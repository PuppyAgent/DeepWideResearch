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

def _polar_headers() -> Dict[str, str]:
    if not POLAR_ACCESS_TOKEN:
        raise HTTPException(status_code=500, detail="Server misconfigured: POLAR_ACCESS_TOKEN not set")
    return {
        "Authorization": f"Bearer {POLAR_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

def _polar_request(method: str, path: str, *, params: Optional[Dict[str, Any]] = None, json_body: Optional[Dict[str, Any]] = None, timeout: int = 8):
    """Perform a Polar API request with DNS fallback.
    If POLAR_API_BASE points to sandbox and DNS fails, retry once against production base.
    """
    base = (POLAR_API_BASE or "https://api.polar.sh").rstrip('/')
    url = f"{base}{path}"
    try:
        return requests.request(method.upper(), url, headers=_polar_headers(), params=params, json=json_body, timeout=timeout)
    except requests.exceptions.RequestException as e:
        # DNS failover only when sandbox base is used
        try:
            is_dns = any(kw in str(e) for kw in ("NameResolutionError", "Failed to resolve", "gaierror"))
            if is_dns and ("sandbox" in base):
                try:
                    logger.warning("polar_request: DNS failed for sandbox, retrying with production base")
                except Exception:
                    ...
                fallback_base = "https://api.polar.sh"
                url2 = f"{fallback_base}{path}"
                return requests.request(method.upper(), url2, headers=_polar_headers(), params=params, json=json_body, timeout=timeout)
        except Exception:
            ...
        raise

def _polar_sdk_client():
    try:
        from polar_sdk import Polar  # type: ignore
        if not POLAR_ACCESS_TOKEN:
            return None
        return Polar(access_token=POLAR_ACCESS_TOKEN)
    except Exception:
        return None

def polar_get_customer_by_email(email: str, timeout: int = 8) -> Optional[str]:
    try:
        resp = _polar_request("GET", "/v1/customers", params={"email": email}, timeout=timeout)
        if not resp.ok:
            try:
                logger.warning("polar_get_customer_by_email: status=%s body=%s", getattr(resp, "status_code", None), getattr(resp, "text", ""))
            except Exception:
                ...
            return None
        data = resp.json()
        # Accept either {items:[{id:...}]} or list
        items = data.get("items") if isinstance(data, dict) else (data if isinstance(data, list) else [])
        if isinstance(items, list) and items:
            cid = items[0].get("id")
            return str(cid) if cid else None
    except Exception:
        try:
            logger.exception("polar_get_customer_by_email: error")
        except Exception:
            ...
    return None

def polar_list_active_subscriptions(customer_id: str, timeout: int = 8) -> Dict[str, Any]:
    try:
        resp = _polar_request("GET", "/v1/subscriptions", params={"customer_id": customer_id, "status": "active"}, timeout=timeout)
        if not resp.ok:
            try:
                logger.warning("polar_list_active_subscriptions: status=%s body=%s", getattr(resp, "status_code", None), getattr(resp, "text", ""))
            except Exception:
                ...
            return {"items": []}
        data = resp.json()
        return data if isinstance(data, dict) else {"items": data if isinstance(data, list) else []}
    except Exception:
        try:
            logger.exception("polar_list_active_subscriptions: error")
        except Exception:
            ...
        return {"items": []}

def polar_update_subscription_price(subscription_id: str, price_id: Optional[str] = None, product_id: Optional[str] = None, timeout: int = 10) -> bool:
    try:
        payload: Dict[str, Any] = {}
        if price_id:
            payload["price_id"] = price_id
        if product_id:
            payload["product_id"] = product_id
        if not payload:
            return False
        resp = _polar_request("POST", f"/v1/subscriptions/{subscription_id}/update", json_body=payload, timeout=timeout)
        ok = bool(getattr(resp, "ok", False))
        if not ok:
            try:
                logger.warning("polar_update_subscription_price: status=%s body=%s", getattr(resp, "status_code", None), getattr(resp, "text", ""))
            except Exception:
                ...
        return ok
    except Exception:
        try:
            logger.exception("polar_update_subscription_price: error")
        except Exception:
            ...
        return False

def polar_cancel_subscription(subscription_id: str, at_period_end: bool = False, timeout: int = 10) -> bool:
    try:
        payload = {"at_period_end": bool(at_period_end)}
        resp = _polar_request("POST", f"/v1/subscriptions/{subscription_id}/cancel", json_body=payload, timeout=timeout)
        ok = bool(getattr(resp, "ok", False))
        if not ok:
            try:
                logger.warning("polar_cancel_subscription: status=%s body=%s", getattr(resp, "status_code", None), getattr(resp, "text", ""))
            except Exception:
                ...
        return ok
    except Exception:
        try:
            logger.exception("polar_cancel_subscription: error")
        except Exception:
            ...
        return False

def polar_create_checkout(product_id: Optional[str] = None, price_id: Optional[str] = None, customer_email: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None, success_url: Optional[str] = None, timeout: int = 10) -> Optional[str]:
    try:
        # Prefer official SDK if available
        client = _polar_sdk_client()
        if client is not None:
            try:
                req: Dict[str, Any] = {}
                if product_id:
                    req["products"] = [product_id]
                if price_id:
                    # Some SDKs accept prices list; fall back to products elsewhere
                    req["prices"] = [price_id]
                if customer_email:
                    req["customer_email"] = customer_email
                if metadata:
                    req["metadata"] = metadata
                if success_url:
                    req["success_url"] = success_url
                with client as polar:
                    res = polar.checkouts.create(request=req)  # type: ignore[attr-defined]
                # Try common access patterns
                url = None
                try:
                    url = getattr(res, "url", None)
                except Exception:
                    url = None
                if not url and isinstance(res, dict):
                    url = res.get("url") or res.get("checkout_url")
                if url:
                    return str(url)
            except Exception:
                try:
                    logger.warning("polar_create_checkout (sdk) failed; falling back to REST")
                except Exception:
                    ...
        payload: Dict[str, Any] = {}
        if product_id:
            payload["product_id"] = product_id
        if price_id:
            payload["price_id"] = price_id
        if customer_email:
            payload["customer_email"] = customer_email
        if metadata:
            payload["metadata"] = metadata
        if success_url:
            payload["success_url"] = success_url
        resp = _polar_request("POST", "/v1/checkouts", json_body=payload, timeout=timeout)
        if not getattr(resp, "ok", False):
            try:
                logger.warning("polar_create_checkout: status=%s body=%s", getattr(resp, "status_code", None), getattr(resp, "text", ""))
            except Exception:
                ...
            return None
        data = resp.json()
        # Accept 'url' or 'checkout_url'
        checkout_url = (data.get("url") or data.get("checkout_url")) if isinstance(data, dict) else None
        return str(checkout_url) if checkout_url else None
    except Exception:
        try:
            logger.exception("polar_create_checkout: error")
        except Exception:
            ...
        return None

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

def resolve_plan_credits(product_id: Optional[str] = None, price_id: Optional[str] = None) -> Optional[int]:
    mapping = _load_plan_credits_mapping()
    if not mapping:
        return None
    if price_id:
        if price_id in mapping:
            return mapping[price_id]
        ns_key = f"price:{price_id}"
        if ns_key in mapping:
            return mapping[ns_key]
    if product_id and product_id in mapping:
        return mapping[product_id]
    return None

def determine_units_for_purchase(product_id: Optional[str], price_id: Optional[str], plan_hint: Optional[str]) -> int:
    units = resolve_plan_credits(product_id=product_id, price_id=price_id)
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
    if not POLAR_WEBHOOK_SECRET:
        return
    # Accept multiple possible header names used by providers / proxies
    possible_header_names = [
        "Polar-Webhook-Signature",
        "polar-webhook-signature",
        "POLAR-WEBHOOK-SIGNATURE",
        "Polar-Signature",
        "polar-signature",
        "POLAR-SIGNATURE",
        "X-Polar-Signature",
        "x-polar-signature",
        "X-POLAR-SIGNATURE",
        "webhook-signature",
    ]
    sig = None
    used_header_name = None
    for name in possible_header_names:
        sig = req.headers.get(name)
        if sig:
            used_header_name = name
            break
    if not sig:
        if POLAR_WEBHOOK_DEBUG:
            try:
                logger.warning("[polar_signature] header not found. Incoming headers: %s", dict(req.headers))
            except Exception:
                pass
        raise HTTPException(status_code=403, detail="Missing Polar signature header")

    # Normalize candidate signature
    header_sig_raw = sig.strip().strip('"\'')
    header_sig_lower = header_sig_raw.lower()
    # Support formats like "sha256=abcdef..."
    if "=" in header_sig_lower:
        parts = header_sig_lower.split("=", 1)
        if len(parts) == 2 and parts[1]:
            header_sig_lower = parts[1]
            header_sig_raw = parts[1]

    # Compute digests (legacy over raw body)
    mac = hmac.new(POLAR_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256)
    digest_hex = mac.hexdigest()
    digest_bytes = mac.digest()
    digest_b64_std = base64.b64encode(digest_bytes).decode("utf-8").strip()
    digest_b64_url = base64.urlsafe_b64encode(digest_bytes).decode("utf-8").strip().rstrip("=")

    # Compute digests with timestamp scheme(s)
    ts = req.headers.get("webhook-timestamp") or req.headers.get("Webhook-Timestamp")
    wid = req.headers.get("webhook-id") or req.headers.get("Webhook-Id")
    digest_ts_b64_std = None
    digest_ts_b64_url = None
    digest_idts_b64_std = None
    digest_idts_b64_url = None
    digest_tsid_b64_std = None
    digest_tsid_b64_url = None
    if ts is not None:
        try:
            msg1 = (str(ts).strip()).encode("utf-8") + b"." + (raw_body or b"")
            mac_ts = hmac.new(POLAR_WEBHOOK_SECRET.encode("utf-8"), msg1, hashlib.sha256)
            digest_ts_b64_std = base64.b64encode(mac_ts.digest()).decode("utf-8").strip()
            digest_ts_b64_url = base64.urlsafe_b64encode(mac_ts.digest()).decode("utf-8").strip().rstrip("=")
        except Exception:
            digest_ts_b64_std = None
            digest_ts_b64_url = None
        if wid:
            try:
                msg2 = (wid.strip()).encode("utf-8") + b"." + (str(ts).strip()).encode("utf-8") + b"." + (raw_body or b"")
                mac_idts = hmac.new(POLAR_WEBHOOK_SECRET.encode("utf-8"), msg2, hashlib.sha256)
                digest_idts_b64_std = base64.b64encode(mac_idts.digest()).decode("utf-8").strip()
                digest_idts_b64_url = base64.urlsafe_b64encode(mac_idts.digest()).decode("utf-8").strip().rstrip("=")
            except Exception:
                digest_idts_b64_std = None
                digest_idts_b64_url = None
            try:
                msg3 = (str(ts).strip()).encode("utf-8") + b"." + (wid.strip()).encode("utf-8") + b"." + (raw_body or b"")
                mac_tsid = hmac.new(POLAR_WEBHOOK_SECRET.encode("utf-8"), msg3, hashlib.sha256)
                digest_tsid_b64_std = base64.b64encode(mac_tsid.digest()).decode("utf-8").strip()
                digest_tsid_b64_url = base64.urlsafe_b64encode(mac_tsid.digest()).decode("utf-8").strip().rstrip("=")
            except Exception:
                digest_tsid_b64_std = None
                digest_tsid_b64_url = None

    valid = False
    # Accept lowercase hex compare
    if hmac.compare_digest(header_sig_lower, digest_hex):
        valid = True
    # Accept uppercase hex
    if not valid and hmac.compare_digest(header_sig_raw.upper(), digest_hex.upper()):
        valid = True
    # Accept standard base64
    if not valid and hmac.compare_digest(header_sig_raw, digest_b64_std):
        valid = True
    # Accept urlsafe base64 (with and without padding)
    if not valid and (
        hmac.compare_digest(header_sig_raw, digest_b64_url)
        or hmac.compare_digest(header_sig_raw.rstrip("="), digest_b64_std.rstrip("=") )
    ):
        valid = True

    # Accept Polar v1 timestamp scheme in 'webhook-signature': 'v1,<b64>' or 'v1=<b64>'
    if not valid and used_header_name and used_header_name.lower() == "webhook-signature":
        provided = header_sig_raw
        if "," in provided:
            provided = provided.split(",", 1)[1].strip()
        elif "=" in provided:
            provided = provided.split("=", 1)[1].strip()
        # Compare against all timestamp-based candidates
        candidates = [
            digest_ts_b64_std, digest_ts_b64_url,
            digest_idts_b64_std, digest_idts_b64_url,
            digest_tsid_b64_std, digest_tsid_b64_url,
        ]
        for cand in candidates:
            if cand and hmac.compare_digest(provided.rstrip("="), cand.rstrip("=")):
                valid = True
                break

    if POLAR_WEBHOOK_DEBUG and not valid:
        logger.warning(
            "[polar_signature] mismatch: headerName=%s headerVal=%s hex=%s b64=%s b64url=%s ts_b64=%s ts_b64url=%s idts_b64=%s idts_b64url=%s tsid_b64=%s tsid_b64url=%s ts=%s id=%s",
            used_header_name,
            header_sig_raw[:128],
            (digest_hex or '')[:64],
            (digest_b64_std or '')[:64],
            (digest_b64_url or '')[:64],
            (digest_ts_b64_std or '')[:64],
            (digest_ts_b64_url or '')[:64],
            (digest_idts_b64_std or '')[:64],
            (digest_idts_b64_url or '')[:64],
            (digest_tsid_b64_std or '')[:64],
            (digest_tsid_b64_url or '')[:64],
            str(ts),
            str(wid)
        )

    if not valid:
        raise HTTPException(status_code=403, detail="Invalid webhook signature")


