"""Regression coverage for Whop complimentary Pro trials and owner-scoped access."""
import os
from datetime import datetime, timedelta, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch
from copy import deepcopy

from mongomock_motor import AsyncMongoMockClient

import whop_billing as billing
import mission_billing
from workspace_accounts import accounts, manual_entitlement_valid


class ComplimentaryWhopTests(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = AsyncMongoMockClient().test
        await self.db.users.insert_one({'id': 'owner', 'email': 'owner@example.com',
                                        'plan': 'free', 'free_missions_used': 0})
        await self.db.organization_accounts.insert_one({'id': 'org_test', 'owner_id': 'owner',
                                                        'plan': 'free', 'free_pool_id': 'owner'})
        self.offer = billing.CATALOG['pro_monthly']
        self.member = {'id': 'mem_test', 'status': 'active',
                       'company': {'id': 'biz_test'},
                       'plan': {'id': self.offer['plan_id']},
                       'checkout_configuration_id': 'ch_test'}
        self.payment = None
        self.provider = AsyncMock(side_effect=self.reply)
        p = patch.object(billing, 'api', self.provider)
        p.start()
        self.addCleanup(p.stop)
        env = patch.dict(os.environ, WHOP_API_KEY='test', WHOP_WEBHOOK_SECRET='test',
                         WHOP_COMPANY_ID='biz_test')
        env.start()
        self.addCleanup(env.stop)
        self.plan = {'id': self.offer['plan_id'], 'company': {'id': 'biz_test'},
                     'currency': 'eur', 'plan_type': 'renewal', 'billing_period': 30,
                     'initial_price': 0, 'renewal_price': 79}

    async def reply(self, method, path, body=None):
        if path.startswith('/plans/'):
            return deepcopy(self.plan)
        if path == '/checkout_configurations':
            return {'id': 'ch_test'}
        if path.startswith('/memberships/'):
            return deepcopy(self.member)
        if path.startswith('/payments/'):
            return deepcopy(self.payment)
        if path.startswith('/memberships?'):
            return {'data': [deepcopy(self.member)],
                    'page_info': {'has_next_page': False}}
        raise AssertionError(path)

    async def quoted(self):
        return await billing.checkout(self.db, {'id': 'org_test'}, 'pro_monthly')

    async def test_free_trial_activation_restores_pro_and_missions(self):
        quote = await self.quoted()
        self.member['status'] = 'trialing'
        self.assertEqual(await billing.sync_membership(self.db, 'mem_test'), 'org_test')
        owner = await accounts(self.db).find_one({'id': 'owner'})
        org = await accounts(self.db).find_one({'id': 'org_test'})
        self.assertEqual(owner['plan'], 'pro')
        self.assertEqual(org['subscription_tier'], 'pro')
        self.assertEqual(org['subscription_status'], 'trialing')
        self.assertEqual(org['billing_catalog_version'], 2)
        self.assertEqual((await mission_billing.quota(self.db, 'org_test'))['mission_limit'], 20)
        self.assertEqual((await self.db.whop_checkouts.find_one({'_id': quote['reference']}))['membership_id'], 'mem_test')
        self.assertIsNone(await billing.sync_membership(self.db, 'mem_test'))
        self.member['status'] = 'expired'
        await billing.sync_membership(self.db, 'mem_test')
        self.assertEqual((await accounts(self.db).find_one({'id': 'owner'}))['plan'], 'free')

    async def test_unbound_and_nonmatching_memberships_cannot_grant_access(self):
        await self.quoted()
        for field, val in [('checkout_configuration_id', 'ch_unknown'),
                           ('status', 'past_due'),
                           ('plan', {'id': 'plan_unknown'}),
                           ('company', {'id': 'biz_foreign'})]:
            before = self.member[field]
            self.member[field] = val
            self.assertIsNone(await billing.sync_membership(self.db, 'mem_test'))
            self.assertEqual((await accounts(self.db).find_one({'id': 'owner'}))['plan'], 'free')
            self.member[field] = before

    async def test_reconciliation_works_after_missing_webhook(self):
        await self.quoted()
        self.assertTrue(await billing.reconcile_checkout_memberships(self.db, 'org_test'))
        self.assertEqual((await accounts(self.db).find_one({'id': 'owner'}))['plan'], 'pro')
        self.assertFalse(await billing.reconcile_checkout_memberships(self.db, 'org_test'))

    async def test_verified_zero_value_payment_is_allowed_and_idempotent(self):
        quote = await self.quoted()
        self.payment = {'id': 'pay_test', 'status': 'paid',
                        'metadata': {'shiftflow_checkout': quote['reference'],
                                     'organization_id': 'org_test'},
                        'membership': {'id': 'mem_test'},
                        'company': {'id': 'biz_test'}, 'plan': {'id': self.offer['plan_id']},
                        'subtotal': 0, 'total': 0, 'currency': 'eur', 'refunded_amount': 0}
        self.assertEqual(await billing.fulfill_payment(self.db, 'pay_test'), 'org_test')
        self.assertEqual(await billing.fulfill_payment(self.db, 'pay_test'), 'org_test')
        self.assertEqual((await accounts(self.db).find_one({'id': 'owner'}))['plan'], 'pro')

    async def test_manual_support_grants_expire_and_cannot_be_permanent(self):
        active = {'plan': 'pro', 'subscription_tier': 'pro', 'payment_provider': 'manual',
                  'subscription_status': 'active', 'billing_catalog_version': 2,
                  'support_pro_until': (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()}
        await self.db.users.update_one({'id': 'owner'}, {'$set': active})
        self.assertTrue(manual_entitlement_valid(active))
        self.assertEqual((await accounts(self.db).find_one({'id': 'org_test'}))['plan'], 'pro')
        active['support_pro_until'] = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        await self.db.users.update_one({'id': 'owner'}, {'$set': active})
        self.assertFalse(manual_entitlement_valid(active))
        self.assertEqual((await accounts(self.db).find_one({'id': 'org_test'}))['plan'], 'free')
        self.assertEqual((await mission_billing.quota(self.db, 'org_test'))['mission_limit'], 3)

    async def test_manual_trial_can_transition_to_a_real_whop_membership(self):
        await self.quoted()
        await self.db.users.update_one({'id': 'owner'}, {'$set': {
            'plan': 'pro', 'subscription_tier': 'pro', 'payment_provider': 'manual',
            'support_pro_until': (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()}})
        self.assertEqual(await billing.sync_membership(self.db, 'mem_test'), 'org_test')
        linked = await accounts(self.db).find_one({'id': 'owner'})
        self.assertEqual(linked['payment_provider'], 'whop')
        self.assertEqual(linked['whop_membership_id'], 'mem_test')
