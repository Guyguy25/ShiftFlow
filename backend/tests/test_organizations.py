"""Real ASGI requests against an in-memory MongoDB double; no production credentials."""
import asyncio
import importlib
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlparse

import httpx
from mongomock_motor import AsyncMongoMockClient

# Import production route definitions under isolated, non-production configuration.
os.environ.setdefault('MONGO_URL', 'mongodb://127.0.0.1:27017')
os.environ.setdefault('DB_NAME', 'shiftflow_organization_tests')
os.environ.setdefault('JWT_SECRET', 'isolated-team-test-secret-at-least-32-bytes-only')
import server as s
import organizations
import whatsapp_routes
import mission_operations


class OrganizationAPITests(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = AsyncMongoMockClient()['test']
        self.patches = [patch.object(s, 'db', self.db), patch.object(whatsapp_routes, 'db', self.db),
                        patch.object(mission_operations, 'db', self.db), patch.object(organizations, 'deliver_invite', AsyncMock(return_value=False))]
        for p in self.patches: p.start()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=s.app), base_url='https://testserver')
        for uid in ('owner', 'member', 'other'):
            await self.db.users.insert_one({'id': uid, 'email': uid+'@example.com', 'name': uid,
                'agency_name': uid+' Events', 'plan': 'pro' if uid=='owner' else 'free',
                'subscription_tier': 'team' if uid=='owner' else 'pro', 'role': 'admin',
                'free_missions_used': 0, 'mission_credits': 0, 'onboarding_completed': True})

    async def asyncTearDown(self):
        await self.client.aclose()
        for p in reversed(self.patches): p.stop()

    def auth(self, uid):
        return {'Authorization':'Bearer '+s.create_access_token(uid, uid+'@example.com')}

    async def request(self, method, path, uid='owner', **kwargs):
        return await self.client.request(method, '/api'+path, headers=self.auth(uid), **kwargs)

    async def invite(self, uid='member'):
        response = await self.request('POST','/organization/invitations',json={'email':uid+'@example.com'})
        self.assertEqual(response.status_code,200,response.text)
        return response.json(), parse_qs(urlparse(response.json()['url']).fragment)['token'][0]

    async def join(self):
        _, token = await self.invite()
        result = await self.request('POST','/organization/accept-invitation',uid='member',json={'token':token})
        self.assertEqual(result.status_code,200,result.text)
        return token

    async def test_existing_accounts_get_one_workspace_without_rekeying_data(self):
        await self.db.missions.insert_one({'id':'legacy','agency_id':'owner','name':'Before Team'})
        for _ in range(2):
            response=await self.request('GET','/auth/me')
            self.assertEqual(response.status_code,200,response.text)
            self.assertEqual(response.json()['organization']['id'],'owner')
            self.assertEqual(response.json()['organization']['name'],'owner Events')
        self.assertEqual(await self.db.organizations.count_documents({'owner_id':'owner'}),1)
        self.assertEqual((await self.db.missions.find_one({'id':'legacy'}))['agency_id'],'owner')

    async def test_register_stores_organization_name_and_own_identity(self):
        response=await self.client.post('/api/auth/register',json={'email':'new@example.com','password':'Secret123',
            'agency_name':'Régie & Lumière','name':'Camille','onboarding_answers':{'annual_events':30}})
        self.assertEqual(response.status_code,200,response.text)
        data=response.json()['user']
        self.assertEqual(data['organization']['name'],'Régie & Lumière')
        self.assertEqual(data['organization']['id'],data['id'])
        self.assertEqual(data['onboarding_answers'], {'annual_events':30})
        self.assertEqual(data['organization']['role'],'owner')

    async def test_invitation_is_hashed_bound_to_email_single_use_and_not_listed_as_plaintext(self):
        result, token=await self.invite()
        raw=await self.db.organizations.find_one({'_id':'owner'})
        self.assertNotIn(token,str(raw)); self.assertEqual(raw['invitations'][0]['token_hash'],organizations.digest(token))
        listed=await self.request('GET','/organization')
        self.assertNotIn('token_hash',listed.text); self.assertNotIn(token,listed.text)
        wrong=await self.request('POST','/organization/accept-invitation',uid='other',json={'token':token})
        self.assertEqual(wrong.status_code,403)
        accepted=await self.request('POST','/organization/accept-invitation',uid='member',json={'token':token})
        self.assertEqual(accepted.status_code,200,accepted.text)
        again=await self.request('POST','/organization/accept-invitation',uid='member',json={'token':token})
        self.assertIn(again.status_code,(404,409))

    async def test_member_reads_shared_data_without_inheriting_owner_identity_or_platform_role(self):
        await self.join()
        await self.db.workers.insert_many([{'id':'shared','agency_id':'owner','first_name':'Paul'}, {'id':'foreign','agency_id':'other','first_name':'Other'}])
        response=await self.request('GET','/workers',uid='member')
        self.assertEqual(response.status_code,200,response.text)
        self.assertIn('shared',response.text); self.assertNotIn('foreign',response.text)
        profile=(await self.request('GET','/auth/me',uid='member')).json()
        self.assertEqual(profile['id'],'member'); self.assertEqual(profile['email'],'member@example.com')
        self.assertEqual(profile['organization']['id'],'owner'); self.assertEqual(profile['organization']['role'],'member')
        self.assertEqual(profile['role'],'admin'); self.assertFalse(profile['can_manage_billing'])
        self.assertEqual(profile['subscription_tier'],'team')

    async def test_member_cannot_manage_billing_org_members_or_admin(self):
        await self.join()
        cases=[('PUT','/organization',{'name':'Hijack','avatar':''}),
               ('POST','/organization/invitations',{'email':'other@example.com'}),
               ('POST','/payments/portal',{}),('POST','/payments/catalog/sync',{}),
               ('POST','/payments/checkout',{'lookup_key':'shiftflow_team_monthly','origin_url':'https://testserver'}),
               ('DELETE','/organization/members/owner',None),('GET','/admin/dashboard',None)]
        for method,path,body in cases:
            with self.subTest(path=path):
                response=await self.request(method,path,uid='member',**({'json':body} if body is not None else {}))
                self.assertEqual(response.status_code,403,response.text)

    async def test_switch_requires_membership_and_retains_personal_data(self):
        await self.join()
        await self.db.workers.insert_one({'id':'personal','agency_id':'member','first_name':'Personal'})
        forbidden=await self.request('POST','/organization/switch',uid='member',json={'organization_id':'other'})
        self.assertEqual(forbidden.status_code,403)
        response=await self.request('POST','/organization/switch',uid='member',json={'organization_id':'member'})
        self.assertEqual(response.status_code,200)
        workers=await self.request('GET','/workers',uid='member')
        self.assertIn('personal',workers.text)
        spaces=(await self.request('GET','/organization',uid='member')).json()['spaces']
        self.assertEqual({space['id'] for space in spaces},{'member','owner'})

    async def test_member_removal_revokes_existing_session_on_next_request(self):
        await self.join()
        await self.db.missions.insert_one({'id':'shared-mission','agency_id':'owner'})
        removed=await self.request('DELETE','/organization/members/member')
        self.assertEqual(removed.status_code,200)
        result=await self.request('GET','/missions/shared-mission',uid='member')
        self.assertEqual(result.status_code,404,result.text)
        profile=(await self.request('GET','/auth/me',uid='member')).json()
        self.assertEqual(profile['organization']['id'],'member')
        self.assertIsNotNone(await self.db.missions.find_one({'id':'shared-mission'}))

    async def test_pro_does_not_allow_invites_and_team_loss_suspends_members_only(self):
        await self.join()
        await self.db.users.update_one({'id':'owner'},{'$set':{'subscription_tier':'pro'}})
        result=await self.request('POST','/organization/invitations',json={'email':'other@example.com'})
        self.assertEqual(result.status_code,403)
        self.assertEqual((await self.request('GET','/workers',uid='member')).status_code,403)
        self.assertEqual((await self.request('GET','/workers')).status_code,200)
        self.assertTrue((await self.request('GET','/auth/me',uid='member')).json()['organization']['locked'])
        self.assertEqual((await self.request('POST','/organization/switch',uid='member',json={'organization_id':'member'})).status_code,200)

    async def test_concurrent_pending_invitations_reserve_exactly_five_seats(self):
        results=await asyncio.gather(*[self.request('POST','/organization/invitations',json={'email':f'colleague{i}@example.com'}) for i in range(12)])
        self.assertEqual(sum(r.status_code==200 for r in results),5,[r.text for r in results])
        org=await self.db.organizations.find_one({'_id':'owner'})
        self.assertEqual(len(org['members'])+len(org['invitations']),6)

    async def test_expired_and_revoked_invitations_do_not_work(self):
        info,token=await self.invite()
        await self.request('DELETE','/organization/invitations/'+info['id'])
        result=await self.request('POST','/organization/accept-invitation',uid='member',json={'token':token})
        self.assertEqual(result.status_code,404)
        _,token=await self.invite()
        await self.db.organizations.update_one({'_id':'owner'},{'$set':{'invitations.0.expires_at':(datetime.now(timezone.utc)-timedelta(days=1)).isoformat()}})
        result=await self.request('POST','/organization/accept-invitation',uid='member',json={'token':token})
        self.assertEqual(result.status_code,404)

    async def test_organization_name_is_shared_and_members_cannot_change_it_via_profile(self):
        await self.join()
        updated=await self.request('PUT','/organization',json={'name':'Nouvelle équipe','avatar':''})
        self.assertEqual(updated.status_code,200,updated.text)
        await self.request('PUT','/auth/me',uid='member',json={'name':'Member','agency_name':'Hijack','phone':'','avatar':''})
        self.assertEqual((await self.request('GET','/auth/me',uid='member')).json()['organization']['name'],'Nouvelle équipe')
        owner=await self.db.users.find_one({'id':'owner'})
        self.assertEqual(owner['agency_name'],'Nouvelle équipe')

    async def test_member_creates_shared_mission_without_consuming_personal_free_balance(self):
        await self.join()
        result=await self.request('POST','/missions',uid='member',json={'name':'Événement partagé','location':'Lille','shifts':[{'date':'2099-01-01','start_time':'08:00','end_time':'12:00','people_needed':1}]})
        self.assertEqual(result.status_code,200,result.text)
        mission=await self.db.missions.find_one({'id':result.json()['id']})
        self.assertEqual(mission['agency_id'],'owner'); self.assertEqual(mission['created_by'],'member')
        self.assertEqual(mission['billing_source'],'pro')
        self.assertEqual((await self.db.users.find_one({'id':'member'}))['free_missions_used'],0)

    async def test_owner_cannot_be_removed_and_unknown_organization_cannot_be_selected(self):
        self.assertEqual((await self.request('DELETE','/organization/members/owner')).status_code,400)
        self.assertEqual((await self.request('POST','/organization/switch',json={'organization_id':'nonexistent'})).status_code,403)

    async def test_team_checkout_uses_exact_prices_embedded_mode_and_owner_identity(self):
        from types import SimpleNamespace
        from unittest.mock import Mock
        from test_team_billing import TeamBillingTests, Obj
        for lookup,amount in [('shiftflow_team_monthly',8900),('shiftflow_team_yearly',74760)]:
            stripe=TeamBillingTests().provider()
            stripe.checkout=SimpleNamespace(Session=SimpleNamespace(create=Mock(return_value=Obj(id='cs_'+lookup,client_secret='cs_secret',status='open'))))
            with patch.object(s,'stripe_lib',stripe):
                response=await self.request('POST','/payments/checkout',uid='other',json={
                    'lookup_key':lookup,'ui_mode':'embedded','quantity':1,'origin_url':'https://untrusted.example','legal_acceptance':{'version':'2026-10-23'}})
            self.assertEqual(response.status_code,200,response.text)
            self.assertEqual(response.json()['ui_mode'],'embedded')
            args=stripe.checkout.Session.create.call_args.kwargs
            self.assertEqual(args['line_items'],[{'price':'price_'+lookup,'quantity':1}])
            self.assertEqual(args['metadata']['user_id'],'other')
            self.assertEqual(args['ui_mode'],'embedded');self.assertNotIn('success_url',args)
            record=await self.db.payment_transactions.find_one({'session_id':'cs_'+lookup})
            self.assertEqual(record['amount'],amount)

    async def test_webhook_updates_team_entitlement_from_current_paid_subscription_and_revokes_it(self):
        from types import SimpleNamespace
        from unittest.mock import Mock
        from test_team_billing import TeamBillingTests, Obj
        stripe=TeamBillingTests().provider()
        subscription=Obj(id='sub_team',status='active',items={'data':[{'price':TeamBillingTests().price('shiftflow_team_yearly')}]},latest_invoice='in_paid')
        stripe.Subscription=SimpleNamespace(retrieve=Mock(return_value=subscription))
        stripe.Webhook=SimpleNamespace(construct_event=Mock(return_value={'type':'invoice.paid','data':{'object':{'parent':{'subscription_details':{'subscription':'sub_team'}}}}}))
        await self.db.users.update_one({'id':'owner'},{'$set':{'stripe_subscription_id':'sub_team','subscription_tier':'pro'}})
        with patch.object(s,'stripe_lib',stripe):
            response=await self.client.post('/api/stripe/webhook',content=b'{}')
            self.assertEqual(response.status_code,200,response.text)
            self.assertEqual((await self.db.users.find_one({'id':'owner'}))['subscription_tier'],'team')
            stripe.Subscription.retrieve.return_value=Obj(id='sub_team',status='canceled',items={'data':[]})
            stripe.Webhook.construct_event.return_value={'type':'customer.subscription.deleted','data':{'object':{'id':'sub_team'}}}
            response=await self.client.post('/api/stripe/webhook',content=b'{}')
            self.assertEqual(response.status_code,200,response.text)
        owner=await self.db.users.find_one({'id':'owner'})
        self.assertEqual(owner['plan'],'free');self.assertEqual(owner['subscription_tier'],'pro')

    async def test_profile_returns_own_signup_answers_even_inside_an_invited_workspace(self):
        await self.db.users.update_one({'id':'owner'}, {'$set':{'onboarding_answers':{'annual_events':300}}})
        await self.db.users.update_one({'id':'member'}, {'$set':{'onboarding_answers':{'monthly_missions':'1-3'}}})
        await self.join()
        owner = (await self.request('GET','/auth/me')).json()
        member = (await self.request('GET','/auth/me',uid='member')).json()
        self.assertEqual(owner['onboarding_answers'], {'annual_events':300})
        self.assertEqual(member['onboarding_answers'], {'monthly_missions':'1-3'})
        self.assertNotIn('password_hash', member)
        without_answers = (await self.request('GET','/auth/me',uid='other')).json()
        self.assertIsNone(without_answers['onboarding_answers'])

    async def test_member_onboarding_updates_their_own_account_only(self):
        await self.join()
        payload={'team_size':'2-5','monthly_missions':'5','current_tool':'Excel','main_pain':'Planning'}
        result=await self.request('POST','/onboarding',uid='member',json=payload)
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual((await self.db.users.find_one({'id':'member'}))['onboarding_answers'],payload)
        self.assertNotIn('onboarding_answers',await self.db.users.find_one({'id':'owner'}))

    async def test_search_is_workspace_scoped_for_members_and_owners(self):
        await self.join()
        for agency in ('owner', 'other'):
            await self.db.missions.insert_one({'id': agency+'-mission', 'agency_id': agency, 'name': 'Festival Son', 'created_at': '2026'})
            await self.db.workers.insert_one({'id': agency+'-worker', 'agency_id': agency, 'first_name': 'Paul', 'last_name': 'Son', 'email': 'private@example.com'})
        for uid in ('owner', 'member'):
            response = await self.request('GET', '/workspace/search?q=son', uid=uid)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual([m['id'] for m in response.json()['missions']], ['owner-mission'])
            self.assertEqual([w['id'] for w in response.json()['workers']], ['owner-worker'])
            self.assertNotIn('private@example.com', response.text)
            self.assertEqual(response.headers['cache-control'], 'no-store')

    async def test_search_limits_results_and_treats_regex_as_literal(self):
        for index in range(10):
            await self.db.missions.insert_one({'id': str(index), 'agency_id': 'owner', 'name': 'Festival', 'created_at': str(index)})
        response = await self.request('GET', '/workspace/search?q=festival')
        self.assertEqual(len(response.json()['missions']), 6)
        response = await self.request('GET', '/workspace/search', params={'q': '.*'})
        self.assertEqual(response.json()['missions'], [])
        response = await self.request('GET', '/workspace/search?q=f')
        self.assertEqual(response.json(), {'missions': [], 'workers': []})
        response = await self.request('GET', '/workspace/search', params={'q': 'x'*121})
        self.assertEqual(response.status_code, 422)

    async def test_search_requires_auth_and_rejects_revoked_members(self):
        self.assertEqual((await self.client.get('/api/workspace/search?q=test')).status_code, 401)
        await self.join()
        await self.request('DELETE', '/organization/members/member')
        response = await self.request('GET', '/workspace/search?q=festival', uid='member')
        self.assertNotEqual(response.status_code, 500)
        # Revoked accounts may fall back to their own organization; they cannot search the owner's data.
        await self.db.missions.insert_one({'id': 'secret', 'agency_id': 'owner', 'name': 'Festival'})
        response = await self.request('GET', '/workspace/search?q=festival', uid='member')
        if response.status_code == 200: self.assertEqual(response.json()['missions'], [])
        else: self.assertIn(response.status_code, (401, 403))

    async def test_search_finds_full_worker_names(self):
        await self.db.workers.insert_one({'id': 'paul', 'agency_id': 'owner', 'first_name': 'Paul', 'last_name': 'Martin'})
        response = await self.request('GET', '/workspace/search', params={'q': 'Paul Martin'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([w['id'] for w in response.json()['workers']], ['paul'])

    async def test_workspace_url_mismatch_blocks_reads_and_mutations(self):
        headers = {**self.auth('owner'), 'X-Organization-ID': 'other'}
        for method, path, body in [('GET', '/organization', None), ('PUT', '/organization', {'name': 'Wrong org', 'avatar': ''}), ('GET', '/workspace/search?q=festival', None), ('GET', '/missions', None), ('POST', '/workers', {'first_name': 'Paul', 'last_name': 'Martin', 'phone': '+33612345678'})]:
            result = await self.client.request(method, '/api'+path, headers=headers, **({'json': body} if body else {}))
            self.assertEqual(result.status_code, 409, result.text)
        self.assertEqual(await self.db.workers.count_documents({}), 0)

    async def test_invited_signup_joins_directly_without_creating_personal_organization(self):
        data = await self.request('POST', '/organization/invitations', json={'email': 'fresh@example.com'})
        token = parse_qs(urlparse(data.json()['url']).fragment)['token'][0]
        response = await self.client.post('/api/auth/register', json={'email':'fresh@example.com','password':'Secret123','name':'Camille','invitation_token':token})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json(); user = result['user']
        self.assertTrue(result['invitation_accepted'])
        self.assertEqual(user['organization']['id'], 'owner')
        self.assertEqual(user['organization']['role'], 'member')
        self.assertTrue(user['can_create_organization'])
        self.assertTrue(user['onboarding_completed'])
        self.assertFalse(user['can_manage_billing'])
        self.assertIsNone(await self.db.organizations.find_one({'owner_id':user['id']}))
        again = await self.client.get('/api/auth/me',headers={'Authorization':'Bearer '+result['access_token']})
        self.assertEqual(again.json()['organization']['id'],'owner')
        self.assertIsNone(await self.db.organizations.find_one({'owner_id':user['id']}))

    async def test_invited_signup_wrong_email_or_expired_token_never_creates_account(self):
        _, token = await self.invite()
        response = await self.client.post('/api/auth/register',json={'email':'wrong@example.com','password':'Secret123','invitation_token':token})
        self.assertEqual(response.status_code,403,response.text)
        self.assertIsNone(await self.db.users.find_one({'email':'wrong@example.com'}))
        response = await self.client.post('/api/auth/register',json={'email':'fresh@example.com','password':'Secret123','invitation_token':'x'*40})
        self.assertEqual(response.status_code,404,response.text)
        self.assertIsNone(await self.db.users.find_one({'email':'fresh@example.com'}))

    async def test_own_organization_created_once_without_inheriting_team_billing_or_data(self):
        await self.db.users.update_one({'id':'member'},{'$set':{'signup_origin':'invitation','active_organization_id':'owner','free_missions_used':2,'mission_credits':0}})
        await self.db.organizations.update_one({'_id':'owner'},{'$setOnInsert':{'id':'owner','owner_id':'owner','name':'Owner Events','members':[{'user_id':'owner','role':'owner'},{'user_id':'member','role':'member'}],'invitations':[]}},upsert=True)
        await self.db.missions.insert_one({'id':'shared','agency_id':'owner','name':'Shared mission'})
        response = await self.request('POST','/organization',uid='member',json={'name':'Camille Events'})
        self.assertEqual(response.status_code,200,response.text)
        personal = (await self.request('GET','/auth/me',uid='member')).json()
        self.assertEqual(personal['organization']['id'],'member')
        self.assertEqual(personal['organization']['name'],'Camille Events')
        self.assertEqual(personal['plan'],'free');self.assertTrue(personal['can_create_organization'])
        self.assertEqual((await self.request('GET','/missions',uid='member')).json(),[])
        quota = (await self.request('GET','/plan/quota',uid='member')).json()
        self.assertEqual(quota['free_missions_remaining'],1)
        repeat = await self.request('POST','/organization',uid='member',json={'name':'Another organization'})
        self.assertEqual(repeat.status_code,200,repeat.text)
        self.assertTrue(repeat.json()['id'].startswith('org_'))
        self.assertEqual((await self.request('GET','/plan/quota',uid='member')).json()['free_missions_remaining'],1)
        self.assertEqual((await self.db.users.find_one({'id':'owner'}))['plan'],'pro')
        await self.request('POST','/organization/switch',uid='member',json={'organization_id':'owner'})
        shared = (await self.request('GET','/auth/me',uid='member')).json()
        self.assertEqual(shared['subscription_tier'],'team'); self.assertFalse(shared['can_manage_billing'])
        self.assertEqual((await self.request('GET','/missions',uid='member')).json()[0]['id'],'shared')

    async def test_personal_creation_concurrency_creates_distinct_organizations(self):
        await self.db.users.update_one({'id':'member'},{'$set':{'signup_origin':'invitation'}})
        results = await asyncio.gather(*[self.request('POST','/organization',uid='member',json={'name':f'Org {i}'}) for i in range(3)])
        self.assertEqual(sum(r.status_code==200 for r in results),3)
        self.assertEqual(await self.db.organizations.count_documents({'owner_id':'member'}),3)

    async def test_revoked_invited_user_without_personal_space_can_create_one(self):
        await self.db.users.update_one({'id':'member'},{'$set':{'signup_origin':'invitation'}})
        await self.join()
        await self.request('DELETE','/organization/members/member')
        response = await self.request('GET','/auth/me',uid='member')
        self.assertEqual(response.status_code,200,response.text)
        self.assertIsNone(response.json()['organization'])
        self.assertTrue(response.json()['needs_organization'])
        self.assertTrue(response.json()['can_create_organization'])
        self.assertIn((await self.request('GET','/missions',uid='member')).status_code,(401,403))
        result = await self.request('POST','/organization',uid='member',json={'name':'My company'})
        self.assertEqual(result.status_code,200,result.text)

    async def test_existing_owner_new_organization_inherits_subscription(self):
        await self.request('GET','/auth/me')
        result = await self.request('POST','/organization',json={'name':'Another space'})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(await self.db.organizations.count_documents({'owner_id':'owner'}),2)
        self.assertEqual((await self.request('GET','/auth/me')).json()['plan'],'pro')
        self.assertIsNone(await self.db.users.find_one({'id':result.json()['id']}))

    async def test_invitation_revoked_during_signup_keeps_account_recoverable_without_empty_org(self):
        data=await self.request('POST','/organization/invitations',json={'email':'fresh@example.com'})
        token=parse_qs(urlparse(data.json()['url']).fragment)['token'][0]
        from fastapi import HTTPException
        with patch.object(organizations,'accept',AsyncMock(side_effect=HTTPException(409,'Invitation révoquée'))):
            response=await self.client.post('/api/auth/register',json={'email':'fresh@example.com','password':'Secret123','invitation_token':token})
        self.assertEqual(response.status_code,200,response.text)
        self.assertFalse(response.json()['invitation_accepted'])
        self.assertTrue(response.json()['user']['needs_organization'])
        self.assertEqual(await self.db.organizations.count_documents({'owner_id':response.json()['user']['id']}),0)

    async def test_google_invitation_signup_also_skips_personal_organization(self):
        data=await self.request('POST','/organization/invitations',json={'email':'fresh@gmail.com'})
        token=parse_qs(urlparse(data.json()['url']).fragment)['token'][0]
        proof=s.jwt.encode({'nonce':'invited-google-nonce','type':'google_nonce','exp':s.now_utc()+timedelta(minutes=10)},s.JWT_SECRET,algorithm=s.JWT_ALGORITHM)
        self.client.cookies.set('google_nonce',proof,path='/api/auth/google')
        with patch('google_auth.verify_google_token',AsyncMock(return_value={'sub':'google-invited','email':'fresh@gmail.com','name':'Camille'})):
            response=await self.client.post('/api/auth/google',json={'credential':'mock-credential','legal_version':'2026-10-23','registration':{'invitation_token':token,'name':'Camille'}})
        self.assertEqual(response.status_code,200,response.text)
        self.assertTrue(response.json()['invitation_accepted'])
        uid=response.json()['user']['id']
        self.assertEqual(response.json()['user']['organization']['id'],'owner')
        self.assertIsNone(await self.db.organizations.find_one({'owner_id':uid}))
        self.assertEqual((await self.db.users.find_one({'id':uid}))['google_sub'],'google-invited')

    async def test_business_admin_role_and_owner_only_billing(self):
        await self.db.users.update_one({'id':'owner'},{'$set':{'subscription_tier':'business'}})
        await self.join()
        promoted=await self.request('PUT','/organization/members/member/role',json={'role':'admin'})
        self.assertEqual(promoted.status_code,200,promoted.text)
        view=(await self.request('GET','/organization',uid='member')).json()
        self.assertEqual(view['role'],'admin');self.assertTrue(view['can_manage']);self.assertEqual(view['max_collaborators'],15)
        self.assertEqual((await self.request('PUT','/organization',uid='member',json={'name':'Managed'})).status_code,200)
        self.assertEqual((await self.request('POST','/whop/checkout',uid='member',json={'offer_key':'business_monthly','legal_version':'2026-10-23'})).status_code,403)
        denied=await self.request('POST','/organization/invitations',uid='member',json={'email':'new@example.com','role':'admin'})
        self.assertEqual(denied.status_code,403)
        self.assertEqual((await self.request('PUT','/organization/members/other/role',uid='member',json={'role':'admin'})).status_code,403)

    async def test_business_coordinator_cannot_delete_or_manage_members(self):
        await self.db.users.update_one({'id':'owner'},{'$set':{'subscription_tier':'business'}})
        await self.join()
        self.assertEqual((await self.request('DELETE','/workers/anything',uid='member')).status_code,403)
        self.assertEqual((await self.request('DELETE','/missions/anything',uid='member')).status_code,403)
        self.assertEqual((await self.request('POST','/organization/invitations',uid='member',json={'email':'new@example.com'})).status_code,403)
        self.assertEqual((await self.request('GET','/missions',uid='member')).status_code,200)

    async def test_business_reserves_fifteen_seats_and_downgrade_locks_excess_members(self):
        await self.db.users.update_one({'id':'owner'},{'$set':{'subscription_tier':'business'}})
        await self.request('GET','/auth/me')
        responses=await asyncio.gather(*[self.request('POST','/organization/invitations',json={'email':f'person{i}@example.com'}) for i in range(17)])
        self.assertEqual(sum(r.status_code==200 for r in responses),15)
        await self.db.organizations.update_one({'_id':'owner'},{'$set':{'invitations':[], 'members':[{'user_id':'owner','role':'owner'}]+[{'user_id':f'extra{i}','role':'member'} for i in range(5)]+[{'user_id':'member','role':'member'}]}})
        await self.db.users.update_one({'id':'member'},{'$set':{'active_organization_id':'owner'}})
        self.assertEqual((await self.request('GET','/missions',uid='member')).status_code,200)
        await self.db.users.update_one({'id':'owner'},{'$set':{'subscription_tier':'team'}})
        self.assertEqual((await self.request('GET','/missions',uid='member')).status_code,403)
        self.assertTrue((await self.request('GET','/auth/me',uid='member')).json()['organization']['locked'])

    async def test_whop_config_is_public_but_checkout_requires_owner_and_current_terms(self):
        self.assertEqual((await self.client.get('/api/whop/config')).status_code,200)
        response=await self.request('POST','/whop/checkout',json={'offer_key':'team_monthly','legal_version':'old'})
        self.assertEqual(response.status_code,400)
        response=await self.request('POST','/whop/status',uid='other',json={'reference':'x'*30})
        self.assertEqual(response.status_code,404)

    async def test_new_owned_organization_creates_scoped_mission_and_independent_settings(self):
        await self.request('GET','/auth/me')
        new=(await self.request('POST','/organization',json={'name':'Second'})).json()['id']
        payload={'name':'New org event','location':'Lille','shifts':[{'date':'2099-01-01','start_time':'08:00','end_time':'12:00','people_needed':1}]}
        response=await self.request('POST','/missions',json=payload)
        self.assertEqual(response.status_code,200,response.text)
        mission=await self.db.missions.find_one({'id':response.json()['id']})
        self.assertEqual(mission['agency_id'],new)
        self.assertEqual((await self.request('GET','/plan/quota')).json()['free_missions_remaining'],3)
        await self.request('PUT','/organization',json={'name':'Second renamed'})
        self.assertEqual((await self.db.users.find_one({'id':'owner'}))['agency_name'],'owner Events')
        await self.request('POST','/organization/switch',json={'organization_id':'owner'})
        self.assertEqual((await self.request('GET','/missions')).json(),[])
        self.assertEqual((await self.request('GET','/auth/me')).json()['plan'],'pro')
