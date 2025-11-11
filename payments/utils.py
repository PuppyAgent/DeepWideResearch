from typing import Optional, Dict, Any
import os
import time
import json
import requests
import hashlib
import hmac
import base64
import logging
from datetime import datetime, timezone

from jose import jwt
from fastapi import HTTPException, Request
from dotenv import load_dotenv

# Load env (payments-level .env only; optional override via PAYMENTS_ENV_FILE)
try:
    from pathlib import Path
    load_dotenv(dotenv_path=Path(__file__).parent / '.env', override=False)
    env_override = os.getenv("PAYMENTS_ENV_FILE")
    if env_override:
        load_dotenv(dotenv_path=env_override, override=False)
except Exception:
    pass

logger = logging.getLogger(__name__)

# ===================== Supabase Auth & DB Helpers =====================
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_JWKS_URL = os.getenv("SUPABASE_JWKS_URL") or (
    f"{SUPABASE_URL.rstrip('/')}/auth/v1/keys" if SUPABASE_URL else None
)
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

_jwks_cache: Optional[Dict[str, Any]] = None
# ===================== Polar REST Helpers =====================
POLAR_ACCESS_TOKEN = os.getenv("POLAR_ACCESS_TOKEN")
POLAR_API_BASE = os.getenv("POLAR_API_BASE") or "https://api.polar.sh"

def _mask_token(value: Optional[str]) -> str:
    if not value:
        return "None"
    try:
        n = len(value)
        if n <= 8:
            return (value[:2] + "***" + value[-2:]) if n >= 4 else "***"
        return value[:4] + "..." + value[-4:]
    except Exception:
        return "***"

try:
    msg = f"[payments] POLAR_ACCESS_TOKEN (masked) = {_mask_token(POLAR_ACCESS_TOKEN)}"
    print(msg)
    logger.info(msg)
except Exception:
    ...

def _polar_sdk_client():
    try:
        from polar_sdk import Polar  # type: ignore
        if not POLAR_ACCESS_TOKEN:
            return None
        # Try to honor custom base URL if provided (e.g., sandbox)
        base = POLAR_API_BASE
        try:
            return Polar(access_token=POLAR_ACCESS_TOKEN, server_url=base)  # type: ignore[call-arg]
        except TypeError:
            try:
                return Polar(access_token=POLAR_ACCESS_TOKEN, server=base)  # type: ignore[call-arg]
            except TypeError:
                return Polar(access_token=POLAR_ACCESS_TOKEN)
    except Exception:
        return None

def polar_get_customer_by_email(email: str, timeout: int = 8) -> Optional[str]:
    try:
        # SDK method signature compatibility varies; for our simplified flow we don't require this lookup.
        return None
    except Exception:
        return None

def polar_list_active_subscriptions(customer_id: str, timeout: int = 8) -> Dict[str, Any]:
    try:
        client = _polar_sdk_client()
        if client is None:
            raise HTTPException(status_code=500, detail="Server misconfigured: Polar SDK not available")
        with client as polar:
            res = polar.subscriptions.list(request={"customer_id": customer_id, "status": "active"})  # type: ignore[attr-defined]
        items = None
        try:
            items = getattr(res, "items", None)  # type: ignore[attr-defined]
        except Exception:
            items = None
        if items is None and isinstance(res, dict):
            items = res.get("items")
        if isinstance(items, list):
            return {"items": items}
        return {"items": []}
    except HTTPException:
        raise
    except Exception:
        try:
            logger.exception("polar_list_active_subscriptions (sdk): error")
        except Exception:
            ...
        return {"items": []}

def polar_update_subscription_product(subscription_id: str, product_id: str, timeout: int = 10) -> bool:
    """Update a subscription to a new product via Polar SDK (product-only)."""
    try:
        client = _polar_sdk_client()
        if client is None:
            raise HTTPException(status_code=500, detail="Server misconfigured: Polar SDK not available")
        with client as polar:
            res = polar.subscriptions.update(  # type: ignore[attr-defined]
                subscription_id=subscription_id,
                request={"product_id": product_id, "proration_behavior": "immediate"},
            )
        return True if res is not None else False
    except HTTPException:
        raise
    except Exception:
        try:
            logger.exception("polar_update_subscription_product (sdk): error")
        except Exception:
            ...
        return False

