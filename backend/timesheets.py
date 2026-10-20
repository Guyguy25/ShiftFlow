"""Post-mission declarations. One atomic, versioned document per assignment."""
import csv
import hashlib
import hmac
import io
import os
import secrets
from datetime import datetime, timedelta
from typing import Literal
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, ConfigDict
import server as s
import whatsapp_routes as wa
from hours_domain import planned_entries, normalize_entries, amount_cents, instant

router = APIRouter(tags=["Timesheets"])
DEFAULT_SETTINGS = {"enabled": False, "delay_hours": 1, "reminder_hours": 48, "max_reminders": 2, "link_days": 30}


class Settings(BaseModel):
    enabled: bool = False
    delay_hours: int = Field(default=1, ge=0, le=168)
    reminder_hours: int = Field(default=48, ge=1, le=720)
    max_reminders: int = Field(default=2, ge=0, le=10)
    link_days: int = Field(default=30, ge=1, le=90)


class Access(BaseModel):
    token: str = Field(min_length=20, max_length=300)


class Entry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start: str = Field(max_length=40)
    end: str = Field(max_length=40)
    break_minutes: int = Field(default=0, ge=0, le=44639, strict=True)
    start_fold: Literal[0, 1] = 0
    end_fold: Literal[0, 1] = 0


class Submission(Access):
    version: int = Field(ge=1)
    entries: list[Entry] = Field(min_length=1, max_length=100)
    note: str = Field(default="", max_length=2000)


class Review(BaseModel):
    version: int = Field(ge=1)
    action: Literal["approved", "rejected", "correction_requested"]
    reason: str = Field(default="", max_length=2000)


def zone():
    return os.environ.get("MISSION_TIMEZONE", "Europe/Paris")


def token_for(row):
    data = f"{row['id']}.{row['token_nonce']}"
    signature = hmac.new(s.JWT_SECRET.encode(), ("timesheet:" + data).encode(), hashlib.sha256).hexdigest()
    return f"{data}.{signature}"


def event(action, actor, **data):
    return {"action": action, "actor": actor, "at": s.iso(s.now_utc()), **data}


async def context(slot_id, owner=None):
    slot = await s.db.mission_workers.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(404, "Affectation introuvable")
    query = {"id": slot["mission_id"]}
    if owner:
        query["agency_id"] = owner["id"]
    mission = await s.db.missions.find_one(query, {"_id": 0})
    if not mission:
        raise HTTPException(404, "Mission introuvable")
    agency_id = mission["agency_id"]
    shift = await s.db.shifts.find_one({"id": slot["shift_id"], "mission_id": mission["id"], "agency_id": agency_id}, {"_id": 0})
    worker = await s.db.workers.find_one({"id": slot["worker_id"], "agency_id": agency_id}, {"_id": 0})
    if not shift or not worker:
        raise HTTPException(409, "Créneau ou intervenant indisponible")
    if slot["status"] != "confirmed" or mission.get("status") == "cancelled" or shift.get("status") == "cancelled":
        raise HTTPException(409, "Cette affectation n'est plus confirmée")
    return slot, shift, mission, worker


async def sheet_context(row, owner=None):
    slot, shift, mission, worker = await context(row["id"], owner)
    if (slot["worker_id"], shift["id"], mission["id"], mission["agency_id"]) != (
            row["worker_id"], row["shift_id"], row["mission_id"], row["agency_id"]):
        raise HTTPException(409, "L'affectation a changé. Contactez l'organisateur.")
    return slot, shift, mission, worker


async def ensure_sheet(slot_id, user):
    slot, shift, mission, worker = await context(slot_id, user)
    try:
        planned = planned_entries(shift, zone())
    except (ValueError, KeyError):
        raise HTTPException(409, "Les horaires prévus sont invalides. Corrigez le créneau.")
    if instant(planned[-1]["end"]) > s.now_utc():
        raise HTTPException(409, "Le créneau n'est pas encore terminé")
    now = s.now_utc()
    settings = {**DEFAULT_SETTINGS, **user.get("timesheet_settings", {})}
    row = {"id": slot_id, "agency_id": user["id"], "mission_id": mission["id"], "shift_id": shift["id"],
           "worker_id": worker["id"], "worker_name": f"{worker.get('first_name', '')} {worker.get('last_name', '')}".strip(),
           "mission_name": mission["name"], "timezone": zone(), "planned_entries": planned,
           "compensation": {key: shift.get(key, default) for key, default in
                            [("pay_type", "hourly"), ("rate_hourly", 0), ("fixed_amount", 0), ("pay_basis", "unspecified")]},
           "entries": planned, "status": "pending", "version": 1, "note": "", "reason": "",
           "token_nonce": secrets.token_hex(16), "expires_at": s.iso(now + timedelta(days=settings["link_days"])),
           "created_at": s.iso(now), "updated_at": s.iso(now), "history": [event("created", user["id"])],
           "delivery_count": 0, "delivery_status": "pending"}
    # Built-in _id uniqueness prevents concurrent creation, without a migration.
    await s.db.timesheets.update_one({"_id": slot_id}, {"$setOnInsert": row}, upsert=True)
    return await s.db.timesheets.find_one({"_id": slot_id}, {"_id": 0})


