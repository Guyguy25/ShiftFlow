from workspace_accounts import accounts
"""Tenant-owned mission changes and retryable WhatsApp lifecycle notifications."""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Literal
import server as s
from server import get_workspace_manager, db, get_workspace_user, ShiftIn
import whatsapp_routes as wa

router = APIRouter(tags=["Mission operations"])


async def owned_mission(mission_id, user, editable=False):
    mission = await db.missions.find_one({"id": mission_id, "agency_id": user["id"]}, {"_id": 0})
    if not mission:
        raise HTTPException(404, "Mission introuvable")
    if editable and (mission.get("status") == "cancelled" or mission.get("archived")):
        raise HTTPException(409, "Mission annulée ou archivée")
    return mission


async def owned_shift(shift_id, user, editable=False):
    shift = await db.shifts.find_one({"id": shift_id, "agency_id": user["id"]}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "Créneau introuvable")
    mission = await owned_mission(shift["mission_id"], user, editable)
    if editable and shift.get("status") == "cancelled":
        raise HTTPException(409, "Créneau annulé")
    return shift, mission


async def deliver_notice(slot, shift, mission, user, kind):
    """Claim a delivery per slot/event; repeated actions retry only failed sends.

    The lease bounds concurrent retries. As with every external messaging API,
    a crash after provider acceptance but before recording success is ambiguous.
    """
    field = f"notice_{kind}"
    now = s.now_utc()
    claimed = await db.mission_workers.update_one({
        "id": slot["id"], f"{field}.sent": {"$ne": True},
        "$or": [{f"{field}.lock_until": {"$exists": False}}, {f"{field}.lock_until": {"$lte": s.iso(now)}}],
    }, {"$set": {f"{field}.lock_until": s.iso(now + timedelta(minutes=3))}})
    if not claimed.modified_count:
        return "skipped"
    try:
        worker = await db.workers.find_one({"id": slot["worker_id"], "agency_id": user["id"]}, {"_id": 0})
        if worker:
            agency = await accounts(db).find_one({"id": user["id"]}, {"_id": 0}) or user
            notification = await wa.send_invite_whatsapp(slot, shift, mission, worker, agency, kind=kind)
            sent = notification.get("status") == "sent"
        else:
            sent = False
        await db.mission_workers.update_one({"id": slot["id"]}, {
            "$set": {f"{field}.sent": sent}, "$unset": {f"{field}.lock_until": ""},
        })
        return "sent" if sent else "failed"
    except Exception:
        await db.mission_workers.update_one({"id": slot["id"]}, {"$unset": {f"{field}.lock_until": ""}})
        s.logger.exception("Lifecycle notification failed slot=%s kind=%s", slot["id"], kind)
        return "failed"


async def notify_slots(slots, mission, user, kind):
    counts = {"sent": 0, "failed": 0, "skipped": 0}
    for slot in slots:
        shift = await db.shifts.find_one({"id": slot["shift_id"]}, {"_id": 0})
        result = await deliver_notice(slot, shift, mission, user, kind) if shift else "failed"
        counts[result] += 1
    return counts


async def cancel_slots(query):
    slots = await db.mission_workers.find(query, {"_id": 0}).to_list(None)
    for slot in slots:
        if slot.get("status") != "cancelled":
            await db.mission_workers.update_one({"id": slot["id"], "status": slot["status"]}, {
                "$set": {"status": "cancelled", "status_before_cancellation": slot["status"], "cancelled_at": s.iso(s.now_utc())},
            })


async def cancel_owned_mission(mission_id, user):
    mission = await owned_mission(mission_id, user)
    # Persist the cancellation before I/O: provider failure cannot leave links active.
    await db.missions.update_one({"id": mission_id, "agency_id": user["id"]}, {"$set": {"status": "cancelled"}})
    await db.shifts.update_many({"mission_id": mission_id}, {"$set": {"status": "cancelled", "confirmed_count": 0}})
    # Retain the previous state for the audit trail, including legacy invitations.
    await cancel_slots({"mission_id": mission_id})
    # Include every assigned worker, including pending, refused, no-answer and removed.
    # No hard delete: retain tokens and delivery history for safe retries.
    slots = await db.mission_workers.find({"mission_id": mission_id}, {"_id": 0}).to_list(None)
    return {"ok": True, "notifications": await notify_slots(slots, mission, user, "cancellation")}


class ProjectStatusIn(BaseModel):
    project_status: Literal["option", "validated"]


