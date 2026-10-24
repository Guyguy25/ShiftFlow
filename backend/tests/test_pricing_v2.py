"""Pricing v2 owner-wide quotas and grandfathering; no external provider calls."""
import asyncio
from unittest import IsolatedAsyncioTestCase

from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient

import mission_billing
import organizations
from workspace_accounts import accounts


class PricingV2Tests(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = AsyncMongoMockClient().test
        self.owner = {"id": "owner", "email": "owner@example.com", "plan": "pro",
                      "subscription_tier": "start", "billing_catalog_version": 2}
        await self.db.users.insert_one(self.owner)
        await self.db.organizations.insert_many([
            {"_id": "owner", "id": "owner", "owner_id": "owner",
             "members": [{"user_id": "owner", "role": "owner"}], "invitations": [], "name": "Main"},
            {"_id": "org_second", "id": "org_second", "owner_id": "owner",
             "members": [{"user_id": "owner", "role": "owner"}], "invitations": [], "name": "Second"},
        ])
        await self.db.organization_accounts.insert_one({
            "id": "org_second", "owner_id": "owner", "free_pool_id": "owner", "plan": "free"})

    async def test_start_three_missions_shared_across_owner_organizations(self):
        results = await asyncio.gather(*[
            mission_billing.reserve(self.db, "owner" if index % 2 else "org_second")
            for index in range(8)
        ], return_exceptions=True)
        self.assertEqual(sum(isinstance(r, str) and r.startswith("period:") for r in results), 3)
        self.assertEqual(sum(isinstance(r, HTTPException) and r.status_code == 402 for r in results), 5)
        for uid in ("owner", "org_second"):
            q = await mission_billing.quota(self.db, uid)
            self.assertEqual(q["mission_limit"], 3)
            self.assertEqual(q["missions_this_month"], 3)
            self.assertFalse(q["can_create_mission"])

    async def test_failed_creation_restores_period_slot(self):
        slot = await mission_billing.reserve(self.db, "org_second")
        await mission_billing.release(self.db, "org_second", slot)
        q = await mission_billing.quota(self.db, "owner")
        self.assertEqual(q["missions_this_month"], 0)
        self.assertTrue(q["can_create_mission"])

    async def test_pro_twenty_missions_and_three_seats(self):
        await self.db.users.update_one({"id": "owner"}, {"$set": {"subscription_tier": "pro"}})
        profile = await accounts(self.db).find_one({"id": "org_second"})
        self.assertEqual(mission_billing.paid_limit(profile), 20)
        self.assertEqual(organizations.collaborator_limit(profile), 3)
        self.assertTrue(organizations.is_team(profile))
        for _ in range(20):
            await mission_billing.reserve(self.db, "org_second")
        with self.assertRaises(HTTPException):
            await mission_billing.reserve(self.db, "owner")

    async def test_business_unlimited_ten_seats(self):
        await self.db.users.update_one({"id": "owner"}, {"$set": {"subscription_tier": "business"}})
        profile = await accounts(self.db).find_one({"id": "owner"})
        self.assertIsNone(mission_billing.paid_limit(profile))
        self.assertEqual(organizations.collaborator_limit(profile), 10)
        for _ in range(25):
            self.assertEqual(await mission_billing.reserve(self.db, "org_second"), "pro")

    async def test_legacy_entitlements_are_unchanged(self):
        await self.db.users.update_one({"id": "owner"}, {"$unset": {"billing_catalog_version": ""}})
        for tier, seats in [("pro", 0), ("team", 5), ("business", 15)]:
            await self.db.users.update_one({"id": "owner"}, {"$set": {"subscription_tier": tier}})
            profile = await accounts(self.db).find_one({"id": "org_second"})
            self.assertIsNone(mission_billing.paid_limit(profile))
            self.assertEqual(organizations.collaborator_limit(profile), seats)
            self.assertEqual(await mission_billing.reserve(self.db, "org_second"), "pro")

    async def test_free_owner_keeps_single_three_mission_pool(self):
        await self.db.users.update_one({"id": "owner"}, {"$set": {"plan": "free"}})
        result = await asyncio.gather(*[
            mission_billing.reserve(self.db, "owner" if index % 2 else "org_second")
            for index in range(5)
        ], return_exceptions=True)
        self.assertEqual(result.count("free"), 3)
        self.assertEqual(sum(isinstance(r, HTTPException) for r in result), 2)
