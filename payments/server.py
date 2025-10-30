from pathlib import Path
from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from urllib.parse import urlparse
import os
import logging

from payments.routes.polar_router import build_polar_router
from payments.utils import (
    verify_polar_signature,
    determine_units_for_purchase,
    grant_credits,
    update_subscription,
    update_profile_plan,
    find_user_by_email,
    verify_supabase_jwt,
    POLAR_PRO_CREDITS_DEFAULT,
    POLAR_PLUS_CREDITS_DEFAULT,
)

# Load environment from .env (root then payments folder)
try:
    project_root = Path(__file__).parent.parent
    load_dotenv(dotenv_path=project_root / '.env', override=False)
    load_dotenv(dotenv_path=Path(__file__).parent / '.env', override=False)
except Exception:
    pass

app = FastAPI(title="Payments Service", version="1.0.0")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("payments")

def _normalize_origin(origin: str) -> str:
    if not origin:
        return origin
    s = origin.strip()
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        s = s[1:-1].strip()
    if s.endswith('/'):
        s = s[:-1]
    try:
        parsed = urlparse(s)
        if parsed.scheme and parsed.netloc:
            netloc = parsed.netloc.lower()
            scheme = parsed.scheme.lower()
            rest = parsed._replace(scheme=scheme, netloc=netloc)
            return rest.geturl()
    except Exception:
        pass
    return s

# CORS
is_production = bool(os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RENDER") or os.getenv("VERCEL"))
allowed_origin_regex = None
if is_production:
    allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
    if allowed_origins_env:
        allowed_origins = [_normalize_origin(o.strip()) for o in allowed_origins_env.split(",") if o.strip()]
        allow_all_origins = False
    else:
        raise ValueError("Production but ALLOWED_ORIGINS not set for Payments Service")
    allowed_origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX", None)
else:
    allowed_origins = ["*"]
    allow_all_origins = True
    allowed_origin_regex = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=not allow_all_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

@app.options("/{full_path:path}")
async def options_handler(request: Request, full_path: str):
    origin = request.headers.get("origin") or request.headers.get("Origin")
    req_headers = request.headers.get("access-control-request-headers") or request.headers.get("Access-Control-Request-Headers")
    headers = {
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Max-Age": "3600",
    }
    if allow_all_origins:
        headers["Access-Control-Allow-Origin"] = "*"
        headers["Access-Control-Allow-Headers"] = req_headers or "*"
        return Response(status_code=204, headers=headers)
    headers["Access-Control-Allow-Origin"] = origin or ""
    headers["Vary"] = "Origin"
    headers["Access-Control-Allow-Credentials"] = "true"
    headers["Access-Control-Allow-Headers"] = req_headers or "authorization,content-type"
    return Response(status_code=204, headers=headers)

@app.get("/")
async def root():
    return {"name": "Payments Service", "version": "1.0.0", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Include Polar router
app.include_router(
    build_polar_router(
        verify_polar_signature=verify_polar_signature,
        determine_units_for_purchase=determine_units_for_purchase,
        grant_credits=grant_credits,
        update_subscription=update_subscription,
        update_profile_plan=update_profile_plan,
        find_user_by_email=find_user_by_email,
        verify_supabase_jwt=verify_supabase_jwt,
        pro_default=POLAR_PRO_CREDITS_DEFAULT,
        plus_default=POLAR_PLUS_CREDITS_DEFAULT,
        logger=logger,
    )
)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PAYMENTS_PORT", "8100"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port, log_level="info")


