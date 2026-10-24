"""Owner billing, shared seats, lifecycle and attribution; no live payments."""
import asyncio, os
from copy import deepcopy
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient
import organizations as orgs
import whop_billing as b
import mission_billing
from workspace_accounts import accounts

class OwnerSubscriptionTests(IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.db=AsyncMongoMockClient().test
  self.owner={'id':'owner','email':'owner@example.com','plan':'free','agency_name':'Main'}
  await self.db.users.insert_many([deepcopy(self.owner),{'id':'guest','email':'guest@example.com','plan':'free'}])
  await orgs.ensure_personal(self.db,self.owner)
  self.second=(await orgs.create_personal(self.db,self.owner,'Second'))['id']
  self.offer=b.CATALOG['team_monthly'];self.payment=None;self.member=None
  self.meta=AsyncMock(return_value=True)
  for p in [patch.dict(os.environ,WHOP_API_KEY='test-only',WHOP_WEBHOOK_SECRET='ws_test',WHOP_COMPANY_ID='biz_test'),patch.object(b,'api',AsyncMock(side_effect=self.response)),patch.object(b,'send_meta_event',self.meta),patch.object(orgs,'deliver_invite',AsyncMock(return_value=False))]:
   p.start();self.addCleanup(p.stop)
 async def response(self,method,path,body=None):
  if path.startswith('/plans/'): return {'id':self.offer['plan_id'],'company':{'id':'biz_test'},'currency':'eur','plan_type':'renewal','initial_price':0,'renewal_price':99,'billing_period':30}
  if path=='/checkout_configurations': return {'id':'ch_test'}
  if path.startswith('/payments/'): return deepcopy(self.payment)
  if path.startswith('/memberships/'): return deepcopy(self.member)
  raise AssertionError(path)
 async def activate(self,consent=False):
  record=await b.checkout(self.db,{'id':self.second,'actor_id':'owner'},'team_monthly',tracking={'consent':consent})
  self.payment={'id':'pay_test','metadata':{'shiftflow_checkout':record['reference'],'organization_id':self.second},'membership':{'id':'mem_test'},'company':{'id':'biz_test'},'plan':{'id':self.offer['plan_id']},'status':'paid','currency':'eur','subtotal':99,'total':99,'refunded_amount':0}
  self.member={'id':'mem_test','status':'active','company':{'id':'biz_test'},'plan':{'id':self.offer['plan_id']}}
  await b.fulfill_payment(self.db,'pay_test',expected_org=self.second)
 async def test_payment_covers_current_and_future_spaces_without_moving_tenant_data(self):
  await self.activate()
  third=(await orgs.create_personal(self.db,self.owner,'Third'))['id']
  for identifier in ['owner',self.second,third]:
   effective=await accounts(self.db).find_one({'id':identifier})
   self.assertEqual(effective['plan'],'pro');self.assertEqual(effective['subscription_tier'],'team')
   self.assertEqual(await mission_billing.reserve(self.db,identifier),'pro')
  self.assertEqual((await accounts(self.db).find_one({'id':self.second}))['agency_name'],'Second')
  self.assertEqual((await self.db.organization_accounts.find_one({'id':self.second}))['plan'],'free')
  self.assertEqual((await self.db.users.find_one({'id':'owner'}))['free_missions_used'],0)
  with self.assertRaises(HTTPException): await b.checkout(self.db,{'id':third},'team_monthly')
 async def test_lifecycle_and_full_refund_remove_benefits_everywhere(self):
  await self.activate();self.member['status']='past_due';await b.sync_membership(self.db,'mem_test')
  for identifier in ['owner',self.second]: self.assertEqual((await accounts(self.db).find_one({'id':identifier}))['plan'],'free')
  self.member['status']='active';await b.sync_membership(self.db,'mem_test')
  self.payment['refunded_amount']=99;await b.refund_payment(self.db,'pay_test');await b.sync_membership(self.db,'mem_test')
  for identifier in ['owner',self.second]: self.assertEqual((await accounts(self.db).find_one({'id':identifier}))['plan'],'free')
 async def test_guest_has_team_access_but_does_not_inherit_owner_subscription(self):
  await self.activate();await self.db.organizations.update_one({'_id':self.second},{'$push':{'members':{'user_id':'guest','role':'member'}}})
  guest=await self.db.users.find_one({'id':'guest'})
  self.assertEqual((await orgs.workspace(self.db,{**guest,'active_organization_id':self.second}))['plan'],'pro')
  personal=(await orgs.create_personal(self.db,guest,'Guest business'))['id']
  self.assertEqual((await accounts(self.db).find_one({'id':personal}))['plan'],'free')
 async def test_legacy_subscription_stays_on_original_document_and_covers_owner(self):
  await self.db.organization_accounts.update_one({'id':self.second},{'$set':{'plan':'pro','subscription_tier':'business','whop_membership_id':'mem_legacy'}})
  self.assertEqual((await accounts(self.db).find_one({'id':'owner'}))['subscription_tier'],'business')
  self.assertEqual((await accounts(self.db).find_one({'whop_membership_id':'mem_legacy'}))['id'],self.second)
 async def test_meta_subscribe_requires_consent_and_deduplicates_replays(self):
  await self.activate(consent=True);await b.fulfill_payment(self.db,'pay_test',expected_org=self.second)
  events=[c.kwargs for c in self.meta.call_args_list]
  subscriptions=[e for e in events if e['event_name']=='Subscribe']
  self.assertEqual(len(subscriptions),1);self.assertEqual(subscriptions[0]['event_id'],'subscribe_mem_test')
  self.assertEqual(subscriptions[0]['custom_data'],{'currency':'EUR','value':99})
  self.assertEqual(len([e for e in events if e['event_name']=='InitiateCheckout']),1)
 async def test_no_consent_never_sends_meta_event(self):
  await self.activate();self.meta.assert_not_awaited()
 async def test_current_account_alias_is_supported(self):
  await self.activate();self.payment['account']=self.payment.pop('company');self.member['account']=self.member.pop('company')
  await b.fulfill_payment(self.db,'pay_test');self.assertEqual((await accounts(self.db).find_one({'id':'owner'}))['plan'],'pro')
 async def test_shared_seats_count_same_person_once_across_spaces(self):
  await self.activate()
  for i in range(5):
   uid='m'+str(i);email=uid+'@example.com';await self.db.users.insert_one({'id':uid,'email':email,'plan':'free'})
   inv=await orgs.invite(self.db,{**self.owner,'active_organization_id':'owner'},email,'https://example.com')
   await orgs.accept(self.db,{'id':uid,'email':email},inv['url'].split('#token=')[1])
  with self.assertRaises(HTTPException): await orgs.invite(self.db,{**self.owner,'active_organization_id':self.second},'new@example.com','https://example.com')
  inv=await orgs.invite(self.db,{**self.owner,'active_organization_id':self.second},'m0@example.com','https://example.com')
  await orgs.accept(self.db,{'id':'m0','email':'m0@example.com'},inv['url'].split('#token=')[1])
  summary=await orgs.summary(self.db,{**self.owner,'active_organization_id':self.second})
  self.assertEqual(summary['used_collaborators'],5);self.assertEqual(len(summary['members']),2)
 async def test_simultaneous_invitations_across_spaces_keep_shared_cap(self):
  await self.activate()
  results=await asyncio.gather(*[orgs.invite(self.db,{**self.owner,'active_organization_id':'owner' if i%2 else self.second},f'new{i}@example.com','https://example.com') for i in range(8)],return_exceptions=True)
  self.assertLessEqual(sum(isinstance(r,dict) for r in results),5)
  self.assertLessEqual(len((await orgs.owner_seats(self.db,'owner'))['reserved']),5)

 async def test_multiple_existing_subscriptions_preserve_capacity_and_highest_role(self):
  await self.db.users.update_one({'id':'owner'},{'$set':{'plan':'pro','subscription_tier':'team','stripe_subscription_id':'sub_legacy'}})
  await self.db.organization_accounts.update_one({'id':self.second},{'$set':{'plan':'pro','subscription_tier':'business','whop_membership_id':'mem_legacy'}})
  effective=await accounts(self.db).find_one({'id':'owner'})
  self.assertEqual(effective['subscription_tier'],'business')
  self.assertEqual(orgs.collaborator_limit(effective),20)
  self.assertTrue(effective['billing_legacy_multiple'])
  self.assertEqual((await self.db.users.find_one({'id':'owner'}))['stripe_subscription_id'],'sub_legacy')
