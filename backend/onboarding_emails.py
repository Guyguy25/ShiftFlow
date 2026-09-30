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
    mission_path = (f"/app/missions/{quote(mission['id'])}"
                    if mission and mission.get("id") else "/app/dashboard")
    if stage == "no_mission":
        subject = "Créez votre première mission sur ShiftFlow"
        message = "Créez votre première mission pour préparer les horaires, le lieu et votre équipe. Votre essai de 30 jours commence à cette étape."
        label, path = "Créer ma mission", "/app/missions/new"
    elif stage == "no_mission_followup":
        subject = "Votre essai ShiftFlow vous attend toujours"
        message = "Votre essai ne démarre qu'à la création de votre première mission. Quelques minutes suffisent pour renseigner le lieu, les horaires et le nombre de personnes recherchées."
        label, path = "Préparer ma première mission", "/app/missions/new"
    elif stage == "no_workers":
        subject = "Votre mission est prête — ajoutez vos intervenants"
        message = f"Votre mission « {mission_name} » est prête. Ajoutez un intervenant pour commencer à gérer les disponibilités. Vous pouvez l'ajouter manuellement ou l'importer depuis WhatsApp."
        label, path = "Ajouter mes intervenants", "/app/workers"
    elif stage == "no_workers_followup":
        subject = "Qui souhaitez-vous contacter pour votre mission ?"
        message = f"« {mission_name} » attend encore votre équipe. Ajoutez vos intervenants maintenant pour pouvoir leur demander leurs disponibilités en une seule fois."
        label, path = "Compléter mon équipe", "/app/workers"
    elif stage == "no_invite":
        subject = "Votre équipe est prête — envoyez votre première demande"
        message = f"Vous avez ajouté des intervenants. Ouvrez « {mission_name} » pour sélectionner votre équipe et envoyer une première demande. Si besoin, connectez WhatsApp depuis cet écran."
        label, path = "Ouvrir ma mission", mission_path
    elif stage == "no_invite_followup":
        subject = "Votre mission est presque lancée"
        message = f"Il ne reste qu'une étape pour « {mission_name} » : sélectionnez les intervenants et envoyez la demande de disponibilité."
        label, path = "Envoyer ma demande", mission_path
    elif stage == "pending_responses":
        subject = "Votre équipe pour cette mission est-elle complète ?"
        message = f"Des places restent à confirmer pour « {mission_name} ». Consultez les réponses et relancez les personnes nécessaires depuis votre tableau de mission."
        label, path = "Voir les réponses", mission_path
    elif stage == "team_ready":
        subject = "Votre équipe est prête pour la mission"
        message = f"L'équipe de « {mission_name} » est complète. Vous pouvez retrouver les personnes confirmées et les horaires à tout moment dans ShiftFlow."
        label, path = "Voir mon équipe", mission_path
    elif stage == "trial_ending_7d":
        subject = "Il reste 7 jours à votre essai ShiftFlow"
        message = "Votre essai arrive dans sa dernière semaine. Vous pouvez continuer à préparer vos missions et centraliser les réponses de votre équipe avant son échéance."
        label, path = "Voir mon espace", "/app/dashboard"
    elif stage == "trial_ending_2d":
        subject = "Plus que 2 jours d'essai ShiftFlow"
        message = "Votre essai se termine bientôt. Passez au plan Pro si vous souhaitez continuer à créer des missions et contacter vos intervenants sans interruption."
        label, path = "Découvrir le plan Pro", "/pricing"
    else:
        subject = "Votre essai ShiftFlow est terminé"
        message = "Votre espace et vos données restent disponibles. Passez au plan Pro pour reprendre la création de missions et les demandes de disponibilité."
        label, path = "Continuer avec ShiftFlow", "/pricing"
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
    return {"subject": subject, "text": body, "html": markup, "url": url,
            "unsubscribe_url": unsubscribe_url}


