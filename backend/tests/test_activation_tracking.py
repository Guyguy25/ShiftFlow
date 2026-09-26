"""Isolated tests for durable activation milestone tracking."""
import ast
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, Mock


def load_functions(*names, **namespace):
    tree = ast.parse((Path(__file__).parents[1] / "server.py").read_text(encoding="utf-8"))
    wanted = [
        node for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names
    ]
    exec(compile(ast.Module(body=wanted, type_ignores=[]), "server.py", "exec"), namespace)
    return [namespace[name] for name in names]


class ActivationTrackingTest(IsolatedAsyncioTestCase):
    async def test_first_occurrence_is_persisted_and_sent_once(self):
        activation_events = SimpleNamespace(
            update_one=AsyncMock(side_effect=[
                SimpleNamespace(upserted_id="created"),
                SimpleNamespace(upserted_id=None),
            ])
        )
        meta = AsyncMock(return_value=True)
        db = SimpleNamespace(activation_events=activation_events)
        request = SimpleNamespace(
            headers={"origin": "https://www.shiftflow.io", "user-agent": "test-agent"},
            client=SimpleNamespace(host="127.0.0.1"),
        )
        now = datetime(2026, 9, 26, tzinfo=timezone.utc)

        request_client_ip, meta_consent_for_user, record_activation_event = load_functions(
            "request_client_ip",
            "meta_consent_for_user",
            "record_activation_event",
            Optional=__import__("typing").Optional,
            Request=object,
            db=db,
            iso=lambda value: value.isoformat(),
            now_utc=lambda: now,
            new_id=lambda: "event-id",
            FRONTEND_URL="https://www.shiftflow.io",
            send_meta_event=meta,
        )

        user = {
            "id": "agency-1",
            "email": "owner@example.com",
            "phone": "+33600000000",
            "meta_consent": True,
            "meta_fbp": "fbp",
            "meta_fbc": "fbc",
        }

        created = await record_activation_event(
            user,
            "worker_added",
            metadata={"source": "manual"},
            request=request,
            meta_event_name="WorkerAdded",
            event_source_path="/app/workers",
        )
        duplicate = await record_activation_event(
            user,
            "worker_added",
            metadata={"source": "manual"},
            request=request,
            meta_event_name="WorkerAdded",
            event_source_path="/app/workers",
        )

        self.assertTrue(created)
        self.assertFalse(duplicate)
        self.assertEqual(meta.await_count, 1)
        self.assertEqual(activation_events.update_one.await_count, 2)
        query = activation_events.update_one.call_args_list[0].args[0]
        self.assertEqual(query, {"_id": "agency-1:worker_added"})
        kwargs = meta.await_args.kwargs
        self.assertEqual(kwargs["event_id"], "activation_worker_added_agency-1")
        self.assertEqual(kwargs["event_source_url"], "https://www.shiftflow.io/app/workers")

    async def test_no_meta_without_consent(self):
        activation_events = SimpleNamespace(
            update_one=AsyncMock(return_value=SimpleNamespace(upserted_id="created"))
        )
        meta = AsyncMock(return_value=True)
        db = SimpleNamespace(activation_events=activation_events)
        now = datetime(2026, 9, 26, tzinfo=timezone.utc)

        _, _, record_activation_event = load_functions(
            "request_client_ip",
            "meta_consent_for_user",
            "record_activation_event",
            Optional=__import__("typing").Optional,
            Request=object,
            db=db,
            iso=lambda value: value.isoformat(),
            now_utc=lambda: now,
            new_id=lambda: "event-id",
            FRONTEND_URL="https://www.shiftflow.io",
            send_meta_event=meta,
        )

        created = await record_activation_event(
            {"id": "agency-2", "email": "no@example.com", "meta_consent": False},
            "whatsapp_connected",
            meta_event_name="WhatsAppConnected",
        )

        self.assertTrue(created)
        meta.assert_not_awaited()
