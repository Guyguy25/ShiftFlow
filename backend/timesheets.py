"""No-account, per-assignment time declarations and organizer approval.

Security: independent random bearer tokens (only their SHA256 stored), tenant-scoped
management APIs, server-side time calculations, immutable review audit events,
and no direct access to payroll/payment execution.
"""
import csv
import hashlib
import io
import os
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

import server as s
from server import db, get_current_user
import whatsapp_routes as wa

router = APIRouter(tags=["Suivi des heures"])
LOCAL_TZ = ZoneInfo(os.environ.get("MISSION_TIMEZONE", "Europe/Paris"))
PUBLIC_STATES = {"sent", "submitted", "needs_correction", "approved"}
DEFAULT_REMINDER_HOURS = 24


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def shift_bounds(shift: dict):
    """One shift per date, with an overnight end on the following day."""
    start = datetime.fromisoformat(f"{shift['date']}T{shift['start_time']}").replace(tzinfo=LOCAL_TZ)
    end = datetime.fromisoformat(f"{shift['date']}T{shift['end_time']}").replace(tzinfo=LOCAL_TZ)
    if end <= start:
        end += timedelta(days=1)
    return start, end


def expected_minutes(shift):
    start, end = shift_bounds(shift)
    return round((end.astimezone(timezone.utc) - start.astimezone(timezone.utc)).total_seconds() / 60)


def calculate_minutes(started_at: datetime, ended_at: datetime, break_minutes: int, shift: dict) -> int:
    if started_at.tzinfo is None or ended_at.tzinfo is None:
        raise ValueError("Précisez le fuseau horaire.")
    start = started_at.astimezone(timezone.utc)
    end = ended_at.astimezone(timezone.utc)
    planned_start, planned_end = shift_bounds(shift)
    planned_start = planned_start.astimezone(timezone.utc)
    planned_end = planned_end.astimezone(timezone.utc)
    duration = (end - start).total_seconds() / 60
    if not 0 < duration <= 36 * 60:
        raise ValueError("La durée doit être comprise entre 1 minute et 36 heures.")
    if start < planned_start - timedelta(hours=36) or end > planned_end + timedelta(hours=72):
        raise ValueError("Les heures saisies sont trop éloignées de la mission.")
    if break_minutes >= duration:
        raise ValueError("La pause doit être inférieure au temps de présence.")
    result = round(duration) - break_minutes
    if result <= 0:
        raise ValueError("Le temps travaillé doit être supérieur à zéro.")
    return result


def public_summary(doc, mission, shift, worker):
    start, end = shift_bounds(shift)
    return {
        "mission": {"name": mission["name"], "location": mission.get("location", "")},
        "worker": {"first_name": worker.get("first_name", "")},
        "shift": {"date": shift["date"], "start_time": shift["start_time"],
                  "end_time": shift["end_time"], "planned_start": start.isoformat(),
                  "planned_end": end.isoformat(), "pay_type": shift.get("pay_type", "hourly")},
        "timesheet": {
            "status": doc.get("status", "sent"),
            "started_at": doc.get("started_at", start.isoformat()),
            "ended_at": doc.get("ended_at", end.isoformat()),
            "break_minutes": doc.get("break_minutes", 0),
            "worked_minutes": doc.get("worked_minutes"),
            "review_note": doc.get("review_note", ""),
        },
    }


