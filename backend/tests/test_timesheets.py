"""Offline API regression tests with real Mongo query semantics; no production I/O."""
import asyncio
import importlib.util
import sys
from datetime import datetime, timezone, timedelta
from unittest import TestCase
from unittest.mock import AsyncMock

import test_mission_operations as fixtures
BACKEND = fixtures.BACKEND


class TimesheetsTest(TestCase):
    def setUp(self):
        fixtures.MissionOperationsTest.setUp(self)
        self.s.JWT_SECRET = "test-only-timesheet-secret"
        self.now = datetime(2026, 10, 20, 12, tzinfo=timezone.utc)
        self.s.now_utc = lambda: self.now
        self.db.raw.shifts.update_one({"id": "s"}, {"$set": {"date": "2026-10-18", "start_time": "22:00", "end_time": "06:00", "break_minutes": 30}})
        spec = importlib.util.spec_from_file_location("timesheets_test_module", BACKEND / "timesheets.py")
        self.hours = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.hours)
        self.app.include_router(self.hours.router, prefix="/api")

    def request_hours(self):
        result = self.client.post("/api/missions/m/hours/request")
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    def row(self):
        return self.db.raw.timesheets.find_one({"id": "slot0"})

    def token(self):
        return self.hours.token_for(self.row())

    def submit(self, **overrides):
        payload = {"token": self.token(), "version": self.row()["version"], "entries": [
            {"start": "2026-10-18T22:00", "end": "2026-10-19T07:00", "break_minutes": 30}], "note": "Une heure supplémentaire"}
        return self.client.post("/api/public/hours/submit", json={**payload, **overrides})

    def review(self, action="approved", **overrides):
        return self.client.post("/api/hours/slot0/review", json={"version": self.row()["version"], "action": action, **overrides})

    def test_end_to_end_hours_identity_and_approval(self):
        self.assertEqual(self.request_hours(), {"sent": 1, "failed": 0, "skipped": 0})
        body = self.wa.send_whatsapp_text.call_args.args[2]
        self.assertIn("/hours#" + self.token(), body)
        self.assertEqual(self.db.raw.timesheets.count_documents({}), 1)
        access = self.client.post("/api/public/hours/access", json={"token": self.token()})
        self.assertEqual(access.headers["cache-control"], "no-store")
        self.assertEqual(access.json()["worker_name"], "Prénom0 Test")
        self.assertEqual(access.json()["planned_entries"][0]["minutes"], 450)
        self.assertNotIn("token_nonce", access.json())
        result = self.submit()
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual((result.json()["minutes"], result.json()["amount_cents"]), (510, 17000))
        self.assertEqual(self.submit().status_code, 409)
        self.assertEqual(self.review().status_code, 200)
        data = self.client.get("/api/hours").json()
        self.assertEqual(data["summary"]["approved_minutes"], 510)
        self.assertEqual(data["summary"]["approved_amount_cents"]["unspecified"], 17000)
        self.assertEqual([e["action"] for e in self.row()["history"]], ["created", "delivery_sent", "submitted", "approved"])

    def test_cross_tenant_read_export_review_renew_and_settings(self):
        self.request_hours()
        other = {"x-agency": "b"}
        self.assertEqual(self.client.get("/api/hours", headers=other).json()["items"], [])
        self.assertNotIn("Prénom0", self.client.get("/api/hours/export", headers=other).text)
        for path in ("/api/hours/slot0/review", "/api/hours/slot0/renew", "/api/missions/m/hours/request"):
            response = self.client.post(path, headers=other, json={"version": 1, "action": "approved"})
            self.assertEqual(response.status_code, 404)
        self.client.put("/api/hours/settings", headers=other, json={"enabled": True})
        self.assertFalse(self.client.get("/api/hours/settings").json()["enabled"])

    def test_token_tampering_expiry_renewal_and_invitation_is_not_hours_token(self):
        self.request_hours()
        old = self.token()
        for token in (old[:-1] + ("a" if old[-1] != "a" else "b"), "token0" * 5, "slot0." + "é" * 30):
            self.assertEqual(self.client.post("/api/public/hours/access", json={"token": token}).status_code, 404)
        self.db.raw.timesheets.update_one({"id": "slot0"}, {"$set": {"expires_at": self.s.iso(self.now - timedelta(days=1))}})
        self.assertEqual(self.submit().status_code, 410)
        self.assertEqual(self.client.post("/api/hours/slot0/renew").json()["delivery"], "sent")
        self.assertNotEqual(self.token(), old)
        self.assertEqual(self.client.post("/api/public/hours/access", json={"token": old}).status_code, 404)

    def test_changed_worker_identity_invalidates_original_link(self):
        self.request_hours()
        self.db.raw.mission_workers.update_one({"id": "slot0"}, {"$set": {"worker_id": "w1"}})
        self.assertEqual(self.submit().status_code, 409)
        self.assertEqual(self.client.post("/api/hours/slot0/renew").status_code, 409)

    def test_two_concurrent_deliveries_only_send_once(self):
        self.wa.send_whatsapp_text.side_effect = RuntimeError("offline")
        self.request_hours()
        async def accept(*args):
            await asyncio.sleep(0)
            return {"messageId": "simulated"}
        self.wa.send_whatsapp_text.side_effect = accept
        self.wa.send_whatsapp_text.reset_mock()
        row = self.row()
        user = self.db.raw.users.find_one({"id": "a"})
        async def run():
            return await asyncio.gather(self.hours.deliver(row, user), self.hours.deliver(row, user))
        self.assertEqual(sorted(asyncio.run(run())), ["sent", "skipped"])
        self.assertEqual(self.wa.send_whatsapp_text.await_count, 1)

    def test_future_cancelled_missing_phone_and_https_configuration(self):
        original = self.db.raw.shifts.find_one({"id": "s"})
        self.db.raw.shifts.update_one({"id": "s"}, {"$set": {"date": "2026-10-21"}})
        self.assertEqual(self.request_hours()["skipped"], 1)
        self.assertIsNone(self.row())
        self.db.raw.shifts.update_one({"id": "s"}, {"$set": {"date": original["date"]}})
        self.db.raw.workers.update_one({"id": "w0"}, {"$set": {"phone": "bad"}})
        self.assertEqual(self.request_hours()["failed"], 1)
        self.assertIn("téléphone", self.row()["delivery_error"])
        self.s.FRONTEND_URL = "http://unsafe.invalid"
        self.assertEqual(self.request_hours()["failed"], 1)
        self.assertIn("HTTPS", self.row()["delivery_error"])
        self.wa.send_whatsapp_text.assert_not_awaited()

    def test_shift_creation_validation_and_duplication_preserve_days_and_pauses(self):
        # ShiftIn's date guard uses the actual clock; choose a date well ahead.
        start, end = "2030-01-10", "2030-01-12"
        payload = {"date": start, "end_date": end, "start_time": "22:00", "end_time": "06:00", "people_needed": 1,
                   "break_minutes": 30, "rate_hourly": 20}
        created = self.client.post("/api/missions/m/shifts", json=payload)
        self.assertEqual(created.status_code, 200, created.text)
        cloned = self.client.post(f"/api/shifts/{created.json()['id']}/duplicate", json={"new_date": "2030-02-10"})
        self.assertEqual((cloned.json()["end_date"], cloned.json()["break_minutes"]), ("2030-02-12", 30))
        self.assertEqual(self.client.post("/api/missions/m/shifts", json={**payload, "end_date": "2030-01-09"}).status_code, 422)

    def test_rejection_correction_resubmission_history_and_version_conflicts(self):
        self.request_hours(); self.submit()
        self.assertEqual(self.review("rejected").status_code, 422)
        self.assertEqual(self.review("rejected", reason="Pause incorrecte").status_code, 200)
        self.assertEqual(self.submit().status_code, 409)
        old = self.token()
        self.assertEqual(self.review("correction_requested", reason="Indiquez la pause réelle").status_code, 200)
        self.assertNotEqual(self.token(), old)
        stale = self.submit(version=1)
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(self.submit().status_code, 200)
        version = self.row()["version"]
        self.assertEqual(self.review(version=version).status_code, 200)
        self.assertEqual(self.review(version=version).status_code, 409)
        self.assertEqual(sum(e["action"] == "submitted" for e in self.row()["history"]), 2)
        self.assertEqual(self.row()["history"][2]["note"], "Une heure supplémentaire")
        self.assertEqual(self.review("correction_requested", reason="Reprendre la validation").status_code, 200)
        self.assertEqual(self.client.get("/api/hours").json()["summary"]["approved_minutes"], 0)

    def test_cancelled_or_removed_assignment_revokes_public_access(self):
        for collection, query in [("mission_workers", {"id": "slot0"}), ("shifts", {"id": "s"}), ("missions", {"id": "m"})]:
            self.request_hours()
            original = self.db.raw[collection].find_one(query)["status"]
            self.db.raw[collection].update_one(query, {"$set": {"status": "cancelled"}})
            self.assertEqual(self.submit().status_code, 409)
            self.assertEqual(self.review().status_code, 409)
            self.db.raw[collection].update_one(query, {"$set": {"status": original}})

    def test_invalid_periods_future_overlap_pause_and_invalid_clock(self):
        self.request_hours()
        entry = {"start": "2026-10-18T22:00", "end": "2026-10-19T06:00", "break_minutes": 0}
        cases = [[], [{**entry, "end": entry["start"]}], [{**entry, "break_minutes": 480}],
                 [{**entry, "break_minutes": -1}], [{**entry, "break_minutes": 0.5}],
                 [{**entry, "start": "bad"}], [{**entry, "end": "2026-10-21T06:00"}], [entry, entry],
                 [{**entry, "start": "2026-03-29T02:30", "end": "2026-03-29T04:00"}],
                 [{**entry, "start": "2026-10-18T22:00:30"}],
                 [{**entry, "start": "2026-01-01T00:00"}]]
        for entries in cases:
            response = self.submit(entries=entries)
            self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(self.row()["status"], "pending")

    def test_multiday_split_periods_fixed_pay_and_compensation_snapshot(self):
        self.db.raw.shifts.update_one({"id": "s"}, {"$set": {"end_date": "2026-10-20", "pay_type": "fixed", "fixed_amount": 250, "pay_basis": "net"}})
        self.request_hours()
        self.db.raw.shifts.update_one({"id": "s"}, {"$set": {"fixed_amount": 999}})
        self.assertEqual(self.row()["planned_entries"][0]["minutes"], 1890)
        result = self.submit(entries=[{"start": "2026-10-18T22:00", "end": "2026-10-19T06:00", "break_minutes": 30},
                                      {"start": "2026-10-19T22:00", "end": "2026-10-20T06:00", "break_minutes": 30}])
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual((self.row()["minutes"], self.row()["amount_cents"]), (900, 25000))
        self.review()
        summary = self.client.get("/api/hours").json()["summary"]
        self.assertEqual(summary["approved_amount_cents"], {"gross": 0, "net": 25000, "unspecified": 0})

    def test_retry_provider_error_lease_and_max_reminders(self):
        self.wa.send_whatsapp_text.side_effect = RuntimeError("Sensitive provider response")
        self.assertEqual(self.request_hours()["failed"], 1)
        self.assertEqual(self.row()["delivery_count"], 0)
        self.assertNotIn("Sensitive", self.row()["delivery_error"])
        self.wa.send_whatsapp_text.side_effect = None
        self.assertEqual(self.request_hours()["sent"], 1)
        self.assertEqual(self.request_hours()["skipped"], 1)
        self.db.raw.timesheets.update_one({"id": "slot0"}, {"$set": {"last_sent_at": self.s.iso(self.now - timedelta(days=3)), "delivery_lock_until": self.s.iso(self.now + timedelta(minutes=2))}})
        self.assertEqual(self.request_hours()["skipped"], 1)
        self.db.raw.timesheets.update_one({"id": "slot0"}, {"$unset": {"delivery_lock_until": ""}})
        self.assertEqual(self.request_hours()["sent"], 1)
        self.db.raw.timesheets.update_one({"id": "slot0"}, {"$set": {"last_sent_at": self.s.iso(self.now - timedelta(days=3)), "delivery_count": 3}})
        self.assertEqual(self.request_hours()["skipped"], 1)
        notification = self.db.raw.notifications.find_one({"kind": "hours"})
        for key in ("body", "url", "to"):
            self.assertNotIn(key, notification)

    def test_cron_opt_in_delay_scope_and_stop_after_submission(self):
        self.assertEqual(asyncio.run(self.hours.run_timesheets())["sent"], 0)
        self.client.put("/api/hours/settings", json={"enabled": True, "delay_hours": 168})
        self.assertEqual(asyncio.run(self.hours.run_timesheets())["sent"], 0)
        self.client.put("/api/hours/settings", json={"enabled": True, "delay_hours": 1})
        self.assertEqual(asyncio.run(self.hours.run_timesheets())["sent"], 1)
        self.assertEqual(asyncio.run(self.hours.run_timesheets())["sent"], 0)
        self.submit(); self.now += timedelta(days=4)
        self.assertEqual(asyncio.run(self.hours.run_timesheets())["sent"], 0)

    def test_csv_injection_filters_and_declaration_totals_once(self):
        self.request_hours()
        self.submit(entries=[{"start": "2026-10-18T22:00", "end": "2026-10-19T06:00", "break_minutes": 30},
                             {"start": "2026-10-19T22:00", "end": "2026-10-20T06:00", "break_minutes": 30}], note="=HYPERLINK(1)")
        export = self.client.get("/api/hours/export")
        self.assertIn("'=HYPERLINK(1)", export.text)
        self.assertEqual(export.text.count("300.00"), 1)
        self.assertNotIn("Prénom0", self.client.get("/api/hours/export?mission_id=other").text)
        self.assertNotIn(self.token(), export.text)


