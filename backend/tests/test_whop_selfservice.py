"""Whop subscription self-service regression tests; never reaches the live provider."""
import asyncio
import os
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient

import whop_billing as b


class WhopSelfserviceTests(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = AsyncMongoMockClient().test
        await self.db.users.insert_many([
            {'id': 'owner', 'plan': 'pro', 'subscription_tier': 'start',
             'billing_catalog_version': 2, 'whop_membership_id': 'mem_test',
             'whop_plan_id': b.CATALOG['start_monthly']['plan_id']},
            {'id': 'stranger', 'plan': 'free'},
        ])
        self.end = (datetime.now(timezone.utc) + timedelta(days=16)).isoformat()
        self.member = {
            'id': 'mem_test', 'status': 'active', 'company': {'id': 'biz_test'},
            'plan': {'id': b.CATALOG['start_monthly']['plan_id']},
            'renewal_period_end': self.end, 'cancel_at_period_end': False,
            'manage_url': 'https://whop.com/billing/manage/mem_test',
        }
        self.calls = []
        self.env = patch.dict(os.environ, {
            'WHOP_API_KEY': 'test', 'WHOP_WEBHOOK_SECRET': 'ws_test', 'WHOP_COMPANY_ID': 'biz_test',
        })
        self.env.start(); self.addCleanup(self.env.stop)
        self.provider = patch.object(b, 'api', AsyncMock(side_effect=self.response))
        self.provider.start(); self.addCleanup(self.provider.stop)

    async def response(self, method, path, body=None):
        self.calls.append((method, path, deepcopy(body)))
        if method == 'GET' and path == '/memberships/mem_test':
            return deepcopy(self.member)
        if method == 'POST' and path == '/memberships/mem_test/cancel':
            if body != {'cancellation_mode': 'at_period_end'}:
                raise AssertionError('Cancellation MUST retain access to the paid period')
            self.member['cancel_at_period_end'] = True
            return deepcopy(self.member)
        if method == 'POST' and path == '/memberships/mem_test/uncancel':
            self.member['cancel_at_period_end'] = False
            return deepcopy(self.member)
        raise AssertionError((method, path, body))

    async def test_real_renewal_date_and_plan_are_read_from_provider(self):
        result = await b.subscription(self.db, {'id': 'owner'})
        self.assertEqual(result['provider'], 'whop')
        self.assertEqual(result['tier'], 'start')
        self.assertEqual(result['billing_interval'], 'monthly')
        self.assertEqual(result['period_end'], self.end)
        self.assertTrue(result['can_cancel'])
        self.assertFalse(result['can_resume'])

    async def test_cancel_only_at_period_end_and_uncancel_restores_renewal(self):
        result = await b.cancel_at_period_end(self.db, {'id': 'owner'})
        self.assertTrue(result['cancel_at_period_end'])
        self.assertEqual(result['period_end'], self.end)
        self.assertFalse(result['can_cancel'])
        self.assertTrue(result['can_resume'])
        self.assertEqual((await self.db.users.find_one({'id': 'owner'}))['plan'], 'pro')
        first_posts = len([call for call in self.calls if call[0] == 'POST'])
        await b.cancel_at_period_end(self.db, {'id': 'owner'})
        self.assertEqual(len([call for call in self.calls if call[0] == 'POST']), first_posts)
        active = await b.undo_cancellation(self.db, {'id': 'owner'})
        self.assertFalse(active['cancel_at_period_end'])
        self.assertTrue(active['can_cancel'])
        self.assertEqual((await self.db.users.find_one({'id': 'owner'}))['plan'], 'pro')

    async def test_no_payment_changes_on_cancel_request_failure(self):
        async def fail(method, path, body=None):
            if method == 'POST': raise HTTPException(502, 'Whop indisponible')
            return deepcopy(self.member)
        with patch.object(b, 'api', AsyncMock(side_effect=fail)):
            with self.assertRaises(HTTPException):
                await b.cancel_at_period_end(self.db, {'id': 'owner'})
        self.assertEqual((await self.db.users.find_one({'id': 'owner'}))['plan'], 'pro')

    async def test_wrong_account_or_company_cannot_mutate(self):
        with self.assertRaises(HTTPException):
            await b.cancel_at_period_end(self.db, {'id': 'stranger'})
        self.member['company'] = {'id': 'foreign'}
        with self.assertRaises(HTTPException):
            await b.cancel_at_period_end(self.db, {'id': 'owner'})
        self.assertFalse(any(c[0] == 'POST' for c in self.calls))

    async def test_no_date_is_not_fabricated(self):
        self.member.pop('renewal_period_end')
        row = await b.subscription(self.db, {'id': 'owner'})
        self.assertIsNone(row['period_end'])

    async def test_invalid_provider_payload_cannot_report_success(self):
        async def fake_success(method, path, body=None):
            if method == 'POST': return {'status': 'ok'}
            return deepcopy(self.member)
        with patch.object(b, 'api', AsyncMock(side_effect=fake_success)):
            with self.assertRaises(HTTPException):
                await b.cancel_at_period_end(self.db, {'id': 'owner'})
        self.assertEqual((await self.db.users.find_one({'id': 'owner'}))['plan'], 'pro')

    async def test_old_team_stays_legacy_tier(self):
        await self.db.users.update_one({'id': 'owner'}, {'$set': {'subscription_tier': 'team'}, '$unset': {'billing_catalog_version': ''}})
        row = await b.subscription(self.db, {'id': 'owner'})
        self.assertEqual(row['tier'], 'team')
        self.assertEqual(row['period_end'], self.end)
