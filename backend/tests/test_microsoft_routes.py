"""Routes Microsoft : requêtes ASGI réelles sur une base MongoDB simulée, Microsoft simulé."""
import os
from datetime import timedelta
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlparse

import httpx
import jwt
from mongomock_motor import AsyncMongoMockClient

os.environ.setdefault('MONGO_URL', 'mongodb://127.0.0.1:27017')
os.environ.setdefault('DB_NAME', 'shiftflow_microsoft_tests')
os.environ.setdefault('JWT_SECRET', 'isolated-team-test-secret-at-least-32-bytes-only')
import server as s
import microsoft_auth

REGISTRATION = {"agency_name": "Camille Events", "onboarding_answers": {"role": "Dirigeant / fondateur"}}


class MicrosoftRouteTests(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = AsyncMongoMockClient()['test']
        self.patches = [patch.object(s, 'db', self.db), patch.object(s, 'MICROSOFT_CLIENT_SECRET', 'secret'),
                        patch.object(s, 'FRONTEND_URL', 'https://shiftflow.io'),
                        patch.object(s, 'send_meta_event', AsyncMock())]
        for p in self.patches: p.start()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=s.app), base_url='https://testserver')

    async def asyncTearDown(self):
        await self.client.aclose()
        for p in reversed(self.patches): p.stop()

    def credential(self, **identity):
        data = {"type": "microsoft_identity", "jti": identity.pop("jti", "j1"), "sub": "tid:oid", "email": "camille@axe.fr",
                "email_verified": True, "name": "Camille Martin", "exp": s.now_utc() + timedelta(minutes=15), **identity}
        return jwt.encode(data, s.JWT_SECRET, algorithm=s.JWT_ALGORITHM)

    async def test_start_redirects_to_microsoft_with_state_cookie(self):
        r = await self.client.get('/api/auth/microsoft/start?mode=register')
        self.assertEqual(r.status_code, 303)
        location = urlparse(r.headers['location'])
        self.assertEqual(location.netloc, 'login.microsoftonline.com')
        query = parse_qs(location.query)
        self.assertEqual(query['redirect_uri'], ['https://shiftflow.io/api/auth/microsoft/callback'])
        self.assertIn('microsoft_oauth=', r.headers['set-cookie'])
        self.assertIn('samesite=lax', r.headers['set-cookie'].lower())

    async def test_callback_returns_identity_to_register_page(self):
        start = await self.client.get('/api/auth/microsoft/start?mode=register')
        state = parse_qs(urlparse(start.headers['location']).query)['state'][0]
        claims = {"tid": "t", "oid": "o", "sub": "s", "email": "camille@axe.fr", "xms_edov": True, "name": "Camille"}
        with patch.object(microsoft_auth, 'exchange_code', AsyncMock(return_value='tok')), patch.object(microsoft_auth, 'verify_id_token', AsyncMock(return_value=claims)):
            r = await self.client.get(f'/api/auth/microsoft/callback?code=abc&state={state}', cookies=start.cookies)
        self.assertEqual(r.status_code, 303)
        target = urlparse(r.headers['location'])
        self.assertEqual(target.path, '/register')
        token = parse_qs(target.fragment)['microsoft'][0]
        self.assertEqual(jwt.decode(token, s.JWT_SECRET, algorithms=[s.JWT_ALGORITHM])['email'], 'camille@axe.fr')

    async def test_callback_rejects_wrong_state(self):
        start = await self.client.get('/api/auth/microsoft/start?mode=login')
        r = await self.client.get('/api/auth/microsoft/callback?code=abc&state=forged', cookies=start.cookies)
        self.assertEqual(urlparse(r.headers['location']).path, '/login')
        self.assertIn('microsoft_error', r.headers['location'])

    async def test_register_then_login_with_microsoft(self):
        r = await self.client.post('/api/auth/microsoft', json={"credential": self.credential()})
        self.assertEqual(r.status_code, 404)
        r = await self.client.post('/api/auth/microsoft', json={"credential": self.credential(), "registration": REGISTRATION, "legal_version": "2026-10-24"})
        self.assertEqual(r.status_code, 200, r.text)
        user = await self.db.users.find_one({"email": "camille@axe.fr"})
        self.assertEqual(user["microsoft_sub"], "tid:oid")
        self.assertEqual(user["agency_name"], "Camille Events")
        self.assertEqual(user["onboarding_answers"], {"role": "Dirigeant / fondateur"})
        # Le même jeton ne peut pas resservir.
        again = await self.client.post('/api/auth/microsoft', json={"credential": self.credential()})
        self.assertEqual(again.status_code, 401)
        login = await self.client.post('/api/auth/microsoft', json={"credential": self.credential(jti="j2")})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["user"]["email"], "camille@axe.fr")

    async def test_unverified_email_cannot_take_over_an_existing_account(self):
        await self.db.users.insert_one({"id": "u", "email": "camille@axe.fr", "role": "admin"})
        r = await self.client.post('/api/auth/microsoft', json={"credential": self.credential(email_verified=False)})
        self.assertEqual(r.status_code, 403)
        self.assertNotIn("microsoft_sub", await self.db.users.find_one({"id": "u"}))

    async def test_verified_email_links_existing_password_account(self):
        await self.db.users.insert_one({"id": "u", "email": "camille@axe.fr", "role": "admin", "created_at": s.iso(s.now_utc())})
        r = await self.client.post('/api/auth/microsoft', json={"credential": self.credential()})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual((await self.db.users.find_one({"id": "u"}))["microsoft_sub"], "tid:oid")

    async def test_disabled_without_secret(self):
        with patch.object(s, 'MICROSOFT_CLIENT_SECRET', ''):
            self.assertEqual((await self.client.get('/api/auth/microsoft/config')).json(), {"enabled": False})
        self.assertEqual((await self.client.get('/api/auth/microsoft/config')).json(), {"enabled": True})
