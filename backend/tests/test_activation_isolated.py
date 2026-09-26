"""Exercise changed API functions with in-memory mocks, without external services.

AST extraction avoids server.py's import-time production configuration and clients.
Run: python -m unittest discover -s backend/tests -p test_activation_isolated.py
"""
import ast
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, Mock


def load_function(name, **namespace):
    tree = ast.parse((Path(__file__).parents[1] / "server.py").read_text(encoding="utf-8"))
    function = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == name)
    function.decorator_list = []
    function.args.defaults = []
    exec(compile(ast.Module(body=[function], type_ignores=[]), "server.py", "exec"), namespace)
    return namespace[name]


class ActivationTest(IsolatedAsyncioTestCase):
    async def test_summary_uses_agency_history_and_successful_invites_only(self):
        missions = SimpleNamespace(find=Mock(return_value=SimpleNamespace(to_list=AsyncMock(return_value=[]))), distinct=AsyncMock(return_value=["archived-mission"]))
        notifications = SimpleNamespace(find_one=AsyncMock(return_value={"id": "sent-invite"}))
        workers = SimpleNamespace(count_documents=AsyncMock(side_effect=[3, 2]))
        fn = load_function("dashboard_summary", db=SimpleNamespace(missions=missions, notifications=notifications, workers=workers), now_utc=lambda: datetime.now(timezone.utc), twilio_ready=lambda: False)
        result = await fn({"id": "agency-a"})
        self.assertEqual(result["activation"], {"first_invite_sent": True, "active_workers": 2})
        missions.distinct.assert_awaited_once_with("id", {"agency_id": "agency-a"})
        query = notifications.find_one.call_args.args[0]
        self.assertEqual(query, {"mission_id": {"$in": ["archived-mission"]}, "channel": "whatsapp", "kind": "invite", "status": "sent"})
        self.assertEqual(workers.count_documents.call_args.args[0], {"agency_id": "agency-a", "active": {"$ne": False}})

    async def test_new_account_is_not_activated(self):
        db = SimpleNamespace(missions=SimpleNamespace(find=Mock(return_value=SimpleNamespace(to_list=AsyncMock(return_value=[]))), distinct=AsyncMock(return_value=[])), notifications=SimpleNamespace(find_one=AsyncMock(return_value=None)), workers=SimpleNamespace(count_documents=AsyncMock(return_value=0)))
        fn = load_function("dashboard_summary", db=db, now_utc=lambda: datetime.now(timezone.utc), twilio_ready=lambda: False)
        self.assertFalse((await fn({"id": "new"}))["activation"]["first_invite_sent"])