async def _eligible_stages(db, user, now):
    """Return relevant messages in priority order; the caller removes stages already sent."""
    agency_id = user["id"]
    mission = await db.missions.find_one(
        {"agency_id": agency_id, "status": {"$ne": "cancelled"}, "archived": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "created_at": 1},
        sort=[("created_at", 1)],
    )
    stages = []
    if not mission:
        account_age = now - (_date(user.get("created_at")) or now)
        if account_age >= timedelta(hours=3):
            stages.append(("no_mission", None))
        if account_age >= timedelta(hours=48):
            stages.append(("no_mission_followup", None))
    else:
        mission_age = now - (_date(mission.get("created_at")) or now)
        worker_count = await db.workers.count_documents(
            {"agency_id": agency_id, "active": {"$ne": False}}, limit=1)
        if not worker_count:
            if mission_age >= timedelta(hours=2):
                stages.append(("no_workers", mission))
            if mission_age >= timedelta(hours=48):
                stages.append(("no_workers_followup", mission))
        else:
            first_worker = await db.workers.find_one(
                {"agency_id": agency_id, "active": {"$ne": False}},
                {"created_at": 1}, sort=[("created_at", 1)])
            worker_age = now - (_date((first_worker or {}).get("created_at")) or now)
            invite = await db.notifications.find_one({
                "mission_id": mission["id"], "kind": "invite", "channel": "whatsapp", "status": "sent",
            }, {"_id": 0, "sent_at": 1}, sort=[("sent_at", 1)])
            if not invite:
                if worker_age >= timedelta(hours=4):
                    stages.append(("no_invite", mission))
                if worker_age >= timedelta(hours=48):
                    stages.append(("no_invite_followup", mission))
            else:
                invite_age = now - (_date(invite.get("sent_at")) or now)
                shifts = await db.shifts.find(
                    {"mission_id": mission["id"], "status": {"$ne": "cancelled"}},
                    {"_id": 0, "people_needed": 1, "confirmed_count": 1},
                ).to_list(100)
                fully_staffed = bool(shifts) and all(
                    int(shift.get("confirmed_count") or 0) >= int(shift.get("people_needed") or 0)
                    for shift in shifts)
                if fully_staffed and invite_age >= timedelta(hours=2):
                    stages.append(("team_ready", mission))
                elif not fully_staffed and invite_age >= timedelta(hours=24):
                    stages.append(("pending_responses", mission))

    trial_end = _date(user.get("trial_ends_at"))
    if trial_end:
        remaining = trial_end - now
        if timedelta(days=2) < remaining <= timedelta(days=7):
            stages.append(("trial_ending_7d", mission))
        if timedelta(0) < remaining <= timedelta(days=2):
            stages.append(("trial_ending_2d", mission))
        if timedelta(days=-7) <= remaining <= timedelta(0):
            stages.append(("trial_expired", mission))
    return stages


async def _stage(db, user, now, sent_stages=None):
    sent_stages = sent_stages or set()
    for stage, mission in await _eligible_stages(db, user, now):
        if stage not in sent_stages:
            return stage, mission
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
    # Cover the complete 30-day trial plus a short post-trial recovery window.
    cutoff = (now - timedelta(days=40)).isoformat()
    cursor = db.users.find({"created_at": {"$gte": cutoff}, "onboarding_email_opt_out": {"$ne": True}},
                           {"_id": 0, "id": 1, "name": 1, "email": 1, "created_at": 1,
                            "plan": 1, "trial_started_at": 1, "trial_ends_at": 1,
                            "onboarding_email_last_sent_at": 1})
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
            sent_records = await db.onboarding_emails.find({
                "_id": {"$regex": f"^{user['id']}:"}, "status": "sent",
            }, {"_id": 1}).to_list(50)
            sent_stages = {
                record["_id"].split(":", 1)[1] for record in sent_records
                if ":" in record.get("_id", "")
            }
            stage, mission = await _stage(db, user, now, sent_stages)
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
                current_stage, _ = await _stage(db, user, now, sent_stages)
                if not current_user or current_user.get("onboarding_email_opt_out") or current_stage != stage:
                    await db.onboarding_emails.update_one({"_id": record_id}, {"$set": {"status": "skipped"}})
                    continue
                data = record["payload"]
                response = await client.post("https://api.resend.com/emails", headers={
                    "Authorization": f"Bearer {key}", "Idempotency-Key": f"shiftflow-onboarding-{record_id}",
                }, json={"from": sender, "to": [record["to"]], "reply_to": "hello@shiftflow.io",
                         "subject": data["subject"], "html": data["html"], "text": data["text"],
                         "headers": {"List-Unsubscribe": f"<{data['unsubscribe_url']}>"}})
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

