from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# Twilio (optional — fallback to demo if not configured)
try:
    from twilio.rest import Client as TwilioClient
    from twilio.base.exceptions import TwilioRestException
except Exception:
    TwilioClient = None
    TwilioRestException = Exception


# ---------------- Config ----------------
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24
REFRESH_TOKEN_DAYS = 30

TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_FROM = os.environ.get("TWILIO_PHONE_NUMBER", "").strip()
DEFAULT_CC = os.environ.get("DEFAULT_COUNTRY_CODE", "+33").strip()
FRONTEND_URL = os.environ.get("FRONTEND_URL", "").rstrip("/")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="ShiftFlow API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("shiftflow")


# ---------------- Helpers ----------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_MINUTES), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(days=REFRESH_TOKEN_DAYS), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                        max_age=ACCESS_TOKEN_MINUTES * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none",
                        max_age=REFRESH_TOKEN_DAYS * 86400, path="/")


def public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u.get("name", ""),
            "agency_name": u.get("agency_name", ""), "phone": u.get("phone", ""),
            "plan": u.get("plan", "free"),
            "onboarding_completed": bool(u.get("onboarding_completed")),
            "subscription_status": u.get("subscription_status"),
            "created_at": u.get("created_at")}


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------- Twilio SMS ----------------
def normalize_phone(raw: str) -> Optional[str]:
    """Return E.164 phone or None if invalid."""
    if not raw:
        return None
    p = "".join(ch for ch in raw if ch.isdigit() or ch == "+")
    if p.startswith("+"):
        return p
    # French format: 06 XX ... -> +336 XX ...
    if p.startswith("0"):
        return f"{DEFAULT_CC}{p[1:]}"
    if p.startswith("00"):
        return "+" + p[2:]
    # bare digits: prepend default CC
    return f"{DEFAULT_CC}{p}"


def twilio_ready() -> bool:
    return bool(TwilioClient and TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM)


def build_invite_message(worker: dict, shift: dict, mission: dict, agency_name: str, url: str) -> str:
    date = shift["date"]
    return (f"Bonjour {worker['first_name']}, {agency_name} vous propose la mission "
            f"« {mission['name']} » le {date} de {shift['start_time']} à {shift['end_time']} "
            f"à {mission['location']}. Rémunération : {shift['rate_hourly']}€/h. "
            f"Répondez ici : {url}")


async def send_invite_sms(slot: dict, shift: dict, mission: dict, worker: dict, agency: dict) -> dict:
    """Send SMS via Twilio if configured; otherwise log demo notification. Returns notification doc."""
    url = f"{FRONTEND_URL}/m/{slot['token']}" if FRONTEND_URL else f"/m/{slot['token']}"
    body = build_invite_message(worker, shift, mission, agency.get("agency_name", "Votre agence"), url)
    to = normalize_phone(worker.get("phone", ""))
    channel = "demo"
    sms_status = "queued_demo"
    error = None
    if twilio_ready() and to:
        try:
            tw = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
            msg = tw.messages.create(from_=TWILIO_FROM, to=to, body=body)
            channel = "sms"
            sms_status = msg.status
            logger.info(f"SMS sent to {to} sid={msg.sid} status={msg.status}")
        except TwilioRestException as e:
            sms_status = "failed"
            error = f"{e.code}: {e.msg}"
            logger.warning(f"Twilio error to {to}: {error}")
        except Exception as e:
            sms_status = "failed"
            error = str(e)
            logger.warning(f"SMS send exception: {error}")
    else:
        if not twilio_ready():
            logger.info(f"[DEMO SMS] to={to or worker.get('phone')} body={body}")
    doc = {
        "id": new_id(),
        "mission_id": mission["id"],
        "shift_id": shift["id"],
        "slot_id": slot["id"],
        "worker_id": worker["id"],
        "to": to,
        "body": body,
        "url": url,
        "channel": channel,
        "status": sms_status,
        "error": error,
        "sent_at": iso(now_utc()),
    }
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def send_owner_alert_sms(agency: dict, mission: dict, shift: dict, worker: dict, missing: int) -> dict:
    """Send a heads-up SMS to the agency owner when a confirmed worker cancels < 24h before start."""
    body = (f"Alerte ShiftFlow : {worker['first_name']} {worker['last_name']} vient d'annuler la mission "
            f"« {mission['name']} » du {shift['date']} à {shift['start_time']}. "
            f"Il manque {missing} personne{'s' if missing > 1 else ''}.")
    to = normalize_phone(agency.get("phone", ""))
    channel = "demo"
    sms_status = "queued_demo"
    error = None
    if twilio_ready() and to:
        try:
            tw = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
            msg = tw.messages.create(from_=TWILIO_FROM, to=to, body=body)
            channel = "sms"
            sms_status = msg.status
            logger.info(f"Owner alert SMS sent to {to} sid={msg.sid}")
        except Exception as e:
            sms_status = "failed"
            error = str(e)
            logger.warning(f"Owner alert SMS failed: {error}")
    else:
        logger.info(f"[DEMO OWNER ALERT] to={to} body={body}")
    doc = {
        "id": new_id(),
        "mission_id": mission["id"],
        "shift_id": shift["id"],
        "slot_id": None,
        "worker_id": None,
        "to": to,
        "body": body,
        "url": None,
        "channel": channel,
        "status": sms_status,
        "error": error,
        "kind": "owner_alert",
        "sent_at": iso(now_utc()),
    }
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    return doc