class TimeRulesTest(TestCase):
    def setUp(self):
        from unittest.mock import patch
        search_path = patch.object(sys, "path", [str(BACKEND), *sys.path])
        search_path.start()
        self.addCleanup(search_path.stop)

    def test_dst_elapsed_time_and_money_rounding(self):
        from hours_domain import normalize_entries, amount_cents
        for start, end, expected in [("2026-03-29T01:00", "2026-03-29T04:00", 120), ("2026-10-25T01:00", "2026-10-25T04:00", 240)]:
            self.assertEqual(normalize_entries([{"start": start, "end": end}])[0]["minutes"], expected)
        self.assertEqual(normalize_entries([{"start": "2026-10-25T02:30", "end": "2026-10-25T02:30", "end_fold": 1}])[0]["minutes"], 60)
        self.assertEqual(amount_cents(1, {"rate_hourly": 20}), 33)
        self.assertEqual(amount_cents(3, {"rate_hourly": 0.1}), 1)

    def test_planned_multi_day_and_invalid_pause(self):
        from hours_domain import planned_entries
        base = {"date": "2026-10-18", "start_time": "22:00", "end_time": "06:00", "end_date": "2026-10-20", "break_minutes": 30}
        self.assertEqual(planned_entries(base)[0]["minutes"], 1890)
        with self.assertRaises(ValueError):
            planned_entries({**base, "end_date": "2026-10-17"})
