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
            raise HTTPException(status_code=500, detail=f"Failed to fetch JWKS: {resp.text}")
        _jwks_cache = resp.json()
    return _jwks_cache

def verify_supabase_jwt(authorization_header: Optional[str]) -> str:
    if not authorization_header or not authorization_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization_header.split(" ", 1)[1].strip()
    try:
        headers = jwt.get_unverified_header(token)
    except Exception:
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
        raise HTTPException(status_code=401, detail=f"Token verification failed (RS): {str(e)}")


# ===================== Credits & Subscription Helpers =====================
def grant_credits(user_id: str, units: int, request_id: str, meta: Dict[str, Any]) -> int:
    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_URL not set")
    url = f"{SUPABASE_URL}/rest/v1/rpc/sp_grant_credits"
    payload = {"p_user_id": user_id, "p_units": units, "p_request_id": request_id, "p_meta": meta or {}}
    resp = requests.post(url, headers=_supabase_auth_headers(), json=payload, timeout=10)
    if not resp.ok:
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
        # Try profiles.user_id first
        resp = _supabase_rest_patch(f"/rest/v1/profiles?user_id=eq.{user_id}", {"plan": plan})
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
            except Exception:
                # If representation not returned, assume applied
                applied = True
        if not applied:
            # Fallback to profiles.id (many Supabase setups use id as auth uid)
            resp2 = _supabase_rest_patch(f"/rest/v1/profiles?id=eq.{user_id}", {"plan": plan})
            if resp2 is not None and not getattr(resp2, "ok", False):
                try:
                    logger.warning("update_profile_plan: id filter patch failed status=%s body=%s", getattr(resp2, "status_code", None), getattr(resp2, "text", ""))
                except Exception:
                    ...
    except Exception:
        pass

def update_profile_plan_by_email(email: str, plan: str) -> None:
    if not email:
        return
    try:
        resp = _supabase_rest_patch(f"/rest/v1/profiles?email=eq.{email}", {"plan": plan})
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
            except Exception:
                applied = True
        if not applied:
            # Fallback: resolve user_id by email and reuse user_id-based updater
            try:
                uid = find_user_by_email(email)
            except Exception:
                uid = None
            if uid:
                update_profile_plan(uid, plan)
    except Exception:
        pass

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
        pass
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