# ---------------- Schemas ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    agency_name: str
    phone: str = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class WorkerIn(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: Optional[str] = ""
    skills: List[str] = []
    note: Optional[str] = ""
    active: bool = True


class ShiftIn(BaseModel):
    date: str  # YYYY-MM-DD
    start_time: str
    end_time: str
    people_needed: int = Field(ge=1)
    rate_hourly: float = 0
    mission_type: Literal["montage", "demontage", "montage_demontage", "technique", "autre"] = "montage"
    skill_required: Optional[str] = ""
    description: Optional[str] = ""


class MissionIn(BaseModel):
    name: str
    location: str
    address: Optional[str] = ""
    description: Optional[str] = ""
    cascade_enabled: bool = True
    followup_hours: int = 2
    shifts: List[ShiftIn] = Field(min_length=1)


class MissionUpdateIn(BaseModel):
    name: str
    location: str
    address: Optional[str] = ""
    description: Optional[str] = ""
    cascade_enabled: bool = True
    followup_hours: int = 2


class SelectWorkersIn(BaseModel):
    worker_ids: List[str]


class ConfirmIn(BaseModel):
    reason: Optional[str] = ""


# ---------------- Cascade Logic (per-shift) ----------------
async def cascade_next_for_shift(shift_id: str):
    shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    if not shift:
        return
    mission = await db.missions.find_one({"id": shift["mission_id"]}, {"_id": 0})
    if not mission or not mission.get("cascade_enabled", True) or mission.get("status") == "cancelled":
        return
    slots = await db.mission_workers.find({"shift_id": shift_id}, {"_id": 0}).sort("priority", 1).to_list(1000)
    need = shift["people_needed"]
    agency = await db.users.find_one({"id": mission["agency_id"]}, {"_id": 0})
    for slot in slots:
        active_count = sum(1 for s in slots if s["status"] in ("contacted", "confirmed"))
        if active_count >= need:
            break
        if slot["status"] == "pending":
            await db.mission_workers.update_one(
                {"id": slot["id"]},
                {"$set": {"status": "contacted", "contacted_at": iso(now_utc())}}
            )
            slot["status"] = "contacted"
            slot["contacted_at"] = iso(now_utc())
            worker = await db.workers.find_one({"id": slot["worker_id"]}, {"_id": 0})
            if worker and agency:
                await send_invite_sms(slot, shift, mission, worker, agency)


async def update_shift_and_mission_status(shift_id: str):
    shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    if not shift:
        return
    slots = await db.mission_workers.find({"shift_id": shift_id}, {"_id": 0}).to_list(1000)
    confirmed = sum(1 for s in slots if s["status"] == "confirmed")
    filled = confirmed >= shift["people_needed"]
    new_status = "filled" if filled else "in_progress"
    if shift.get("status") != "cancelled":
        await db.shifts.update_one({"id": shift_id}, {"$set": {"status": new_status, "confirmed_count": confirmed}})

    # Mission status = filled if all shifts filled, else in_progress
    mission_id = shift["mission_id"]
    mission = await db.missions.find_one({"id": mission_id}, {"_id": 0})
    if not mission or mission.get("status") == "cancelled":
        return
    all_shifts = await db.shifts.find({"mission_id": mission_id}, {"_id": 0}).to_list(1000)
    if all_shifts and all(s.get("status") == "filled" for s in all_shifts):
        await db.missions.update_one({"id": mission_id}, {"$set": {"status": "filled"}})
    else:
        await db.missions.update_one({"id": mission_id}, {"$set": {"status": "in_progress"}})


# ---------------- Auth ----------------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email")
    user = {"id": new_id(), "email": email, "password_hash": hash_password(payload.password),
            "name": payload.name, "agency_name": payload.agency_name, "phone": payload.phone,
            "role": "admin", "created_at": iso(now_utc())}
    await db.users.insert_one(user)
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"user": public_user(user), "access_token": access}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"user": public_user(user), "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return public_user(user)


class UpdateProfileIn(BaseModel):
    name: str
    agency_name: str
    phone: str = ""