def polar_cancel_subscription(subscription_id: str, at_period_end: bool = False, timeout: int = 10) -> bool:
    try:
        client = _polar_sdk_client()
        if client is None:
            raise HTTPException(status_code=500, detail="Server misconfigured: Polar SDK not available")
        with client as polar:
            res = polar.subscriptions.cancel(  # type: ignore[attr-defined]
                subscription_id=subscription_id,
                request={"at_period_end": bool(at_period_end)},
            )
        return True if res is not None else False
    except HTTPException:
        raise
    except Exception:
        try:
            logger.exception("polar_cancel_subscription (sdk): error")
        except Exception:
            ...
        return False

def polar_create_checkout(product_id: str, customer_email: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None, success_url: Optional[str] = None, timeout: int = 10) -> Optional[str]:
    try:
        client = _polar_sdk_client()
        if client is None:
            raise HTTPException(status_code=500, detail="Server misconfigured: Polar SDK not available")
        req: Dict[str, Any] = {}
        req["products"] = [product_id]
        if customer_email:
            req["customer_email"] = customer_email
        if metadata:
            req["metadata"] = metadata
        if success_url:
            req["success_url"] = success_url
        with client as polar:
            res = polar.checkouts.create(request=req)  # type: ignore[attr-defined]
        url = None
        try:
            url = getattr(res, "url", None)
        except Exception:
            url = None
        if not url and isinstance(res, dict):
            url = res.get("url") or res.get("checkout_url")
        if not url:
            raise HTTPException(status_code=502, detail="Failed to create checkout URL via Polar SDK")
        return str(url)
    except HTTPException:
        raise
    except Exception:
        try:
            logger.exception("polar_create_checkout (sdk) error")
        except Exception:
            ...
        raise HTTPException(status_code=502, detail="Polar SDK checkout failed")

def get_email_by_user_id(user_id: str) -> Optional[str]:
    # Try profiles table first
    try:
        resp = _supabase_rest_get("/rest/v1/profiles", params={"user_id": f"eq.{user_id}", "select": "email", "limit": "1"})
        if getattr(resp, "ok", False):
            arr = resp.json()
            if isinstance(arr, list) and arr:
                email = arr[0].get("email")
                if email:
                    return str(email)
    except Exception:
        try:
            logger.exception("get_email_by_user_id: profiles lookup error")
        except Exception:
            ...
    # Fallback to admin users
    try:
        if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
            url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{user_id}"
            headers = {
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            }
            resp2 = requests.get(url, headers=headers, timeout=6)
            if getattr(resp2, "ok", False):
                data = resp2.json()
                email = data.get("email") if isinstance(data, dict) else None
                return str(email) if email else None
    except Exception:
        try:
            logger.exception("get_email_by_user_id: admin lookup error")
        except Exception:
            ...
    return None

def get_profile_plan(user_id: str) -> Optional[str]:
    """Fetch current plan from Supabase profiles by user_id."""
    try:
        resp = _supabase_rest_get("/rest/v1/profiles", params={"user_id": f"eq.{user_id}", "select": "plan", "limit": "1"})
        if getattr(resp, "ok", False):
            arr = resp.json()
            if isinstance(arr, list) and arr:
                plan = arr[0].get("plan")
                return str(plan).lower() if plan else None
    except Exception:
        try:
            logger.exception("get_profile_plan: profiles lookup error")
        except Exception:
            ...
    return None

def _supabase_auth_headers() -> Dict[str, str]:
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_SERVICE_ROLE_KEY not set")
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

def _supabase_rest_get(path: str, params: Optional[Dict[str, str]] = None, timeout: int = 5):
    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_URL not set")
    url = f"{SUPABASE_URL.rstrip('/')}{path}"
    return requests.get(url, headers=_supabase_auth_headers(), params=params, timeout=timeout)

def _supabase_rest_patch(path: str, json_body: Dict[str, Any], timeout: int = 5):
    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_URL not set")
    url = f"{SUPABASE_URL.rstrip('/')}{path}"
    headers = _supabase_auth_headers()
    headers["Prefer"] = "return=representation"
    return requests.patch(url, headers=headers, json=json_body, timeout=timeout)