@router.patch("/missions/{mission_id}/project-status")
async def set_project_status(mission_id: str, payload: ProjectStatusIn, user=Depends(get_workspace_manager)):
    """Independent commercial status; staffing status remains draft/in_progress/filled."""
    await s.ensure_trial_active_or_raise(user)
    mission = await owned_mission(mission_id, user, editable=True)
    before = mission.get("project_status", "validated")
    if before == payload.project_status:
        return {"ok": True, "project_status": before, "changed": False,
                "notifications": {"sent": 0, "failed": 0, "skipped": 0}}
    prior = {"project_status": before} if "project_status" in mission else {"project_status": {"$exists": False}}
    updated = await db.missions.update_one({
        "id": mission_id, "agency_id": user["id"], "status": {"$ne": "cancelled"},
        "archived": {"$ne": True}, **prior,
    }, {"$set": {"project_status": payload.project_status,
                  "project_status_updated_at": s.iso(s.now_utc())}})
    if updated.modified_count != 1:
        raise HTTPException(409, "Le statut du projet a été modifié. Rechargez la page.")
    counts = {"sent": 0, "failed": 0, "skipped": 0}
    if before == "option" and payload.project_status == "validated":
        # Notify only confirmed technicians. A pending invitation is not a booking.
        slots = await db.mission_workers.find({
            "mission_id": mission_id, "status": "confirmed"}, {"_id": 0}).to_list(1000)
        if slots:
            await db.mission_workers.update_many(
                {"id": {"$in": [slot["id"] for slot in slots]}},
                {"$set": {"notice_validation.sent": False},
                 "$unset": {"notice_validation.lock_until": ""}})
            validated = {**mission, "project_status": "validated"}
            counts = await notify_slots(slots, validated, user, "validation")
    return {"ok": True, "project_status": payload.project_status, "changed": True,
            "notifications": counts}


@router.post("/mission-workers/{slot_id}/confirm-manually")
async def confirm_worker_manually(slot_id: str, user=Depends(get_workspace_manager)):
    """Manager-approved booking; does not fake an incoming WhatsApp response."""
    await s.ensure_trial_active_or_raise(user)
    slot = await db.mission_workers.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(404, "Intervenant introuvable")
    shift, mission = await owned_shift(slot["shift_id"], user, editable=True)
    if shift.get("deleted_at") or mission.get("status") == "cancelled":
        raise HTTPException(409, "Créneau ou mission annulé.")
    if slot.get("status") == "confirmed":
        return {"ok": True, "status": "confirmed", "already_confirmed": True}
    if slot.get("status") not in ("pending", "contacted", "no_answer"):
        raise HTTPException(409, "Cette personne a refusé ou a été retirée. Sélectionnez un autre intervenant.")
    # Reserve capacity atomically to prevent two simultaneous manual bookings.
    reservation = await db.shifts.update_one({
        "id": shift["id"], "agency_id": user["id"],
        "status": {"$ne": "cancelled"},
        "confirmed_count": {"$lt": shift["people_needed"]},
    }, {"$inc": {"confirmed_count": 1}})
    if reservation.modified_count != 1:
        raise HTTPException(409, "L'équipe est complète ou vient de changer. Rechargez la mission.")
    try:
        changed = await db.mission_workers.update_one({
            "id": slot_id, "shift_id": shift["id"],
            "status": slot["status"],
        }, {"$set": {
            "status": "confirmed", "responded_at": s.iso(s.now_utc()),
            "response_reason": "confirmed_manually",
            "confirmed_by": user.get("actor_id", user["id"]),
        }})
        if changed.modified_count != 1:
            raise HTTPException(409, "La réponse de cet intervenant vient de changer. Rechargez la mission.")
    except Exception:
        await db.shifts.update_one({"id": shift["id"]}, {"$inc": {"confirmed_count": -1}})
        raise
    await s.update_shift_and_mission_status(shift["id"])
    # Do not send an acceptance email to the person who manually booked this slot.
    return {"ok": True, "status": "confirmed", "manual": True}


@router.post("/missions/{mission_id}/shifts")
async def add_shift(mission_id: str, payload: ShiftIn, user=Depends(get_workspace_user)):
    await s.ensure_trial_active_or_raise(user)
    await owned_mission(mission_id, user, editable=True)
    shift = {**payload.model_dump(), "id": s.new_id(), "mission_id": mission_id, "agency_id": user["id"],
             "status": "draft", "confirmed_count": 0, "created_at": s.iso(s.now_utc())}
    await db.shifts.insert_one(shift)
    await s.update_shift_and_mission_status(shift["id"])
    shift.pop("_id", None)
    return shift


@router.put("/shifts/{shift_id}")
async def edit_shift(shift_id: str, payload: ShiftIn, user=Depends(get_workspace_user)):
    await s.ensure_trial_active_or_raise(user)
    shift, mission = await owned_shift(shift_id, user, editable=True)
    confirmed = await db.mission_workers.count_documents({"shift_id": shift_id, "status": "confirmed"})
    if payload.people_needed < confirmed:
        raise HTTPException(409, "Retirez d'abord les intervenants en surnombre")
    patch = payload.model_dump()
    if all(shift.get(k, {"pay_type": "hourly", "fixed_amount": 0, "pay_basis": "unspecified"}.get(k)) == v for k, v in patch.items()):
        return {"ok": True, "notifications": {"sent": 0, "failed": 0, "skipped": 0}}
    await db.shifts.update_one({"id": shift_id, "agency_id": user["id"]}, {"$set": patch})
    # A new edit is a new event. Retry failures through the dedicated endpoint.
    await db.mission_workers.update_many({"shift_id": shift_id}, {
        "$set": {"notice_change.sent": False}, "$unset": {"notice_change.lock_until": ""},
    })
    await s.update_shift_and_mission_status(shift_id)
    slots = await db.mission_workers.find({"shift_id": shift_id, "status": {"$in": ["contacted", "confirmed"]}}, {"_id": 0}).to_list(None)
    return {"ok": True, "notifications": await notify_slots(slots, mission, user, "change")}


