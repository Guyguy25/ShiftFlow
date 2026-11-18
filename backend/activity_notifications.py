"""Workspace-scoped activity feed and transactional Resend alerts.

Transport records in db.notifications are delivery logs, not a user inbox.
The inbox is deliberately separate; only authenticated workspace members can read it.
"""
import html
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from pymongo import ReturnDocument

from workspace_accounts import billing_owner_id

logger = logging.getLogger("shiftflow.activity_notifications")

KINDS = {
    "accepted": ("Invitation acceptée", "{worker} a accepté la mission « {mission} »."),
    "refused": ("Invitation refusée", "{worker} a refusé la mission « {mission} »."),
    "cancelled": ("Participation annulée", "{worker} a annulé sa participation à « {mission} »."),
    "invite": ("Invitation envoyée", "Invitation envoyée à {worker} pour « {mission} »."),
    "followup": ("Relance envoyée", "Relance WhatsApp envoyée à {worker} pour « {mission} »."),
    "reminder": ("Rappel envoyé", "Rappel WhatsApp envoyé à {worker} pour « {mission} »."),
}
EMAIL_KINDS = {"accepted", "refused", "cancelled"}


def stamp():
    return datetime.now(timezone.utc).isoformat()


def clean(value, max_length=150):
    return str(value or "").strip()[:max_length]


def format_worker(worker):
    name = " ".join(filter(None, (clean((worker or {}).get("first_name"), 60),
                                 clean((worker or {}).get("last_name"), 60))))
    return name or "Un intervenant"


async def publish(db, *, kind, event_key, agency_id, mission, worker=None, shift=None):
    """Idempotent event creation, independent of email provider availability."""
    if kind not in KINDS or not agency_id or not (mission or {}).get("id") or not event_key:
        return None
    mission_name = clean(mission.get("name"), 160) or "sans titre"
    worker_name = format_worker(worker)
    title, pattern = KINDS[kind]
    event_id = f"{kind}:{event_key}"
    event = {
        "_id": event_id,
        "agency_id": agency_id,
        "kind": kind,
        "mission_id": mission["id"],
        "shift_id": (shift or {}).get("id"),
        "worker_name": worker_name,
        "title": title,
        "message": pattern.format(worker=worker_name, mission=mission_name),
        "url": f"/app/missions/{mission['id']}",
        "created_at": stamp(),
    }
    result = await db.activity_events.update_one({"_id": event_id},
                                                  {"$setOnInsert": event}, upsert=True)
    saved = event if result.upserted_id is not None else await db.activity_events.find_one({"_id": event_id})
    return saved


async def record_response(db, kind, slot, mission, shift=None):
    """Called only after an atomic response state transition succeeds."""
    worker = await db.workers.find_one({"id": slot.get("worker_id")}, {"_id": 0}) or {}
    event = await publish(db, kind=kind, event_key=slot["id"],
                          agency_id=mission["agency_id"], mission=mission,
                          worker=worker, shift=shift)
    if event and kind in EMAIL_KINDS:
        owner_id = await billing_owner_id(db, mission["agency_id"])
        owner = await db.users.find_one({"id": owner_id}, {"_id": 0, "email": 1}) or {}
        to = clean(owner.get("email"), 254)
        if to:
            await db.notification_emails.update_one({"_id": event["_id"]}, {"$setOnInsert": {
                "_id": event["_id"], "event_id": event["_id"],
                "to": to, "status": "pending", "attempts": 0,
                "created_at": stamp(), "next_attempt_at": stamp(),
            }}, upsert=True)
            # The response action must succeed even if the email provider is down.
            await send_one(db, event["_id"])
    return event


async def record_delivery(db, notification):
    """Create inbox items only for real, successfully sent WhatsApp messages."""
    if notification.get("status") != "sent" or notification.get("kind") not in {"invite", "followup", "reminder"}:
        return None
    mission_id = notification.get("mission_id")
    worker_id = notification.get("worker_id")
    if not mission_id or not worker_id:
        return None
    mission = await db.missions.find_one({"id": mission_id}, {"_id": 0})
    worker = await db.workers.find_one({"id": worker_id}, {"_id": 0})
    if not mission:
        return None
    return await publish(db, kind=notification["kind"], event_key=notification["id"],
                         agency_id=mission["agency_id"], mission=mission, worker=worker)


