"""Run checkout routes with provider/DB mocks, without production credentials."""
import ast
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Literal, Optional
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, Mock, patch

from fastapi import HTTPException, Request, Response
from pydantic import BaseModel, Field, ValidationError


class Session(dict):
    def __getattr__(self, name): return self.get(name)


def load(name, namespace):
    tree = ast.parse((Path(__file__).parents[1] / 'server.py').read_text())
    node = next(n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and n.name == name)
    if not isinstance(node, ast.ClassDef):
        node.decorator_list = []
        if name in ('create_checkout', 'payment_status_endpoint'): node.args.defaults = []
    exec(compile(ast.Module(body=[node], type_ignores=[]), 'server.py', 'exec'), namespace)
    return namespace[name]


class EmbeddedCheckoutTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.db = SimpleNamespace(payment_transactions=SimpleNamespace(find_one=AsyncMock(return_value=None), count_documents=AsyncMock(return_value=0), update_one=AsyncMock()), users=SimpleNamespace(update_one=AsyncMock()))
        self.session = Session(id='cs_test_123', client_secret='cs_test_123_secret_private', url=None, status='open')
        self.stripe = SimpleNamespace(checkout=SimpleNamespace(Session=SimpleNamespace(create=Mock(return_value=self.session), retrieve=Mock())), error=SimpleNamespace(InvalidRequestError=type('InvalidRequestError',(Exception,),{})))
        self.account = AsyncMock(return_value={'id':'u1','plan':'free'})
        self.discounts = Mock(return_value={'discounts':[{'coupon':'feedback-v1-AVIS-U'}], 'payment_method_collection':'always'})
        self.ns = dict(os=os, Request=Request, Response=Response, HTTPException=HTTPException,
            Optional=Optional, Literal=Literal, BaseModel=BaseModel, Field=Field, secrets=secrets,
            db=self.db, stripe_lib=self.stripe,
            mission_billing=SimpleNamespace(account=self.account, MISSION_LOOKUP="shiftflow_mission"),
            subscription_billing=SimpleNamespace(resolve_price=Mock(return_value=SimpleNamespace(id='price_month',product='prod_1'))),
            return_feedback=SimpleNamespace(eligible=lambda _: True, discount_options=self.discounts),
            FRONTEND_URL='https://www.shiftflow.io', ALLOWED_STRIPE_PRICES={'shiftflow_monthly':{'interval':'month','amount':7900},'shiftflow_yearly':{'interval':'year','amount':71100}},
            now_utc=lambda:datetime.now(timezone.utc), iso=lambda dt:dt.isoformat(), new_id=lambda:'transaction',
            request_client_ip=lambda _:None, send_meta_event=AsyncMock(), fulfill_checkout=AsyncMock())
        load('CheckoutIn',self.ns)
        load('stripe_publishable_key',self.ns)
        load('stripe_checkout_response',self.ns)
        self.create = load('create_checkout',self.ns)
        self.request = SimpleNamespace(headers={})

    def payload(self, **changes):
        return self.ns['CheckoutIn'](**{'lookup_key':'shiftflow_monthly','ui_mode':'embedded','origin_url':'https://evil.test','legal_acceptance':{'version':'2026-10-19'},**changes})

    async def test_embedded_session_returns_only_client_secret_and_stays_on_site(self):
        result = await self.create(self.payload(),self.request,{'id':'u1','email':'user@example.test'})
        args = self.stripe.checkout.Session.create.call_args.kwargs
        self.assertEqual(args['ui_mode'],'embedded')
        self.assertEqual(args['redirect_on_completion'],'never')
        self.assertNotIn('success_url',args); self.assertNotIn('cancel_url',args)
        self.assertEqual(args['mode'],'subscription'); self.assertEqual(args['payment_method_types'],['card'])
        self.assertEqual(args['metadata']['user_id'],'u1')
        self.assertIn('embedded',args['idempotency_key'])
        self.assertEqual(result,{'provider':'stripe','ui_mode':'embedded','client_secret':self.session.client_secret,'session_id':'cs_test_123'})
        stored = self.db.payment_transactions.update_one.call_args.args[1]['$setOnInsert']
        self.assertEqual(stored['origin_url'],'https://www.shiftflow.io')
        self.assertEqual(stored['ui_mode'],'embedded')
        self.assertNotIn('client_secret',stored)
        self.db.users.update_one.assert_not_called()

    async def test_legacy_hosted_checkout_is_preserved(self):
        self.session['url']='https://checkout.stripe.com/test'
        result = await self.create(self.payload(ui_mode='hosted'),self.request,{'id':'u1'})
        args=self.stripe.checkout.Session.create.call_args.kwargs
        self.assertIn('success_url',args); self.assertIn('cancel_url',args)
        self.assertNotIn('redirect_on_completion',args)
        self.assertEqual(result['checkout_url'],self.session.url)
        self.assertNotIn('client_secret',result)

    async def test_pending_embedded_checkout_is_reused_in_its_own_ui_mode(self):
        self.db.payment_transactions.find_one.return_value={'session_id':'cs_test_123'}
        self.stripe.checkout.Session.retrieve.return_value=self.session
        result=await self.create(self.payload(),self.request,{'id':'u1'})
        self.assertEqual(result['client_secret'],self.session.client_secret)
        self.stripe.checkout.Session.create.assert_not_called()
        query=self.db.payment_transactions.find_one.call_args.args[0]
        self.assertEqual(query['ui_mode'],'embedded'); self.assertEqual(query['user_id'],'u1')

    async def test_completed_pending_payment_is_reconciled_before_creating_another(self):
        self.db.payment_transactions.find_one.return_value={'session_id':'cs_test_123'}
        self.session['status']='complete'; self.stripe.checkout.Session.retrieve.return_value=self.session
        self.account.side_effect=[{'id':'u1','plan':'free'},{'id':'u1','plan':'pro'}]
        with self.assertRaises(HTTPException) as error: await self.create(self.payload(),self.request,{'id':'u1'})
        self.assertEqual(error.exception.status_code,409)
        self.ns['fulfill_checkout'].assert_awaited_once_with(self.session)
        self.stripe.checkout.Session.create.assert_not_called()

    async def test_monthly_reward_is_validated_and_preserved_in_embedded_session(self):
        account={'id':'u1','plan':'free','return_feedback':{'promo_code':'AVIS-U'}}
        self.account.return_value=account
        await self.create(self.payload(promo_code='AVIS-U'),self.request,{'id':'u1'})
        args=self.stripe.checkout.Session.create.call_args.kwargs
        self.assertEqual(args['discounts'],[{'coupon':'feedback-v1-AVIS-U'}])
        self.assertEqual(args['payment_method_collection'],'always')
        self.assertNotIn('allow_promotion_codes',args)
        with self.assertRaises(HTTPException): await self.create(self.payload(promo_code='FORGED'),self.request,{'id':'u1'})
        with self.assertRaises(HTTPException): await self.create(self.payload(lookup_key='shiftflow_yearly',promo_code='AVIS-U'),self.request,{'id':'u1'})

    async def test_terms_plan_and_quantity_are_checked_before_session_creation(self):
        for changes in [{'legal_acceptance':{}},{'lookup_key':'unlisted'},{'quantity':2}]:
            with self.subTest(changes=changes), self.assertRaises(HTTPException): await self.create(self.payload(**changes),self.request,{'id':'u1'})
        self.stripe.checkout.Session.create.assert_not_called()

    async def test_active_subscriber_cannot_buy_again(self):
        self.account.return_value={'id':'u1','plan':'pro'}
        with self.assertRaises(HTTPException) as error: await self.create(self.payload(),self.request,{'id':'u1'})
        self.assertEqual(error.exception.status_code,409)
        self.stripe.checkout.Session.create.assert_not_called()

    async def test_config_exposes_only_publishable_key_and_is_not_cached(self):
        config=load('payments_config',self.ns)
        with patch.dict(os.environ,{'STRIPE_PUBLISHABLE_KEY':'pk_live_public','STRIPE_SECRET_KEY':'sk_live_private'}):
            response=Response(); result=await config(response)
        self.assertEqual(result,{'provider':'stripe','publishable_key':'pk_live_public'})
        self.assertEqual(response.headers['Cache-Control'],'no-store')
        with patch.dict(os.environ,{'STRIPE_PUBLISHABLE_KEY':'sk_live_never_expose'}): self.assertEqual(self.ns['stripe_publishable_key'](),'')

    def test_schema_keeps_legacy_default_and_rejects_other_providers(self):
        self.assertEqual(self.ns['CheckoutIn'](lookup_key='shiftflow_monthly',origin_url='https://www.shiftflow.io').ui_mode,'hosted')
        with self.assertRaises(ValidationError): self.payload(ui_mode='whop')

    async def test_unpaid_checkout_never_grants_pro(self):
        fn=load('fulfill_checkout',self.ns)
        await fn({'id':'cs_test_123','status':'complete','payment_status':'unpaid'})
        self.db.users.update_one.assert_not_called()
        self.db.payment_transactions.find_one.assert_not_called()

    async def test_zero_value_complete_coupon_session_grants_pro_after_provider_verification(self):
        record={'session_id':'cs_test_123','user_id':'u1','lookup_key':'shiftflow_monthly','billing_interval':'month'}
        self.db.payment_transactions.find_one.return_value=record
        self.db.users.find_one=AsyncMock(return_value={'id':'u1','plan':'pro'})
        self.stripe.Subscription=SimpleNamespace(retrieve=Mock(return_value=SimpleNamespace(status='active')))
        self.ns['record_activation_event']=AsyncMock(); self.ns['_send_subscribe_meta_if_needed']=AsyncMock()
        fn=load('fulfill_checkout',self.ns)
        await fn({'id':'cs_test_123','payment_status':'no_payment_required','status':'complete','amount_total':0,
                  'metadata':{'user_id':'u1','lookup_key':'shiftflow_monthly'},'mode':'subscription','subscription':'sub_1','customer':'cus_1'})
        self.stripe.Subscription.retrieve.assert_called_once_with('sub_1')
        self.assertEqual(self.db.users.update_one.call_args.args[1]['$set']['plan'],'pro')

    async def test_status_reads_only_authenticated_owner_and_does_not_expose_secret(self):
        self.db.payment_transactions.find_one.return_value={'session_id':'cs_test_123','status':'completed',
            'payment_status':'paid','lookup_key':'shiftflow_monthly','fulfilled':True,'client_secret':'never_return'}
        fn=load('payment_status_endpoint',self.ns)
        result=await fn('cs_test_123',{'id':'u1'})
        self.assertEqual(self.db.payment_transactions.find_one.call_args.args[0],{'session_id':'cs_test_123','user_id':'u1'})
        self.assertNotIn('client_secret',result)
        self.assertTrue(result['fulfilled'])

    async def test_other_users_cannot_read_or_reconcile_a_session(self):
        fn=load('payment_status_endpoint',self.ns)
        with self.assertRaises(HTTPException) as error: await fn('cs_other',{'id':'u1'})
        self.assertEqual(error.exception.status_code,404)
        self.stripe.checkout.Session.retrieve.assert_not_called()
