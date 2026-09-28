"""Small, opt-out aware onboarding email job, driven by the existing cron."""

import html
import logging
import os
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import httpx
import jwt
from pymongo.errors import DuplicateKeyError

logger = logging.getLogger("shiftflow.onboarding_emails")


def _date(value):
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def _message(user, stage, mission, frontend_url, unsubscribe_url):
    first_name = html.escape((user.get("name") or "").strip().split(" ")[0][:60])
    greeting = f"Bonjour {first_name}," if first_name else "Bonjour,"
    mission_name = html.escape((mission or {}).get("name", "")[:100])
    base = frontend_url.rstrip("/")
    if stage == "no_mission":
        subject = "Créez votre première mission sur ShiftFlow"
        message = "Créez votre première mission pour préparer les horaires, le lieu et votre équipe. Votre essai de 30 jours commence à cette étape."
        label, path = "Créer ma mission", "/app/missions/new"
    elif stage == "no_workers":
        subject = "Votre mission est prête — ajoutez vos intervenants"
        message = f"Votre mission « {mission_name} » est prête. Ajoutez un intervenant pour commencer à gérer les disponibilités. Vous pouvez l'ajouter manuellement ou l'importer depuis WhatsApp."
        label, path = "Ajouter mes intervenants", "/app/workers"
    else:
        subject = "Votre équipe est prête — envoyez votre première demande"
        message = f"Vous avez ajouté des intervenants. Ouvrez « {mission_name} » pour sélectionner votre équipe et envoyer une première demande. Si besoin, connectez WhatsApp depuis cet écran."
        label, path = "Ouvrir ma mission", f"/app/missions/{quote(mission['id'])}"
    url = f"{base}{path}?utm_source=lifecycle_email&utm_medium=email&utm_campaign={stage}"
    safe_url = html.escape(url, quote=True)
    safe_unsubscribe = html.escape(unsubscribe_url, quote=True)
    body = f"{greeting}\n\n{html.unescape(message)}\n\n{label} : {url}\n\nUne question ? Répondez à cet email.\nNe plus recevoir de conseils de démarrage : {unsubscribe_url}"
    markup = (
        '<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;color:#182438;line-height:1.6">'
        '<p style="font-size:22px;font-weight:bold;color:#1942a2">⚡ ShiftFlow</p>'
        f'<p>{greeting}</p><p>{message}</p>'
        f'<p style="margin:28px 0"><a href="{safe_url}" style="background:#2458d3;color:white;padding:12px 18px;border-radius:7px;text-decoration:none">{html.escape(label)}</a></p>'
        '<p style="font-size:13px;color:#566276">Une question ? Répondez simplement à cet email.</p>'
        f'<p style="font-size:12px;color:#667085;border-top:1px solid #e4e7ec;padding-top:14px"><a href="{safe_unsubscribe}">Ne plus recevoir ces conseils de démarrage</a></p></div>'
    )
    return {"subject": subject, "text": body, "html": markup, "url": url}


async def _stage(db, user, now):
    agency_id = user["id"]
    mission = await db.missions.find_one(
        {"agency_id": agency_id, "status": {"$ne": "cancelled"}, "archived": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "created_at": 1},
        sort=[("created_at", 1)],
    )
    if not mission:
        return ("no_mission", None) if now - _date(user["created_at"]) >= timedelta(hours=3) else (None, None)

    if now - (_date(mission.get("created_at")) or now) < timedelta(hours=2):
        return None, None
    if not await db.workers.count_documents({"agency_id": agency_id, "active": {"$ne": False}}, limit=1):
        return "no_workers", mission

    mission_ids = await db.missions.distinct("id", {"agency_id": agency_id})
    sent = await db.notifications.find_one({
        "mission_id": {"$in": mission_ids}, "kind": "invite", "channel": "whatsapp", "status": "sent",
    }, {"_id": 1})
    if sent:
        return None, None
    first_worker = await db.workers.find_one({"agency_id": agency_id, "active": {"$ne": False}},
                                             {"created_at": 1}, sort=[("created_at", 1)])
    if now - (_date((first_worker or {}).get("created_at")) or now) >= timedelta(hours=4):
        return "no_invite", mission
    return None, None


