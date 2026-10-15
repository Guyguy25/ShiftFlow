"""Offline API tests: real routes + MongoDB query semantics, no WhatsApp/network.
Run: python -m unittest discover -s backend/tests -p test_mission_operations.py
Test dependency: mongomock (never needed by production).
"""
import ast
import importlib.util
import sys
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Literal
from types import ModuleType, SimpleNamespace
from unittest import TestCase
from unittest.mock import AsyncMock, Mock, patch

import mongomock
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field, field_validator, model_validator

BACKEND = Path(__file__).parents[1]


class Cursor:
    def __init__(self, cursor): self.cursor = cursor
    def sort(self, *args): self.cursor = self.cursor.sort(*args); return self
    async def to_list(self, length):
        rows = list(self.cursor)
        return rows if length is None else rows[:length]


class Collection:
    def __init__(self, collection): self.collection = collection
    def find(self, *args, **kwargs): return Cursor(self.collection.find(*args, **kwargs))
    def __getattr__(self, name):
        async def call(*args, **kwargs): return getattr(self.collection, name)(*args, **kwargs)
        return call


class Database:
    def __init__(self): self.raw = mongomock.MongoClient().test
    def __getattr__(self, name): return Collection(self.raw[name])


class MissionOperationsTest(TestCase):
    def setUp(self):
        self.db = Database()
        self.s = ModuleType("server")
        self.s.__dict__.update({key: value for key, value in globals().items() if not key.startswith("_")})
        self.s.db = self.db
        self.s.api = APIRouter()
        self.s.now_utc = lambda: datetime.now(timezone.utc)
        self.s.iso = lambda dt: dt.isoformat()
        self.s.new_id = lambda: str(uuid.uuid4())
        self.s.FRONTEND_URL = "https://test.invalid"
        self.s.logger = Mock()
        self.s.normalize_phone = lambda value: value if value.startswith("+") else None
        self.s.record_activation_event = AsyncMock()
        self.s.check_quota_or_raise = AsyncMock()
        self.s.mission_billing = SimpleNamespace(reserve=AsyncMock(return_value="free"), release=AsyncMock())
        self.s.ensure_trial_active_or_raise = AsyncMock()
        self.s.has_active_product_access = lambda user: bool(user)
        async def current_user(request: Request):
            return self.db.raw.users.find_one({"id": request.headers.get("x-agency", "a")}) or {"id": "unknown"}
        self.s.get_current_user = current_user
        tree = ast.parse((BACKEND / "server.py").read_text(encoding="utf-8"))
        names = {"ShiftIn", "MissionIn", "SelectWorkersIn", "ConfirmIn", "ShiftDuplicateIn", "compute_shift_estimate", "mission_with_shifts", "update_shift_and_mission_status", "public_get", "public_accept", "public_refuse", "select_workers_for_shift", "mark_no_answer", "cancel_mission", "duplicate_shift", "duplicate_mission", "force_cascade", "get_mission"}
        nodes = [node for node in tree.body if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
        exec(compile(ast.Module(body=nodes, type_ignores=[]), "server.py", "exec"), self.s.__dict__)
        sys_path = patch.object(sys, "path", [str(BACKEND), *sys.path]); sys_path.start(); self.addCleanup(sys_path.stop)
        modules = patch.dict(sys.modules, {"server": self.s}); modules.start(); self.addCleanup(modules.stop)
        def load(name):
            spec = importlib.util.spec_from_file_location(name, BACKEND / f"{name}.py")
            module = importlib.util.module_from_spec(spec)
            sys.modules[name] = module
            spec.loader.exec_module(module)
            return module
        self.wa = load("whatsapp_routes")
        self.ops = load("mission_operations")
        self.wa.send_whatsapp_text = AsyncMock(return_value={"messageId": "fake"})
        self.app = FastAPI()
        self.app.include_router(self.s.api, prefix="/api")
        self.app.include_router(self.wa.router, prefix="/api")
        self.app.include_router(self.ops.router, prefix="/api")
        self.client = TestClient(self.app)
        self.addCleanup(self.client.close)
        self.day = (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()
        self.db.raw.users.insert_many([{"id": "a", "plan": "free", "agency_name": "Agence A"}, {"id": "b", "plan": "pro"}])
        self.db.raw.missions.insert_one({"id": "m", "agency_id": "a", "status": "in_progress", "name": "Concert", "location": "Paris"})
        self.shift = {"id": "s", "mission_id": "m", "agency_id": "a", "date": self.day, "start_time": "10:00", "end_time": "18:00", "people_needed": 2, "rate_hourly": 20, "mission_type": "montage", "status": "in_progress", "confirmed_count": 1}
        self.db.raw.shifts.insert_one(dict(self.shift))
        for i, status in enumerate(["confirmed", "contacted", "pending", "refused", "no_answer"]):
            self.db.raw.workers.insert_one({"id": f"w{i}", "agency_id": "a", "first_name": f"Prénom{i}", "last_name": "Test", "phone": f"+3360000000{i}"})
            self.db.raw.mission_workers.insert_one({"id": f"slot{i}", "shift_id": "s", "mission_id": "m", "worker_id": f"w{i}", "token": f"token{i}", "priority": i, "status": status, "contacted_at": (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat()})

    def post(self, path, **kwargs): return self.client.post("/api" + path, **kwargs)
    def payload(self, **kwargs):
        return {key: value for key, value in {**self.shift, **kwargs}.items() if key in self.s.ShiftIn.model_fields}

    def test_all_plans_can_edit_and_legacy_template_survives(self):
        template = "Bonjour {prenom}, {mission} le {date}. {lien}"
        self.db.raw.users.update_one({"id": "a"}, {"$set": {"whatsapp_invite_template": template}})
        result = self.client.get("/api/whatsapp/automations").json()
        self.assertEqual(result["templates"]["invite"], template)
        self.assertTrue(result["can_edit"])
        for kind in ("invite", "followup", "cancellation", "removal", "change"):
            response = self.client.put(f"/api/whatsapp/automations/{kind}", json={"template": template})
            self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get("/api/whatsapp/message-template").json()["template"], template)
        self.assertEqual(self.client.get("/api/whatsapp/message-template", headers={"x-agency": "b"}).json()["template"], self.wa.DEFAULT_INVITE_TEMPLATE)
        self.assertEqual(self.client.delete("/api/whatsapp/message-template").status_code, 200)

    def test_invalid_template_never_saved_or_sent(self):
        for template in ("", "{prenom} {mission} {date} https://evil.invalid {lien}", "{prenom} {mission} {date} {bad} {lien}", "x" * 501):
            response = self.client.put("/api/whatsapp/automations/invite", json={"template": template})
            self.assertEqual(response.status_code, 400)
            self.assertEqual(self.post("/shifts/s/select-workers", json={"worker_ids": ["w0"], "invitation_template": template}).status_code, 400)
        self.wa.send_whatsapp_text.assert_not_awaited()

    def test_selection_freezes_edited_text_and_delays_until_confirmation(self):
        self.db.raw.mission_workers.delete_many({})
        template = "Bonjour {prenom}, nouvelle invitation {mission} le {date} : {lien}"
        self.assertEqual(self.client.get("/api/whatsapp/message-template").status_code, 200)
        self.wa.send_whatsapp_text.assert_not_awaited()
        result = self.post("/shifts/s/select-workers", json={"worker_ids": ["w0", "w1", "w2"], "invitation_template": template})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.wa.send_whatsapp_text.await_count, 2)
        self.assertTrue(all(row["invitation_template"] == template for row in self.db.raw.mission_workers.find({})))
        self.assertIn("nouvelle invitation", self.wa.send_whatsapp_text.call_args.args[2])
        self.assertNotIn("{lien}", self.wa.send_whatsapp_text.call_args.args[2])

    def test_fixed_pay_validation_estimate_public_and_duplicate(self):
        payload = self.payload(pay_type="fixed", fixed_amount=180, pay_basis="net")
        result = self.client.put("/api/shifts/s", json=payload)
        self.assertEqual(result.status_code, 200, result.text)
        shift = self.db.raw.shifts.find_one({"id": "s"})
        self.assertEqual(self.s.compute_shift_estimate(shift), 360)
        self.assertEqual(self.wa.compensation_label(shift), "180 € net / cachet")
        self.assertEqual(self.client.get("/api/public/mission/token0").json()["shift"]["pay_type"], "fixed")
        clone = self.post("/shifts/s/duplicate", json={"new_date": self.day}).json()
        self.assertEqual((clone["pay_type"], clone["fixed_amount"], clone["pay_basis"]), ("fixed", 180, "net"))
        self.assertEqual(self.client.put("/api/shifts/s", json={**payload, "fixed_amount": -1}).status_code, 422)
        self.assertEqual(self.client.put("/api/shifts/s", json={**payload, "start_time": "28:30"}).status_code, 422)
        self.assertEqual(self.client.put("/api/shifts/s", json={**payload, "pay_basis": "unspecified"}).status_code, 422)
        self.assertEqual(self.wa.compensation_label(self.shift), "20 €/h")
        rendered = self.wa.render_invite_template("{prenom} {tarif}€/h {lien}", {"first_name": "{lien}"}, shift, {}, {}, "SAFE")
        self.assertEqual(rendered, "{lien} 180 € net / cachet SAFE")

    def test_shift_capacity_add_and_soft_delete(self):
        self.assertEqual(self.client.put("/api/shifts/s", json=self.payload(people_needed=0)).status_code, 422)
        self.db.raw.mission_workers.update_one({"id": "slot1"}, {"$set": {"status": "confirmed"}})
        self.assertEqual(self.client.put("/api/shifts/s", json=self.payload(people_needed=1)).status_code, 409)
        result = self.post("/missions/m/shifts", json=self.payload())
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.db.raw.missions.find_one({"id": "m"})["status"], "in_progress")
        deleted = self.client.delete("/api/shifts/s")
        self.assertEqual(deleted.status_code, 200, deleted.text)
        self.assertEqual(deleted.json()["notifications"]["sent"], 5)
        self.assertEqual(self.post("/public/mission/token0/accept").status_code, 409)
        self.assertEqual(self.client.put("/api/shifts/s", json=self.payload()).status_code, 409)
        self.assertIsNotNone(self.db.raw.shifts.find_one({"id": "s"})["deleted_at"])

    def test_followup_only_waiting_and_throttled(self):
        self.assertEqual(self.post("/mission-workers/slot0/followup").status_code, 409)
        result = self.post("/mission-workers/slot1/followup")
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.post("/mission-workers/slot1/followup").status_code, 409)
        self.assertEqual(self.wa.send_whatsapp_text.await_count, 1)
        self.assertEqual(self.db.raw.notifications.find_one({})["kind"], "followup")
        self.assertEqual(self.db.raw.mission_workers.find_one({"id": "slot1"})["status"], "contacted")

    def test_remove_notifies_once_preserves_history_and_blocks_old_token(self):
        result = self.post("/mission-workers/slot0/remove")
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.post("/mission-workers/slot0/remove").status_code, 200)
        self.assertEqual(self.wa.send_whatsapp_text.await_count, 1)
        self.assertEqual(self.db.raw.shifts.find_one({"id": "s"})["confirmed_count"], 0)
        self.assertEqual(self.post("/public/mission/token0/accept").status_code, 409)
        self.assertEqual(self.post("/public/mission/token0/refuse", json={}).status_code, 409)

    def test_cancel_all_states_provider_failure_and_retry_without_duplicate(self):
        self.wa.send_whatsapp_text.side_effect = [RuntimeError("offline"), {}, {}, {}, {}]
        result = self.post("/missions/m/cancel")
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["notifications"], {"sent": 4, "failed": 1, "skipped": 0})
        self.assertTrue(all(row["status"] == "cancelled" for row in self.db.raw.mission_workers.find({})))
        self.assertEqual(self.db.raw.shifts.find_one({"id": "s"})["confirmed_count"], 0)
        self.wa.send_whatsapp_text.side_effect = None
        retry = self.post("/missions/m/retry-notifications")
        self.assertEqual(retry.json()["notifications"]["sent"], 1)
        self.assertEqual(self.post("/missions/m/cancel").json()["notifications"]["sent"], 0)
        self.assertEqual(self.wa.send_whatsapp_text.await_count, 6)
        self.assertEqual(self.post("/public/mission/token1/accept").status_code, 409)

    def test_cross_tenant_actions_never_send_or_change(self):
        paths = ["/missions/m/cancel", "/missions/m/retry-notifications", "/mission-workers/slot0/remove", "/mission-workers/slot1/followup"]
        for path in paths:
            self.assertEqual(self.post(path, headers={"x-agency": "b"}).status_code, 404, path)
        self.assertEqual(self.client.put("/api/shifts/s", json=self.payload(), headers={"x-agency": "b"}).status_code, 404)
        self.assertEqual(self.client.delete("/api/shifts/s", headers={"x-agency": "b"}).status_code, 404)
        self.assertEqual(self.post("/missions/m/shifts", json=self.payload(), headers={"x-agency": "b"}).status_code, 404)
        self.wa.send_whatsapp_text.assert_not_awaited()

    def test_pending_notification_lease_prevents_double_send(self):
        self.db.raw.mission_workers.update_one({"id": "slot0"}, {"$set": {"notice_removal": {"lock_until": (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()}}})
        result = self.post("/mission-workers/slot0/remove")
        self.assertEqual(result.json()["notifications"]["skipped"], 1)
        self.wa.send_whatsapp_text.assert_not_awaited()

    def test_no_answer_can_be_followed_up_without_reopening_cancelled_slots(self):
        result = self.post("/mission-workers/slot4/followup")
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["notifications"]["sent"], 1)
        self.db.raw.mission_workers.update_one({"id": "slot4"}, {"$set": {"status": "cancelled"}})
        self.assertEqual(self.post("/mission-workers/slot4/followup").status_code, 409)

    def test_scheduler_is_tenant_scoped_and_uses_followup_template(self):
        self.db.raw.users.update_one({"id": "a"}, {"$set": {"whatsapp_templates.followup": "Bonjour {prenom}, RELANCE {mission} le {date} : {lien}"}})
        self.db.raw.missions.insert_one({"id": "other", "agency_id": "b", "status": "in_progress"})
        self.db.raw.shifts.insert_one({**self.shift, "id": "other", "agency_id": "b", "mission_id": "other"})
        result = self.post("/whatsapp/cron/followups")
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["sent"], 1)
        self.assertEqual(self.db.raw.notifications.find_one({})["kind"], "followup")
        self.assertIn("RELANCE", self.wa.send_whatsapp_text.call_args.args[2])

    def test_retry_recovers_after_cancellation_before_any_delivery_was_claimed(self):
        self.db.raw.missions.update_one({"id": "m"}, {"$set": {"status": "cancelled"}})
        result = self.post("/missions/m/retry-notifications")
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["notifications"]["sent"], 5)

    def test_edit_notifies_only_live_assignments_and_failure_is_retryable(self):
        self.wa.send_whatsapp_text.side_effect = [RuntimeError("offline"), {}]
        result = self.client.put("/api/shifts/s", json=self.payload(start_time="11:00"))
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["notifications"]["failed"], 1)
        self.assertEqual(self.db.raw.shifts.find_one({"id": "s"})["start_time"], "11:00")
        self.wa.send_whatsapp_text.side_effect = None
        result = self.post("/missions/m/retry-notifications")
        self.assertEqual(result.json()["notifications"]["sent"], 1)
        self.assertEqual(self.wa.send_whatsapp_text.await_count, 3)

    def test_failed_invitations_report_failure_and_retry_the_reviewed_text(self):
        self.db.raw.mission_workers.delete_many({})
        template = "Bonjour {prenom}, TEXTE VALIDÉ pour {mission} le {date} : {lien}"
        self.wa.send_whatsapp_text.side_effect = RuntimeError("offline")
        result = self.post("/shifts/s/select-workers", json={"worker_ids": ["w0", "w1"], "invitation_template": template})
        self.assertEqual(result.json()["notifications"], {"sent": 0, "failed": 2})
        self.db.raw.users.update_one({"id": "a"}, {"$set": {"whatsapp_invite_template": "Bonjour {prenom}, AUTRE {mission} le {date} {lien}"}})
        self.wa.send_whatsapp_text.side_effect = None
        result = self.post("/shifts/s/next-cascade")
        self.assertEqual(result.json()["notifications"], {"sent": 2, "failed": 0})
        self.assertIn("TEXTE VALIDÉ", self.wa.send_whatsapp_text.call_args.args[2])

    def test_deleted_shift_is_excluded_from_totals_without_consuming_a_credit(self):
        self.db.raw.users.update_one({"id": "a"}, {"$set": {"mission_credits": 7, "free_missions_used": 3}})
        self.post("/missions/m/shifts", json=self.payload(people_needed=3))
        self.client.delete("/api/shifts/s")
        result = self.client.get("/api/missions/m")
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["total_needed"], 3)
        self.assertEqual(len(result.json()["shifts"]), 1)
        agency = self.db.raw.users.find_one({"id": "a"})
        self.assertEqual((agency["mission_credits"], agency["free_missions_used"]), (7, 3))

    def test_mission_duplicate_preserves_fixed_pay_and_excludes_deleted_shifts(self):
        self.db.raw.shifts.update_one({"id": "s"}, {"$set": {"pay_type": "fixed", "fixed_amount": 220, "pay_basis": "gross"}})
        self.db.raw.shifts.insert_one({**self.shift, "id": "deleted", "deleted_at": "past", "status": "cancelled"})
        result = self.post("/missions/m/duplicate")
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(len(result.json()["shifts"]), 1)
        clone = result.json()["shifts"][0]
        self.assertEqual((clone["pay_type"], clone["fixed_amount"], clone["pay_basis"]), ("fixed", 220, "gross"))

    def test_duplicate_of_empty_mission_does_not_reserve_a_credit(self):
        self.db.raw.shifts.update_one({"id": "s"}, {"$set": {"deleted_at": "past"}})
        result = self.post("/missions/m/duplicate")
        self.assertEqual(result.status_code, 409, result.text)
        self.s.mission_billing.reserve.assert_not_awaited()
