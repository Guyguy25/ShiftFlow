"""Whop billing: opaque checkout binding, API reconciliation and signed webhooks.

No browser callback or email address can grant a subscription.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from datetime import datetime, timezone
from decimal import Decimal
from urllib.parse import urlparse

PLANS = {
    "shiftflow_monthly": ("WHOP_MONTHLY_PLAN_ID", "plan_RK1Q30cZoGceV", 7900, 30, "month"),
    "shiftflow_yearly": ("WHOP_YEARLY_PLAN_ID", "plan_qTHTFF6iyWHCn", 52140, 365, "year"),
}
API_ROOT = "https://api.whop.com/api/v1"


class BillingError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message
        super().__init__(message)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def object_id(value):
    return value.get("id") if isinstance(value, dict) else value


def plan_details(lookup):
    if lookup not in PLANS:
        raise BillingError(400, "Offre non autorisée.")
    env, default, amount, days, interval = PLANS[lookup]
    return {"id": os.environ.get(env, default).strip(), "amount": amount,
            "days": days, "interval": interval}


def require_config():
    if not all(os.environ.get(k, "").strip() for k in
               ("WHOP_API_KEY", "WHOP_WEBHOOK_SECRET", "WHOP_COMPANY_ID")):
        raise BillingError(503, "Le paiement est en cours de configuration. Contactez le support.")


async def api_get(resource):
    import httpx
    require_config()
    # IDs never become arbitrary paths or URLs.
    if not re.fullmatch(r"(?:plans/plan_|memberships/mem_|payments/pay_)[A-Za-z0-9]+", resource):
        raise BillingError(400, "Identifiant de paiement invalide.")
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(f"{API_ROOT}/{resource}", headers={
                "Authorization": f"Bearer {os.environ['WHOP_API_KEY']}",
            })
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError):
        raise BillingError(502, "Whop est temporairement indisponible. Réessayez.") from None


def validate_plan(plan, expected):
    try:
        valid = (plan.get("id") == expected["id"]
                 and object_id(plan.get("company")) == os.environ.get("WHOP_COMPANY_ID")
                 and plan.get("currency", "").lower() == "eur"
                 and plan.get("plan_type") == "renewal"
                 and plan.get("billing_period") == expected["days"]
                 and Decimal(str(plan.get("renewal_price"))) * 100 == expected["amount"]
                 and Decimal(str(plan.get("initial_price"))) * 100 == expected["amount"]
                 and not plan.get("trial_period_days"))
    except (ValueError, ArithmeticError):
        valid = False
    if not valid:
        raise BillingError(503, "Le tarif Whop ne correspond pas à l’offre affichée. Contactez le support.")


async def create_checkout(db, user, payload, request_info, origin):
    require_config()
    if payload.legal_acceptance.get("version") != "2026-10-19":
        raise BillingError(400, "Veuillez accepter les conditions actuelles sur la page Tarifs.")
    if payload.quantity != 1:
        raise BillingError(400, "Un seul abonnement par compte.")
    if user.get("plan") == "pro":
        raise BillingError(409, "Votre abonnement Pro est déjà actif.")
    # Existing Stripe feedback coupons cannot silently turn into full-price Whop purchases.
    if payload.promo_code:
        raise BillingError(409, "Votre offre de 2 mois offerts nécessite une activation par le support avant le passage à Whop. Aucun paiement n’a été lancé.")
    expected = plan_details(payload.lookup_key)
    validate_plan(await api_get(f"plans/{expected['id']}"), expected)
    session_id = "whop_" + secrets.token_hex(24)
    token = secrets.token_hex(32)
    await db.payment_transactions.insert_one({
        "_id": session_id, "session_id": session_id, "user_id": user["id"],
        "provider": "whop", "lookup_key": payload.lookup_key,
        "whop_plan_id": expected["id"], "whop_checkout_token": token,
        "amount": expected["amount"], "currency": "eur", "quantity": 1,
        "billing_interval": expected["interval"], "status": "initiated",
        "payment_status": "pending", "fulfilled": False,
        "legal_acceptance": payload.legal_acceptance, "origin_url": origin,
        "meta_consent": payload.meta_consent, **request_info,
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    return {"provider": "whop", "session_id": session_id, "plan_id": expected["id"],
            "metadata": {"shiftflow_session": session_id, "shiftflow_token": token},
            "return_url": f"{origin}/payment/success?session_id={session_id}"}


def verify_webhook(body, headers, secret, now=None):
    """Whop v1 Standard Webhooks; ws_ secrets are used verbatim per Whop docs."""
    try:
        stamp = headers["webhook-timestamp"]
        msg_id = headers["webhook-id"]
        if not secret or abs((time.time() if now is None else now) - int(stamp)) > 300:
            raise ValueError()
        signed = f"{msg_id}.{stamp}.".encode() + body
        signature = base64.b64encode(hmac.new(secret.encode(), signed, hashlib.sha256).digest()).decode()
        candidates = headers.get("webhook-signature", "").split()
        if not any(hmac.compare_digest(candidate, f"v1,{signature}") for candidate in candidates):
            raise ValueError()
        event = json.loads(body)
        if not isinstance(event, dict) or event.get("id") != msg_id:
            raise ValueError()
        return event
    except (KeyError, ValueError, TypeError):
        raise BillingError(400, "Signature Whop invalide.") from None


def active_membership(membership):
    status = membership.get("status")
    if status not in ("active", "trialing", "canceling"):
        return False
    end = membership.get("renewal_period_end")
    if end:
        try:
            if datetime.fromisoformat(end.replace("Z", "+00:00")) <= datetime.now(timezone.utc):
                return False
        except (ValueError, TypeError):
            return False
    return True


async def reconcile_membership(db, membership_id, metadata=None):
    membership = await api_get(f"memberships/{membership_id}")
    if object_id(membership.get("company")) != os.environ.get("WHOP_COMPANY_ID"):
        raise BillingError(400, "Entreprise Whop incorrecte.")
    record = await db.payment_transactions.find_one({"provider": "whop", "whop_membership_id": membership_id})
    if not record:
        data = metadata or membership.get("metadata") or {}
        session_id = data.get("shiftflow_session")
        record = await db.payment_transactions.find_one({"provider": "whop", "session_id": session_id}) if session_id else None
        token = str(data.get("shiftflow_token") or "")
        if not record or not token or not hmac.compare_digest(token, record.get("whop_checkout_token", "")):
            return None  # Purchases made outside the authenticated ShiftFlow checkout.
        if record.get("whop_membership_id") not in (None, membership_id):
            raise BillingError(409, "Cette transaction est déjà liée à un abonnement.")
    if object_id(membership.get("plan")) != record["whop_plan_id"]:
        raise BillingError(400, "Offre Whop incorrecte.")
    active = active_membership(membership)
    # Bind once atomically. A reused checkout token cannot reassign an existing purchase.
    bound = await db.payment_transactions.update_one({
        "_id": record["_id"], "$or": [{"whop_membership_id": {"$exists": False}}, {"whop_membership_id": membership_id}],
    }, {"$set": {"whop_membership_id": membership_id, "updated_at": now_iso()}})
    if not bound.matched_count:
        raise BillingError(409, "Transaction déjà liée.")
    user = await db.users.find_one({"id": record["user_id"]})
    if not user:
        raise BillingError(503, "Compte en cours de synchronisation.")
    current_id = user.get("whop_membership_id")
    if current_id and current_id != membership_id:
        # Old subscription events must never overwrite a newer subscription.
        old_record = await db.payment_transactions.find_one({"provider": "whop", "whop_membership_id": current_id})
        if old_record and old_record.get("created_at", "") > record.get("created_at", ""):
            return record
        if not active:
            return record
    version = membership.get("updated_at")
    if not version:
        raise BillingError(502, "État Whop incomplet.")
    query = {"id": record["user_id"], "whop_membership_id": current_id, "$or": [
        {"whop_membership_id": {"$ne": membership_id}},
        {"whop_updated_at": {"$exists": False}}, {"whop_updated_at": {"$lte": version}},
    ]}
    await db.users.update_one(query, {"$set": {
        "plan": "pro" if active else "free", "subscription_status": membership.get("status"),
        "billing_provider": "whop", "whop_membership_id": membership_id,
        "whop_updated_at": version, "subscription_billing_interval": record["billing_interval"],
        "subscription_current_period_end": membership.get("renewal_period_end"),
    }})
    if active:
        await db.payment_transactions.update_one({"_id": record["_id"]}, {"$set": {
            "status": "completed", "payment_status": "paid", "fulfilled": True,
            "updated_at": now_iso(),
        }})
    return await db.payment_transactions.find_one({"_id": record["_id"]})


async def process_event(db, event):
    company = event.get("account_id") or event.get("company_id")
    if company != os.environ.get("WHOP_COMPANY_ID"):
        raise BillingError(400, "Entreprise Whop incorrecte.")
    event_id = event["id"]
    if await db.whop_events.find_one({"_id": event_id, "processed": True}):
        return None
    data, kind = event.get("data") or {}, event.get("type", "")
    record = None
    if kind.startswith("membership."):
        record = await reconcile_membership(db, data.get("id"))
    elif kind in ("payment.succeeded", "payment.failed", "payment.refunded"):
        payment = await api_get(f"payments/{data.get('id')}")
        membership_id = object_id(payment.get("membership"))
        if membership_id:
            record = await reconcile_membership(db, membership_id, payment.get("metadata"))
    await db.whop_events.update_one({"_id": event_id}, {"$set": {
        "processed": True, "type": kind, "processed_at": now_iso(),
    }}, upsert=True)
    return record


async def portal_url(user):
    membership = await api_get(f"memberships/{user.get('whop_membership_id', '')}")
    if object_id(membership.get("company")) != os.environ.get("WHOP_COMPANY_ID"):
        raise BillingError(400, "Abonnement incorrect.")
    url = membership.get("manage_url", "")
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "whop.com":
        raise BillingError(502, "Portail Whop indisponible.")
    return url