def _supabase_rest_post(path: str, json_body: Dict[str, Any], timeout: int = 5):
    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_URL not set")
    url = f"{SUPABASE_URL.rstrip('/')}{path}"
    headers = _supabase_auth_headers()
    headers["Prefer"] = "return=representation"
    return requests.post(url, headers=headers, json=json_body, timeout=timeout)

def _get_jwks() -> Dict[str, Any]:
    global _jwks_cache
    if _jwks_cache is None:
        if not SUPABASE_JWKS_URL:
            raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_JWKS_URL not set")
        resp = requests.get(SUPABASE_JWKS_URL, timeout=5)
        if not resp.ok:
            try:
                logger.warning("_get_jwks: fetch failed status=%s body=%s", getattr(resp, "status_code", None), getattr(resp, "text", ""))
            except Exception:
                ...
            raise HTTPException(status_code=500, detail=f"Failed to fetch JWKS: {resp.text}")
        _jwks_cache = resp.json()
    return _jwks_cache

def verify_supabase_jwt(authorization_header: Optional[str]) -> str:
    if not authorization_header or not authorization_header.lower().startswith("bearer "):
        try:
            logger.exception("verify_supabase_jwt: missing/invalid Authorization header")
        except Exception:
            ...
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization_header.split(" ", 1)[1].strip()
    try:
        headers = jwt.get_unverified_header(token)
    except Exception:
        try:
            logger.exception("verify_supabase_jwt: invalid token header")
        except Exception:
            ...
        raise HTTPException(status_code=401, detail="Invalid token header")

    alg = (headers.get("alg") or "").upper()
    if alg.startswith("HS"):
        if not SUPABASE_JWT_SECRET:
            raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_JWT_SECRET not set for HS tokens")
        try:
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256", "HS512"], options={"verify_aud": False})
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid token payload")
            return user_id
        except HTTPException:
            raise
        except Exception as e:
            try:
                logger.exception("verify_supabase_jwt: HS decode error")
            except Exception:
                ...
            raise HTTPException(status_code=401, detail=f"Token verification failed (HS): {str(e)}")

    jwks = _get_jwks()
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == headers.get("kid")), None)
    if key is None:
        global _jwks_cache
        _jwks_cache = None
        jwks = _get_jwks()
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == headers.get("kid")), None)
        if key is None:
            raise HTTPException(status_code=401, detail="JWKS key not found")

    rsa_key = {"kty": key["kty"], "kid": key["kid"], "use": key.get("use", "sig"), "n": key["n"], "e": key["e"]}
    try:
        payload = jwt.decode(token, rsa_key, algorithms=["RS256", "RS512"], options={"verify_aud": False})
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        try:
            logger.exception("verify_supabase_jwt: RS decode error")
        except Exception:
            ...
        raise HTTPException(status_code=401, detail=f"Token verification failed (RS): {str(e)}")


# ===================== Credits & Subscription Helpers =====================
def grant_credits(user_id: str, units: int, request_id: str, meta: Dict[str, Any]) -> int:
    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_URL not set")
    url = f"{SUPABASE_URL}/rest/v1/rpc/sp_grant_credits"
    payload = {"p_user_id": user_id, "p_units": units, "p_request_id": request_id, "p_meta": meta or {}}
    resp = requests.post(url, headers=_supabase_auth_headers(), json=payload, timeout=10)
    if not resp.ok:
        try:
            logger.warning("grant_credits: rpc error status=%s body=%s", getattr(resp, "status_code", None), getattr(resp, "text", ""))
        except Exception:
            ...
        raise HTTPException(status_code=500, detail=f"Supabase grant error: {resp.text}")
    try:
        return int(resp.json())
    except Exception:
        return 0

def revoke_credits(user_id: str, units: int, request_id: str, meta: Dict[str, Any]) -> int:
    neg_units = -abs(int(units or 0))
    return grant_credits(user_id=user_id, units=neg_units, request_id=request_id, meta=meta)

