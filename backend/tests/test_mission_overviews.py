import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, Mock
sys.path.insert(0, str(Path(__file__).parents[1]))
from mission_overviews import load_mission_overviews

class MissionOverviewTests(IsolatedAsyncioTestCase):
    async def test_batch_reads_preserve_dates_staffing_and_cancelled_history(self):
        rows = [
            {"id": "a", "mission_id": "m1", "date": "2026-10-26", "end_date": "2026-10-28", "people_needed": 5, "confirmed_count": 3},
            {"id": "b", "mission_id": "m1", "date": "2026-10-27", "people_needed": 9, "status": "cancelled"},
            {"id": "c", "mission_id": "m2", "date": "2026-10-28", "people_needed": 2, "deleted_at": "deleted"},
        ]
        cursor = Mock(); cursor.sort.return_value = cursor; cursor.to_list = AsyncMock(return_value=rows)
        db = SimpleNamespace(shifts=SimpleNamespace(find=Mock(return_value=cursor)))
        missions = [{"id": "m1"}, {"id": "m2"}, {"id": "m3"}]
        await load_mission_overviews(db, missions, lambda shift: 100)
        db.shifts.find.assert_called_once_with({"mission_id": {"$in": ["m1", "m2", "m3"]}}, {"_id": 0})
        self.assertEqual(missions[0]["total_needed"], 5)
        self.assertEqual(missions[0]["total_confirmed"], 3)
        self.assertEqual(missions[0]["last_date"], "2026-10-28")
        self.assertEqual(len(missions[0]["shifts"]), 2)
        self.assertEqual(missions[0]["shifts"][0]["estimated_cost"], 100)
        for mission in missions[1:]:
            self.assertEqual(mission["shifts"], [])
            self.assertIsNone(mission["first_date"])
            self.assertEqual(mission["total_needed"], 0)

    async def test_empty_list_does_not_query(self):
        db = Mock()
        self.assertEqual(await load_mission_overviews(db, [], lambda shift: 0), [])
        db.shifts.find.assert_not_called()

    async def test_per_mission_limit_is_preserved(self):
        rows = [{"mission_id": "a", "date": "2026-10-26", "people_needed": 1} for _ in range(501)]
        cursor = Mock(); cursor.sort.return_value = cursor; cursor.to_list = AsyncMock(return_value=rows)
        db = SimpleNamespace(shifts=SimpleNamespace(find=Mock(return_value=cursor)))
        result = await load_mission_overviews(db, [{"id": "a"}], lambda shift: 0)
        self.assertEqual(result[0]["total_needed"], 500)