def public_view(row):
    keys = ("id", "worker_name", "mission_name", "timezone", "planned_entries", "entries", "compensation",
            "status", "version", "note", "reason", "minutes", "amount_cents", "expires_at")
    return {key: row[key] for key in keys if key in row}


def owner_view(row):
    return {key: value for key, value in row.items() if key not in ("_id", "token_nonce", "delivery_lock_until")}


async def access_sheet(token):
    slot_id = token.split(".", 1)[0]
    row = await s.db.timesheets.find_one({"_id": slot_id}, {"_id": 0})
    if not row or not hmac.compare_digest(token_for(row).encode(), token.encode()):
        raise HTTPException(404, "Lien invalide. Demandez un nouveau lien à l'organisateur.")
    if instant(row["expires_at"]) <= s.now_utc():
        raise HTTPException(410, "Lien expiré. Demandez un nouveau lien à l'organisateur.")
    await sheet_context(row)
    return row


@router.post("/public/hours/access")
async def public_access(payload: Access, response: Response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return public_view(await access_sheet(payload.token))


@router.post("/public/hours/submit")
async def submit(payload: Submission, response: Response):
    response.headers["Cache-Control"] = "no-store"
    row = await access_sheet(payload.token)
    if row["status"] not in ("pending", "correction_requested"):
        raise HTTPException(409, "Cette déclaration n'est plus modifiable")
    try:
        entries = normalize_entries([entry.model_dump() for entry in payload.entries], row["timezone"], s.now_utc())
    except (ValueError, OverflowError):
        raise HTTPException(422, "Dates, chevauchements ou pauses invalides. Vérifiez chaque période et les changements d'heure.")
    minutes = sum(entry["minutes"] for entry in entries)
    patch = {"entries": entries, "minutes": minutes, "amount_cents": amount_cents(minutes, row["compensation"]),
             "note": payload.note.strip(), "status": "submitted", "updated_at": s.iso(s.now_utc()), "reason": ""}
    changed = await s.db.timesheets.update_one({"_id": row["id"], "version": payload.version,
                                               "status": row["status"], "token_nonce": row["token_nonce"]}, {
        "$set": patch, "$inc": {"version": 1},
        "$push": {"history": event("submitted", "worker:" + row["worker_id"], **patch)},
    })
    if not changed.modified_count:
        raise HTTPException(409, "La déclaration a changé. Rechargez la page.")
    return public_view({**row, **patch, "version": payload.version + 1})


@router.get("/hours/settings")
async def get_settings(user=Depends(s.get_current_user)):
    return {**DEFAULT_SETTINGS, **user.get("timesheet_settings", {})}


@router.put("/hours/settings")
async def save_settings(payload: Settings, user=Depends(s.get_current_user)):
    await s.db.users.update_one({"id": user["id"]}, {"$set": {"timesheet_settings": payload.model_dump()}})
    return payload.model_dump()


async def list_rows(user, mission_id=None, status=None):
    query = {"agency_id": user["id"]}
    if mission_id:
        query["mission_id"] = mission_id
    if status:
        query["status"] = status
    # Fetch one extra to fail explicitly instead of silently truncating an export.
    rows = await s.db.timesheets.find(query, {"_id": 0}).sort("updated_at", -1).to_list(10001)
    if len(rows) > 10000:
        raise HTTPException(422, "Trop de déclarations. Filtrez par mission ou statut.")
    return rows


@router.get("/hours")
async def dashboard(mission_id: str = None, status: str = None, user=Depends(s.get_current_user)):
    rows = await list_rows(user, mission_id, status)
    approved = [row for row in rows if row["status"] == "approved"]
    totals = {basis: sum(row.get("amount_cents", 0) for row in approved if row["compensation"]["pay_basis"] == basis)
              for basis in ("gross", "net", "unspecified")}
    return {"items": [owner_view(row) for row in rows], "summary": {
        "approved_minutes": sum(row.get("minutes", 0) for row in approved), "approved_amount_cents": totals,
        "counts": {state: sum(row["status"] == state for row in rows)
                   for state in ("pending", "submitted", "approved", "rejected", "correction_requested")}}}


def safe_cell(value):
    text = str(value)
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r", "\n")) else text


@router.get("/hours/export")
async def export(mission_id: str = None, status: str = None, user=Depends(s.get_current_user)):
    rows = await list_rows(user, mission_id, status)
    output = io.StringIO(newline="")
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["Déclaration", "Mission", "Intervenant", "Statut", "Début", "Fin", "Pause (min)",
                     "Minutes période", "Minutes déclaration", "Rémunération", "Tarif EUR", "Base", "Montant déclaration EUR", "Note", "Motif", "Version"])
    for row in rows:
        comp = row["compensation"]
        for index, entry in enumerate(row["entries"]):
            # Declaration totals only appear once, so summing exported rows is safe.
            writer.writerow([safe_cell(value) for value in [row["id"], row["mission_name"], row["worker_name"], row["status"],
                entry["start"], entry["end"], entry["break_minutes"], entry["minutes"], row.get("minutes", "") if index == 0 else "",
                comp["pay_type"], comp["fixed_amount"] if comp["pay_type"] == "fixed" else comp["rate_hourly"], comp["pay_basis"],
                f"{row['amount_cents'] / 100:.2f}" if index == 0 and "amount_cents" in row else "", row["note"], row["reason"], row["version"]]])
    return Response("\ufeff" + output.getvalue(), media_type="text/csv; charset=utf-8", headers={
        "Content-Disposition": 'attachment; filename="shiftflow-heures.csv"', "Cache-Control": "no-store"})


