"""Isolated inbox, ownership and Resend email regression tests (no real sends)."""
import os
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, MagicMock, patch

from mongomock_motor import AsyncMongoMockClient

import activity_notifications as n


class ActivityTests(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = AsyncMongoMockClient().test
        await self.db.users.insert_many([
            {"id": "owner1", "email": "one@example.com"},
            {"id": "owner2", "email": "two@example.com"},
        ])
        await self.db.organizations.insert_many([
            {"_id": "org1", "owner_id": "owner1"},
            {"_id": "org2", "owner_id": "owner2"},
        ])
        await self.db.missions.insert_many([
            {"id": "m1", "agency_id": "org1", "name": "Concert"},
            {"id": "m2", "agency_id": "org2", "name": "Festival"},
        ])
        await self.db.workers.insert_one({"id": "w1", "first_name": "Paul", "last_name": "Test"})
        self.m1 = {"id": "m1", "agency_id": "org1", "name": "Concert"}
        self.slot = {"id": "slot1", "worker_id": "w1"}
        self.env = patch.dict(os.environ, {"RESEND_API_KEY": "mock-key",
            "ONBOARDING_EMAIL_FROM": "ShiftFlow <hello@shiftflow.io>",
            "FRONTEND_URL": "https://www.shiftflow.io"})
        self.env.start()
        self.addCleanup(self.env.stop)

    async def test_workspace_and_user_scoped_read_states(self):
        await n.publish(self.db, kind="accepted", event_key="slot1",
                        agency_id="org1", mission=self.m1)
        await n.publish(self.db, kind="refused", event_key="slot2",
                        agency_id="org2", mission={"id": "m2", "name": "Festival"})
        one = await n.inbox(self.db, "org1", "owner1")
        two = await n.inbox(self.db, "org2", "owner1")
        self.assertEqual([item["kind"] for item in one["items"]], ["accepted"])
        self.assertEqual([item["kind"] for item in two["items"]], ["refused"])
        self.assertEqual(one["unread"], 1)
        await n.mark_read(self.db, "org1", "owner1")
        self.assertEqual((await n.inbox(self.db, "org1", "owner1"))["unread"], 0)
        self.assertEqual((await n.inbox(self.db, "org1", "owner2"))["unread"], 1)
        self.assertEqual((await n.inbox(self.db, "org2", "owner1"))["unread"], 1)

    async def test_response_is_idempotent_and_email_goes_to_owner_only(self):
        with patch.object(n, "send_one", new_callable=AsyncMock) as send:
            await n.record_response(self.db, "accepted", self.slot, self.m1)
            await n.record_response(self.db, "accepted", self.slot, self.m1)
        self.assertEqual(await self.db.activity_events.count_documents({}), 1)
        outbox = await self.db.notification_emails.find_one({"_id": "accepted:slot1"})
        self.assertEqual(outbox["to"], "one@example.com")
        self.assertEqual(outbox["status"], "pending")
        self.assertEqual(send.await_count, 2)

    async def test_whatsapp_activity_only_for_sent_messages(self):
        record = {"id": "w-msg", "mission_id": "m1", "worker_id": "w1",
                  "kind": "followup", "status": "sent"}
        await n.record_delivery(self.db, record)
        await n.record_delivery(self.db, record)
        self.assertEqual((await n.inbox(self.db, "org1", "owner1"))["items"][0]["kind"], "followup")
        self.assertEqual(await self.db.activity_events.count_documents({}), 1)
        self.assertEqual(await self.db.notification_emails.count_documents({}), 0)
        await n.record_delivery(self.db, {**record, "id": "failed", "status": "failed"})
        self.assertEqual(await self.db.activity_events.count_documents({}), 1)

    async def test_resend_acceptance_is_tracked_without_exposing_secrets(self):
        await n.publish(self.db, kind="refused", event_key="slot1",
                        agency_id="org1", mission=self.m1)
        with patch.object(n, "send_one", new_callable=AsyncMock):
            await n.record_response(self.db, "refused", self.slot, self.m1)
        response = MagicMock()
        response.json.return_value = {"id": "email_accepted"}
        response.raise_for_status.return_value = None
        client = MagicMock()
        client.post = AsyncMock(return_value=response)
        manager = MagicMock()
        manager.__aenter__ = AsyncMock(return_value=client)
        manager.__aexit__ = AsyncMock(return_value=None)
        with patch.object(n.httpx, "AsyncClient", return_value=manager):
            self.assertTrue(await n.send_one(self.db, "refused:slot1"))
        row = await self.db.notification_emails.find_one({"_id": "refused:slot1"})
        self.assertEqual(row["status"], "sent")
        self.assertEqual(row["provider_id"], "email_accepted")
        payload = client.post.await_args.kwargs["json"]
        self.assertEqual(payload["to"], ["one@example.com"])
        self.assertIn("Paul Test", payload["text"])
        self.assertIn("Idempotency-Key", client.post.await_args.kwargs["headers"])
        self.assertFalse(await n.send_one(self.db, "refused:slot1"))

    async def test_retry_pending_after_resend_error(self):
        with patch.object(n, "send_one", new_callable=AsyncMock):
            await n.record_response(self.db, "cancelled", self.slot, self.m1)
        manager = MagicMock()
        client = MagicMock()
        client.post = AsyncMock(side_effect=n.httpx.ConnectError("temporary"))
        manager.__aenter__ = AsyncMock(return_value=client)
        manager.__aexit__ = AsyncMock(return_value=None)
        with patch.object(n.httpx, "AsyncClient", return_value=manager):
            self.assertFalse(await n.send_one(self.db, "cancelled:slot1"))
        row = await self.db.notification_emails.find_one({"_id": "cancelled:slot1"})
        self.assertEqual(row["status"], "pending")
        self.assertEqual(row["attempts"], 1)
        await self.db.notification_emails.update_one(
            {"_id": "cancelled:slot1"}, {"$set": {"next_attempt_at": "2000-01-01T00:00:00Z"}})
        with patch.object(n, "send_one", new_callable=AsyncMock, return_value=True) as resend:
            self.assertEqual(await n.retry_pending(self.db), 1)
            resend.assert_awaited_once_with(self.db, "cancelled:slot1")
