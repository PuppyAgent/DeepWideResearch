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
        _supabase_rest_patch(f"/rest/v1/profiles?user_id=eq.{user_id}", {"plan": plan})
    except Exception:
        pass

def find_user_by_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    try:
        resp = _supabase_rest_get("/rest/v1/profiles", params={"email": f"eq.{email}", "select": "user_id"})
        if resp.ok:
            arr = resp.json()
            if isinstance(arr, list) and arr:
                uid = arr[0].get("user_id")
                return str(uid) if uid else None
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
    ]
    sig = None
    for name in possible_header_names:
        sig = req.headers.get(name)
        if sig:
            break
    if not sig:
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

    # Compute digests
    mac = hmac.new(POLAR_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256)
    digest_hex = mac.hexdigest()
    digest_bytes = mac.digest()
    digest_b64_std = base64.b64encode(digest_bytes).decode("utf-8").strip()
    digest_b64_url = base64.urlsafe_b64encode(digest_bytes).decode("utf-8").strip().rstrip("=")

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

    if POLAR_WEBHOOK_DEBUG and not valid:
        logger.warning(
            "[polar_signature] mismatch: header=%s hex=%s b64=%s b64url=%s",
            header_sig_raw[:64], digest_hex[:64], digest_b64_std[:64], digest_b64_url[:64]
        )

    if not valid:

        raise HTTPException(status_code=403, detail="Invalid webhook signature")


