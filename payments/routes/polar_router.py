from typing import Optional, Callable, Dict, Any
import os
import json
import time
import logging

from fastapi import APIRouter, Request, HTTPException
from jose import jwt as jose_jwt
from pydantic import BaseModel


class CheckoutSuccessRequest(BaseModel):
    plan: Optional[str] = None  # 'plus' | 'pro'
    product_id: Optional[str] = None

class UpgradeRequest(BaseModel):
    target: str  # 'pro' | 'plus'


def build_polar_router(
    verify_polar_signature: Callable[[Request, bytes], None],
    determine_units_for_purchase: Callable[[Optional[str], Optional[str]], int],
    grant_credits: Callable[[str, int, str, Dict[str, Any]], int],
    update_subscription: Callable[[str, str, Optional[str], Optional[str], Dict[str, Any]], None],
    update_profile_plan: Callable[[str, str], None],  # by user_id
    update_profile_plan_by_email: Callable[[str, str], None],
    find_user_by_email: Callable[[Optional[str]], Optional[str]],
    verify_supabase_jwt: Callable[[Optional[str]], str],
    pro_default: int,
    plus_default: int,
    logger: logging.Logger,
    get_email_by_user_id: Optional[Callable[[str], Optional[str]]] = None,
):
    router = APIRouter()
    DEBUG = os.getenv("POLAR_WEBHOOK_DEBUG", "0") not in ("0", "false", "False")

    def _mask_value(val: Optional[str]) -> str:
        try:
            if not val:
                return "None"
            n = len(val)
            if n <= 8:
                return (val[:2] + "***" + val[-2:]) if n >= 4 else "***"
            return val[:4] + "..." + val[-4:]
        except Exception:
            return "***"

    @router.post("/api/polar/webhook")
    async def polar_webhook(req: Request):
        """Handle Polar webhook events (sandbox/production)."""
        raw = await req.body()
        if logger:
            try:
                logger.info("[polar_webhook] incoming bytes=%s", len(raw or b""))
            except Exception:
                ...
        try:
            verify_polar_signature(req, raw)
        except HTTPException:
            raise
        except Exception:
            if logger:
                try:
                    logger.exception("[polar_webhook] signature verification error")
                except Exception:
                    ...
            raise HTTPException(status_code=403, detail="Webhook verification failed")

        try:
            payload = json.loads(raw or b"{}")
        except Exception:
            if logger:
                try:
                    logger.exception("[polar_webhook] invalid JSON payload")
                except Exception:
                    ...
            raise HTTPException(status_code=400, detail="Invalid JSON payload")

        evt_type = str(payload.get("type") or "").lower()
        data = payload.get("data") or {}
        event_id = str(payload.get("id") or data.get("id") or int(time.time() * 1000))
        if logger:
            try:
                logger.info("[polar_webhook] evt=%s id=%s", evt_type, event_id)
            except Exception:
                ...

        # Identify user: prefer metadata user_id (robust variants), else email lookup
        meta_raw = data.get("metadata") or {}
        meta: Dict[str, Any]
        if isinstance(meta_raw, str):
            try:
                meta = json.loads(meta_raw)
            except Exception:
                meta = {"_raw": meta_raw}
        elif isinstance(meta_raw, dict):
            meta = meta_raw
        else:
            meta = {}

        # Try multiple key variants to be resilient to provider param encoding
        user_id: Optional[str] = None
        for key in [
            "user_id",
            "userid",
            "userId",
            "supabase_user_id",
            "supabaseUserId",
            "supabase-user-id",
            "metadata.user_id",
            "metadata[supabase_user_id]",
            "metadata[user_id]",
            "metadata[userid]",
        ]:
            v = meta.get(key)
            if v:
                try:
                    user_id = str(v)
                    break
                except Exception:
                    pass

        if DEBUG and logger:
            try:
                logger.warning("[polar_webhook] meta keys: %s", list(meta.keys()))
            except Exception:
                ...

        # Always extract email (even when user_id is present), to drive plan updates by email
        email = (
            (data.get("customer") or {}).get("email")
            or (data.get("buyer") or {}).get("email")
            or data.get("email")
            or payload.get("customerEmail")
            or meta.get("email")
        )

        if not user_id:
            user_id = find_user_by_email(email)
            if DEBUG and logger:
                try:
                    logger.warning("[polar_webhook] lookup via email=%s -> %s", email, user_id)
                except Exception:
                    ...
        if logger:
            try:
                logger.info("[polar_webhook] identified email=%s user_id=%s", email, user_id)
            except Exception:
                ...

        if not user_id:
            logger.warning("[polar_webhook] User not found for event %s", event_id)
            return {"ok": True, "skipped": True}

        # Payments: only concrete payment confirmations update subscription record
        if evt_type in ("order.paid", "invoice.paid"):
            product_id = (
                data.get("product_id")
                or (data.get("product") or {}).get("id")
            )

            # Optional: update subscription + plan
            status = (data.get("status") or data.get("state") or "active")
            period_end = data.get("current_period_end") or data.get("period_end") or data.get("current_period_end_at")
            update_subscription(
                user_id=user_id,
                provider="polar",
                status=str(status).lower(),
                current_period_end=period_end,
                metadata={
                    "event_id": event_id,
                    "event_type": evt_type,
                    "subscription_id": (data.get("subscription_id") or (data.get("subscription") or {}).get("id")),
                    "product_id": product_id,
                },
            )

            return {"ok": True, "user_id": user_id, "noted": True}

        # Refunds: revoke credits idempotently
        if evt_type in ("order.refunded",):
            product_id = (
                data.get("product_id")
                or (data.get("product") or {}).get("id")
            )
            plan_hint = (data.get("metadata") or {}).get("plan")
            units = determine_units_for_purchase(product_id=product_id, plan_hint=plan_hint)
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
                    "raw": {"id": event_id, "product_id": product_id},
                },
            )

            status = (data.get("status") or data.get("state") or "refunded")
            period_end = data.get("current_period_end") or data.get("period_end") or data.get("current_period_end_at")
            update_subscription(
                user_id=user_id,
                provider="polar",
                status=str(status).lower(),
                current_period_end=period_end,
                metadata={
                    "event_id": event_id,
                    "event_type": evt_type,
                    "subscription_id": (data.get("subscription_id") or (data.get("subscription") or {}).get("id")),
                    "product_id": product_id,
                },
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
                metadata={
                    "event_id": event_id,
                    "event_type": evt_type,
                    "subscription_id": (data.get("subscription_id") or (data.get("subscription") or {}).get("id")),
                },
            )
            return {"ok": True, "user_id": user_id, "updated": True}

        return {"ok": True}

    @router.post("/api/polar/checkout/success")
    async def polar_checkout_success(body: CheckoutSuccessRequest, req: Request):
        """Grant credits immediately after client returns from successful checkout."""
        try:
            user_id = verify_supabase_jwt(req.headers.get("Authorization"))
        except Exception as e:
            try:
                logger.exception("JWT verification failed on checkout success")
            except Exception:
                ...
            raise

        units = determine_units_for_purchase(product_id=(body.product_id or None), plan_hint=(body.plan or None))

        rid = f"polar_checkout_success_{user_id}_{int(time.time())}"
        new_balance = grant_credits(
            user_id=user_id,
            units=units,
            request_id=rid,
            meta={
                "provider": "polar",
                "source": "checkout_success_endpoint",
                "product_id": body.product_id,
                "plan": (body.plan or None),
            },
        )

        plan_for_profile = "pro" if units >= pro_default else ("plus" if units >= plus_default else "free")
        if logger:
            try:
                logger.info("[polar_checkout_success] updating plan user_id=%s plan=%s", user_id, plan_for_profile)
            except Exception:
                ...
        update_profile_plan(user_id, plan_for_profile)

        return {"ok": True, "user_id": user_id, "granted": units, "balance": new_balance}

    @router.post("/api/polar/upgrade")
    async def polar_upgrade(req: Request, body: Optional[UpgradeRequest] = None):
        # Validate user
        try:
            user_id = verify_supabase_jwt(req.headers.get("Authorization"))
        except Exception:
            if logger:
                try:
                    logger.exception("[polar_upgrade] JWT verification failed")
                except Exception:
                    ...
            raise

        target = None
        try:
            qp_target = (req.query_params.get("target") or "").strip().lower()
            body_target = ((body.target if body else None) or "").strip().lower()
            target = body_target or qp_target
        except Exception:
            target = None
        if target not in ("plus", "pro"):
            raise HTTPException(status_code=400, detail="Invalid target; must be 'plus' or 'pro'")

        # Resolve user email
        email: Optional[str] = None
        try:
            if get_email_by_user_id:
                email = get_email_by_user_id(user_id)
        except Exception:
            email = None
        if not email:
            # Fallback: extract from JWT claims (unverified) to avoid strict dependency on service role
            try:
                auth = req.headers.get("Authorization") or ""
                if auth.lower().startswith("bearer "):
                    token = auth.split(" ", 1)[1].strip()
                    claims = jose_jwt.get_unverified_claims(token)
                    email = (
                        claims.get("email")
                        or (claims.get("user_metadata") or {}).get("email")
                        or (claims.get("app_metadata") or {}).get("email")
                    )
            except Exception:
                email = None
        if not email:
            raise HTTPException(status_code=400, detail="Cannot resolve user email for upgrade")

        # Map target to product id
        product_id = None
        if target == "pro":
            product_id = os.getenv("POLAR_PRODUCT_ID_PRO")
        else:
            product_id = os.getenv("POLAR_PRODUCT_ID_PLUS")
        # Print masked product ids for debugging env loading
        try:
            pro_id = os.getenv("POLAR_PRODUCT_ID_PRO")
            plus_id = os.getenv("POLAR_PRODUCT_ID_PLUS")
            msg1 = f"[payments] POLAR_PRODUCT_ID_PRO (masked) = {_mask_value(pro_id)}"
            msg2 = f"[payments] POLAR_PRODUCT_ID_PLUS (masked) = {_mask_value(plus_id)}"
            print(msg1); print(msg2)
            if logger:
                logger.info(msg1); logger.info(msg2)
        except Exception:
            ...
        if not product_id:
            raise HTTPException(status_code=500, detail="Server misconfigured: set POLAR_PRODUCT_ID_* or POLAR_PRICE_ID_*")

        # Read current plan from Supabase to decide simplest path
        plan_current: Optional[str] = None
        try:
            try:
                from payments.utils import get_profile_plan as _get_profile_plan  # type: ignore
            except Exception:
                from utils import get_profile_plan as _get_profile_plan  # type: ignore
            plan_current = (_get_profile_plan(user_id) or "").strip().lower()
        except Exception:
            plan_current = None
        # Prefer checkout for non-paid states (free, unknown, any non-plus/pro)
        prefer_checkout = plan_current not in ("plus", "pro")

        # Try direct upgrade via Polar API using saved payment method
        mode = "direct"
        sub_id: Optional[str] = None
        # For free users, skip any Polar customer lookup and go straight to checkout
        if prefer_checkout:
            mode = "checkout"
            checkout_url: Optional[str] = None
            try:
                success_url = os.getenv("POLAR_SUCCESS_URL") or None
                checkout_url = polar_create_checkout(
                    product_id=product_id or "",
                    customer_email=email,
                    metadata={"user_id": user_id, "plan": target},
                    success_url=success_url,
                )
            except Exception:
                checkout_url = None
            if checkout_url:
                return {"ok": True, "mode": mode, "checkout_url": checkout_url, "target": target}

        try:
            from payments.utils import (
                get_active_polar_subscription_id,
                polar_update_subscription_product,
                polar_cancel_subscription,
                polar_create_checkout,
            )
        except Exception:
            from utils import (
                get_active_polar_subscription_id,
                polar_update_subscription_product,
                polar_cancel_subscription,
                polar_create_checkout,
            )

        try:
            # Attempt direct product update using subscription id from our DB (no customer lookup)
            sub_id = get_active_polar_subscription_id(user_id)
            if logger:
                try:
                    logger.info("[polar_upgrade] db subscription id=%s", sub_id)
                except Exception:
                    ...
            if sub_id:
                ok = polar_update_subscription_product(sub_id, product_id=product_id)
                if ok:
                    update_subscription(
                        user_id=user_id,
                        provider="polar",
                        status="active",
                        current_period_end=None,
                        metadata={"upgrade": "direct", "target": target, "subscription_id": sub_id},
                    )
                    try:
                        if email:
                            update_profile_plan_by_email(email, target)
                    except Exception:
                        ...
                    return {"ok": True, "mode": "direct", "target": target}
        except HTTPException:
            raise
        except Exception:
            if logger:
                try:
                    logger.exception("[polar_upgrade] direct upgrade attempt failed")
                except Exception:
                    ...

        # Fallback: create a checkout session (for users without active subscription)
        mode = "checkout"
        checkout_url: Optional[str] = None
        try:
            success_url = os.getenv("POLAR_SUCCESS_URL") or None
            checkout_url = polar_create_checkout(
                product_id=product_id or "",
                customer_email=email,
                metadata={"user_id": user_id, "plan": target},
                success_url=success_url,
            )
        except Exception:
            if logger:
                try:
                    logger.exception("[polar_upgrade] checkout fallback error")
                except Exception:
                    ...
        if checkout_url:
            return {"ok": True, "mode": mode, "checkout_url": checkout_url, "target": target}
        # Otherwise, generic failure
        raise HTTPException(status_code=502, detail="Upgrade failed: unable to update subscription or create checkout")

    @router.post("/api/polar/downgrade")
    async def polar_downgrade(req: Request, body: Optional[UpgradeRequest] = None):
        # Validate user
        try:
            user_id = verify_supabase_jwt(req.headers.get("Authorization"))
        except Exception:
            if logger:
                try:
                    logger.exception("[polar_downgrade] JWT verification failed")
                except Exception:
                    ...
            raise

        # Target lower plan
        target = None
        try:
            qp_target = (req.query_params.get("target") or "").strip().lower()
            body_target = ((body.target if body else None) or "").strip().lower()
            target = body_target or qp_target
        except Exception:
            target = None
        if target not in ("plus", "pro", "free"):
            # Support downgrading to plus/pro/free
            raise HTTPException(status_code=400, detail="Invalid target; must be 'plus', 'pro' or 'free'")

        # Resolve email
        email: Optional[str] = None
        try:
            if get_email_by_user_id:
                email = get_email_by_user_id(user_id)
        except Exception:
            email = None
        if not email:
            # Fallback: extract from JWT claims (unverified)
            try:
                auth = req.headers.get("Authorization") or ""
                if auth.lower().startswith("bearer "):
                    token = auth.split(" ", 1)[1].strip()
                    claims = jose_jwt.get_unverified_claims(token)
                    email = (
                        claims.get("email")
                        or (claims.get("user_metadata") or {}).get("email")
                        or (claims.get("app_metadata") or {}).get("email")
                    )
            except Exception:
                email = None
        if not email:
            raise HTTPException(status_code=400, detail="Cannot resolve user email for downgrade")

        # Determine identifiers for target (plus uses configured ids; free -> cancel at period end)
        product_id = None
        if target == "plus":
            product_id = os.getenv("POLAR_PRODUCT_ID_PLUS")
        elif target == "pro":
            product_id = os.getenv("POLAR_PRODUCT_ID_PRO")

        # Load helpers
        try:
            from payments.utils import (
                polar_get_customer_by_email,
                polar_list_active_subscriptions,
                polar_update_subscription_product,
                polar_cancel_subscription,
            )
        except Exception:
            from utils import (
                polar_get_customer_by_email,
                polar_list_active_subscriptions,
                polar_update_subscription_product,
                polar_cancel_subscription,
            )

        # Find active subscription
        sub_id: Optional[str] = None
        try:
            cid = polar_get_customer_by_email(email)
            if cid:
                subs = polar_list_active_subscriptions(cid)
                items = subs.get("items") if isinstance(subs, dict) else []
                if isinstance(items, list) and items:
                    sub_id = items[0].get("id")
        except Exception:
            if logger:
                try:
                    logger.exception("[polar_downgrade] list active subscription error")
                except Exception:
                    ...

        if not sub_id:
            raise HTTPException(status_code=400, detail="No active subscription to downgrade")

        # Attempt to schedule downgrade at period end:
        # 1) If target is plus, try immediate price update (providers often prorate). If strict next-cycle is required, cancel at period end.
        # 2) If target is free, cancel at period end.
        try:
            if target == "plus" and product_id:
                ok = polar_update_subscription_product(sub_id, product_id=product_id)
                if ok:
                    update_subscription(
                        user_id=user_id,
                        provider="polar",
                        status="active",
                        current_period_end=None,
                        metadata={"downgrade": "price_update", "target": target, "subscription_id": sub_id},
                    )
                    try:
                        if email:
                            update_profile_plan_by_email(email, target)
                    except Exception:
                        ...
                    return {"ok": True, "mode": "price_update", "target": target}
        except Exception:
            if logger:
                try:
                    logger.exception("[polar_downgrade] price update failed; falling back to cancel at period end")
                except Exception:
                    ...

        # Fallback: cancel at period end (effective next month)
        ok_cancel = False
        try:
            ok_cancel = polar_cancel_subscription(sub_id, at_period_end=True)
        except Exception:
            ok_cancel = False
        if ok_cancel:
            update_subscription(
                user_id=user_id,
                provider="polar",
                status="active",
                current_period_end=None,
                metadata={"downgrade": "cancel_at_period_end", "target": target, "subscription_id": sub_id},
            )
            return {"ok": True, "mode": "cancel_at_period_end", "target": target}
        raise HTTPException(status_code=502, detail="Downgrade failed")

    return router