class DeclarationIn(BaseModel):
    started_at: datetime
    ended_at: datetime
    break_minutes: int = Field(default=0, ge=0, le=720)
    note: str = Field(default="", max_length=500)

    @field_validator("started_at", "ended_at")
    @classmethod
    def timezone_required(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Date et heure avec fuseau horaire obligatoires.")
        return value


class ReviewIn(BaseModel):
    decision: Literal["approve", "request_correction"]
    note: str = Field(default="", max_length=500)


class SendIn(BaseModel):
    shift_id: Optional[str] = None
    slot_ids: list[str] = Field(default_factory=list, max_length=200)
    resend: bool = False


class SettingsIn(BaseModel):
    auto_send: bool = False
    reminder_enabled: bool = True
    reminder_after_hours: Literal[12, 24, 48] = DEFAULT_REMINDER_HOURS


async def owned_mission(mission_id, user):
    mission = await db.missions.find_one({"id": mission_id, "agency_id": user["id"]}, {"_id": 0})
    if not mission:
        raise HTTPException(404, "Mission introuvable")
    return mission


async def checked_public_token(token):
    if not 20 <= len(token) <= 128:
        raise HTTPException(404, "Lien invalide ou expiré.")
    doc = await db.timesheets.find_one({"token_hash": hash_token(token)}, {"_id": 0})
    if not doc or doc.get("status") not in PUBLIC_STATES:
        raise HTTPException(404, "Lien invalide ou expiré.")
    mission = await db.missions.find_one({"id": doc["mission_id"], "agency_id": doc["agency_id"]}, {"_id": 0})
    shift = await db.shifts.find_one({"id": doc["shift_id"], "mission_id": doc["mission_id"]}, {"_id": 0})
    slot = await db.mission_workers.find_one({"id": doc["slot_id"], "shift_id": doc["shift_id"]}, {"_id": 0})
    worker = await db.workers.find_one({"id": doc["worker_id"], "agency_id": doc["agency_id"]}, {"_id": 0})
    if not all((mission, shift, slot, worker)) or mission.get("status") == "cancelled" or shift.get("status") == "cancelled":
        raise HTTPException(404, "Cette mission n'est plus disponible.")
    if slot.get("status") != "confirmed" and doc.get("status") != "approved":
        raise HTTPException(409, "Votre affectation n'est plus confirmée.")
    return doc, mission, shift, worker


@router.get("/public/timesheets/{token}")
async def public_timesheet(token: str, response: Response):
    response.headers["Cache-Control"] = "no-store"
    doc, mission, shift, worker = await checked_public_token(token)
    return public_summary(doc, mission, shift, worker)


@router.post("/public/timesheets/{token}")
async def submit_timesheet(token: str, payload: DeclarationIn, response: Response):
    response.headers["Cache-Control"] = "no-store"
    doc, mission, shift, worker = await checked_public_token(token)
    if doc.get("status") not in ("sent", "needs_correction", "submitted"):
        raise HTTPException(409, "Cette déclaration a déjà été validée.")
    try:
        minutes = calculate_minutes(payload.started_at, payload.ended_at, payload.break_minutes, shift)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    now = s.iso(s.now_utc())
    event = {"at": now, "action": "submitted", "by": "worker",
             "worked_minutes": minutes, "previous_status": doc.get("status")}
    updated = await db.timesheets.update_one(
        {"id": doc["id"], "token_hash": hash_token(token),
         "status": doc.get("status"), "revision": doc.get("revision", 0)},
        {"$set": {"started_at": payload.started_at.isoformat(), "ended_at": payload.ended_at.isoformat(),
                  "break_minutes": payload.break_minutes, "worked_minutes": minutes,
                  "worker_note": payload.note.strip(), "status": "submitted", "submitted_at": now,
                  "review_note": "", "updated_at": now},
         "$inc": {"revision": 1}, "$push": {"events": event}},
    )
    if not updated.modified_count:
        raise HTTPException(409, "La déclaration a été modifiée. Rechargez la page.")
    return {"ok": True, "status": "submitted", "worked_minutes": minutes}


@router.get("/missions/{mission_id}/timesheets")
async def mission_timesheets(mission_id: str, user=Depends(get_current_user)):
    mission = await owned_mission(mission_id, user)
    shifts = await db.shifts.find({"mission_id": mission_id, "deleted_at": {"$exists": False}}, {"_id": 0}).sort("date", 1).to_list(500)
    slots = await db.mission_workers.find({"mission_id": mission_id, "status": "confirmed"}, {"_id": 0}).to_list(10000)
    docs = await db.timesheets.find({"mission_id": mission_id, "agency_id": user["id"]}, {"_id": 0, "token_hash": 0}).to_list(10000)
    by_slot = {d["slot_id"]: d for d in docs}
    by_shift = {sh["id"]: sh for sh in shifts}
    worker_ids = list(set(slot["worker_id"] for slot in slots))
    workers = await db.workers.find({"id": {"$in": worker_ids}, "agency_id": user["id"]}, {"_id": 0}).to_list(10000) if worker_ids else []
    by_worker = {w["id"]: w for w in workers}
    rows = []
    for slot in slots:
        shift = by_shift.get(slot["shift_id"])
        worker = by_worker.get(slot["worker_id"])
        if not shift or not worker or shift.get("status") == "cancelled":
            continue
        doc = by_slot.get(slot["id"], {})
        start, end = shift_bounds(shift)
        rows.append({
            "slot_id": slot["id"], "shift_id": shift["id"], "worker_id": worker["id"],
            "worker_name": f"{worker.get('first_name', '')} {worker.get('last_name', '')}".strip(),
            "date": shift["date"], "start_time": shift["start_time"], "end_time": shift["end_time"],
            "planned_end": end.isoformat(), "expected_minutes": expected_minutes(shift),
            "status": doc.get("status", "not_sent"), "started_at": doc.get("started_at"),
            "ended_at": doc.get("ended_at"), "break_minutes": doc.get("break_minutes", 0),
            "worked_minutes": doc.get("worked_minutes"), "worker_note": doc.get("worker_note", ""),
            "review_note": doc.get("review_note", ""), "submitted_at": doc.get("submitted_at"),
            "approved_at": doc.get("approved_at"), "events": doc.get("events", []),
            "sent_at": doc.get("sent_at"), "pay_type": shift.get("pay_type", "hourly"),
            "rate_hourly": shift.get("rate_hourly", 0), "fixed_amount": shift.get("fixed_amount", 0),
            "pay_basis": shift.get("pay_basis", "unspecified"),
        })
    return {"mission": {"id": mission["id"], "name": mission["name"]}, "rows": rows}


@router.post("/missions/{mission_id}/timesheets/send")
async def send_timesheets(mission_id: str, payload: SendIn, user=Depends(get_current_user)):
    mission = await owned_mission(mission_id, user)
    if mission.get("status") == "cancelled":
        raise HTTPException(409, "Mission annulée.")
    agency = await db.users.find_one({"id": user["id"]}, {"_id": 0}) or user
    slots = await db.mission_workers.find({"mission_id": mission_id, "status": "confirmed"}, {"_id": 0}).to_list(10000)
    targets = set(payload.slot_ids)
    if targets and any(slot_id not in {s["id"] for s in slots} for slot_id in targets):
        raise HTTPException(400, "Une affectation sélectionnée n'est pas confirmée sur cette mission.")
    counts = {"sent": 0, "failed": 0, "skipped": 0}
    for slot in slots:
        if targets and slot["id"] not in targets:
            continue
        if payload.shift_id and slot["shift_id"] != payload.shift_id:
            continue
        shift = await db.shifts.find_one({"id": slot["shift_id"], "mission_id": mission_id}, {"_id": 0})
        if not shift or shift.get("status") == "cancelled":
            counts["skipped"] += 1
            continue
        _, end = shift_bounds(shift)
        if end.astimezone(timezone.utc) > s.now_utc():
            counts["skipped"] += 1
            continue
        worker = await db.workers.find_one({"id": slot["worker_id"], "agency_id": user["id"]}, {"_id": 0})
        if not worker:
            counts["failed"] += 1
            continue
        result = await deliver_timesheet(slot, shift, mission, agency, worker, resend=payload.resend)
        counts[result] += 1
    return {"ok": True, **counts}


async def deliver_timesheet(slot, shift, mission, agency, worker, resend=False, reminder=False):
    """Reserve a 3-minute lease before sending; retry failed messages only."""
    now = s.now_utc()
    slot_id = slot["id"]
    previous = await db.timesheets.find_one({"slot_id": slot_id, "agency_id": agency["id"]}, {"_id": 0})
    if previous:
        state = previous.get("status")
        if state in ("submitted", "approved") or (state == "needs_correction" and not resend):
            return "skipped"
        if reminder and (state != "sent" or previous.get("reminder_sent_at")):
            return "skipped"
        if not reminder and state == "sent" and not resend:
            return "skipped"
        # A manual resend is rate-limited to one delivery per hour.
        if resend and previous.get("sent_at"):
            try:
                if datetime.fromisoformat(previous["sent_at"]) > now - timedelta(hours=1):
                    return "skipped"
            except ValueError:
                pass
    claim = {"slot_id": slot_id, "agency_id": agency["id"],
             "send_lock_until": {"$lte": s.iso(now)}}
    # First ensure there is exactly one record per assignment (unique index).
    if not previous:
        try:
            await db.timesheets.insert_one({
                "id": s.new_id(), "slot_id": slot_id, "agency_id": agency["id"],
                "mission_id": mission["id"], "shift_id": shift["id"], "worker_id": worker["id"],
                "status": "not_sent", "revision": 0, "events": [], "send_lock_until": s.iso(now),
            })
        except Exception:
            pass  # Concurrent send may have inserted it.
    locked = await db.timesheets.update_one({
        "slot_id": slot_id, "agency_id": agency["id"],
        "$or": [{"send_lock_until": {"$exists": False}},
                {"send_lock_until": {"$lte": s.iso(now)}}],
        "status": {"$in": ["not_sent", "sent"] if reminder or not resend else ["not_sent", "sent", "needs_correction"]},
    }, {"$set": {"send_lock_until": s.iso(now + timedelta(minutes=3))}})
    if not locked.modified_count:
        return "skipped"
    token = secrets.token_urlsafe(32)
    url = f"{s.FRONTEND_URL}/h/{token}" if s.FRONTEND_URL else f"/h/{token}"
    body = (f"Bonjour {worker.get('first_name', '')} 👋\n\n"
            f"Merci de {'vérifier à nouveau' if resend else 'déclarer'} vos heures pour « {mission['name']} » "
            f"du {shift['date']} ({shift['start_time']}–{shift['end_time']}).\n"
            f"Aucun compte nécessaire : {url}")
    to = s.normalize_phone(worker.get("phone", ""))
    status, error, message_id = "failed", None, None
    try:
        if not to:
            error = "Numéro invalide"
        else:
            result = await wa.send_whatsapp_text(agency, to, body)
            message_id = result.get("messageId")
            status = "sent"
    except Exception as exc:
        error = str(exc)
    finally:
        # Do not change existing token on a failed reminder. A successful resend
        # deliberately invalidates the older link.
        patch = {"send_lock_until": s.iso(now), "last_delivery_error": error}
        if status == "sent":
            if reminder:
                patch.update({"reminder_sent_at": s.iso(now), "token_hash": hash_token(token)})
            else:
                correction = bool(previous and previous.get("status") == "needs_correction")
                patch.update({"token_hash": hash_token(token),
                              "status": "needs_correction" if correction else "sent",
                              "sent_at": s.iso(now)})
        await db.timesheets.update_one({"slot_id": slot_id, "agency_id": agency["id"]},
                                       {"$set": patch})
        await db.notifications.insert_one({
            "id": s.new_id(), "channel": "whatsapp", "sent_at": s.iso(now), "kind": "timesheet_reminder" if reminder else "timesheet_request",
            "mission_id": mission["id"], "shift_id": shift["id"], "slot_id": slot_id,
            "worker_id": worker["id"], "to": to, "body": body, "url": url, "status": status,
            "error": error, "provider_message_id": message_id,
        })
    return status if status == "sent" else "failed"


@router.post("/missions/{mission_id}/timesheets/{slot_id}/review")
async def review_timesheet(mission_id: str, slot_id: str, payload: ReviewIn, user=Depends(get_current_user)):
    await owned_mission(mission_id, user)
    doc = await db.timesheets.find_one({"mission_id": mission_id, "slot_id": slot_id, "agency_id": user["id"]}, {"_id": 0})
    if not doc or doc.get("status") != "submitted":
        raise HTTPException(409, "Cette déclaration n'est pas en attente de validation.")
    if payload.decision == "request_correction" and not payload.note.strip():
        raise HTTPException(422, "Précisez la correction demandée.")
    now = s.iso(s.now_utc())
    status = "approved" if payload.decision == "approve" else "needs_correction"
    updated = await db.timesheets.update_one({"id": doc["id"], "status": "submitted", "revision": doc.get("revision", 0)},
        {"$set": {"status": status, "review_note": payload.note.strip(),
                  "approved_at": now if status == "approved" else None, "updated_at": now},
         "$inc": {"revision": 1},
         "$push": {"events": {"at": now, "action": status, "by": user["id"], "note": payload.note.strip()}}})
    if not updated.modified_count:
        raise HTTPException(409, "Cette déclaration vient de changer.")
    delivery = None
    if status == "needs_correction":
        slot = await db.mission_workers.find_one({"id": slot_id, "mission_id": mission_id}, {"_id": 0})
        shift = await db.shifts.find_one({"id": doc["shift_id"], "mission_id": mission_id}, {"_id": 0})
        worker = await db.workers.find_one({"id": doc["worker_id"], "agency_id": user["id"]}, {"_id": 0})
        agency = await db.users.find_one({"id": user["id"]}, {"_id": 0}) or user
        mission = await owned_mission(mission_id, user)
        if slot and shift and worker:
            delivery = await deliver_timesheet(slot, shift, mission, agency, worker, resend=True)
    return {"ok": True, "status": status, "correction_message": delivery}


def csv_safe(value):
    value = str(value if value is not None else "")
    if value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + value
    return value


@router.get("/missions/{mission_id}/timesheets/export")
async def export_timesheets(mission_id: str, user=Depends(get_current_user)):
    data = await mission_timesheets(mission_id, user)
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["Mission", "Intervenant", "Date", "Heure début", "Heure fin", "Pause (min)",
                     "Heures validées", "Mode", "Tarif", "Base", "Montant estimé", "Statut"])
    for row in data["rows"]:
        if row["status"] != "approved":
            continue
        hours = row["worked_minutes"] / 60
        amount = round(hours * float(row["rate_hourly"]), 2) if row["pay_type"] == "hourly" else float(row["fixed_amount"])
        writer.writerow([csv_safe(data["mission"]["name"]), csv_safe(row["worker_name"]),
                         row["date"], row["started_at"], row["ended_at"], row["break_minutes"],
                         f"{hours:.2f}", row["pay_type"],
                         row["rate_hourly"] if row["pay_type"] == "hourly" else row["fixed_amount"],
                         row["pay_basis"], f"{amount:.2f}", "Validé"])
    return Response("\ufeff" + output.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="shiftflow-heures-{mission_id}.csv"',
                             "Cache-Control": "no-store"})