def update_subscription(user_id: str, provider: str, status: Optional[str], current_period_end: Optional[str], metadata: Dict[str, Any]) -> None:
    try:
        resp = _supabase_rest_get(
            "/rest/v1/subscriptions",
            params={"user_id": f"eq.{user_id}", "provider": f"eq.{provider}", "select": "id", "limit": "1"},
        )
        if resp.ok and isinstance(resp.json(), list) and resp.json():
            sub_id = resp.json()[0].get("id")
            if sub_id:
                _supabase_rest_patch(
                    f"/rest/v1/subscriptions?id=eq.{sub_id}",
                    {"status": status, "current_period_end": current_period_end, "metadata": metadata or {}},
                )
                return
        _supabase_rest_post(
            "/rest/v1/subscriptions",
            {"user_id": user_id, "provider": provider, "status": status or "active", "current_period_end": current_period_end, "metadata": metadata or {}},
        )
    except Exception as e:
        logger.warning(f"Failed to upsert subscription: {e}")

def get_active_polar_subscription_id(user_id: str) -> Optional[str]:
    """Fetch active Polar subscription_id for a user from Supabase subscriptions table."""
    try:
        resp = _supabase_rest_get(
            "/rest/v1/subscriptions",
            params={
                "user_id": f"eq.{user_id}",
                "provider": "eq.polar",
                "status": "eq.active",
                "select": "metadata",
                "limit": "1",
            },
        )
        if getattr(resp, "ok", False):
            arr = resp.json()
            if isinstance(arr, list) and arr:
                meta = arr[0].get("metadata") or {}
                if isinstance(meta, str):
                    try:
                        meta = json.loads(meta)
                    except Exception:
                        meta = {}
                sub_id = None
                if isinstance(meta, dict):
                    sub_id = meta.get("subscription_id") or (meta.get("subscription") or {}).get("id")
                return str(sub_id) if sub_id else None
    except Exception:
        try:
            logger.exception("get_active_polar_subscription_id: error")
        except Exception:
            ...
    return None
def update_profile_plan(user_id: str, plan: str) -> None:
    try:
        try:
            logger.info("update_profile_plan: start user_id=%s plan=%s", user_id, plan)
        except Exception:
            ...
        # Try profiles.user_id first
        resp = _supabase_rest_patch(f"/rest/v1/profiles?user_id=eq.{user_id}", {"plan": plan})
        try:
            logger.info(
                "update_profile_plan: patch by user_id resp_ok=%s status=%s",
                getattr(resp, "ok", None), getattr(resp, "status_code", None)
            )
        except Exception:
            ...
        if resp is not None and not getattr(resp, "ok", False):
            try:
                logger.warning("update_profile_plan: user_id filter patch failed status=%s body=%s", getattr(resp, "status_code", None), getattr(resp, "text", ""))
            except Exception:
                ...
        applied = False
        if resp is not None and getattr(resp, "ok", False):
            try:
                body = resp.json()
                if isinstance(body, list) and len(body) > 0:
                    applied = True
                try:
                    logger.info("update_profile_plan: patch by user_id returned %s row(s)", len(body) if isinstance(body, list) else None)
                except Exception:
                    ...
            except Exception:
                # If representation not returned, assume applied
                applied = True
        try:
            logger.info("update_profile_plan: applied_by_user_id=%s", applied)
        except Exception:
            ...
        if not applied:
            # Fallback to profiles.id (many Supabase setups use id as auth uid)
            resp2 = _supabase_rest_patch(f"/rest/v1/profiles?id=eq.{user_id}", {"plan": plan})
            try:
                logger.info(
                    "update_profile_plan: patch by id resp_ok=%s status=%s",
                    getattr(resp2, "ok", None), getattr(resp2, "status_code", None)
                )
            except Exception:
                ...
            if resp2 is not None and not getattr(resp2, "ok", False):
                try:
                    logger.warning("update_profile_plan: id filter patch failed status=%s body=%s", getattr(resp2, "status_code", None), getattr(resp2, "text", ""))
                except Exception:
                    ...
    except Exception:
        try:
            logger.exception("update_profile_plan: unexpected error")
        except Exception:
            ...