@router.delete("/shifts/{shift_id}")
async def delete_shift(shift_id: str, user=Depends(get_workspace_manager)):
    shift, mission = await owned_shift(shift_id, user)
    await db.shifts.update_one({"id": shift_id, "agency_id": user["id"]}, {"$set": {"status": "cancelled", "deleted_at": s.iso(s.now_utc()), "confirmed_count": 0}})
    await cancel_slots({"shift_id": shift_id})
    slots = await db.mission_workers.find({"shift_id": shift_id}, {"_id": 0}).to_list(None)
    await s.update_shift_and_mission_status(shift_id)
    return {"ok": True, "notifications": await notify_slots(slots, mission, user, "cancellation")}


@router.post("/mission-workers/{slot_id}/followup")
async def followup(slot_id: str, user=Depends(get_workspace_user)):
    await s.ensure_trial_active_or_raise(user)
    slot = await db.mission_workers.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(404, "Invitation introuvable")
    shift, mission = await owned_shift(slot["shift_id"], user, editable=True)
    if wa.shift_start_utc(shift) is None or wa.shift_start_utc(shift) <= s.now_utc():
        raise HTTPException(409, "Ce créneau a déjà commencé")
    confirmed = await db.mission_workers.count_documents({"shift_id": shift["id"], "status": "confirmed"})
    if confirmed >= shift["people_needed"]:
        raise HTTPException(409, "L’équipe de ce créneau est déjà complète")
    worker = await db.workers.find_one({"id": slot["worker_id"], "agency_id": user["id"]}, {"_id": 0})
    if not worker:
        raise HTTPException(404, "Intervenant introuvable")
    agency = await accounts(db).find_one({"id": user["id"]}, {"_id": 0}) or user
    notification = await wa.send_followup(slot, shift, mission, agency, worker)
    return {"ok": notification["status"] == "sent", "notifications": {"sent": int(notification["status"] == "sent"), "failed": int(notification["status"] != "sent")}}


@router.post("/mission-workers/{slot_id}/remove")
async def remove_worker(slot_id: str, user=Depends(get_workspace_user)):
    slot = await db.mission_workers.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(404, "Invitation introuvable")
    shift, mission = await owned_shift(slot["shift_id"], user, editable=True)
    if slot.get("status") != "confirmed" and slot.get("response_reason") != "agency_removed":
        raise HTTPException(409, "Seul un intervenant confirmé peut être retiré")
    changed = await db.mission_workers.update_one({"id": slot_id, "status": "confirmed"}, {"$set": {"status": "cancelled", "response_reason": "agency_removed", "responded_at": s.iso(s.now_utc())}})
    if not changed.modified_count and slot.get("response_reason") != "agency_removed":
        current = await db.mission_workers.find_one({"id": slot_id}, {"_id": 0})
        if not current or current.get("response_reason") != "agency_removed":
            raise HTTPException(409, "Cette confirmation a changé. Rechargez la mission.")
    await s.update_shift_and_mission_status(shift["id"])
    # Replacement remains an explicit selection/review action by the organizer.
    return {"ok": True, "notifications": await notify_slots([slot], mission, user, "removal")}


@router.post("/missions/{mission_id}/retry-notifications")
async def retry_notices(mission_id: str, user=Depends(get_workspace_user)):
    mission = await owned_mission(mission_id, user)
    slots = await db.mission_workers.find({"mission_id": mission_id}, {"_id": 0}).to_list(None)
    counts = {"sent": 0, "failed": 0, "skipped": 0}
    for slot in slots:
        for kind in ("cancellation", "removal", "change", "validation"):
            state = slot.get(f"notice_{kind}")
            shift = await db.shifts.find_one({"id": slot["shift_id"]}, {"_id": 0})
            cancellation = mission.get("status") == "cancelled" or (shift or {}).get("deleted_at")
            if kind == "cancellation" and cancellation:
                state = state or {"sent": False}
            if kind == "removal" and slot.get("response_reason") == "agency_removed" and not cancellation:
                state = state or {"sent": False}
            if kind != "cancellation" and cancellation:
                continue
            if kind == "validation" and (slot.get("status") != "confirmed" or mission.get("project_status", "validated") != "validated"):
                continue
            if kind == "change" and slot.get("status") not in ("contacted", "confirmed"):
                continue
            if state and not state.get("sent"):
                result = await notify_slots([slot], mission, user, kind)
                for key in counts:
                    counts[key] += result[key]
    return {"ok": True, "notifications": counts}
