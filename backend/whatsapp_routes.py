import os
import inspect

import httpx
from fastapi import APIRouter, Depends, HTTPException

import server as server_module
from server import get_current_user, db, new_id, iso, now_utc

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

WHATSAPP_SERVICE_URL = os.environ.get("WHATSAPP_SERVICE_URL", "http://localhost:3001").rstrip("/")
WHATSAPP_TIMEOUT = float(os.environ.get("WHATSAPP_SERVICE_TIMEOUT", "90"))
FOLLOWUP_DEFAULT_HOURS = max(1, int(os.environ.get("WHATSAPP_FOLLOWUP_HOURS", "2")))


def session_id_for_user(user):
    return str(user["id"])


async def whatsapp_request(method: str, path: str, user, **kwargs):
    headers = dict(kwargs.pop("headers", {}) or {})
    headers["X-WhatsApp-Session"] = session_id_for_user(user)
    try:
        async with httpx.AsyncClient(timeout=WHATSAPP_TIMEOUT) as client:
            response = await client.request(method, f"{WHATSAPP_SERVICE_URL}{path}", headers=headers, **kwargs)
    except httpx.RequestError as error:
        raise HTTPException(status_code=503, detail=f"Le service WhatsApp n'est pas disponible: {error}")

    try:
        data = response.json()
    except Exception:
        data = {"error": response.text}

    if response.status_code >= 400:
        message = data.get("error", "Erreur du service WhatsApp") if isinstance(data, dict) else "Erreur du service WhatsApp"
        raise HTTPException(status_code=response.status_code, detail=message)
    return data


async def send_whatsapp_text(session_user: dict, to: str, body: str) -> dict:
    return await whatsapp_request("POST", "/send", session_user, json={"to": to, "message": body})


def build_invite_message(worker: dict, shift: dict, mission: dict, agency_name: str, url: str) -> str:
    return (
        f"Bonjour {worker['first_name']}, {agency_name} vous propose la mission "
        f"« {mission['name']} » le {shift['date']} de {shift['start_time']} à {shift['end_time']} "
        f"à {mission['location']}. Rémunération : {shift['rate_hourly']}€/h. "
        f"Répondez ici : {url}"
    )


async def _insert_notification(**doc):
    notification = {"id": new_id(), "channel": "whatsapp", "sent_at": iso(now_utc()), **doc}
    await db.notifications.insert_one(notification)
    notification.pop("_id", None)
    return notification


async def send_invite_whatsapp(slot: dict, shift: dict, mission: dict, worker: dict, agency: dict) -> dict:
    url = f"{server_module.FRONTEND_URL}/m/{slot['token']}" if server_module.FRONTEND_URL else f"/m/{slot['token']}"
    body = build_invite_message(worker, shift, mission, agency.get("agency_name", "Votre agence"), url)
    to = server_module.normalize_phone(worker.get("phone", ""))

    if not to:
        return await _insert_notification(
            mission_id=mission["id"], shift_id=shift["id"], slot_id=slot["id"], worker_id=worker["id"],
            to=None, body=body, url=url, status="failed", error="Numéro de téléphone invalide", kind="invite",
        )

    try:
        result = await send_whatsapp_text(agency, to, body)
        status, error = "sent", None
        server_module.logger.info(f"WhatsApp invitation sent to {to} session={agency['id']}")
    except Exception as exc:
        result = None
        status, error = "failed", str(exc)
        server_module.logger.warning(f"WhatsApp invitation failed to {to}: {error}")

    return await _insert_notification(
        mission_id=mission["id"], shift_id=shift["id"], slot_id=slot["id"], worker_id=worker["id"],
        to=to, body=body, url=url, status=status, error=error, kind="invite",
        provider_message_id=(result or {}).get("messageId") if result else None,
    )