def update_profile_plan_by_email(email: str, plan: str) -> None:
    if not email:
        return
    try:
        try:
            logger.info("update_profile_plan_by_email: start email=%s plan=%s", email, plan)
        except Exception:
            ...
        resp = _supabase_rest_patch(f"/rest/v1/profiles?email=eq.{email}", {"plan": plan})
        try:
            logger.info(
                "update_profile_plan_by_email: patch by email resp_ok=%s status=%s",
                getattr(resp, "ok", None), getattr(resp, "status_code", None)
            )
        except Exception:
            ...
        if resp is not None and not getattr(resp, "ok", False):
            try:
                logger.warning("update_profile_plan_by_email: email filter patch failed status=%s body=%s", getattr(resp, "status_code", None), getattr(resp, "text", ""))
            except Exception:
                ...
        applied = False
        if resp is not None and getattr(resp, "ok", False):
            try:
                body = resp.json()
                if isinstance(body, list) and len(body) > 0:
                    applied = True
                try:
                    logger.info("update_profile_plan_by_email: patch by email returned %s row(s)", len(body) if isinstance(body, list) else None)
                except Exception:
                    ...
            except Exception:
                applied = True
        try:
            logger.info("update_profile_plan_by_email: applied_by_email=%s", applied)
        except Exception:
            ...
        if not applied:
            # Fallback: resolve user_id by email and try user_id update; if still not applied, upsert
            try:
                uid = find_user_by_email(email)
            except Exception:
                uid = None
            try:
                logger.info("update_profile_plan_by_email: resolved uid=%s from email", uid)
            except Exception:
                ...
            if uid:
                # Try user_id-based patch
                update_profile_plan(uid, plan)
                # Attempt to upsert profile row if it still does not exist
                try:
                    resp_upsert = _supabase_rest_post(
                        "/rest/v1/profiles?on_conflict=user_id",
                        {"user_id": uid, "email": email, "plan": plan},
                    )
                    try:
                        logger.info(
                            "update_profile_plan_by_email: upsert resp_ok=%s status=%s",
                            getattr(resp_upsert, "ok", None), getattr(resp_upsert, "status_code", None)
                        )
                    except Exception:
                        ...
                except Exception:
                    ...
        # Post-check: read back plan snapshot for this email
        try:
            snap = _supabase_rest_get("/rest/v1/profiles", params={"email": f"eq.{email}", "select": "user_id,email,plan"})
            if getattr(snap, "ok", False):
                try:
                    logger.info("update_profile_plan_by_email: post_check rows=%s body=%s", "?", snap.text[:256])
                except Exception:
                    ...
        except Exception:
            ...
    except Exception:
        try:
            logger.exception("update_profile_plan_by_email: unexpected error")
        except Exception:
            ...

def find_user_by_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    try:
        # 1) Try profiles table (if it stores email)
        resp = _supabase_rest_get("/rest/v1/profiles", params={"email": f"eq.{email}", "select": "user_id"})
        if resp.ok:
            arr = resp.json()
            if isinstance(arr, list) and arr:
                uid = arr[0].get("user_id")
                if uid:
                    return str(uid)
    except Exception:
        try:
            logger.exception("find_user_by_email: profiles lookup error")
        except Exception:
            ...
    # 2) Fallback: Supabase Auth admin – find user by email
    try:
        if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
            url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/admin/users"
            headers = {
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            }
            resp2 = requests.get(url, headers=headers, params={"email": email}, timeout=5)
            if resp2.ok:
                data = resp2.json()
                users = data.get("users") if isinstance(data, dict) else (data if isinstance(data, list) else [])
                if isinstance(users, list) and users:
                    uid = users[0].get("id")
                    if uid:
                        return str(uid)
    except Exception:
        try:
            logger.exception("find_user_by_email: admin lookup error")
        except Exception:
            ...
        return None
    return None


# ===================== Plan → Credits Mapping =====================
POLAR_PLAN_CREDITS_URL = os.getenv("POLAR_PLAN_CREDITS_URL")
POLAR_PLAN_CREDITS_JSON = os.getenv("POLAR_PLAN_CREDITS_JSON", "{}")
POLAR_PLAN_CREDITS_TTL_SEC = int(os.getenv("POLAR_PLAN_CREDITS_TTL_SEC", "300"))
_plan_credits_cache: Dict[str, Any] = {"data": {}, "last_fetch": 0.0}

