import base64
import copy
import hashlib
import hmac
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import whop_billing as billing


def matches(doc, query):
    for key, value in query.items():
        if key == '$or':
            if not any(matches(doc, item) for item in value): return False
        elif isinstance(value, dict):
            for op, expected in value.items():
                if op == '$exists' and (key in doc) != expected: return False
                if op == '$ne' and doc.get(key) == expected: return False
                if op == '$lte' and not (doc.get(key, '') <= expected): return False
        elif doc.get(key) != value: return False
    return True


class Collection:
    def __init__(self, docs=()): self.docs = list(copy.deepcopy(docs))
    async def find_one(self, query):
        return next((copy.deepcopy(d) for d in self.docs if matches(d, query)), None)
    async def insert_one(self, doc): self.docs.append(copy.deepcopy(doc))
    async def update_one(self, query, update, upsert=False):
        for doc in self.docs:
            if matches(doc, query):
                doc.update(copy.deepcopy(update.get('$set', {})))
                return SimpleNamespace(matched_count=1)
        if upsert:
            doc = dict(query); doc.update(update.get('$set', {})); self.docs.append(doc)
        return SimpleNamespace(matched_count=0)


class WhopTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'WHOP_API_KEY': 'test', 'WHOP_WEBHOOK_SECRET': 'ws_test', 'WHOP_COMPANY_ID': 'biz_test'})
        self.env.start(); self.addCleanup(self.env.stop)
        self.user = {'id': 'u1', 'plan': 'free'}
        self.db = SimpleNamespace(users=Collection([self.user]), payment_transactions=Collection(), whop_events=Collection())
        self.payload = SimpleNamespace(legal_acceptance={'version': '2026-10-19'}, quantity=1, lookup_key='shiftflow_monthly', promo_code='', meta_consent=False)

    def plan(self, lookup='shiftflow_monthly'):
        p = billing.plan_details(lookup)
        return {'id': p['id'], 'company': {'id': 'biz_test'}, 'currency': 'eur', 'plan_type': 'renewal', 'billing_period': p['days'], 'initial_price': p['amount']/100, 'renewal_price': p['amount']/100, 'trial_period_days': None}

    async def checkout(self):
        with patch.object(billing, 'api_get', AsyncMock(return_value=self.plan())):
            self.checkout_data = await billing.create_checkout(self.db, self.user, self.payload, {}, 'https://www.shiftflow.io')
        return self.checkout_data

    def membership(self, **changes):
        return {'id': 'mem_123', 'company': {'id': 'biz_test'}, 'plan': {'id': billing.plan_details('shiftflow_monthly')['id']}, 'status': 'active', 'updated_at': '2026-10-21T10:00:00+00:00', 'renewal_period_end': '2099-01-01T00:00:00+00:00', **changes}

    def test_plan_amount_interval_company_and_trial_are_checked(self):
        expected = billing.plan_details('shiftflow_monthly')
        billing.validate_plan(self.plan(), expected)
        for changes in [{'currency':'usd'}, {'initial_price':0}, {'renewal_price':49}, {'billing_period':365}, {'trial_period_days':7}, {'company':{'id':'biz_other'}}]:
            with self.subTest(changes=changes), self.assertRaises(billing.BillingError): billing.validate_plan({**self.plan(), **changes}, expected)
        annual = billing.plan_details('shiftflow_yearly')
        self.assertEqual(annual['amount'], 52140)
        billing.validate_plan(self.plan('shiftflow_yearly'), annual)

    def signed(self, body=None, stamp=1000):
        body = body or json.dumps({'id':'msg_1', 'type':'payment.succeeded', 'data':{}}).encode()
        signature = base64.b64encode(hmac.new(b'ws_test', b'msg_1.'+str(stamp).encode()+b'.'+body, hashlib.sha256).digest()).decode()
        return body, {'webhook-id':'msg_1','webhook-timestamp':str(stamp),'webhook-signature':'v1,'+signature}

    def test_signature_accepts_raw_secret_and_rotation(self):
        body, headers = self.signed()
        headers['webhook-signature'] = 'v1,old '+headers['webhook-signature']
        self.assertEqual(billing.verify_webhook(body, headers, 'ws_test', now=1000)['id'], 'msg_1')

    def test_tampered_expired_future_missing_and_wrong_secrets_are_rejected(self):
        body, headers = self.signed()
        cases = [(body+b' ',headers,'ws_test',1000),(body,headers,'wrong',1000),(body,headers,'ws_test',1301),(body,headers,'ws_test',699),(body,{},'ws_test',1000)]
        for b,h,s,n in cases:
            with self.subTest(n=n,s=s), self.assertRaises(billing.BillingError): billing.verify_webhook(b,h,s,now=n)

    async def test_checkout_does_not_grant_pro_and_binds_only_to_authenticated_user(self):
        checkout = await self.checkout()
        self.assertEqual(self.db.users.docs[0]['plan'], 'free')
        self.assertEqual(self.db.payment_transactions.docs[0]['user_id'], 'u1')
        self.assertEqual(len(checkout['metadata']['shiftflow_token']), 64)
        self.assertNotIn('test', checkout.values())
        self.assertTrue(checkout['return_url'].startswith('https://www.shiftflow.io/payment/success?'))

    async def test_checkout_rejects_active_account_quantity_terms_reward_and_missing_config(self):
        cases = [('quantity',2),('promo_code','AVIS-U'),('lookup_key','unknown'),('legal_acceptance',{})]
        for field,value in cases:
            payload = SimpleNamespace(**{**vars(self.payload), field:value})
            with self.subTest(field=field), self.assertRaises(billing.BillingError): await billing.create_checkout(self.db,self.user,payload,{},'https://www.shiftflow.io')
        with self.assertRaises(billing.BillingError): await billing.create_checkout(self.db,{'id':'u1','plan':'pro'},self.payload,{},'https://www.shiftflow.io')
        with patch.dict(os.environ, {'WHOP_API_KEY':''}), self.assertRaises(billing.BillingError): billing.require_config()

    async def test_webhook_activation_and_cancellation_reconcile_current_state(self):
        checkout = await self.checkout()
        with patch.object(billing,'api_get',AsyncMock(return_value=self.membership())):
            record = await billing.reconcile_membership(self.db,'mem_123',checkout['metadata'])
        self.assertTrue(record['fulfilled']); self.assertEqual(self.db.users.docs[0]['plan'],'pro')
        with patch.object(billing,'api_get',AsyncMock(return_value=self.membership(status='canceled',updated_at='2026-10-22T10:00:00+00:00'))):
            await billing.reconcile_membership(self.db,'mem_123')
        self.assertEqual(self.db.users.docs[0]['plan'],'free')

    async def test_cancel_at_period_end_keeps_access_until_paid_period_ends(self):
        self.assertTrue(billing.active_membership(self.membership(status='canceling')))
        self.assertFalse(billing.active_membership(self.membership(status='canceling',renewal_period_end='2020-01-01T00:00:00+00:00')))
        self.assertFalse(billing.active_membership(self.membership(status='past_due')))

    async def test_forged_binding_wrong_plan_and_wrong_company_cannot_grant_access(self):
        checkout = await self.checkout()
        with patch.object(billing,'api_get',AsyncMock(return_value=self.membership())):
            self.assertIsNone(await billing.reconcile_membership(self.db,'mem_123',{**checkout['metadata'],'shiftflow_token':'fake'}))
            self.assertIsNone(await billing.reconcile_membership(self.db,'mem_123',{}))
        for changes in [{'company':{'id':'biz_other'}},{'plan':{'id':'plan_other'}}]:
            with patch.object(billing,'api_get',AsyncMock(return_value=self.membership(**changes))), self.assertRaises(billing.BillingError):
                await billing.reconcile_membership(self.db,'mem_123',checkout['metadata'])
        self.assertEqual(self.db.users.docs[0]['plan'],'free')

    async def test_stale_snapshot_and_reused_token_do_not_restore_canceled_access(self):
        checkout = await self.checkout()
        canceled = self.membership(status='canceled',updated_at='2026-10-22T10:00:00+00:00')
        with patch.object(billing,'api_get',AsyncMock(return_value=canceled)):
            await billing.reconcile_membership(self.db,'mem_123',checkout['metadata'])
        with patch.object(billing,'api_get',AsyncMock(return_value=self.membership())):
            await billing.reconcile_membership(self.db,'mem_123',checkout['metadata'])
        self.assertEqual(self.db.users.docs[0]['plan'],'free')
        with patch.object(billing,'api_get',AsyncMock(return_value=self.membership(id='mem_other'))), self.assertRaises(billing.BillingError):
            await billing.reconcile_membership(self.db,'mem_other',checkout['metadata'])

    async def test_duplicate_delivery_does_not_repeat_provider_calls(self):
        checkout = await self.checkout()
        event = {'id':'msg_1','account_id':'biz_test','type':'payment.succeeded','data':{'id':'pay_1'}}
        payment = {'membership':{'id':'mem_123'},'metadata':checkout['metadata']}
        getter = AsyncMock(side_effect=[payment,self.membership()])
        with patch.object(billing,'api_get',getter):
            await billing.process_event(self.db,event)
            await billing.process_event(self.db,event)
        self.assertEqual(getter.await_count,2)
        self.assertEqual(self.db.users.docs[0]['plan'],'pro')

    async def test_provider_failure_is_retryable_and_not_marked_processed(self):
        await self.checkout()
        event = {'id':'msg_2','company_id':'biz_test','type':'membership.updated','data':{'id':'mem_123'}}
        with patch.object(billing,'api_get',AsyncMock(side_effect=billing.BillingError(502,'offline'))), self.assertRaises(billing.BillingError): await billing.process_event(self.db,event)
        self.assertEqual(self.db.whop_events.docs,[])

    async def test_billing_portal_only_allows_whop_https(self):
        for url in ['https://whop.com/billing/manage/mem_123','https://evil.test/','https://whop.com.evil.test/','javascript:alert(1)']:
            with patch.object(billing,'api_get',AsyncMock(return_value=self.membership(manage_url=url))):
                if url.startswith('https://whop.com/'):
                    self.assertEqual(await billing.portal_url({'whop_membership_id':'mem_123'}),url)
                else:
                    with self.assertRaises(billing.BillingError): await billing.portal_url({'whop_membership_id':'mem_123'})


if __name__ == '__main__': unittest.main()