async def send_owner_alert_whatsapp(agency: dict, mission: dict, shift: dict, worker: dict, missing: int) -> dict:
    body = (
        f"Alerte ShiftFlow : {worker['first_name']} {worker['last_name']} vient d'annuler la mission "
        f"« {mission['name']} » du {shift['date']} à {shift['start_time']}. "
        f"Il manque {missing} personne{'s' if missing > 1 else ''}."
    )
    to = server_module.normalize_phone(agency.get("phone", ""))
    if not to:
        return await _insert_notification(
            mission_id=mission["id"], shift_id=shift["id"], slot_id=None, worker_id=None,
            to=None, body=body, url=None, status="failed", error="Numéro du responsable invalide", kind="owner_alert",
        )
    try:
        result = await send_whatsapp_text(agency, to, body)
        status, error = "sent", None
    except Exception as exc:
        result = None
        status, error = "failed", str(exc)
    return await _insert_notification(
        mission_id=mission["id"], shift_id=shift["id"], slot_id=None, worker_id=None,
        to=to, body=body, url=None, status=status, error=error, kind="owner_alert",
        provider_message_id=(result or {}).get("messageId") if result else None,
    )


async def send_reminder_whatsapp(slot: dict, shift: dict, mission: dict, agency: dict, worker: dict) -> dict:
    url = f"{server_module.FRONTEND_URL}/m/{slot['token']}" if server_module.FRONTEND_URL else f"/m/{slot['token']}"
    body = (
        f"Rappel {agency.get('agency_name', '')} : vous êtes confirmé pour « {mission['name']} » "
        f"le {shift['date']} de {shift['start_time']} à {shift['end_time']} à {mission['location']}. "
        f"Détails : {url}"
    )
    to = server_module.normalize_phone(worker.get("phone", ""))
    try:
        result = await send_whatsapp_text(agency, to, body)
        status, error = "sent", None
    except Exception as exc:
        result = None
        status, error = "failed", str(exc)
    return await _insert_notification(
        mission_id=mission["id"], shift_id=shift["id"], slot_id=slot["id"], worker_id=worker["id"],
        to=to, body=body, url=url, status=status, error=error, kind="reminder",
        provider_message_id=(result or {}).get("messageId") if result else None,
    )


async def cascade_all_selected_for_shift(shift_id: str):
    """Launch all pending invitations, but only after the explicit launch action.

    select-workers historically called cascade immediately. We deliberately detect that
    call and do nothing there; the explicit next-cascade endpoint is the only launcher.
    """
    callers = {frame.function for frame in inspect.stack()[1:5]}
    if "select_workers_for_shift" in callers and "force_cascade" not in callers:
        return 0

    shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    if not shift:
        return 0
    mission = await db.missions.find_one({"id": shift["mission_id"]}, {"_id": 0})
    if not mission or mission.get("status") == "cancelled":
        return 0
    agency = await db.users.find_one({"id": mission["agency_id"]}, {"_id": 0})
    if not agency:
        return 0

    slots = await db.mission_workers.find({"shift_id": shift_id}, {"_id": 0}).sort("priority", 1).to_list(1000)
    sent = 0
    failed = 0

    for slot in slots:
        if slot.get("status") != "pending":
            continue
        worker = await db.workers.find_one({"id": slot["worker_id"]}, {"_id": 0})
        if not worker:
            continue

        # IMPORTANT: status stays pending until the WhatsApp service confirms send.
        notification = await send_invite_whatsapp(slot, shift, mission, worker, agency)
        if notification.get("status") == "sent":
            await db.mission_workers.update_one(
                {"id": slot["id"]},
                {"$set": {"status": "contacted", "contacted_at": iso(now_utc())}},
            )
            sent += 1
        else:
            failed += 1

    return {"sent": sent, "failed": failed, "total": sent + failed}