async def inbox(db, agency_id, actor_id, limit=40):
    limit = max(1, min(int(limit), 50))
    state = await db.activity_read_state.find_one({"_id": f"{actor_id}:{agency_id}"}) or {}
    seen = state.get("seen_at", "")
    query = {"agency_id": agency_id}
    events = await db.activity_events.find(query, {"_id": 1, "kind": 1, "title": 1, "message": 1,
                                                    "created_at": 1, "url": 1, "mission_id": 1})\
        .sort("created_at", -1).to_list(limit)
    unread = await db.activity_events.count_documents({"agency_id": agency_id, "created_at": {"$gt": seen}})
    return {"items": [{**{k: v for k, v in item.items() if k != "_id"},
                       "id": item["_id"], "unread": item["created_at"] > seen} for item in events],
            "unread": unread}


async def mark_read(db, agency_id, actor_id):
    # A fixed watermark makes read state user-specific without mutating shared events.
    key = f"{actor_id}:{agency_id}"
    now = stamp()
    await db.activity_read_state.update_one({"_id": key}, {"$set": {"seen_at": now}}, upsert=True)
    return {"ok": True, "unread": 0}


async def send_one(db, event_id):
    key = os.getenv("RESEND_API_KEY", "").strip()
    sender = (os.getenv("NOTIFICATION_EMAIL_FROM") or os.getenv("ONBOARDING_EMAIL_FROM") or "").strip()
    if not key or not sender:
        return False
    now = stamp()
    queued = await db.notification_emails.find_one_and_update({
        "_id": event_id, "status": "pending", "attempts": {"$lt": 5},
        "next_attempt_at": {"$lte": now}},
        {"$set": {"status": "sending", "sending_at": now}},
        return_document=ReturnDocument.AFTER)
    if not queued:
        return False
    event = await db.activity_events.find_one({"_id": event_id})
    if not event:
        await db.notification_emails.update_one({"_id": event_id}, {"$set": {"status": "skipped"}})
        return False
    url = (os.getenv("FRONTEND_URL") or "https://www.shiftflow.io").rstrip("/") + event["url"]
    text = f"{event['message']}\n\nVoir la mission : {url}\n\nShiftFlow"
    payload = {
        "from": sender, "to": [queued["to"]],
        "subject": f"ShiftFlow — {event['title']}",
        "text": text,
        "html": ('<div style="font-family:Arial,sans-serif;line-height:1.6">'
                 '<h2>ShiftFlow</h2><p>' + html.escape(event["message"]) +
                 '</p><p><a href="' + html.escape(url, quote=True) +
                 '">Voir la mission</a></p></div>'),
    }
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            response = await client.post("https://api.resend.com/emails", json=payload,
                headers={"Authorization": f"Bearer {key}",
                         "Idempotency-Key": f"shiftflow-activity-{event_id}"})
        response.raise_for_status()
        provider_id = response.json().get("id")
        if not provider_id:
            raise ValueError("Resend did not provide an email ID")
        await db.notification_emails.update_one({"_id": event_id}, {"$set": {
            "status": "sent", "accepted_at": stamp(), "provider_id": provider_id}})
        return True
    except (httpx.HTTPError, ValueError) as exc:
        attempts = queued.get("attempts", 0) + 1
        next_time = (datetime.now(timezone.utc) + timedelta(minutes=min(60, 3 * (2 ** attempts)))).isoformat()
        await db.notification_emails.update_one({"_id": event_id}, {
            "$set": {"status": "pending" if attempts < 5 else "failed",
                     "next_attempt_at": next_time}, "$inc": {"attempts": 1}})
        logger.warning("Resend activity alert was not accepted (event=%s, attempt=%d, type=%s)",
                       event_id, attempts, type(exc).__name__)
        return False


async def retry_pending(db, limit=20):
    """Executed by the existing authenticated cron, never by public clients."""
    now = stamp()
    stale = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    await db.notification_emails.update_many(
        {"status": "sending", "sending_at": {"$lt": stale}},
        {"$set": {"status": "pending", "next_attempt_at": now}})
    pending = await db.notification_emails.find(
        {"status": "pending", "next_attempt_at": {"$lte": now},
         "attempts": {"$lt": 5}}, {"_id": 1}).sort("created_at", 1).to_list(limit)
    sent = 0
    for item in pending:
        if await send_one(db, item["_id"]):
            sent += 1
    return sent