@router.post("/hours/{sheet_id}/review")
async def review(sheet_id: str, payload: Review, user=Depends(s.get_current_user)):
    row = await s.db.timesheets.find_one({"_id": sheet_id, "agency_id": user["id"]}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Déclaration introuvable")
    await sheet_context(row, user)
    if payload.action != "approved" and not payload.reason.strip():
        raise HTTPException(422, "Indiquez le motif du refus ou de la correction")
    allowed = ["submitted"] if payload.action != "correction_requested" else ["submitted", "rejected", "approved"]
    patch = {"status": payload.action, "reason": payload.reason.strip(), "updated_at": s.iso(s.now_utc())}
    if payload.action == "correction_requested":
        settings = {**DEFAULT_SETTINGS, **user.get("timesheet_settings", {})}
        patch.update(token_nonce=secrets.token_hex(16), expires_at=s.iso(s.now_utc() + timedelta(days=settings["link_days"])),
                     delivery_count=0, delivery_status="pending")
    update = {
        "$set": patch, "$inc": {"version": 1},
        "$push": {"history": event(payload.action, user["id"], reason=payload.reason.strip())},
    }
    if payload.action == "correction_requested":
        update["$unset"] = {"delivery_lock_until": ""}
    changed = await s.db.timesheets.update_one({"_id": sheet_id, "agency_id": user["id"], "version": payload.version,
                                               "status": {"$in": allowed}}, update)
    if not changed.modified_count:
        raise HTTPException(409, "Cette déclaration a changé ou n'est pas soumise. Rechargez la page.")
    # Decision is committed before messaging. Delivery failure is visible and retryable.
    delivery = None
    if payload.action == "correction_requested":
        updated = await s.db.timesheets.find_one({"_id": sheet_id}, {"_id": 0})
        delivery = await deliver(updated, user)
    return {"ok": True, "delivery": delivery}


async def deliver(row, user):
    if row["status"] not in ("pending", "correction_requested"):
        return "skipped"
    now = s.now_utc()
    settings = {**DEFAULT_SETTINGS, **user.get("timesheet_settings", {})}
    if row.get("last_sent_at") and instant(row["last_sent_at"]) + timedelta(hours=settings["reminder_hours"]) > now and row["delivery_count"]:
        return "skipped"
    if row["delivery_count"] >= 1 + settings["max_reminders"]:
        return "skipped"
    claim = {"_id": row["id"], "version": row["version"], "status": row["status"],
             "delivery_count": row["delivery_count"], "$or": [
                 {"delivery_lock_until": {"$exists": False}}, {"delivery_lock_until": {"$lte": s.iso(now)}}]}
    claimed = await s.db.timesheets.update_one(claim, {"$set": {"delivery_lock_until": s.iso(now + timedelta(minutes=5))}})
    if not claimed.modified_count:
        return "skipped"
    status, error = "sent", None
    try:
        _, _, mission, worker = await sheet_context(row, user)
        origin = s.FRONTEND_URL.rstrip("/")
        if urlparse(origin).scheme != "https" or not urlparse(origin).netloc:
            raise ValueError("Configurez FRONTEND_URL avec une URL HTTPS")
        if instant(row["expires_at"]) <= now:
            raise ValueError("Lien expiré : renouvelez le lien")
        phone = s.normalize_phone(worker.get("phone", ""))
        if not phone:
            raise ValueError("Numéro de téléphone invalide")
        link = f"{origin}/hours#{token_for(row)}"
        message = f"Bonjour {worker.get('first_name', '')}, merci de déclarer vos heures pour « {mission['name']} »."
        if row["status"] == "correction_requested":
            message += " Une correction est demandée. Consultez le motif sur votre formulaire."
        await wa.send_whatsapp_text(user, phone, message + " Lien personnel, à ne pas partager : " + link)
    except Exception as exc:
        status, error = "failed", str(exc) if isinstance(exc, ValueError) else "Envoi WhatsApp impossible. Vérifiez la connexion puis réessayez."
    patch = {"delivery_status": status, "delivery_error": error, "last_attempt_at": s.iso(now)}
    update = {"$set": patch, "$unset": {"delivery_lock_until": ""},
              "$push": {"history": event("delivery_" + status, "system", error=error)}}
    if status == "sent":
        patch["last_sent_at"] = s.iso(now)
        update["$inc"] = {"delivery_count": 1}
    # A concurrent correction/rotation invalidates this delivery's link and state.
    await s.db.timesheets.update_one({"_id": row["id"], "token_nonce": row["token_nonce"]}, update)
    # No bearer URL, phone or message body in the shared notification log.
    await wa._insert_notification(mission_id=row["mission_id"], shift_id=row["shift_id"], slot_id=row["id"],
                                  worker_id=row["worker_id"], kind="hours", status=status, error=error)
    return status


@router.post("/missions/{mission_id}/hours/request")
async def request_hours(mission_id: str, user=Depends(s.get_current_user)):
    mission = await s.db.missions.find_one({"id": mission_id, "agency_id": user["id"]}, {"_id": 0})
    if not mission:
        raise HTTPException(404, "Mission introuvable")
    slots = await s.db.mission_workers.find({"mission_id": mission_id, "status": "confirmed"}, {"_id": 0}).to_list(None)
    counts = {"sent": 0, "failed": 0, "skipped": 0}
    for slot in slots:
        try:
            row = await ensure_sheet(slot["id"], user)
            counts[await deliver(row, user)] += 1
        except HTTPException:
            counts["skipped"] += 1
    return counts


@router.post("/hours/{sheet_id}/renew")
async def renew(sheet_id: str, user=Depends(s.get_current_user)):
    row = await s.db.timesheets.find_one({"_id": sheet_id, "agency_id": user["id"]}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Déclaration introuvable")
    await sheet_context(row, user)
    if row["status"] not in ("pending", "correction_requested"):
        raise HTTPException(409, "Cette déclaration n'est plus modifiable")
    settings = {**DEFAULT_SETTINGS, **user.get("timesheet_settings", {})}
    changed = await s.db.timesheets.update_one({"_id": sheet_id, "version": row["version"]}, {
        "$set": {"token_nonce": secrets.token_hex(16), "expires_at": s.iso(s.now_utc() + timedelta(days=settings["link_days"])),
                 "delivery_count": 0, "delivery_status": "pending", "updated_at": s.iso(s.now_utc())},
        "$inc": {"version": 1}, "$unset": {"delivery_lock_until": ""},
        "$push": {"history": event("link_renewed", user["id"])}})
    if not changed.modified_count:
        raise HTTPException(409, "Cette déclaration a changé. Rechargez la page.")
    row = await s.db.timesheets.find_one({"_id": sheet_id}, {"_id": 0})
    return {"delivery": await deliver(row, user)}


async def run_timesheets():
    """Called by the existing authenticated reminder webhook; opt-in per agency."""
    counts = {"sent": 0, "failed": 0, "skipped": 0}
    users = await s.db.users.find({"timesheet_settings.enabled": True}, {"_id": 0}).to_list(None)
    for user in users:
        settings = {**DEFAULT_SETTINGS, **user["timesheet_settings"]}
        missions = await s.db.missions.find({"agency_id": user["id"], "status": {"$ne": "cancelled"}, "archived": {"$ne": True}}, {"_id": 0}).to_list(None)
        for mission in missions:
            slots = await s.db.mission_workers.find({"mission_id": mission["id"], "status": "confirmed"}, {"_id": 0}).to_list(None)
            for slot in slots:
                try:
                    row = await ensure_sheet(slot["id"], user)
                    due = instant(row["planned_entries"][-1]["end"]) + timedelta(hours=settings["delay_hours"])
                    if due <= s.now_utc():
                        # Retry failures at most once per scheduler interval, even across overlapping runs.
                        if row.get("last_attempt_at") and instant(row["last_attempt_at"]) > s.now_utc() - timedelta(minutes=15):
                            continue
                        counts[await deliver(row, user)] += 1
                except HTTPException:
                    counts["skipped"] += 1
                except Exception:
                    s.logger.exception("Timesheet processing failed for assignment %s", slot["id"])
                    counts["failed"] += 1
    return counts