async def run_whatsapp_followups():
    now = now_utc()
    shifts = await db.shifts.find({"status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(5000)
    sent = 0
    for shift in shifts:
        try:
            shift_dt = __import__("datetime").datetime.fromisoformat(f"{shift['date']}T{shift['start_time']}:00+00:00")
        except Exception:
            continue
        if shift_dt <= now:
            continue
        mission = await db.missions.find_one({"id": shift["mission_id"], "status": {"$ne": "cancelled"}}, {"_id": 0})
        if not mission:
            continue
        agency = await db.users.find_one({"id": mission["agency_id"]}, {"_id": 0})
        if not agency:
            continue
        hours = max(1, int(mission.get("followup_hours") or FOLLOWUP_DEFAULT_HOURS))
        cutoff = now - __import__("datetime").timedelta(hours=hours)
        slots = await db.mission_workers.find({
            "shift_id": shift["id"], "status": "contacted",
            "contacted_at": {"$lte": iso(cutoff)}, "followup_sent_at": {"$exists": False},
        }, {"_id": 0}).to_list(1000)
        for slot in slots:
            worker = await db.workers.find_one({"id": slot["worker_id"]}, {"_id": 0})
            if not worker:
                continue
            notification = await send_invite_whatsapp(slot, shift, mission, worker, agency)
            if notification.get("status") == "sent":
                await db.mission_workers.update_one({"id": slot["id"]}, {"$set": {"followup_sent_at": iso(now_utc())}})
                sent += 1
    return sent


async def run_whatsapp_reminders():
    now = now_utc()
    window_start = now + __import__("datetime").timedelta(hours=23)
    window_end = now + __import__("datetime").timedelta(hours=25)
    candidate_dates = {window_start.date().isoformat(), window_end.date().isoformat()}
    shifts = await db.shifts.find({"date": {"$in": list(candidate_dates)}, "status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(2000)
    sent = 0
    for shift in shifts:
        try:
            dt = __import__("datetime").datetime.fromisoformat(f"{shift['date']}T{shift['start_time']}:00+00:00")
        except Exception:
            continue
        if not (window_start <= dt <= window_end):
            continue
        mission = await db.missions.find_one({"id": shift["mission_id"], "status": {"$ne": "cancelled"}}, {"_id": 0})
        if not mission:
            continue
        agency = await db.users.find_one({"id": mission["agency_id"]}, {"_id": 0})
        if not agency:
            continue
        slots = await db.mission_workers.find({"shift_id": shift["id"], "status": "confirmed", "reminder_sent": {"$ne": True}}, {"_id": 0}).to_list(500)
        for slot in slots:
            worker = await db.workers.find_one({"id": slot["worker_id"]}, {"_id": 0})
            if not worker:
                continue
            notification = await send_reminder_whatsapp(slot, shift, mission, agency, worker)
            if notification.get("status") == "sent":
                await db.mission_workers.update_one({"id": slot["id"]}, {"$set": {"reminder_sent": True}})
                sent += 1
    return sent


server_module.send_invite_sms = send_invite_whatsapp
server_module.send_owner_alert_sms = send_owner_alert_whatsapp
server_module.cascade_next_for_shift = cascade_all_selected_for_shift
server_module._run_reminders = run_whatsapp_reminders
server_module.twilio_ready = lambda: False


@router.get("/status")
async def whatsapp_status(user=Depends(get_current_user)):
    return await whatsapp_request("GET", "/status", user)

@router.get("/contacts")
async def whatsapp_contacts(user=Depends(get_current_user)):
    return await whatsapp_request("GET", "/contacts", user)

@router.post("/refresh")
async def whatsapp_refresh(user=Depends(get_current_user)):
    return await whatsapp_request("POST", "/refresh", user)

@router.post("/session/start")
async def whatsapp_start(user=Depends(get_current_user)):
    return await whatsapp_request("POST", "/session/start", user)

@router.post("/session/logout")
async def whatsapp_logout(user=Depends(get_current_user)):
    return await whatsapp_request("POST", "/session/logout", user)

@router.post("/send-test")
async def whatsapp_send_test(payload: dict, user=Depends(get_current_user)):
    target = server_module.normalize_phone(payload.get("to") or user.get("phone", ""))
    if not target:
        raise HTTPException(status_code=400, detail="Aucun numéro fourni ni renseigné sur votre profil")
    body = f"[Test ShiftFlow] Bonjour {user.get('name', '')}, l'envoi WhatsApp fonctionne."
    try:
        result = await send_whatsapp_text(user, target, body)
        await _insert_notification(mission_id=None, shift_id=None, slot_id=None, worker_id=None, to=target, body=body, url=None, status="sent", error=None, kind="test", provider_message_id=result.get("messageId"))
        return {"success": True, "channel": "whatsapp", "to": target, "status": "sent"}
    except Exception as exc:
        await _insert_notification(mission_id=None, shift_id=None, slot_id=None, worker_id=None, to=target, body=body, url=None, status="failed", error=str(exc), kind="test")
        return {"success": False, "channel": "whatsapp", "to": target, "status": "failed", "error": str(exc)}

@router.get("/stats")
async def whatsapp_stats(user=Depends(get_current_user)):
    missions = await db.missions.find({"agency_id": user["id"]}, {"_id": 0}).to_list(5000)
    mids = [m["id"] for m in missions]
    if not mids:
        return {"sent_this_month": 0, "whatsapp_total": 0, "invites_sent": 0, "invites_responded": 0, "response_rate": 0}
    now = now_utc()
    month_start = iso(__import__("datetime").datetime(now.year, now.month, 1, tzinfo=now.tzinfo))
    notifications = await db.notifications.find({"mission_id": {"$in": mids}, "channel": "whatsapp"}, {"_id": 0}).to_list(20000)
    sent_this_month = sum(1 for n in notifications if n.get("sent_at", "") >= month_start and n.get("status") == "sent")
    whatsapp_total = sum(1 for n in notifications if n.get("status") == "sent")
    invite_slot_ids = [n["slot_id"] for n in notifications if n.get("kind", "invite") == "invite" and n.get("slot_id")]
    invite_ids = list(set(invite_slot_ids))
    responded = 0
    if invite_ids:
        slots = await db.mission_workers.find({"id": {"$in": invite_ids}}, {"_id": 0}).to_list(5000)
        responded = sum(1 for s in slots if s.get("status") in ("confirmed", "refused"))
    return {"sent_this_month": sent_this_month, "whatsapp_total": whatsapp_total, "invites_sent": len(invite_ids), "invites_responded": responded, "response_rate": round((responded / len(invite_ids)) * 100, 1) if invite_ids else 0}

@router.post("/cron/followups")
async def whatsapp_followups_cron(user=Depends(get_current_user)):
    count = await run_whatsapp_followups()
    return {"ok": True, "sent": count}

@router.post("/import")
async def whatsapp_import(payload: dict, user=Depends(get_current_user)):
    selected_ids = payload.get("contacts", [])
    if not isinstance(selected_ids, list) or not selected_ids:
        raise HTTPException(status_code=400, detail="Aucun contact sélectionné.")
    whatsapp_data = await whatsapp_request("GET", "/contacts", user)
    if not isinstance(whatsapp_data, list):
        raise HTTPException(status_code=502, detail="Réponse invalide du service WhatsApp.")
    contacts = {str(c.get("id")): c for c in whatsapp_data if c.get("id")}
    selected = [contacts[str(cid)] for cid in selected_ids if str(cid) in contacts]
    if not selected:
        raise HTTPException(status_code=400, detail="Les contacts sélectionnés sont introuvables.")
    plan_doc = await db.users.find_one({"id": user["id"]}, {"plan": 1})
    limit = None if (plan_doc or {}).get("plan", "free") == "pro" else 10
    current_count = await db.workers.count_documents({"agency_id": user["id"]})
    created, skipped = [], []
    for contact in selected:
        if limit is not None and current_count >= limit:
            skipped.append(contact)
            continue
        number = str(contact.get("number", "")).strip().replace(" ", "")
        if not number or len(number) < 8:
            skipped.append(contact)
            continue
        normalized = number if number.startswith("+") else f"+{number}"
        possible = [number, normalized]
        digits = number.lstrip("+")
        if digits.startswith("33"):
            possible.append(f"0{digits[2:]}")
        if await db.workers.find_one({"agency_id": user["id"], "phone": {"$in": possible}}):
            skipped.append(contact)
            continue
        full_name = str(contact.get("name") or "Sans nom").strip()
        parts = full_name.split()
        worker = {
            "id": new_id(), "agency_id": user["id"],
            "first_name": parts[0] if parts else "Sans",
            "last_name": " ".join(parts[1:]) if len(parts) > 1 else "Nom",
            "phone": normalized, "email": "", "skills": [], "note": "", "active": True,
            "created_at": iso(now_utc()),
        }
        await db.workers.insert_one(worker)
        worker.pop("_id", None)
        created.append(worker)
        current_count += 1
    return {"success": True, "created": len(created), "skipped": len(skipped), "workers": created, "quota_hit": limit is not None and len(skipped) > 0 and current_count >= limit, "limit": limit}