POLAR_PLUS_CREDITS_DEFAULT = int(os.getenv("POLAR_PLUS_CREDITS", "2000"))
POLAR_PRO_CREDITS_DEFAULT = int(os.getenv("POLAR_PRO_CREDITS", "15000"))

def _parse_plan_credits_json(text: str) -> Dict[str, int]:
    try:
        data = json.loads(text or "{}")
        out: Dict[str, int] = {}
        if isinstance(data, dict):
            for k, v in data.items():
                try:
                    out[str(k)] = int(v)
                except Exception:
                    continue
        return out
    except Exception:
        return {}

def _load_plan_credits_mapping(force: bool = False) -> Dict[str, int]:
    now = time.time()
    if POLAR_PLAN_CREDITS_URL:
        if force or (now - float(_plan_credits_cache.get("last_fetch", 0.0)) > POLAR_PLAN_CREDITS_TTL_SEC):
            try:
                resp = requests.get(POLAR_PLAN_CREDITS_URL, timeout=5)
                if resp.ok:
                    _plan_credits_cache["data"] = _parse_plan_credits_json(resp.text)
                    _plan_credits_cache["last_fetch"] = now
                else:
                    _plan_credits_cache["data"] = _parse_plan_credits_json(POLAR_PLAN_CREDITS_JSON)
                    _plan_credits_cache["last_fetch"] = now
            except Exception:
                _plan_credits_cache["data"] = _parse_plan_credits_json(POLAR_PLAN_CREDITS_JSON)
                _plan_credits_cache["last_fetch"] = now
        return _plan_credits_cache.get("data", {})
    return _parse_plan_credits_json(POLAR_PLAN_CREDITS_JSON)

def resolve_plan_credits(product_id: Optional[str] = None) -> Optional[int]:
    mapping = _load_plan_credits_mapping()
    if not mapping:
        return None
    if product_id and product_id in mapping:
        return mapping[product_id]
    return None

def determine_units_for_purchase(product_id: Optional[str], plan_hint: Optional[str]) -> int:
    units = resolve_plan_credits(product_id=product_id)
    if isinstance(units, int) and units > 0:
        return units
    plan = (plan_hint or "").strip().lower()
    if plan == "pro":
        return POLAR_PRO_CREDITS_DEFAULT
    if plan == "plus":
        return POLAR_PLUS_CREDITS_DEFAULT
    return POLAR_PLUS_CREDITS_DEFAULT


# ===================== Webhook Signature =====================
POLAR_WEBHOOK_SECRET = os.getenv("POLAR_WEBHOOK_SECRET")
POLAR_WEBHOOK_DEBUG = os.getenv("POLAR_WEBHOOK_DEBUG", "0") not in ("0", "false", "False")

def verify_polar_signature(req: Request, raw_body: bytes) -> None:
    """Minimal verification:
    - Require 'Webhook-Signature' header with format 'v1=<base64(hmac_sha256(ts + "." + body))>'
    - Require 'Webhook-Timestamp' header within 300s window
    """
    if not POLAR_WEBHOOK_SECRET:
        return
    sig = req.headers.get("Webhook-Signature")
    ts = req.headers.get("Webhook-Timestamp")
    if not sig or not ts:
        raise HTTPException(status_code=403, detail="Missing webhook signature or timestamp")
    provided = sig.strip().strip('"\'')
    if provided.startswith("v1="):
        provided = provided[3:].strip()
    elif provided.startswith("v1,"):
        provided = provided[3:].strip()
    # Timestamp window check (±300s)
    try:
        ts_val = int(str(ts).strip())
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid webhook timestamp")
    now = int(datetime.now(timezone.utc).timestamp())
    if abs(now - ts_val) > 300:
        raise HTTPException(status_code=403, detail="Stale webhook timestamp")
    # Compute expected signature
    msg = (str(ts_val).encode("utf-8")) + b"." + (raw_body or b"")
    digest = hmac.new(POLAR_WEBHOOK_SECRET.encode("utf-8"), msg, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode("utf-8").strip()
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=403, detail="Invalid webhook signature")