@router.get("/timesheets/settings")
async def get_timesheet_settings(user=Depends(get_current_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {
        "auto_send": bool((u or {}).get("timesheet_auto_send", False)),
        "reminder_enabled": bool((u or {}).get("timesheet_reminder_enabled", True)),
        "reminder_after_hours": int((u or {}).get("timesheet_reminder_after_hours", DEFAULT_REMINDER_HOURS)),
    }


@router.put("/timesheets/settings")
async def save_timesheet_settings(payload: SettingsIn, user=Depends(get_current_user)):
    existing = await db.users.find_one({"id": user["id"]}, {"_id": 0}) or {}
    changes = {"timesheet_auto_send": payload.auto_send, "timesheet_reminder_enabled": payload.reminder_enabled,
               "timesheet_reminder_after_hours": payload.reminder_after_hours}
    if payload.auto_send and not existing.get("timesheet_auto_send", False):
        changes["timesheet_auto_enabled_at"] = s.iso(s.now_utc())
    await db.users.update_one({"id": user["id"]}, {"$set": changes})
    return await get_timesheet_settings(user)


async def run_automatic_timesheets():
    """Called by the existing authenticated Railway reminder cron.

    Opt-in only; never replay messages for missions completed before opt-in.
    """
    now = s.now_utc()
    today = now.astimezone(LOCAL_TZ).date()
    days = [(today - timedelta(days=d)).isoformat() for d in range(4)]
    shifts = await db.shifts.find({"date": {"$in": days}, "status": {"$ne": "cancelled"}},
                                  {"_id": 0}).to_list(4000)
    counts = {"sent": 0, "failed": 0, "skipped": 0}
    for shift in shifts:
        _, end = shift_bounds(shift)
        ended_at = end.astimezone(timezone.utc)
        if ended_at > now or ended_at < now - timedelta(hours=72):
            continue
        mission = await db.missions.find_one({"id": shift["mission_id"], "status": {"$ne": "cancelled"}}, {"_id": 0})
        if not mission:
            continue
        agency = await db.users.find_one({"id": mission["agency_id"]}, {"_id": 0})
        if not agency or not agency.get("timesheet_auto_send") or not s.has_active_product_access(agency):
            continue
        enabled_at = agency.get("timesheet_auto_enabled_at")
        if not enabled_at or ended_at < datetime.fromisoformat(enabled_at).astimezone(timezone.utc):
            continue
        slots = await db.mission_workers.find({"shift_id": shift["id"], "status": "confirmed"}, {"_id": 0}).to_list(500)
        for slot in slots:
            doc = await db.timesheets.find_one({"slot_id": slot["id"]}, {"_id": 0})
            reminder = False
            if doc and doc.get("status") == "sent" and agency.get("timesheet_reminder_enabled", True):
                reminder_hours = int(agency.get("timesheet_reminder_after_hours", DEFAULT_REMINDER_HOURS))
                try:
                    reminder = bool(doc.get("sent_at") and datetime.fromisoformat(doc["sent_at"]) <= now - timedelta(hours=reminder_hours)
                                    and not doc.get("reminder_sent_at"))
                except ValueError:
                    reminder = False
            elif doc and doc.get("status") not in ("not_sent",):
                continue
            if doc and doc.get("status") == "sent" and not reminder:
                continue
            worker = await db.workers.find_one({"id": slot["worker_id"], "agency_id": agency["id"]}, {"_id": 0})
            if not worker:
                counts["failed"] += 1
                continue
            outcome = await deliver_timesheet(slot, shift, mission, agency, worker, reminder=reminder)
            counts[outcome] += 1
    return counts
