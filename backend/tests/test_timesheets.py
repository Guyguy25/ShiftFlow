"""Offline regression tests for WhatsApp timesheets. No external services needed.
Run: python -m unittest discover -s backend/tests -p test_timesheets.py
"""
import importlib.util
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import ModuleType
from unittest import TestCase
from unittest.mock import AsyncMock, patch

import mongomock
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

BACKEND = Path(__file__).parents[1]


class Cursor:
    def __init__(self, cursor): self.cursor = cursor
    def sort(self, *args): self.cursor = self.cursor.sort(*args); return self
    async def to_list(self, n):
        rows = list(self.cursor)
        return rows if n is None else rows[:n]


class Collection:
    def __init__(self, collection): self.collection = collection
    def find(self, *args, **kwargs): return Cursor(self.collection.find(*args, **kwargs))
    def __getattr__(self, name):
        async def call(*args, **kwargs): return getattr(self.collection, name)(*args, **kwargs)
        return call


class Database:
    def __init__(self): self.raw = mongomock.MongoClient().test
    def __getattr__(self, name): return Collection(self.raw[name])


class TimesheetTests(TestCase):
    def setUp(self):
        self.db = Database()
        server = ModuleType("server")
        server.db = self.db
        server.now_utc = lambda: datetime.now(timezone.utc)
        server.iso = lambda value: value.isoformat()
        server.new_id = lambda: str(uuid.uuid4())
        server.FRONTEND_URL = "https://shiftflow.test"
        server.normalize_phone = lambda value: value if value.startswith("+") else None
        server.has_active_product_access = lambda user: True

        async def get_user(request: Request):
            return {"id": request.headers.get("x-agency", "a")}
        server.get_current_user = get_user

        whatsapp = ModuleType("whatsapp_routes")
        whatsapp.send_whatsapp_text = AsyncMock(return_value={"messageId": "sent"})
        modules = patch.dict(sys.modules, {"server": server, "whatsapp_routes": whatsapp})
        modules.start()
        self.addCleanup(modules.stop)
        spec = importlib.util.spec_from_file_location("timesheets", BACKEND / "timesheets.py")
        self.ts = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.ts)
        app = FastAPI()
        app.include_router(self.ts.router, prefix="/api")
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

        yesterday = (datetime.now(self.ts.LOCAL_TZ) - timedelta(days=1)).date().isoformat()
        self.db.raw.users.insert_many([{"id": "a", "agency_name": "Agence A"}, {"id": "b", "agency_name": "Agence B"}])
        self.db.raw.missions.insert_many([
            {"id": "ma", "agency_id": "a", "name": "Spectacle", "location": "Lille", "status": "filled"},
            {"id": "mb", "agency_id": "b", "name": "Autre", "location": "Paris", "status": "filled"},
        ])
        self.db.raw.shifts.insert_one({"id": "sha", "mission_id": "ma", "agency_id": "a", "date": yesterday,
                                      "start_time": "20:00", "end_time": "02:00",
                                      "pay_type": "hourly", "rate_hourly": 20, "pay_basis": "gross"})
        self.db.raw.workers.insert_one({"id": "wa", "agency_id": "a", "first_name": "Paul",
                                        "last_name": "Martin", "phone": "+33612345678"})
        self.db.raw.mission_workers.insert_one({"id": "sla", "agency_id": "a", "mission_id": "ma",
                                                "shift_id": "sha", "worker_id": "wa", "status": "confirmed"})

    def _send(self):
        response = self.client.post("/api/missions/ma/timesheets/send", json={})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["sent"], 1)
        self.assertEqual(self.ts.wa.send_whatsapp_text.await_count, 1)
        # Unwrap the bearer token delivered only through WhatsApp.
        body = self.ts.wa.send_whatsapp_text.await_args.args[2]
        return body.split("/h/")[1].strip()

    def test_overnight_and_unpaid_break(self):
        shift = self.db.raw.shifts.find_one({"id": "sha"})
        start, end = self.ts.shift_bounds(shift)
        self.assertEqual(start.date().isoformat(), shift["date"])
        self.assertEqual((end - start).days, 0)  # 6 hours, crossing midnight
        self.assertEqual(self.ts.calculate_minutes(start, end, 30, shift), 330)
        with self.assertRaises(ValueError):
            self.ts.calculate_minutes(start, end, 361, shift)
        with self.assertRaises(ValueError):
            self.ts.calculate_minutes(end, start, 0, shift)

    def test_unrelated_agency_cannot_read_send_or_review(self):
        self.assertEqual(self.client.get("/api/missions/ma/timesheets", headers={"x-agency": "b"}).status_code, 404)
        self.assertEqual(self.client.post("/api/missions/ma/timesheets/send", headers={"x-agency": "b"}, json={}).status_code, 404)
        self.assertEqual(self.client.post("/api/missions/ma/timesheets/sla/review", headers={"x-agency": "b"},
                                          json={"decision": "approve"}).status_code, 404)

    def test_secure_link_submit_approval_and_csv(self):
        token = self._send()
        document = self.db.raw.timesheets.find_one({"slot_id": "sla"})
        self.assertNotIn("token", document)
        self.assertEqual(document["token_hash"], self.ts.hash_token(token))
        notification = self.db.raw.notifications.find_one({"slot_id": "sla"})
        self.assertNotIn(token, str(notification))
        self.assertEqual(self.client.get("/api/public/timesheets/wrong-token").status_code, 404)
        public = self.client.get(f"/api/public/timesheets/{token}")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.json()["worker"]["first_name"], "Paul")
        planned = public.json()["shift"]
        payload = {"started_at": planned["planned_start"], "ended_at": planned["planned_end"],
                   "break_minutes": 30, "note": "Pause déjeuner"}
        submission = self.client.post(f"/api/public/timesheets/{token}", json=payload)
        self.assertEqual(submission.status_code, 200, submission.text)
        self.assertEqual(submission.json()["worked_minutes"], 330)
        listing = self.client.get("/api/missions/ma/timesheets").json()
        self.assertEqual(listing["rows"][0]["status"], "submitted")
        self.assertEqual(self.client.get("/api/missions/ma/timesheets/export").text.count("Paul"), 0)
        approved = self.client.post("/api/missions/ma/timesheets/sla/review", json={"decision": "approve"})
        self.assertEqual(approved.status_code, 200, approved.text)
        self.assertEqual(self.client.post(f"/api/public/timesheets/{token}", json=payload).status_code, 409)
        exported = self.client.get("/api/missions/ma/timesheets/export")
        self.assertEqual(exported.status_code, 200)
        self.assertIn("Paul Martin", exported.text)
        self.assertIn("110.00", exported.text)

    def test_correction_reopens_submission_and_rotates_link(self):
        first = self._send()
        public = self.client.get(f"/api/public/timesheets/{first}").json()
        payload = {"started_at": public["shift"]["planned_start"], "ended_at": public["shift"]["planned_end"],
                   "break_minutes": 0}
        self.client.post(f"/api/public/timesheets/{first}", json=payload)
        correction = self.client.post("/api/missions/ma/timesheets/sla/review",
                                      json={"decision": "request_correction", "note": "Pause manquante"})
        self.assertEqual(correction.status_code, 200, correction.text)
        self.assertEqual(correction.json()["correction_message"], "sent")
        self.assertEqual(self.client.get(f"/api/public/timesheets/{first}").status_code, 404)
        replacement = self.ts.wa.send_whatsapp_text.await_args.args[2].split("/h/")[1].strip()
        page = self.client.get(f"/api/public/timesheets/{replacement}")
        self.assertEqual(page.json()["timesheet"]["status"], "needs_correction")
        self.assertEqual(page.json()["timesheet"]["review_note"], "Pause manquante")
        payload["break_minutes"] = 30
        self.assertEqual(self.client.post(f"/api/public/timesheets/{replacement}", json=payload).status_code, 200)

    def test_no_send_before_end_or_to_nonconfirmed(self):
        self.db.raw.shifts.update_one({"id": "sha"}, {"$set": {"date": (datetime.now(self.ts.LOCAL_TZ) + timedelta(days=3)).date().isoformat()}})
        response = self.client.post("/api/missions/ma/timesheets/send", json={})
        self.assertEqual(response.json()["sent"], 0)
        self.assertEqual(response.json()["skipped"], 1)
        self.assertEqual(self.ts.wa.send_whatsapp_text.await_count, 0)

    def test_automatic_dispatch_requires_opt_in(self):
        import asyncio
        self.assertEqual(asyncio.run(self.ts.run_automatic_timesheets())["sent"], 0)
        # Only shifts completed after opt-in are eligible; past missions aren't replayed.
        self.db.raw.users.update_one({"id": "a"}, {"$set": {
            "timesheet_auto_send": True, "timesheet_auto_enabled_at": datetime.now(timezone.utc).isoformat()}})
        self.assertEqual(asyncio.run(self.ts.run_automatic_timesheets())["sent"], 0)


if __name__ == "__main__":
    import unittest
    unittest.main()
