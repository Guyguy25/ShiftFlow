from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock
from return_visits import record_visit, visit_summary, retention_summary

NOW = datetime(2026, 10, 11, 12, tzinfo=timezone.utc)


class SummaryTests(TestCase):
    def test_unknown_history_is_not_fabricated(self):
        self.assertFalse(visit_summary({"created_at": "2020-01-01", "last_seen_at": "2026-10-11"}, NOW)["tracked"])

    def test_same_day_visits_are_not_returns(self):
        value = visit_summary({"visit_days": ["2026-10-11", "2026-10-11"]}, NOW)
        self.assertEqual(value["active_days"], 1)
        self.assertEqual(value["return_count"], 0)

    def test_distinct_days_and_gap(self):
        value = visit_summary({"visit_days": ["2026-10-11", "2026-10-01", "2026-10-07"]}, NOW)
        self.assertEqual(value["return_count"], 2)
        self.assertEqual(value["last_return_day"], "2026-10-11")
        self.assertEqual(value["days_between_last_visits"], 4)
        self.assertTrue(value["returned_7d"])

    def test_windows_count_users_and_exclude_first_visits(self):
        users = [{"visit_days": ["2026-10-11"]}, {"visit_days": ["2026-09-01", "2026-09-12"]},
                 {"visit_days": ["2026-09-01", "2026-10-05", "2026-10-11"]}, {}]
        self.assertEqual(retention_summary(users, NOW), {
            "tracked_users": 3, "returning_users": 2, "return_rate": 67,
            "returning_users_7d": 1, "returning_users_30d": 2,
        })
        self.assertEqual(retention_summary([], NOW)["return_rate"], 0)


class RecordingTests(IsolatedAsyncioTestCase):
    async def test_atomic_daily_deduplication(self):
        users = SimpleNamespace(update_one=AsyncMock())
        await record_visit(users, "user-a", NOW)
        users.update_one.assert_awaited_once_with({"id": "user-a"}, {
            "$addToSet": {"visit_days": "2026-10-11"},
            "$min": {"visit_tracking_started_at": NOW.isoformat()},
        })
