"""Focused tests for the funnel decisions, without sending any email."""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from onboarding_emails import _message, _stage, run_onboarding_emails


class OnboardingEmailTests(unittest.IsolatedAsyncioTestCase):
    async def test_disabled_does_not_query_or_send(self):
        db = SimpleNamespace(users=SimpleNamespace(find=AsyncMock()))
        self.assertEqual(await run_onboarding_emails(db, "https://www.shiftflow.io", "secret"), 0)
        db.users.find.assert_not_called()

    async def test_stage_progresses_and_stops_after_real_invite(self):
        now = datetime(2026, 9, 28, 16, tzinfo=timezone.utc)
        user = {"id": "agency-1", "created_at": (now - timedelta(hours=5)).isoformat()}
        mission = {"id": "mission-1", "name": "Montage", "created_at": (now - timedelta(hours=3)).isoformat()}
        db = SimpleNamespace(
            missions=SimpleNamespace(find_one=AsyncMock(return_value=None), distinct=AsyncMock(return_value=["mission-1"])),
            workers=SimpleNamespace(count_documents=AsyncMock(return_value=0),
                                    find_one=AsyncMock(return_value={"created_at": (now - timedelta(hours=5)).isoformat()})),
            notifications=SimpleNamespace(find_one=AsyncMock(return_value=None)),
        )
        self.assertEqual(await _stage(db, user, now), ("no_mission", None))
        db.missions.find_one.return_value = mission
        self.assertEqual(await _stage(db, user, now), ("no_workers", mission))
        db.workers.count_documents.return_value = 1
        self.assertEqual(await _stage(db, user, now), ("no_invite", mission))
        db.notifications.find_one.return_value = {"_id": "sent-whatsapp-invite"}
        self.assertEqual(await _stage(db, user, now), (None, None))

    def test_mission_name_is_escaped_in_html(self):
        msg = _message({"name": "Tanguy"}, "no_workers", {"name": "<script>alert(1)</script>"},
                       "https://www.shiftflow.io", "https://www.shiftflow.io/api/email/unsubscribe?token=test")
        self.assertNotIn("<script>", msg["html"])
        self.assertIn("&lt;script&gt;", msg["html"])
        self.assertIn("/app/workers?utm_source=lifecycle_email", msg["url"])


if __name__ == "__main__":
    unittest.main()