async def run_onboarding_emails(db, frontend_url, jwt_secret, now=None):
    """At most five sends/tick. Disabled until domain, API key and flag are configured."""
    key = os.getenv("RESEND_API_KEY", "").strip()
    sender = os.getenv("ONBOARDING_EMAIL_FROM", "").strip()
    if os.getenv("ONBOARDING_EMAILS_ENABLED", "").lower() != "true" or not all((key, sender, frontend_url)):
        return 0
    now = now or datetime.now(timezone.utc)
    # Keep room in the provider's free 100/day allowance for manual tests.
    day_start = (now - timedelta(hours=24)).isoformat()
    already_sent_today = await db.onboarding_emails.count_documents({
        "status": "sent", "sent_at": {"$gte": day_start},
    })
    if already_sent_today >= 90:
        return 0
    cutoff = (now - timedelta(days=14)).isoformat()
    cursor = db.users.find({"created_at": {"$gte": cutoff}, "onboarding_email_opt_out": {"$ne": True}},
                           {"_id": 0, "id": 1, "name": 1, "email": 1, "created_at": 1,
                            "plan": 1, "onboarding_email_last_sent_at": 1})
    sent_count = 0
    async with httpx.AsyncClient(timeout=8) as client:
        async for user in cursor:
            if sent_count >= min(5, 90 - already_sent_today):
                break
            if not user.get("email") or user.get("plan") == "pro":
                continue
            last = _date(user.get("onboarding_email_last_sent_at"))
            if last and now - last < timedelta(hours=24):
                continue
            # The per-stage log also protects the 24h rule if a prior process
            # stopped between recording an accepted email and updating the user.
            recent = await db.onboarding_emails.find_one({
                "_id": {"$regex": f"^{user['id']}:"}, "status": "sent",
                "sent_at": {"$gte": (now - timedelta(hours=24)).isoformat()},
            }, {"_id": 1})
            if recent:
                continue
            stage, mission = await _stage(db, user, now)
            if not stage:
                continue

            # Reserve the user and stage atomically across concurrent cron executions.
            reserved = await db.users.update_one({
                "id": user["id"], "onboarding_email_opt_out": {"$ne": True},
                "$and": [
                    {"$or": [{"onboarding_email_last_sent_at": {"$exists": False}},
                              {"onboarding_email_last_sent_at": {"$lte": (now - timedelta(hours=24)).isoformat()}}]},
                    {"$or": [{"onboarding_email_locked_until": {"$exists": False}},
                              {"onboarding_email_locked_until": {"$lt": now.isoformat()}}]},
                ],
            }, {"$set": {"onboarding_email_locked_until": (now + timedelta(minutes=2)).isoformat()}})
            if not reserved.modified_count:
                continue
            record_id = f"{user['id']}:{stage}"
            try:
                token = jwt.encode({"sub": user["id"], "type": "onboarding_unsubscribe",
                                    "exp": now + timedelta(days=365)}, jwt_secret, algorithm="HS256")
                unsubscribe_url = f"{frontend_url.rstrip('/')}/api/email/unsubscribe?token={quote(token)}"
                payload = _message(user, stage, mission, frontend_url, unsubscribe_url)
                try:
                    await db.onboarding_emails.update_one({"_id": record_id}, {"$setOnInsert": {
                        "status": "pending", "payload": payload, "to": user["email"], "created_at": now.isoformat(),
                    }}, upsert=True)
                except DuplicateKeyError:
                    pass
                record = await db.onboarding_emails.find_one_and_update({
                    "_id": record_id, "status": "pending",
                    "$or": [{"locked_until": {"$exists": False}}, {"locked_until": {"$lt": now.isoformat()}},
                            {"locked_until": None}],
                }, {"$set": {"locked_until": (now + timedelta(minutes=2)).isoformat()}}, return_document=True)
                if not record:
                    continue
                # Recheck progression just before delivery, in case the user acted since the scan.
                current_user = await db.users.find_one({"id": user["id"]}, {"onboarding_email_opt_out": 1})
                current_stage, _ = await _stage(db, user, now)
                if not current_user or current_user.get("onboarding_email_opt_out") or current_stage != stage:
                    await db.onboarding_emails.update_one({"_id": record_id}, {"$set": {"status": "skipped"}})
                    continue
                data = record["payload"]
                response = await client.post("https://api.resend.com/emails", headers={
                    "Authorization": f"Bearer {key}", "Idempotency-Key": f"shiftflow-onboarding-{record_id}",
                }, json={"from": sender, "to": [record["to"]], "reply_to": "hello@shiftflow.io",
                         "subject": data["subject"], "html": data["html"], "text": data["text"]})
                response.raise_for_status()
                delivered_at = datetime.now(timezone.utc).isoformat()
                await db.onboarding_emails.update_one({"_id": record_id}, {"$set": {
                    "status": "sent", "sent_at": delivered_at, "provider_id": response.json().get("id"),
                }})
                await db.users.update_one({"id": user["id"]}, {"$set": {
                    "onboarding_email_last_sent_at": delivered_at,
                }})
                sent_count += 1
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("Onboarding email %s failed: %s", record_id, str(exc)[:250])
            finally:
                await db.users.update_one({"id": user["id"]}, {"$unset": {"onboarding_email_locked_until": ""}})
    return sent_count
