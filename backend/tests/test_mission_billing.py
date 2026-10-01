"""Offline billing regression tests. Requires test-only dependency mongomock."""
import ast
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, Mock

import mongomock
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).parents[1]))
import mission_billing as billing


class Collection:
    def __init__(self, collection):
        self.raw = collection

    def __getattr__(self, name):
        async def call(*args, **kwargs):
            await asyncio.sleep(0)
            return getattr(self.raw, name)(*args, **kwargs)
        return call


def function(name, **namespace):
    tree = ast.parse((Path(__file__).parents[1] / "server.py").read_text(encoding="utf-8"))
    node = next(n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name)
    node.decorator_list = []
    node.args.defaults = []
    for arg in node.args.args:
        arg.annotation = None
    exec(compile(ast.Module(body=[node], type_ignores=[]), "server.py", "exec"), namespace)
    return namespace[name]


class BillingTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.raw = mongomock.MongoClient().db
        self.db = SimpleNamespace(**{name: Collection(self.raw[name]) for name in
            ("users", "missions", "payment_transactions")})
        self.raw.users.insert_one({"id": "u", "plan": "free"})

    async def test_existing_archived_missions_count_once(self):
        self.raw.missions.insert_many([{"agency_id": "u", "archived": True}, {"agency_id": "u", "status": "cancelled"}])
        self.assertEqual(billing.balance(await billing.account(self.db, "u"))["free_missions_remaining"], 1)
        self.raw.missions.delete_many({})
        self.assertEqual(billing.balance(await billing.account(self.db, "u"))["free_missions_remaining"], 1)

    async def test_concurrent_requests_cannot_exceed_three_free_missions(self):
        results = await asyncio.gather(*(billing.reserve(self.db, "u") for _ in range(8)), return_exceptions=True)
        self.assertEqual(results.count("free"), 3)
        self.assertEqual(sum(isinstance(r, HTTPException) and r.status_code == 402 for r in results), 5)
        self.assertEqual(self.raw.users.find_one({"id": "u"})["free_missions_used"], 3)

    async def test_duplicate_payment_grants_one_credit_and_one_creation(self):
        self.raw.users.update_one({"id": "u"}, {"$set": {"free_missions_used": 3}})
        await asyncio.gather(*(billing.grant_credit(self.db, "u", "cs_paid") for _ in range(8)))
        user = self.raw.users.find_one({"id": "u"})
        self.assertEqual(user["mission_credits"], 1)
        self.assertEqual(user["plan"], "free")
        results = await asyncio.gather(*(billing.reserve(self.db, "u") for _ in range(3)), return_exceptions=True)
        self.assertEqual(results.count("credit"), 1)
        self.assertEqual(self.raw.users.find_one({"id": "u"})["mission_credits"], 0)

    async def test_free_precedes_paid_and_pro_does_not_consume_credit(self):
        await billing.grant_credit(self.db, "u", "cs_paid")
        self.assertEqual(await billing.reserve(self.db, "u"), "free")
        self.raw.users.update_one({"id": "u"}, {"$set": {"plan": "pro"}})
        self.assertEqual(await billing.reserve(self.db, "u"), "pro")
        self.assertEqual(self.raw.users.find_one({"id": "u"})["mission_credits"], 1)

    async def test_failed_creation_refunds_reserved_credit(self):
        self.raw.users.update_one({"id": "u"}, {"$set": {"free_missions_used": 3, "mission_credits": 1}})
        source = await billing.reserve(self.db, "u")
        await billing.release(self.db, "u", source)
        self.assertEqual(self.raw.users.find_one({"id": "u"})["mission_credits"], 1)

    async def test_expired_legacy_trial_does_not_block_existing_missions(self):
        user = {"plan": "free", "trial_ends_at": "2020-01-01"}
        self.assertFalse(function("trial_info")(user)["trial_expired"])
        self.assertTrue(function("has_active_product_access")(user))

    def fulfillment(self):
        return function("fulfill_checkout", db=self.db, HTTPException=HTTPException,
            mission_billing=billing, stripe_lib=SimpleNamespace(Subscription=SimpleNamespace(
                retrieve=Mock(return_value=SimpleNamespace(status="active")))),
            record_activation_event=AsyncMock(), _send_subscribe_meta_if_needed=AsyncMock(),
            now_utc=lambda: datetime.now(timezone.utc), iso=lambda d: d.isoformat())

    async def test_complete_but_unpaid_session_never_grants_access(self):
        await self.fulfillment()({"id": "cs", "status": "complete", "payment_status": "unpaid"})
        self.assertNotIn("mission_credits", self.raw.users.find_one({"id": "u"}))

    async def test_paid_session_fulfills_only_its_owner_and_never_pro(self):
        self.raw.payment_transactions.insert_one({"session_id": "cs", "user_id": "u", "lookup_key": "shiftflow_mission"})
        obj = {"id": "cs", "payment_status": "paid", "mode": "payment",
               "metadata": {"user_id": "u", "lookup_key": "shiftflow_mission"}}
        await self.fulfillment()(obj)
        await self.fulfillment()(obj)
        self.assertEqual(self.raw.users.find_one({"id": "u"})["mission_credits"], 1)
        self.assertEqual(self.raw.users.find_one({"id": "u"})["plan"], "free")
        self.assertTrue(self.raw.payment_transactions.find_one({"session_id": "cs"})["fulfilled"])
        obj["metadata"]["user_id"] = "intruder"
        with self.assertRaises(HTTPException):
            await self.fulfillment()(obj)

    async def test_checkout_uses_server_price_and_requires_accepted_terms(self):
        self.raw.users.update_one({"id": "u"}, {"$set": {"free_missions_used": 3}})
        create = Mock(return_value=SimpleNamespace(id="cs", url="https://checkout.stripe.com/test"))
        stripe = SimpleNamespace(checkout=SimpleNamespace(Session=SimpleNamespace(create=create)))
        fn = function("create_checkout", HTTPException=HTTPException, db=self.db, mission_billing=billing,
            ALLOWED_STRIPE_PRICES={"shiftflow_mission": {"interval": "one_time", "amount": 490}},
            stripe_lib=stripe, FRONTEND_URL="https://www.shiftflow.io", new_id=lambda: "id",
            request_client_ip=lambda _: None, now_utc=lambda: datetime.now(timezone.utc), iso=lambda d: d.isoformat())
        payload = SimpleNamespace(quantity=1, lookup_key="shiftflow_mission", origin_url="https://evil.test",
            legal_acceptance={"version": "2026-10-01"}, meta_consent=False)
        await fn(payload, SimpleNamespace(headers={}), {"id": "u"})
        args = create.call_args.kwargs
        self.assertEqual(args["mode"], "payment")
        self.assertEqual(args["line_items"][0]["price_data"]["unit_amount"], 490)
        self.assertTrue(args["success_url"].startswith("https://www.shiftflow.io/"))
        payload.legal_acceptance = {}
        with self.assertRaises(HTTPException):
            await fn(payload, SimpleNamespace(headers={}), {"id": "u"})

    def test_pack_boundaries_and_invalid_quantities(self):
        for quantity, credits in [(1, 1), (4, 4), (5, 6), (9, 10), (10, 12), (100, 120)]:
            self.assertEqual(billing.pack(quantity)["mission_credits"], credits)
            self.assertEqual(billing.pack(quantity)["amount"], quantity * 490)
        for invalid in [0, -1, 101, 5.5, "5", True]:
            with self.assertRaises(HTTPException):
                billing.pack(invalid)

    async def test_pack_replays_grant_full_bonus_once(self):
        self.raw.payment_transactions.insert_one({"session_id": "pack", "user_id": "u",
            "lookup_key": "shiftflow_mission", "mission_credits": 12, "quantity": 10})
        obj = {"id": "pack", "payment_status": "paid", "mode": "payment",
            "metadata": {"user_id": "u", "lookup_key": "shiftflow_mission", "mission_credits": "999"}}
        await asyncio.gather(*(self.fulfillment()(obj) for _ in range(8)))
        self.assertEqual(self.raw.users.find_one({"id": "u"})["mission_credits"], 12)

    async def test_pack_checkout_and_annual_subscription(self):
        create = Mock(side_effect=lambda **kw: SimpleNamespace(id="cs-" + str(create.call_count), url="https://checkout.stripe.com/test"))
        price_list = Mock(return_value=SimpleNamespace(data=[SimpleNamespace(
            id="price_year", recurring=SimpleNamespace(interval="year"), currency="eur", unit_amount=49980)]))
        fn = function("create_checkout", HTTPException=HTTPException, db=self.db, mission_billing=billing,
            ALLOWED_STRIPE_PRICES={"shiftflow_mission": {"interval": "one_time", "amount": 490},
                "shiftflow_pro_yearly": {"interval": "year", "amount": 49980}},
            stripe_lib=SimpleNamespace(checkout=SimpleNamespace(Session=SimpleNamespace(create=create)), Price=SimpleNamespace(list=price_list)),
            FRONTEND_URL="https://www.shiftflow.io", new_id=lambda: "id", request_client_ip=lambda _: None,
            now_utc=lambda: datetime.now(timezone.utc), iso=lambda d: d.isoformat())
        payload = SimpleNamespace(quantity=5, lookup_key="shiftflow_mission", origin_url="https://www.shiftflow.io",
            legal_acceptance={"version": "2026-10-01"}, meta_consent=False)
        # Free credits do not prevent an explicitly chosen bulk purchase.
        await fn(payload, SimpleNamespace(headers={}), {"id": "u"})
        args = create.call_args.kwargs
        self.assertEqual(args["line_items"][0]["price_data"]["unit_amount"], 2450)
        self.assertEqual(self.raw.payment_transactions.find_one({"session_id": "cs-1"})["mission_credits"], 6)
        payload.quantity = 10
        await fn(payload, SimpleNamespace(headers={}), {"id": "u"})
        self.assertNotEqual(args["idempotency_key"], create.call_args.kwargs["idempotency_key"])
        payload.lookup_key = "shiftflow_pro_yearly"
        with self.assertRaises(HTTPException):
            await fn(payload, SimpleNamespace(headers={}), {"id": "u"})
        payload.quantity = 1
        await fn(payload, SimpleNamespace(headers={}), {"id": "u"})
        self.assertEqual(create.call_args.kwargs["mode"], "subscription")
        self.assertEqual(create.call_args.kwargs["line_items"], [{"price": "price_year", "quantity": 1}])
