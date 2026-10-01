"""Focused tests for the funnel decisions, without sending any email."""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from onboarding_emails import _eligible_stages, _message, _stage, run_onboarding_emails


class OnboardingEmailTests(unittest.IsolatedAsyncioTestCase):
    async def test_disabled_does_not_query_or_send(self):
        db = SimpleNamespace(users=SimpleNamespace(find=AsyncMock()))
        self.assertEqual(await run_onboarding_emails(db, "https://www.shiftflow.io", "secret"), 0)
        db.users.find.assert_not_called()

    async def test_stage_progresses_to_a_useful_post_invite_message(self):
        now = datetime(2026, 9, 28, 16, tzinfo=timezone.utc)
        user = {"id": "agency-1", "created_at": (now - timedelta(hours=5)).isoformat()}
        mission = {"id": "mission-1", "name": "Montage", "created_at": (now - timedelta(hours=3)).isoformat()}
        db = SimpleNamespace(
            missions=SimpleNamespace(find_one=AsyncMock(return_value=None), distinct=AsyncMock(return_value=["mission-1"])),
            workers=SimpleNamespace(count_documents=AsyncMock(return_value=0),
                                    find_one=AsyncMock(return_value={"created_at": (now - timedelta(hours=5)).isoformat()})),
            notifications=SimpleNamespace(find_one=AsyncMock(return_value=None)),
            shifts=SimpleNamespace(find=lambda *args, **kwargs: SimpleNamespace(
                to_list=AsyncMock(return_value=[{"people_needed": 2, "confirmed_count": 2}]))),
        )
        self.assertEqual(await _stage(db, user, now), ("no_mission", None))
        db.missions.find_one.return_value = mission
        self.assertEqual(await _stage(db, user, now), ("no_workers", mission))
        db.workers.count_documents.return_value = 1
        self.assertEqual(await _stage(db, user, now), ("no_invite", mission))
        db.notifications.find_one.return_value = {
            "sent_at": (now - timedelta(hours=5)).isoformat()
        }
        self.assertEqual(await _stage(db, user, now), ("team_ready", mission))

    async def test_sent_activation_stage_yields_to_usage_reminder(self):
        now = datetime(2026, 9, 28, 16, tzinfo=timezone.utc)
        user = {
            "id": "agency-1",
            "created_at": (now - timedelta(days=25)).isoformat(),
            "trial_ends_at": (now + timedelta(days=6)).isoformat(),
            "free_missions_used": 2,
        }
        mission = {"id": "mission-1", "name": "Montage", "created_at": (now - timedelta(days=25)).isoformat()}
        db = SimpleNamespace(
            missions=SimpleNamespace(find_one=AsyncMock(return_value=mission)),
            workers=SimpleNamespace(count_documents=AsyncMock(return_value=1),
                                    find_one=AsyncMock(return_value={"created_at": (now - timedelta(days=25)).isoformat()})),
            notifications=SimpleNamespace(find_one=AsyncMock(return_value={
                "sent_at": (now - timedelta(days=20)).isoformat()
            })),
            shifts=SimpleNamespace(find=lambda *args, **kwargs: SimpleNamespace(
                to_list=AsyncMock(return_value=[{"people_needed": 2, "confirmed_count": 2}]))),
        )
        stages = [stage for stage, _ in await _eligible_stages(db, user, now)]
        self.assertEqual(stages, ["team_ready", "last_free_mission"])
        self.assertEqual(
            await _stage(db, user, now, {"team_ready"}),
            ("last_free_mission", mission),
        )

    def test_mission_name_is_escaped_in_html(self):
        msg = _message({"name": "Tanguy"}, "no_workers", {"name": "<script>alert(1)</script>"},
                       "https://www.shiftflow.io", "https://www.shiftflow.io/api/email/unsubscribe?token=test")
        self.assertNotIn("<script>", msg["html"])
        self.assertIn("&lt;script&gt;", msg["html"])
        self.assertIn("/app/workers?utm_source=lifecycle_email", msg["url"])

    async def test_no_false_free_offer_after_archiving_all_missions(self):
        now = datetime(2026, 9, 30, tzinfo=timezone.utc)
        db = SimpleNamespace(missions=SimpleNamespace(find_one=AsyncMock(return_value=None)))
        user = {"id": "u", "created_at": (now - timedelta(days=5)).isoformat(), "free_missions_used": 3}
        self.assertEqual(await _stage(db, user, now), ("free_missions_used", None))
        user["mission_credits"] = 1
        self.assertEqual(await _stage(db, user, now), (None, None))

    def test_old_deadline_messages_cannot_be_rendered(self):
        with self.assertRaises(ValueError):
            _message({}, "trial_expired", None, "https://www.shiftflow.io", "https://www.shiftflow.io/unsubscribe")

    async def test_pro_comparison_requires_consumption_and_no_remaining_credit(self):
        now = datetime(2026, 10, 1, tzinfo=timezone.utc)
        db = SimpleNamespace(missions=SimpleNamespace(find_one=AsyncMock(return_value=None),
            count_documents=AsyncMock(return_value=10)))
        user = {"id": "u", "created_at": now.isoformat(), "free_missions_used": 3,
                "credited_checkout_sessions": ["pack"], "mission_credits": 2}
        self.assertEqual(await _stage(db, user, now, {"free_missions_used"}), (None, None))
        db.missions.count_documents.assert_not_called()
        user["mission_credits"] = 0
        self.assertEqual(await _stage(db, user, now, {"free_missions_used"}), ("pro_relevant", None))
        db.missions.count_documents.return_value = 9
        self.assertEqual(await _stage(db, user, now, {"free_missions_used"}), (None, None))


if __name__ == "__main__":
    unittest.main()

