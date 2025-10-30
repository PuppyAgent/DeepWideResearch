# Payments Service

Independent service for handling payment webhooks and credit grants, writing to Supabase.

## Endpoints
- `GET /health` – health check
- `POST /api/polar/webhook` – Polar webhook (HMAC-SHA256 via `Polar-Webhook-Signature`)
- `POST /api/polar/checkout/success` – Client fallback to grant credits on successful checkout redirect

## Env
See `env.example` for variables. Required basics:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL` (or `SUPABASE_JWT_SECRET`)
- `ALLOWED_ORIGINS`
- `POLAR_WEBHOOK_SECRET`
- `POLAR_PLAN_CREDITS_JSON` or `POLAR_PLUS_CREDITS`/`POLAR_PRO_CREDITS`

## Run locally (no Docker)
```bash
cd payments
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Put your envs into payments/.env (see env.example)
# Start from inside the payments folder
uvicorn server:app --host 0.0.0.0 --port 8100 --log-level info

# Alternatively, from repo root:
# uvicorn payments.server:app --host 0.0.0.0 --port 8100 --log-level info
```

## Docker (optional)
If you prefer containers, you can still use Docker. Not required for local runs.
```bash
docker build -t payments-service ./payments
docker run -p 8100:8100 --env-file ./payments/env.example payments-service
```

## Frontend
- Set `NEXT_PUBLIC_PAYMENTS_API_URL` to your payments service URL.
- Success URL from Polar should redirect to your frontend with `?success=1` so the UI triggers a fallback credit grant.
