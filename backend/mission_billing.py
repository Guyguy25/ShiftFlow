from workspace_accounts import accounts
"""Usage-based access. All balance mutations are atomic on the agency document."""
from datetime import datetime, timezone
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

FREE_MISSIONS = 3
MISSION_AMOUNT = 490
MISSION_LOOKUP = "shiftflow_mission"

# Only v2 Whop subscriptions have these monthly limits. Legacy subscriptions
# keep their existing unlimited mission entitlement. Usage is owner-wide and
# counts a multi-day mission once at creation, not once per shift.
V2_LIMITS = {"start": 3, "pro": 20, "business": None}


def paid_limit(user):
    if user.get("plan") != "pro" or user.get("billing_catalog_version") != 2:
        return None
    return V2_LIMITS.get(user.get("subscription_tier", "pro"))


def period_id(user):
    owner_id = user.get("billing_owner_id") or user.get("free_pool_id") or user["id"]
    return f"{owner_id}:{datetime.now(timezone.utc).strftime('%Y-%m')}"


async def monthly_used(db, user):
    if paid_limit(user) is None:
        return 0
    row = await db.mission_period_usage.find_one({"_id": period_id(user)})
    return int((row or {}).get("count", 0))


async def quota(db, user_id):
    user = await account(db, user_id)
    used = await monthly_used(db, user)
    return {**balance(user, used), "mission_limit": paid_limit(user) if user.get("plan") == "pro" else FREE_MISSIONS,
            "missions_this_month": used}



def pack(quantity):
    if type(quantity) is not int or not 1 <= quantity <= 100:
        raise HTTPException(400, "Choisissez entre 1 et 100 missions à acheter.")
    return {"quantity": quantity, "bonus_missions": quantity // 5,
            "mission_credits": quantity + quantity // 5, "amount": quantity * MISSION_AMOUNT}


async def account(db, user_id):
    user = await accounts(db).find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "Compte introuvable")
    pool_id = user.get("free_pool_id") or user_id
    if pool_id != user_id:
        pool = await account(db, pool_id)
        return {**user, "free_missions_used": pool.get("free_missions_used", 0)}
    if "free_missions_used" not in user:
        # Include archived/cancelled missions: deleting never replenishes the offer.
        used = min(FREE_MISSIONS, await db.missions.count_documents({"agency_id": user_id}))
        await accounts(db).update_one({"id": user_id, "free_missions_used": {"$exists": False}},
                                  {"$set": {"free_missions_used": used}})
        user = await accounts(db).find_one({"id": user_id})
    return user


def balance(user, used=0):
    free = max(0, FREE_MISSIONS - int(user.get("free_missions_used", 0)))
    paid = max(0, int(user.get("mission_credits", 0)))
    return {"free_missions_remaining": free, "mission_credits": paid,
            "can_create_mission": (used < paid_limit(user) if paid_limit(user) is not None else True) if user.get("plan") == "pro" else free + paid > 0}


async def reserve(db, user_id):
    user = await account(db, user_id)
    await accounts(db).update_one({"id": user_id}, {"$set": {"last_mission_created_at": datetime.now(timezone.utc).isoformat()}})
    if user.get("plan") == "pro":
        limit = paid_limit(user)
        if limit is None: return "pro"
        key = period_id(user)
        try:
            result = await db.mission_period_usage.update_one(
                {"_id": key, "count": {"$lt": limit}},
                {"$inc": {"count": 1}}, upsert=True)
        except DuplicateKeyError:
            result = None
        if result and (result.modified_count or result.upserted_id):
            return "period:" + key
        raise HTTPException(402, f"Votre offre a atteint sa limite de {limit} missions ce mois-ci. Passez à l’offre supérieure pour continuer.")
    result = await accounts(db).update_one(
        {"id": user.get("free_pool_id") or user_id, "free_missions_used": {"$lt": FREE_MISSIONS}},
        {"$inc": {"free_missions_used": 1}})
    if result.modified_count:
        return "free"
    result = await accounts(db).update_one(
        {"id": user_id, "mission_credits": {"$gt": 0}},
        {"$inc": {"mission_credits": -1}})
    if result.modified_count:
        return "credit"
    raise HTTPException(402, "Vos 3 missions offertes ont été utilisées. Découvrez les formules ShiftFlow à partir de 29 €/mois. Vos missions existantes restent accessibles.")


async def release(db, user_id, source):
    if isinstance(source, str) and source.startswith("period:"):
        await db.mission_period_usage.update_one(
            {"_id": source.removeprefix("period:"), "count": {"$gt": 0}},
            {"$inc": {"count": -1}})
        return
    if source in ("free", "credit"):
        field = "free_missions_used" if source == "free" else "mission_credits"
        current = await account(db, user_id)
        target = (current.get("free_pool_id") or user_id) if source == "free" else user_id
        await accounts(db).update_one({"id": target}, {"$inc": {field: -1 if source == "free" else 1}})


async def grant_credit(db, user_id, session_id, credits=1):
    # Webhook and success-page polling can race/retry: grant exactly once.
    return await accounts(db).update_one(
        {"id": user_id, "credited_checkout_sessions": {"$ne": session_id}},
        {"$inc": {"mission_credits": credits},
         "$addToSet": {"credited_checkout_sessions": session_id},
         "$set": {"last_mission_purchase_at": datetime.now(timezone.utc).isoformat()}})
