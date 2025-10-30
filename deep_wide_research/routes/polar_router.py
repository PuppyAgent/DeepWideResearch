from typing import Optional, Callable, Dict, Any
import json
import time
import logging

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel


class CheckoutSuccessRequest(BaseModel):
    plan: Optional[str] = None  # 'plus' | 'pro'
    product_id: Optional[str] = None
    price_id: Optional[str] = None


def build_polar_router(
    verify_polar_signature: Callable[[Request, bytes], None],
    determine_units_for_purchase: Callable[[Optional[str], Optional[str], Optional[str]], int],
    grant_credits: Callable[[str, int, str, Dict[str, Any]], int],
    update_subscription: Callable[[str, str, Optional[str], Optional[str], Dict[str, Any]], None],
    update_profile_plan: Callable[[str, str], None],
    find_user_by_email: Callable[[Optional[str]], Optional[str]],
    verify_supabase_jwt: Callable[[Optional[str]], str],
    pro_default: int,
    plus_default: int,
    logger: logging.Logger,
):
    router = APIRouter()

    @router.post("/api/polar/webhook")
    async def polar_webhook(req: Request):
        """Handle Polar webhook events (sandbox/production)."""
        raw = await req.body()
        try:
            verify_polar_signature(req, raw)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=403, detail="Webhook verification failed")

        try:
            payload = json.loads(raw or b"{}")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")

        evt_type = str(payload.get("type") or "").lower()
        data = payload.get("data") or {}
        event_id = str(payload.get("id") or data.get("id") or int(time.time() * 1000))

        # Identify user: prefer metadata.user_id, else email lookup; always extract email for plan updates
        meta = data.get("metadata") or {}
        user_id = meta.get("user_id") or meta.get("supabase_user_id")
        email = (
            (data.get("customer") or {}).get("email")
            or (data.get("buyer") or {}).get("email")
            or data.get("email")
            or payload.get("customerEmail")
            or meta.get("email")
        )

        if not user_id:
            user_id = find_user_by_email(email)

        if not user_id:
            logger.warning("[polar_webhook] User not found for event %s", event_id)
            return {"ok": True, "skipped": True}

        # Payments: only concrete payment confirmations grant credits
        if evt_type in ("order.paid", "invoice.paid"):
            product_id = (
                data.get("product_id")
                or (data.get("product") or {}).get("id")
                or (data.get("price") or {}).get("product_id")
            )
            price_id = data.get("price_id") or (data.get("price") or {}).get("id")
            plan_hint = (data.get("metadata") or {}).get("plan")
            units = determine_units_for_purchase(product_id=product_id, price_id=price_id, plan_hint=plan_hint)
            # Use a canonical transaction identifier across related events to ensure idempotency
            canonical_txn_id = (
                data.get("invoice_id")
                or (data.get("invoice") or {}).get("id")
                or data.get("order_id")
                or (data.get("order") or {}).get("id")
                or data.get("checkout_id")
                or (data.get("checkout") or {}).get("id")
                or data.get("payment_id")
                or data.get("transaction_id")
                or data.get("subscription_id")
                or (data.get("subscription") or {}).get("id")
            )
            rid = f"polar_{canonical_txn_id or event_id}"
            new_balance = grant_credits(
                user_id=user_id,
                units=units,
                request_id=rid,
                meta={
                    "provider": "polar",
                    "event_type": evt_type,
                    "raw": {"id": event_id, "product_id": product_id, "price_id": price_id},
                },
            )

            # Optional: update subscription + plan
            status = (data.get("status") or data.get("state") or "active")
            period_end = data.get("current_period_end") or data.get("period_end") or data.get("current_period_end_at")
            update_subscription(
                user_id=user_id,
                provider="polar",
                status=str(status).lower(),
                current_period_end=period_end,
                metadata={"event_id": event_id, "event_type": evt_type},
            )
            if str(status).lower() in ("active", "paid"):
                plan_for_profile = "pro" if units >= pro_default else ("plus" if units >= plus_default else "free")
                if email:
                    update_profile_plan(email, plan_for_profile)

            return {"ok": True, "user_id": user_id, "granted": units, "balance": new_balance}

        # Refunds: revoke credits idempotently
        if evt_type in ("order.refunded",):
            product_id = (
                data.get("product_id")
                or (data.get("product") or {}).get("id")
                or (data.get("price") or {}).get("product_id")
            )
            price_id = data.get("price_id") or (data.get("price") or {}).get("id")
            plan_hint = (data.get("metadata") or {}).get("plan")
            units = determine_units_for_purchase(product_id=product_id, price_id=price_id, plan_hint=plan_hint)
            canonical_txn_id = (
                data.get("invoice_id")
                or (data.get("invoice") or {}).get("id")
                or data.get("order_id")
                or (data.get("order") or {}).get("id")
                or data.get("checkout_id")
                or (data.get("checkout") or {}).get("id")
                or data.get("payment_id")
                or data.get("transaction_id")
                or data.get("subscription_id")
                or (data.get("subscription") or {}).get("id")
            )
            rid = f"polar_refund_{canonical_txn_id or event_id}"
            new_balance = grant_credits(
                user_id=user_id,
                units= -abs(int(units or 0)),
                request_id=rid,
                meta={
                    "provider": "polar",
                    "event_type": evt_type,
                    "raw": {"id": event_id, "product_id": product_id, "price_id": price_id},
                },
            )
            status = (data.get("status") or data.get("state") or "refunded")
            period_end = data.get("current_period_end") or data.get("period_end") or data.get("current_period_end_at")
            update_subscription(
                user_id=user_id,
                provider="polar",
                status=str(status).lower(),
                current_period_end=period_end,
                metadata={"event_id": event_id, "event_type": evt_type},
            )
            return {"ok": True, "user_id": user_id, "revoked": units, "balance": new_balance}

        # Subscription lifecycle: update status only
        if evt_type.startswith("subscription."):
            status = (data.get("status") or data.get("state") or evt_type.split(".")[-1])
            period_end = data.get("current_period_end") or data.get("period_end") or data.get("current_period_end_at")
            update_subscription(
                user_id=user_id,
                provider="polar",
                status=str(status).lower(),
                current_period_end=period_end,
                metadata={"event_id": event_id, "event_type": evt_type},
            )
            return {"ok": True, "user_id": user_id, "updated": True}

        return {"ok": True}

    @router.post("/api/polar/checkout/success")
    async def polar_checkout_success(body: CheckoutSuccessRequest, req: Request):
        """Grant credits immediately after client returns from successful checkout."""
        try:
            user_id = verify_supabase_jwt(req.headers.get("Authorization"))
        except Exception as e:
            logger.error(f"JWT verification failed on checkout success: {e}")
            raise

        units = determine_units_for_purchase(
            product_id=(body.product_id or None),
            price_id=(body.price_id or None),
            plan_hint=(body.plan or None),
        )

        rid = f"polar_checkout_success_{user_id}_{int(time.time())}"
        new_balance = grant_credits(
            user_id=user_id,
            units=units,
            request_id=rid,
            meta={
                "provider": "polar",
                "source": "checkout_success_endpoint",
                "product_id": body.product_id,
                "price_id": body.price_id,
                "plan": (body.plan or None),
            },
        )

        plan_for_profile = "pro" if units >= pro_default else ("plus" if units >= plus_default else "free")
        update_profile_plan(user_id, plan_for_profile)

        return {"ok": True, "user_id": user_id, "granted": units, "balance": new_balance}

    return router


