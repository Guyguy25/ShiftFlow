"""Returning-user research and a single personal two-month Pro reward."""
from typing import Literal
from pydantic import BaseModel, Field, field_validator
from fastapi import HTTPException
import secrets


class FeedbackIn(BaseModel):
    activity: str = Field(min_length=2, max_length=200)
    role: str = Field(min_length=2, max_length=120)
    team_size: Literal["1–5", "6–20", "21–50", "51–100", "100+"]
    monthly_missions: Literal["1–3", "4–10", "11–30", "30+"]
    current_tools: str = Field(min_length=2, max_length=500)
    workflow: str = Field(min_length=30, max_length=2000)
    main_obstacle: str = Field(min_length=30, max_length=2000)
    desired_improvement: str = Field(min_length=30, max_length=2000)
    impact: str = Field(min_length=15, max_length=1000)
    satisfaction: int = Field(ge=1, le=10, strict=True)
    follow_up: bool = False

    @field_validator("activity", "role", "current_tools", "workflow", "main_obstacle", "desired_improvement", "impact", mode="before")
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value


def eligible(user):
    return (user.get("role") != "owner" and user.get("plan", "free") != "pro"
            and not user.get("stripe_subscription_id")
            and len(set(user.get("visit_days", []))) >= 2)


def status(user, now):
    feedback = user.get("return_feedback") or {}
    snoozed = user.get("feedback_snoozed_until")
    return {"eligible": eligible(user), "completed": bool(feedback),
            "show": eligible(user) and not feedback and (not snoozed or snoozed <= now.isoformat()),
            "promo_code": feedback.get("promo_code") if eligible(user) else None}


async def submit(users, user, payload, now):
    if not eligible(user):
        raise HTTPException(403, "Cette offre est réservée aux utilisateurs de retour sans abonnement Pro.")
    # Store the first complete answer and reward atomically, including concurrent retries.
    await users.update_one({"id": user["id"], "return_feedback": {"$exists": False}}, {"$set": {
        "return_feedback": {"answers": payload.model_dump(), "submitted_at": now.isoformat(),
                            "promo_code": "AVIS-" + secrets.token_hex(8).upper()}}})
    current = await users.find_one({"id": user["id"]}, {"_id": 0})
    return status(current, now)


def discount_options(stripe, user, lookup, code, product_id):
    if not code:
        return {"allow_promotion_codes": True}
    feedback = user.get("return_feedback") or {}
    if not eligible(user) or not secrets.compare_digest(code, feedback.get("promo_code", "")):
        raise HTTPException(403, "Ce code personnel n’est pas disponible pour votre compte.")
    if lookup != "shiftflow_monthly":
        raise HTTPException(400, "Les deux mois offerts s’appliquent uniquement à Pro mensuel.")
    coupon_id = "feedback-v1-" + code
    try:
        coupon = stripe.Coupon.retrieve(coupon_id)
    except stripe.error.InvalidRequestError as exc:
        if exc.code != "resource_missing":
            raise
        coupon = stripe.Coupon.create(
            id=coupon_id, percent_off=100, duration="repeating", duration_in_months=2, max_redemptions=1,
            applies_to={"products": [product_id]}, name="Votre avis : 2 mois de Pro offerts",
            metadata={"user_id": user["id"], "campaign": "return_feedback"},
            idempotency_key=f"feedback-coupon-{code}")
    if not coupon.get("valid", True):
        raise HTTPException(409, "Votre offre a déjà été utilisée.")
    return {"discounts": [{"coupon": coupon.id}], "payment_method_collection": "always"}