@api.put("/auth/me")
async def update_me(payload: UpdateProfileIn, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": payload.model_dump()})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(updated)


@api.post("/auth/forgot-password")
async def forgot(payload: ForgotIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "id": new_id(), "user_id": user["id"], "token": token,
            "expires_at": iso(now_utc() + timedelta(hours=1)), "used": False,
        })
        logger.info(f"[RESET LINK] /reset-password?token={token} for {email}")
        return {"ok": True, "demo_token": token}
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset(payload: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": payload.token, "used": False})
    if not rec:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré")
    if datetime.fromisoformat(rec["expires_at"]) < now_utc():
        raise HTTPException(status_code=400, detail="Lien expiré")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    await db.password_reset_tokens.update_one({"id": rec["id"]}, {"$set": {"used": True}})
    return {"ok": True}


# ---------------- Workers ----------------
@api.get("/workers")
async def list_workers(q: Optional[str] = None, skill: Optional[str] = None, user=Depends(get_current_user)):
    query = {"agency_id": user["id"]}
    if skill:
        query["skills"] = skill
    workers = await db.workers.find(query, {"_id": 0}).sort("last_name", 1).to_list(2000)
    if q:
        ql = q.lower()
        workers = [w for w in workers if ql in (w["first_name"] + " " + w["last_name"]).lower() or ql in w.get("phone", "")]
    return workers


@api.post("/workers")
async def create_worker(payload: WorkerIn, user=Depends(get_current_user)):
    await check_quota_or_raise(user, "worker")  # noqa: F821 (defined later)
    w = {"id": new_id(), "agency_id": user["id"], **payload.model_dump(), "created_at": iso(now_utc())}
    await db.workers.insert_one(w)
    w.pop("_id", None)
    return w


@api.put("/workers/{worker_id}")
async def update_worker(worker_id: str, payload: WorkerIn, user=Depends(get_current_user)):
    res = await db.workers.update_one({"id": worker_id, "agency_id": user["id"]}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Intervenant introuvable")
    return await db.workers.find_one({"id": worker_id}, {"_id": 0})


@api.delete("/workers/{worker_id}")
async def delete_worker(worker_id: str, user=Depends(get_current_user)):
    res = await db.workers.delete_one({"id": worker_id, "agency_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Intervenant introuvable")
    return {"ok": True}


# ---------------- Missions & Shifts ----------------
def compute_shift_estimate(shift: dict) -> float:
    """hours × rate_hourly × people_needed (as a target cost)."""
    try:
        s = shift["start_time"].split(":")
        e = shift["end_time"].split(":")
        sh = int(s[0]) + int(s[1]) / 60
        eh = int(e[0]) + int(e[1]) / 60
        hours = eh - sh
        if hours <= 0:
            hours += 24  # overnight
        return round(hours * float(shift.get("rate_hourly", 0)) * int(shift.get("people_needed", 0)), 2)
    except Exception:
        return 0.0


async def mission_with_shifts(mission: dict, include_slots: bool = False) -> dict:
    shifts = await db.shifts.find({"mission_id": mission["id"]}, {"_id": 0}).sort("date", 1).to_list(500)
    for sh in shifts:
        sh["estimated_cost"] = compute_shift_estimate(sh)
        if include_slots:
            slots = await db.mission_workers.find({"shift_id": sh["id"]}, {"_id": 0}).sort("priority", 1).to_list(1000)
            worker_ids = [s["worker_id"] for s in slots]
            workers = {w["id"]: w for w in await db.workers.find({"id": {"$in": worker_ids}}, {"_id": 0}).to_list(2000)}
            for s in slots:
                s["worker"] = workers.get(s["worker_id"])
            sh["slots"] = slots
    # aggregate: earliest date, total people & confirmed
    if shifts:
        mission["first_date"] = min(sh["date"] for sh in shifts)
        mission["last_date"] = max(sh["date"] for sh in shifts)
        mission["total_needed"] = sum(sh["people_needed"] for sh in shifts)
        mission["total_confirmed"] = sum(sh.get("confirmed_count", 0) for sh in shifts)
    else:
        mission["first_date"] = None
        mission["last_date"] = None
        mission["total_needed"] = 0
        mission["total_confirmed"] = 0
    mission["shifts"] = shifts
    return mission


@api.get("/missions")
async def list_missions(user=Depends(get_current_user)):
    missions = await db.missions.find({"agency_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    for m in missions:
        await mission_with_shifts(m, include_slots=False)
    return missions


@api.post("/missions")
async def create_mission(payload: MissionIn, user=Depends(get_current_user)):
    await check_quota_or_raise(user, "mission")  # noqa: F821 (defined later)
    mission = {
        "id": new_id(),
        "agency_id": user["id"],
        "name": payload.name,
        "location": payload.location,
        "address": payload.address,
        "description": payload.description,
        "cascade_enabled": payload.cascade_enabled,
        "followup_hours": payload.followup_hours,
        "status": "draft",
        "created_at": iso(now_utc()),
    }
    await db.missions.insert_one(mission)
    for s in payload.shifts:
        shift = {
            "id": new_id(),
            "mission_id": mission["id"],
            "agency_id": user["id"],
            **s.model_dump(),
            "status": "draft",
            "confirmed_count": 0,
            "created_at": iso(now_utc()),
        }
        await db.shifts.insert_one(shift)
        shift.pop("_id", None)
    mission.pop("_id", None)
    return await mission_with_shifts({**mission}, include_slots=True)


@api.get("/missions/{mission_id}")
async def get_mission(mission_id: str, user=Depends(get_current_user)):
    mission = await db.missions.find_one({"id": mission_id, "agency_id": user["id"]}, {"_id": 0})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    return await mission_with_shifts(mission, include_slots=True)


@api.put("/missions/{mission_id}")
async def update_mission(mission_id: str, payload: MissionUpdateIn, user=Depends(get_current_user)):
    res = await db.missions.update_one({"id": mission_id, "agency_id": user["id"]}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    m = await db.missions.find_one({"id": mission_id}, {"_id": 0})
    return await mission_with_shifts(m, include_slots=True)


@api.delete("/missions/{mission_id}")
async def delete_mission(mission_id: str, user=Depends(get_current_user)):
    res = await db.missions.delete_one({"id": mission_id, "agency_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    shift_ids = [s["id"] for s in await db.shifts.find({"mission_id": mission_id}, {"_id": 0}).to_list(500)]
    await db.shifts.delete_many({"mission_id": mission_id})
    if shift_ids:
        await db.mission_workers.delete_many({"shift_id": {"$in": shift_ids}})
    return {"ok": True}


@api.post("/missions/{mission_id}/cancel")
async def cancel_mission(mission_id: str, user=Depends(get_current_user)):
    res = await db.missions.update_one({"id": mission_id, "agency_id": user["id"]}, {"$set": {"status": "cancelled"}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    await db.shifts.update_many({"mission_id": mission_id}, {"$set": {"status": "cancelled"}})
    return {"ok": True}


# ---- Shift-level actions ----
@api.post("/shifts/{shift_id}/select-workers")
async def select_workers_for_shift(shift_id: str, payload: SelectWorkersIn, user=Depends(get_current_user)):
    shift = await db.shifts.find_one({"id": shift_id, "agency_id": user["id"]}, {"_id": 0})
    if not shift:
        raise HTTPException(status_code=404, detail="Shift introuvable")
    existing = await db.mission_workers.find({"shift_id": shift_id}, {"_id": 0}).to_list(1000)
    if existing:
        raise HTTPException(status_code=400, detail="Les intervenants ont déjà été sélectionnés pour ce shift")
    slots = []
    for idx, worker_id in enumerate(payload.worker_ids):
        worker = await db.workers.find_one({"id": worker_id, "agency_id": user["id"]}, {"_id": 0})
        if not worker:
            continue
        slots.append({
            "id": new_id(),
            "mission_id": shift["mission_id"],
            "shift_id": shift_id,
            "worker_id": worker_id,
            "priority": idx,
            "token": secrets.token_urlsafe(24),
            "status": "pending",
            "contacted_at": None,
            "responded_at": None,
            "response_reason": None,
            "created_at": iso(now_utc()),
        })
    if slots:
        await db.mission_workers.insert_many(slots)
    await db.shifts.update_one({"id": shift_id}, {"$set": {"status": "in_progress"}})
    await db.missions.update_one({"id": shift["mission_id"]}, {"$set": {"status": "in_progress"}})
    await cascade_next_for_shift(shift_id)
    await update_shift_and_mission_status(shift_id)
    return {"ok": True, "slots_created": len(slots)}


@api.post("/shifts/{shift_id}/next-cascade")
async def force_cascade(shift_id: str, user=Depends(get_current_user)):
    shift = await db.shifts.find_one({"id": shift_id, "agency_id": user["id"]}, {"_id": 0})
    if not shift:
        raise HTTPException(status_code=404, detail="Shift introuvable")
    await cascade_next_for_shift(shift_id)
    await update_shift_and_mission_status(shift_id)
    return {"ok": True}


@api.post("/mission-workers/{slot_id}/mark-no-answer")
async def mark_no_answer(slot_id: str, user=Depends(get_current_user)):
    slot = await db.mission_workers.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot introuvable")
    shift = await db.shifts.find_one({"id": slot["shift_id"], "agency_id": user["id"]}, {"_id": 0})
    if not shift:
        raise HTTPException(status_code=404, detail="Shift introuvable")
    await db.mission_workers.update_one({"id": slot_id}, {"$set": {"status": "no_answer", "responded_at": iso(now_utc())}})
    await cascade_next_for_shift(slot["shift_id"])
    await update_shift_and_mission_status(slot["shift_id"])
    return {"ok": True}


# ---------------- Public (token) ----------------
@api.get("/public/mission/{token}")
async def public_get(token: str):
    slot = await db.mission_workers.find_one({"token": token}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Lien invalide")
    shift = await db.shifts.find_one({"id": slot["shift_id"]}, {"_id": 0})
    mission = await db.missions.find_one({"id": slot["mission_id"]}, {"_id": 0})
    worker = await db.workers.find_one({"id": slot["worker_id"]}, {"_id": 0})
    if not mission or not worker or not shift:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    agency = await db.users.find_one({"id": mission["agency_id"]}, {"_id": 0, "password_hash": 0})
    return {
        "slot": {"id": slot["id"], "status": slot["status"]},
        "shift": {
            "date": shift["date"], "start_time": shift["start_time"], "end_time": shift["end_time"],
            "rate_hourly": shift["rate_hourly"], "mission_type": shift["mission_type"],
            "description": shift.get("description", "") or mission.get("description", ""),
        },
        "mission": {
            "name": mission["name"], "location": mission["location"],
            "address": mission.get("address", ""), "status": mission.get("status", ""),
        },
        "worker": {"first_name": worker["first_name"], "last_name": worker["last_name"]},
        "agency": {"name": agency.get("agency_name", "") if agency else ""},
    }


@api.post("/public/mission/{token}/accept")
async def public_accept(token: str):
    slot = await db.mission_workers.find_one({"token": token}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Lien invalide")
    if slot["status"] in ("confirmed", "refused"):
        return {"ok": True, "status": slot["status"]}
    mission = await db.missions.find_one({"id": slot["mission_id"]}, {"_id": 0})
    shift = await db.shifts.find_one({"id": slot["shift_id"]}, {"_id": 0})
    if mission and mission.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Cette mission a été annulée")
    slots = await db.mission_workers.find({"shift_id": slot["shift_id"]}, {"_id": 0}).to_list(1000)
    confirmed_count = sum(1 for s in slots if s["status"] == "confirmed")
    if shift and confirmed_count >= shift["people_needed"]:
        await db.mission_workers.update_one(
            {"id": slot["id"]},
            {"$set": {"status": "cancelled", "responded_at": iso(now_utc()),
                      "response_reason": "Équipe déjà complète"}}
        )
        return {"ok": False, "status": "cancelled", "reason": "Équipe déjà complète"}
    await db.mission_workers.update_one({"id": slot["id"]},
                                        {"$set": {"status": "confirmed", "responded_at": iso(now_utc())}})
    await update_shift_and_mission_status(slot["shift_id"])
    await cascade_next_for_shift(slot["shift_id"])
    await update_shift_and_mission_status(slot["shift_id"])
    return {"ok": True, "status": "confirmed"}


@api.post("/public/mission/{token}/refuse")
async def public_refuse(token: str, payload: ConfirmIn):
    slot = await db.mission_workers.find_one({"token": token}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Lien invalide")
    if slot["status"] in ("confirmed", "refused"):
        return {"ok": True, "status": slot["status"]}
    await db.mission_workers.update_one(
        {"id": slot["id"]},
        {"$set": {"status": "refused", "responded_at": iso(now_utc()), "response_reason": payload.reason}}
    )
    await cascade_next_for_shift(slot["shift_id"])
    await update_shift_and_mission_status(slot["shift_id"])
    return {"ok": True, "status": "refused"}


@api.post("/public/mission/{token}/cancel-confirmation")
async def public_cancel(token: str):
    slot = await db.mission_workers.find_one({"token": token}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Lien invalide")
    if slot["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Vous n'êtes pas confirmé sur cette mission")
    await db.mission_workers.update_one(
        {"id": slot["id"]},
        {"$set": {"status": "cancelled", "responded_at": iso(now_utc()),
                  "response_reason": "Annulation intervenant"}}
    )
    await cascade_next_for_shift(slot["shift_id"])
    await update_shift_and_mission_status(slot["shift_id"])
    # Owner alert if <24h before shift
    try:
        shift = await db.shifts.find_one({"id": slot["shift_id"]}, {"_id": 0})
        mission = await db.missions.find_one({"id": slot["mission_id"]}, {"_id": 0})
        worker = await db.workers.find_one({"id": slot["worker_id"]}, {"_id": 0})
        if shift and mission and worker:
            agency = await db.users.find_one({"id": mission["agency_id"]}, {"_id": 0})
            dt = datetime.fromisoformat(f"{shift['date']}T{shift['start_time']}:00+00:00")
            if (dt - now_utc()) <= timedelta(hours=24):
                slots = await db.mission_workers.find({"shift_id": shift["id"]}, {"_id": 0}).to_list(1000)
                confirmed = sum(1 for s in slots if s["status"] == "confirmed")
                missing = max(0, shift["people_needed"] - confirmed)
                await send_owner_alert_sms(agency, mission, shift, worker, missing)
    except Exception as e:
        logger.warning(f"owner alert failed: {e}")
    return {"ok": True}


# ---------------- Duplication ----------------
class ShiftDuplicateIn(BaseModel):
    new_date: str


@api.post("/missions/{mission_id}/duplicate")
async def duplicate_mission(mission_id: str, user=Depends(get_current_user)):
    await check_quota_or_raise(user, "mission")  # noqa: F821
    original = await db.missions.find_one({"id": mission_id, "agency_id": user["id"]}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    new_mission = {
        "id": new_id(),
        "agency_id": user["id"],
        "name": original["name"] + " (copie)",
        "location": original["location"],
        "address": original.get("address", ""),
        "description": original.get("description", ""),
        "cascade_enabled": original.get("cascade_enabled", True),
        "followup_hours": original.get("followup_hours", 2),
        "status": "draft",
        "created_at": iso(now_utc()),
    }
    await db.missions.insert_one(new_mission)
    new_mission.pop("_id", None)
    original_shifts = await db.shifts.find({"mission_id": mission_id}, {"_id": 0}).sort("date", 1).to_list(500)
    for sh in original_shifts:
        try:
            base_dt = datetime.fromisoformat(f"{sh['date']}T00:00:00+00:00")
            new_date = (base_dt + timedelta(days=7)).date().isoformat()
        except Exception:
            new_date = sh["date"]
        clone = {
            "id": new_id(),
            "mission_id": new_mission["id"],
            "agency_id": user["id"],
            "date": new_date,
            "start_time": sh["start_time"],
            "end_time": sh["end_time"],
            "people_needed": sh["people_needed"],
            "rate_hourly": sh["rate_hourly"],
            "mission_type": sh["mission_type"],
            "skill_required": sh.get("skill_required", ""),
            "description": sh.get("description", ""),
            "status": "draft",
            "confirmed_count": 0,
            "created_at": iso(now_utc()),
        }
        await db.shifts.insert_one(clone)
    return await mission_with_shifts({**new_mission}, include_slots=True)


@api.post("/shifts/{shift_id}/duplicate")
async def duplicate_shift(shift_id: str, payload: ShiftDuplicateIn, user=Depends(get_current_user)):
    original = await db.shifts.find_one({"id": shift_id, "agency_id": user["id"]}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Shift introuvable")
    clone = {
        "id": new_id(),
        "mission_id": original["mission_id"],
        "agency_id": user["id"],
        "date": payload.new_date,
        "start_time": original["start_time"],
        "end_time": original["end_time"],
        "people_needed": original["people_needed"],
        "rate_hourly": original["rate_hourly"],
        "mission_type": original["mission_type"],
        "skill_required": original.get("skill_required", ""),
        "description": original.get("description", ""),
        "status": "draft",
        "confirmed_count": 0,
        "created_at": iso(now_utc()),
    }
    await db.shifts.insert_one(clone)
    clone.pop("_id", None)
    return clone



@api.get("/dashboard/summary")
async def dashboard_summary(user=Depends(get_current_user)):
    missions = await db.missions.find({"agency_id": user["id"]}, {"_id": 0}).to_list(2000)
    for m in missions:
        await mission_with_shifts(m, include_slots=False)
    workers_count = await db.workers.count_documents({"agency_id": user["id"]})
    today = now_utc().date().isoformat()

    upcoming, ongoing, past = [], [], []
    for m in missions:
        if m.get("status") == "cancelled" or (m.get("last_date") and m["last_date"] < today):
            past.append(m)
        elif m.get("first_date") and m["first_date"] > today:
            upcoming.append(m)
        else:
            ongoing.append(m)

    pending_count = 0
    for m in missions:
        if m.get("status") == "cancelled":
            continue
        for sh in m.get("shifts", []):
            if sh.get("status") == "cancelled":
                continue
            slots = await db.mission_workers.find({"shift_id": sh["id"]}, {"_id": 0}).to_list(1000)
            pending_count += sum(1 for s in slots if s["status"] in ("pending", "contacted"))

    return {
        "upcoming": upcoming,
        "ongoing": ongoing,
        "past": past[-20:],
        "workers_count": workers_count,
        "pending_confirmations": pending_count,
        "missions_total": len(missions),
        "twilio_ready": twilio_ready(),
    }


@api.get("/dashboard/sms-stats")
async def sms_stats(user=Depends(get_current_user)):
    # Restrict to this agency's notifications
    missions = await db.missions.find({"agency_id": user["id"]}, {"_id": 0}).to_list(5000)
    mids = [m["id"] for m in missions]
    if not mids:
        return {"sent_this_month": 0, "sms_total": 0, "demo_total": 0,
                "invites_sent": 0, "invites_responded": 0, "response_rate": 0}
    now = now_utc()
    month_start = iso(datetime(now.year, now.month, 1, tzinfo=timezone.utc))
    all_notifs = await db.notifications.find({"mission_id": {"$in": mids}}, {"_id": 0}).to_list(20000)
    sent_this_month = sum(1 for n in all_notifs if n.get("sent_at", "") >= month_start)
    sms_total = sum(1 for n in all_notifs if n.get("channel") == "sms")
    demo_total = sum(1 for n in all_notifs if n.get("channel") == "demo")
    # response rate: for invite notifications, count how many corresponding slots got responded
    invite_slot_ids = [n["slot_id"] for n in all_notifs if n.get("kind", "invite") != "owner_alert" and n.get("slot_id")]
    invites_sent = len(set(invite_slot_ids))
    responded = 0
    if invite_slot_ids:
        slots = await db.mission_workers.find({"id": {"$in": list(set(invite_slot_ids))}}, {"_id": 0}).to_list(5000)
        responded = sum(1 for s in slots if s["status"] in ("confirmed", "refused"))
    rate = round((responded / invites_sent) * 100, 1) if invites_sent else 0
    return {
        "sent_this_month": sent_this_month,
        "sms_total": sms_total,
        "demo_total": demo_total,
        "invites_sent": invites_sent,
        "invites_responded": responded,
        "response_rate": rate,
    }


class TestSmsIn(BaseModel):
    to: Optional[str] = None  # if omitted, use user's phone


@api.post("/notifications/test-sms")
async def test_sms(payload: TestSmsIn, user=Depends(get_current_user)):
    target = normalize_phone(payload.to or user.get("phone", ""))
    if not target:
        raise HTTPException(status_code=400, detail="Aucun numéro fourni ni renseigné sur votre profil")
    body = f"[Test ShiftFlow] Bonjour {user.get('name', '')}, la configuration Twilio de {user.get('agency_name', 'votre agence')} fonctionne."
    channel = "demo"
    sms_status = "queued_demo"
    error = None
    if twilio_ready():
        try:
            tw = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
            msg = tw.messages.create(from_=TWILIO_FROM, to=target, body=body)
            channel = "sms"
            sms_status = msg.status
        except Exception as e:
            sms_status = "failed"
            error = str(e)
            low = error.lower()
            if any(k in low for k in ("572006", "21608", "trial", "unverified", "verified recipient", "predefined sms templates")):
                error = ("Compte Twilio TRIAL : envoi bloqué. Ajoutez le numéro destinataire "
                         "comme 'Verified Caller ID' dans Twilio Console, ou upgradez le compte.")
            logger.warning(f"Test SMS failed: {error}")
    doc = {
        "id": new_id(), "mission_id": None, "shift_id": None, "slot_id": None,
        "worker_id": None, "to": target, "body": body, "url": None,
        "channel": channel, "status": sms_status, "error": error, "kind": "test",
        "sent_at": iso(now_utc()),
    }
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    return {"success": error is None, "channel": channel, "to": target, "status": sms_status, "error": error}


# ---------------- Cron: 24h reminders ----------------
async def _run_reminders():
    """Iterate shifts that start in ~24h and send SMS reminders to confirmed workers not yet reminded."""
    now = now_utc()
    window_start = now + timedelta(hours=23)
    window_end = now + timedelta(hours=25)
    # Fetch shifts with date in the relevant window (today or tomorrow ISO)
    candidate_dates = {window_start.date().isoformat(), window_end.date().isoformat()}
    shifts = await db.shifts.find({"date": {"$in": list(candidate_dates)}, "status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(2000)
    count_sent = 0
    for shift in shifts:
        try:
            dt = datetime.fromisoformat(f"{shift['date']}T{shift['start_time']}:00+00:00")
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
        slots = await db.mission_workers.find({"shift_id": shift["id"], "status": "confirmed",
                                               "reminder_sent": {"$ne": True}}, {"_id": 0}).to_list(500)
        for slot in slots:
            worker = await db.workers.find_one({"id": slot["worker_id"]}, {"_id": 0})
            if not worker:
                continue
            url = f"{FRONTEND_URL}/m/{slot['token']}" if FRONTEND_URL else f"/m/{slot['token']}"
            body = (f"Rappel {agency.get('agency_name','')} : vous êtes confirmé pour « {mission['name']} » "
                    f"demain {shift['date']} de {shift['start_time']} à {shift['end_time']} à {mission['location']}. "
                    f"Détails : {url}")
            to = normalize_phone(worker.get("phone", ""))
            channel, sms_status, error = "demo", "queued_demo", None
            if twilio_ready() and to:
                try:
                    tw = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
                    msg = tw.messages.create(from_=TWILIO_FROM, to=to, body=body)
                    channel, sms_status = "sms", msg.status
                except Exception as e:
                    sms_status, error = "failed", str(e)
            await db.notifications.insert_one({
                "id": new_id(), "mission_id": mission["id"], "shift_id": shift["id"],
                "slot_id": slot["id"], "worker_id": worker["id"], "to": to, "body": body, "url": url,
                "channel": channel, "status": sms_status, "error": error, "kind": "reminder",
                "sent_at": iso(now_utc()),
            })
            await db.mission_workers.update_one({"id": slot["id"]}, {"$set": {"reminder_sent": True}})
            count_sent += 1
    logger.info(f"Cron reminders: sent {count_sent}")
    return count_sent


import asyncio


@api.post("/cron/reminders")
async def cron_reminders(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    auth = request.headers.get("Authorization", "")
    expected = os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not expected or not auth.startswith("Bearer ") or not secrets.compare_digest(auth[7:], expected):
        raise HTTPException(status_code=401, detail="Unauthorized")
    run_id = request.headers.get("X-Webhook-Id", new_id())
    # Idempotency: skip if same run_id already processed
    if await db.cron_runs.find_one({"run_id": run_id}):
        return {"ok": True, "duplicate": True}
    await db.cron_runs.insert_one({"run_id": run_id, "kind": "reminders", "at": iso(now_utc())})
    asyncio.create_task(_run_reminders())
    return {"ok": True, "queued": True}


@api.get("/config")
async def get_config(user=Depends(get_current_user)):
    return {
        "twilio_ready": twilio_ready(),
        "twilio_from": TWILIO_FROM if twilio_ready() else None,
        "default_country_code": DEFAULT_CC,
    }


@api.get("/notifications/recent")
async def recent_notifications(user=Depends(get_current_user), limit: int = 30):
    missions = await db.missions.find({"agency_id": user["id"]}, {"_id": 0}).to_list(500)
    mids = [m["id"] for m in missions]
    docs = await db.notifications.find({"mission_id": {"$in": mids}}, {"_id": 0}).sort("sent_at", -1).to_list(limit)
    return docs


# ---------------- Seed ----------------
async def seed_admin_and_demo():
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        user = {"id": new_id(), "email": admin_email, "password_hash": hash_password(admin_password),
                "name": os.environ.get("ADMIN_NAME", "Tanguy"),
                "agency_name": os.environ.get("ADMIN_AGENCY", "Demo Event Agency"),
                "phone": os.environ.get("ADMIN_PHONE", ""), "role": "admin", "created_at": iso(now_utc())}
        await db.users.insert_one(user)
        agency_id = user["id"]
        logger.info(f"Seeded admin {admin_email}")
    else:
        if not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        agency_id = existing["id"]

    # Purge legacy demo data (old schema without shifts) to migrate cleanly
    legacy = await db.missions.find_one({"agency_id": agency_id, "date": {"$exists": True}})
    if legacy:
        legacy_ids = [m["id"] for m in await db.missions.find({"agency_id": agency_id, "date": {"$exists": True}}, {"_id": 0}).to_list(500)]
        await db.mission_workers.delete_many({"mission_id": {"$in": legacy_ids}})
        await db.missions.delete_many({"id": {"$in": legacy_ids}})
        logger.info(f"Purged {len(legacy_ids)} legacy missions (pre-shift schema)")

    if await db.workers.count_documents({"agency_id": agency_id}) == 0:
        demo_workers = [
            ("Thomas", "Dupont", "0601020301", ["montage"]),
            ("Lucas", "Martin", "0601020302", ["montage", "demontage"]),
            ("Kevin", "Bernard", "0601020303", ["montage"]),
            ("Julien", "Morel", "0601020304", ["demontage"]),
            ("Hugo", "Leroy", "0601020305", ["montage", "technique"]),
            ("Paul", "Martin", "0601020306", ["montage"]),
            ("Antoine", "Petit", "0601020307", ["demontage"]),
            ("Nathan", "Robert", "0601020308", ["montage"]),
            ("Arthur", "Simon", "0601020309", ["technique"]),
            ("Maxime", "Durand", "0601020310", ["montage", "demontage"]),
        ]
        docs = [{"id": new_id(), "agency_id": agency_id, "first_name": fn, "last_name": ln, "phone": phone,
                 "email": "", "skills": sk, "note": "", "active": True, "created_at": iso(now_utc())}
                for fn, ln, phone, sk in demo_workers]
        await db.workers.insert_many(docs)
        logger.info("Seeded demo workers")

    # Seed demo mission with 3 shifts if none exist
    if await db.missions.count_documents({"agency_id": agency_id}) == 0:
        mission = {
            "id": new_id(), "agency_id": agency_id,
            "name": "Montage Salon Nike",
            "location": "Lille Grand Palais",
            "address": "1 Boulevard des Cités Unies, 59777 Lille",
            "description": "Salon annuel Nike — montage puis démontage.",
            "cascade_enabled": True, "followup_hours": 2,
            "status": "in_progress", "created_at": iso(now_utc()),
        }
        await db.missions.insert_one(mission)
        shifts_data = [
            ("2026-08-31", "07:00", "14:00", 8, 15, "montage"),
            ("2026-09-01", "07:00", "14:00", 8, 15, "montage"),
            ("2026-09-02", "18:00", "23:00", 6, 15, "demontage"),
        ]
        for date, st, et, n, rate, mt in shifts_data:
            sh = {"id": new_id(), "mission_id": mission["id"], "agency_id": agency_id,
                  "date": date, "start_time": st, "end_time": et, "people_needed": n,
                  "rate_hourly": rate, "mission_type": mt, "skill_required": "", "description": "",
                  "status": "draft", "confirmed_count": 0, "created_at": iso(now_utc())}
            await db.shifts.insert_one(sh)
        logger.info("Seeded demo mission with 3 shifts")


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.workers.create_index("agency_id")
    await db.missions.create_index("agency_id")
    await db.shifts.create_index("mission_id")
    await db.shifts.create_index("agency_id")
    await db.mission_workers.create_index("shift_id")
    await db.mission_workers.create_index("token", unique=True)
    await seed_admin_and_demo()
    logger.info(f"Twilio ready: {twilio_ready()} (from={TWILIO_FROM or 'unset'})")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


@api.get("/")
async def root():
    return {"service": "shiftflow", "ok": True, "twilio_ready": twilio_ready()}


# ---------------- Stripe / Plan / Onboarding ----------------
import stripe as stripe_lib
stripe_lib.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
FREE_MISSION_LIMIT = 1
FREE_WORKER_LIMIT = 10


async def _get_plan(user_id: str) -> str:
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    return (u or {}).get("plan", "free")


async def _active_missions_count(user_id: str) -> int:
    today = now_utc().date().isoformat()
    ms = await db.missions.find({"agency_id": user_id, "status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(2000)
    count = 0
    for m in ms:
        shifts = await db.shifts.find({"mission_id": m["id"]}, {"_id": 0}).to_list(500)
        if not shifts:
            count += 1
        else:
            last = max((s["date"] for s in shifts), default=None)
            if last and last >= today:
                count += 1
    return count


async def check_quota_or_raise(user, kind: str):
    if (await _get_plan(user["id"])) == "pro":
        return
    if kind == "mission":
        if (await _active_missions_count(user["id"])) >= FREE_MISSION_LIMIT:
            raise HTTPException(status_code=402,
                detail=f"Limite plan gratuit atteinte ({FREE_MISSION_LIMIT} mission active max). Passez au Pro pour créer des missions illimitées.")
    elif kind == "worker":
        if (await db.workers.count_documents({"agency_id": user["id"]})) >= FREE_WORKER_LIMIT:
            raise HTTPException(status_code=402,
                detail=f"Limite plan gratuit atteinte ({FREE_WORKER_LIMIT} intervenants max). Passez au Pro pour un nombre illimité.")


class OnboardingIn(BaseModel):
    team_size: str
    monthly_missions: str
    current_tool: str
    main_pain: str


@api.get("/onboarding/status")
async def onboarding_status(user=Depends(get_current_user)):
    return {"completed": bool(user.get("onboarding_completed"))}


@api.post("/onboarding")
async def submit_onboarding(payload: OnboardingIn, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "onboarding_completed": True,
        "onboarding_answers": payload.model_dump(),
        "onboarding_completed_at": iso(now_utc()),
    }})
    return {"ok": True}


@api.get("/plan/quota")
async def get_quota(user=Depends(get_current_user)):
    plan = await _get_plan(user["id"])
    missions = await _active_missions_count(user["id"])
    workers = await db.workers.count_documents({"agency_id": user["id"]})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {
        "plan": plan,
        "active_missions": missions,
        "mission_limit": None if plan == "pro" else FREE_MISSION_LIMIT,
        "workers": workers,
        "worker_limit": None if plan == "pro" else FREE_WORKER_LIMIT,
        "subscription_status": (u or {}).get("subscription_status"),
    }


class CheckoutIn(BaseModel):
    lookup_key: str
    origin_url: str


@api.post("/payments/checkout")
async def create_checkout(payload: CheckoutIn, user=Depends(get_current_user)):
    prices = stripe_lib.Price.list(lookup_keys=[payload.lookup_key], active=True, limit=1).data
    if not prices:
        raise HTTPException(status_code=400, detail=f"Prix inconnu: {payload.lookup_key}")
    price = prices[0]
    origin = payload.origin_url.rstrip("/")
    # French micro-entrepreneur franchise en base de TVA (art. 293 B du CGI): no VAT applied.
    session = stripe_lib.checkout.Session.create(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="subscription" if price.recurring else "payment",
        success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/payment/cancel",
        customer_email=user.get("email"),
        metadata={"user_id": user["id"], "lookup_key": payload.lookup_key},
        custom_text={
            "submit": {"message": "TVA non applicable, art. 293 B du CGI"},
        },
    )
    await db.payment_transactions.insert_one({
        "id": new_id(), "session_id": session.id, "user_id": user["id"],
        "lookup_key": payload.lookup_key, "amount": (price.unit_amount or 0),
        "currency": price.currency, "status": "initiated", "payment_status": "pending",
        "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
    })
    return {"checkout_url": session.url, "session_id": session.id}


@api.get("/payments/status/{session_id}")
async def payment_status_endpoint(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction inconnue")
    if record.get("payment_status") != "paid":
        try:
            s = stripe_lib.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "stripe_subscription_id": s.subscription,
                              "updated_at": iso(now_utc())}},
                )
                if s.metadata and s.metadata.get("user_id"):
                    await db.users.update_one({"id": s.metadata["user_id"]}, {"$set": {
                        "plan": "pro", "subscription_status": "active",
                        "stripe_customer_id": s.customer, "stripe_subscription_id": s.subscription,
                    }})
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe_lib.error.StripeError:
            pass
    return {"session_id": record["session_id"],
            "status": record["status"], "payment_status": record["payment_status"]}


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe_lib.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj = event["data"]["object"]
    t = event["type"]
    if t == "checkout.session.completed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"),
                      "stripe_subscription_id": obj.get("subscription"),
                      "updated_at": iso(now_utc())}},
        )
        uid = (obj.get("metadata") or {}).get("user_id")
        if uid:
            await db.users.update_one({"id": uid}, {"$set": {
                "plan": "pro", "subscription_status": "active",
                "stripe_customer_id": obj.get("customer"),
                "stripe_subscription_id": obj.get("subscription"),
            }})
    elif t == "customer.subscription.deleted":
        await db.users.update_one({"stripe_customer_id": obj.get("customer")}, {"$set": {
            "plan": "free", "subscription_status": "canceled",
        }})
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one({"session_id": obj["id"]},
            {"$set": {"status": "expired", "payment_status": "expired", "updated_at": iso(now_utc())}})
    return {"status": "ok"}


@api.post("/payments/portal")
async def billing_portal(request: Request, user=Depends(get_current_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not u or not u.get("stripe_customer_id"):
        raise HTTPException(status_code=400, detail="Aucun abonnement actif")
    origin = request.headers.get("origin", FRONTEND_URL)
    session = stripe_lib.billing_portal.Session.create(
        customer=u["stripe_customer_id"],
        return_url=f"{origin}/app/settings",
    )
    return {"url": session.url}


app.include_router(api)

# CORS
_origins_env = os.environ.get("CORS_ORIGINS", "*")
if _origins_env.strip() == "*":
    _origins = [FRONTEND_URL] if FRONTEND_URL else []
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins or ["*"],
        allow_credentials=bool(_origins),
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in _origins_env.split(",") if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
