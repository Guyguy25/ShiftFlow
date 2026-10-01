"""Usage-based access. All balance mutations are atomic on the agency document."""
from datetime import datetime, timezone
from fastapi import HTTPException

FREE_MISSIONS = 3
MISSION_AMOUNT = 0
MISSION_LOOKUP = "shiftflow_mission"


def pack(quantity):
    if type(quantity) is not int or not 1 <= quantity <= 100:
        raise HTTPException(400, "Choisissez entre 1 et 100 missions à acheter.")
    return {"quantity": quantity, "bonus_missions": quantity // 5,
            "mission_credits": quantity + quantity // 5, "amount": quantity * MISSION_AMOUNT}


async def account(db, user_id):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "Compte introuvable")
    if "free_missions_used" not in user:
        # Include archived/cancelled missions: deleting never replenishes the offer.
        used = min(FREE_MISSIONS, await db.missions.count_documents({"agency_id": user_id}))
        await db.users.update_one({"id": user_id, "free_missions_used": {"$exists": False}},
                                  {"$set": {"free_missions_used": used}})
        user = await db.users.find_one({"id": user_id})
    return user


def balance(user):
    free = max(0, FREE_MISSIONS - int(user.get("free_missions_used", 0)))
    paid = max(0, int(user.get("mission_credits", 0)))
    return {"free_missions_remaining": free, "mission_credits": paid,
            "can_create_mission": user.get("plan") == "pro" or free + paid > 0}


async def reserve(db, user_id):
    user = await account(db, user_id)
    await db.users.update_one({"id": user_id}, {"$set": {"last_mission_created_at": datetime.now(timezone.utc).isoformat()}})
    if user.get("plan") == "pro":
        return "pro"
    result = await db.users.update_one(
        {"id": user_id, "free_missions_used": {"$lt": FREE_MISSIONS}},
        {"$inc": {"free_missions_used": 1}})
    if result.modified_count:
        return "free"
    result = await db.users.update_one(
        {"id": user_id, "mission_credits": {"$gt": 0}},
        {"$inc": {"mission_credits": -1}})
    if result.modified_count:
        return "credit"
    raise HTTPException(402, "Vos 3 missions offertes ont été utilisées. Continuez à 4,90 € la mission ou à 49 €/mois en illimité. Vos missions existantes restent accessibles.")


async def release(db, user_id, source):
    if source in ("free", "credit"):
        field = "free_missions_used" if source == "free" else "mission_credits"
        await db.users.update_one({"id": user_id}, {"$inc": {field: -1 if source == "free" else 1}})


async def grant_credit(db, user_id, session_id, credits=1):
    # Webhook and success-page polling can race/retry: grant exactly once.
    return await db.users.update_one(
        {"id": user_id, "credited_checkout_sessions": {"$ne": session_id}},
        {"$inc": {"mission_credits": credits},
         "$addToSet": {"credited_checkout_sessions": session_id},
         "$set": {"last_mission_purchase_at": datetime.now(timezone.utc).isoformat()}})
