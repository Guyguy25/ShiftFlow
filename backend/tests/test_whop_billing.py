"""Offline provider and MongoDB integration checks; never uses live payments."""
import asyncio, base64, hashlib, hmac, json, os, time
from copy import deepcopy
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient
import whop_billing as b
import mission_billing
from workspace_accounts import accounts

class WhopTests(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db=AsyncMongoMockClient().test
        self.env=patch.dict(os.environ,{'WHOP_API_KEY':'test-only','WHOP_WEBHOOK_SECRET':'ws_test-only','WHOP_COMPANY_ID':'biz_test'});self.env.start();self.addCleanup(self.env.stop)
        await self.db.users.insert_one({'id':'owner','plan':'free','free_missions_used':0})
        await self.db.organization_accounts.insert_one({'id':'org_test','plan':'free','free_pool_id':'owner'})
        self.user={'id':'org_test','actor_id':'owner'}
        self.offer=b.CATALOG['team_monthly']
        self.plan={'id':self.offer['plan_id'],'company':{'id':'biz_test'},'currency':'eur','plan_type':'renewal','billing_period':30,'initial_price':0,'renewal_price':99}
        self.provider=AsyncMock(side_effect=self.response)
        self.p=patch.object(b,'api',self.provider);self.p.start();self.addCleanup(self.p.stop)
        self.payment=None;self.member=None
    async def response(self,method,path,body=None):
        if path.startswith('/plans/'): return deepcopy(self.plan)
        if path=='/checkout_configurations': return {'id':'ch_test'}
        if path.startswith('/payments/'): return deepcopy(self.payment)
        if path.startswith('/memberships/'): return deepcopy(self.member)
        raise AssertionError(path)
    async def paid(self):
        checkout=await b.checkout(self.db,self.user,'team_monthly')
        self.payment={'id':'pay_test','metadata':{'shiftflow_checkout':checkout['reference'],'organization_id':'org_test'},'membership':{'id':'mem_test'},'company':{'id':'biz_test'},'plan':{'id':self.offer['plan_id']},'status':'paid','currency':'eur','subtotal':99,'total':99,'refunded_amount':0}
        self.member={'id':'mem_test','status':'active','company':{'id':'biz_test'},'plan':{'id':self.offer['plan_id']},'manage_url':'https://whop.com/hub/memberships/mem_test/'}
        return checkout
    async def test_catalog_exactly_matches_six_supplied_plans(self):
        self.assertEqual([v['plan_id'] for v in b.CATALOG.values()],['plan_wT9sMJbmEPmEX','plan_bfw2MekzEdm1L','plan_0qi0BSH21UYmt','plan_c4V3F8w1mC2Ij','plan_acPF1WcadHWiT','plan_7k832i8ogYfkD'])
        for offer in b.CATALOG.values():
            b.validate_plan({**self.plan,'id':offer['plan_id'],'billing_period':offer['days'],'initial_price':0,'renewal_price':offer['amount']/100},offer)
    async def test_wrong_price_company_currency_trial_or_period_fail_closed(self):
        for field,value in [('initial_price',89),('renewal_price',89),('company',{'id':'other'}),('currency','usd'),('billing_period',365),('trial_period_days',7)]:
            with self.subTest(field=field), self.assertRaises(HTTPException): b.validate_plan({**self.plan,field:value},self.offer)
    async def test_raw_adaptive_flag_does_not_block_any_recurring_eur_offer(self):
        for offer in b.CATALOG.values():
            plan={**self.plan,'id':offer['plan_id'],'billing_period':offer['days'],
                  'renewal_price':offer['amount']/100,'adaptive_pricing_enabled':True}
            b.validate_plan(plan,offer)
            for change in [{'plan_type':'one_time'},{'currency':'usd'}, {'renewal_price':1}]:
                with self.subTest(offer=offer['plan_id'],change=change),self.assertRaises(HTTPException):
                    b.validate_plan({**plan,**change},offer)

    async def test_adaptive_flag_allows_checkout_but_never_foreign_currency_activation(self):
        self.plan['adaptive_pricing_enabled']=True
        checkout=await self.paid()
        self.assertEqual(checkout['session_id'],'ch_test')
        self.payment['currency']='usd'
        self.assertIsNone(await b.fulfill_payment(self.db,'pay_test'))
        self.assertEqual((await accounts(self.db).find_one({'id':'org_test'}))['plan'],'free')
        self.payment['currency']='eur'
        self.assertEqual(await b.fulfill_payment(self.db,'pay_test'),'org_test')

    async def test_business_annual_diagnostic_identifies_actual_field(self):
        offer=b.CATALOG['business_yearly']
        plan={**self.plan,'id':offer['plan_id'],'billing_period':365,'renewal_price':1072.80}
        b.validate_plan(plan,offer)
        for field,value,expected in [('renewal_price',1072,'1 072'),('currency','usd','devise'),('billing_period',30,'365 jours'),('initial_price',149,'frais initiaux')]:
            with self.subTest(field=field), self.assertRaises(HTTPException) as caught:
                b.validate_plan({**plan,field:value},offer)
            self.assertIn('Business annuel',caught.exception.detail)
            self.assertIn('Aucun paiement',caught.exception.detail)
            if field=='renewal_price': self.assertIn('1072,80',caught.exception.detail)
            else: self.assertIn(expected,caught.exception.detail)

    async def test_current_catalog_account_and_verified_first_charge_are_supported(self):
        plan={**self.plan,'initial_price':99,'initial_price_due':{'amount':'99.00','currency':'eur'},'account':{'id':'biz_test'}}
        del plan['company']
        b.validate_plan(plan,self.offer)
        for due in [None,{}, {'amount':'198.00','currency':'eur'},{'amount':'99.00','currency':'usd'},{'amount':'99.001','currency':'eur'}]:
            with self.subTest(due=due), self.assertRaises(HTTPException):
                b.validate_plan({**plan,'initial_price_due':due},self.offer)
        with self.assertRaises(HTTPException):
            b.validate_plan({**plan,'account':{'id':'biz_other'}},self.offer)

    async def test_money_comparison_never_truncates_extra_decimals(self):
        self.assertEqual(b.cents('1072.80'),107280)
        for value in ['1072.809',None, 'NaN', 'Infinity', {}, '']:
            self.assertEqual(b.cents(value),-1)
        with self.assertRaises(HTTPException):
            b.validate_plan({**self.plan,'renewal_price':'99.001'},self.offer)

    async def test_checkout_metadata_and_pending_reuse(self):
        c=await b.checkout(self.db,self.user,'team_monthly');again=await b.checkout(self.db,self.user,'team_monthly')
        self.assertEqual(c,again)
        calls=[c for c in self.provider.call_args_list if c.args[0]=='POST'];self.assertEqual(len(calls),1)
        self.assertEqual(calls[0].args[2]['metadata']['organization_id'],'org_test')
    async def test_browse_all_offers_immediately_then_reuse_each_quote(self):
        checkouts={}
        for key,offer in b.CATALOG.items():
            self.plan={**self.plan,'id':offer['plan_id'],'billing_period':offer['days'],'renewal_price':offer['amount']/100}
            checkouts[key]=await b.checkout(self.db,self.user,key)
        self.assertEqual(len({c['reference'] for c in checkouts.values()}),6)
        self.assertEqual(await self.db.whop_checkouts.count_documents({'organization_id':'org_test'}),6)
        for key in reversed(list(b.CATALOG)):
            self.assertEqual(await b.checkout(self.db,self.user,key),checkouts[key])
        self.assertEqual(sum(c.args[0]=='POST' for c in self.provider.call_args_list),6)
        account=await accounts(self.db).find_one({'id':'org_test'})
        self.assertEqual(account['plan'],'free')
        self.assertNotIn('whop_membership_id',account)

    async def test_switching_offer_keeps_old_payment_reference_verifiable(self):
        original=await self.paid()
        offer=b.CATALOG['business_yearly']
        self.plan={**self.plan,'id':offer['plan_id'],'billing_period':offer['days'],'renewal_price':offer['amount']/100}
        other=await b.checkout(self.db,self.user,'business_yearly')
        self.assertNotEqual(original['reference'],other['reference'])
        self.assertEqual(await b.fulfill_payment(self.db,'pay_test'),'org_test')
        self.assertTrue((await self.db.whop_checkouts.find_one({'_id':original['reference']}))['fulfilled'])
        self.assertFalse((await self.db.whop_checkouts.find_one({'_id':other['reference']}))['fulfilled'])
        self.assertEqual((await accounts(self.db).find_one({'id':'org_test'}))['subscription_tier'],'team')
        with self.assertRaises(HTTPException): await b.checkout(self.db,self.user,'business_yearly')

    async def test_missing_secrets_do_not_create_checkout(self):
        with patch.dict(os.environ,{'WHOP_WEBHOOK_SECRET':''}),self.assertRaises(HTTPException): await b.checkout(self.db,self.user,'team_monthly')
        self.provider.assert_not_called()
    async def test_existing_subscriptions_and_rewards_are_not_bypassed(self):
        for field,value in [('stripe_subscription_id','sub_test'),('whop_membership_id','mem_existing'),('plan','pro'),('return_feedback',{'promo_code':'AVIS'})]:
            await self.db.organization_accounts.update_one({'id':'org_test'},{'$set':{field:value}})
            with self.assertRaises(HTTPException): await b.checkout(self.db,self.user,'team_monthly')
            await self.db.organization_accounts.update_one({'id':'org_test'},{'$unset':{field:''}})
        self.provider.assert_not_called()
    async def test_verified_payment_grants_only_bound_organization_idempotently(self):
        await self.paid()
        self.assertEqual(await b.fulfill_payment(self.db,'pay_test'), 'org_test')
        await b.fulfill_payment(self.db,'pay_test')
        self.assertEqual((await accounts(self.db).find_one({'id':'org_test'}))['subscription_tier'],'team')
        self.assertEqual((await self.db.users.find_one({'id':'owner'}))['plan'],'free')
        with self.assertRaises(HTTPException): await b.checkout(self.db,self.user,'team_monthly')
    async def test_foreign_owner_callback_does_not_fulfill_payment(self):
        await self.paid()
        with self.assertRaises(HTTPException): await b.fulfill_payment(self.db,'pay_test',expected_org='other')
        self.assertEqual((await accounts(self.db).find_one({'id':'org_test'}))['plan'],'free')
    async def test_pending_refunded_wrong_amount_and_trial_do_not_activate(self):
        await self.paid()
        for field,value in [('status','pending'),('refunded_amount',99),('subtotal',89),('currency','usd')]:
            original=self.payment[field];self.payment[field]=value
            self.assertIsNone(await b.fulfill_payment(self.db,'pay_test'));self.payment[field]=original
        self.member['status']='trialing';self.assertIsNone(await b.fulfill_payment(self.db,'pay_test'))
        self.assertEqual((await accounts(self.db).find_one({'id':'org_test'}))['plan'],'free')
    async def test_current_membership_prevents_old_events_and_unpaid_upgrades(self):
        await self.paid();await b.fulfill_payment(self.db,'pay_test')
        self.member['plan']={'id':b.CATALOG['business_monthly']['plan_id']}
        await b.sync_membership(self.db,'mem_test')
        self.assertEqual((await accounts(self.db).find_one({'id':'org_test'}))['subscription_tier'],'team')
        self.payment['plan']=self.member['plan'];self.payment['subtotal']=50
        await b.fulfill_payment(self.db,'pay_upgrade')
        self.assertEqual((await accounts(self.db).find_one({'id':'org_test'}))['subscription_tier'],'business')
        self.member['status']='expired';await b.sync_membership(self.db,'mem_test')
        current=await accounts(self.db).find_one({'id':'org_test'});self.assertEqual(current['plan'],'free');self.assertNotIn('whop_membership_id',current)
    async def test_full_refund_revokes_and_membership_event_cannot_restore_access(self):
        await self.paid();await b.fulfill_payment(self.db,'pay_test');self.payment['refunded_amount']=99
        await b.refund_payment(self.db,'pay_test');await b.sync_membership(self.db,'mem_test')
        self.assertEqual((await accounts(self.db).find_one({'id':'org_test'}))['plan'],'free')
    async def test_partial_refund_retains_access_and_portal_is_validated(self):
        await self.paid();await b.fulfill_payment(self.db,'pay_test');self.payment['refunded_amount']=10
        await b.refund_payment(self.db,'pay_test');self.assertEqual((await accounts(self.db).find_one({'id':'org_test'}))['plan'],'pro')
        self.assertTrue((await b.portal(self.db,self.user))['url'].startswith('https://whop.com/'))
        self.member['manage_url']='https://evil.example/';
        with self.assertRaises(HTTPException): await b.portal(self.db,self.user)
    async def test_webhook_signature_payload_and_timestamp_are_verified(self):
        raw=json.dumps({'type':'payment.succeeded','data':{'id':'pay_test'}}).encode();ts=str(int(time.time()));eid='msg_test'
        sig=base64.b64encode(hmac.new(b'ws_test-only',eid.encode()+b'.'+ts.encode()+b'.'+raw,hashlib.sha256).digest()).decode()
        headers={'webhook-id':eid,'webhook-timestamp':ts,'webhook-signature':'v1,'+sig}
        self.assertEqual(b.verify_webhook(raw,headers)[1],eid)
        for body,h in [(raw+b' ',headers),(raw,{**headers,'webhook-timestamp':'1'}),(raw,{**headers,'webhook-signature':'v1,bad'})]:
            with self.assertRaises(HTTPException): b.verify_webhook(body,h)
    async def test_free_quota_is_shared_atomically_across_owned_organizations(self):
        await self.db.organization_accounts.insert_one({'id':'org_second','plan':'free','free_pool_id':'owner'})
        outcomes=await asyncio.gather(*[mission_billing.reserve(self.db,'org_test' if i%2 else 'org_second') for i in range(8)],return_exceptions=True)
        self.assertEqual(outcomes.count('free'),3)
        for org in ['owner','org_test','org_second']:
            self.assertEqual(mission_billing.balance(await mission_billing.account(self.db,org))['free_missions_remaining'],0)
