import sys
import time
from pathlib import Path
from unittest import TestCase
from unittest.mock import AsyncMock, Mock, patch
from urllib.parse import urlparse, parse_qs

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

sys.path.insert(0, str(Path(__file__).parents[1]))
import microsoft_auth
from microsoft_auth import verify_id_token, identity_from_claims, authorize_url, pkce_pair, CONSUMER_TENANT


def complete(coroutine):
    try:
        coroutine.send(None)
    except StopIteration as result:
        return result.value
    finally:
        coroutine.close()
    raise AssertionError("Unexpected real I/O")


class MicrosoftTokenTests(TestCase):
    def setUp(self):
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        jwk = jwt.algorithms.RSAAlgorithm.to_jwk(self.key.public_key(), as_dict=True)
        jwk["kid"] = "k"
        result = Mock(); result.json.return_value = {"keys": [jwk]}
        self.client = AsyncMock(); self.client.get.return_value = result; self.client.__aenter__.return_value = self.client
        self.tid = "11111111-2222-3333-4444-555555555555"
        self.claims = dict(iss=f"https://login.microsoftonline.com/{self.tid}/v2.0", aud="client", sub="s", oid="o", tid=self.tid,
                           nonce="nonce", email="camille@axe.fr", xms_edov=True, name="Camille",
                           exp=int(time.time()) + 300, iat=int(time.time()))

    def verify(self, **changes):
        token = jwt.encode({**self.claims, **changes}, self.key, algorithm="RS256", headers={"kid": "k"})
        with patch.object(microsoft_auth.httpx, "AsyncClient", return_value=self.client):
            return complete(verify_id_token(token, "client", "nonce"))

    def test_valid_token(self):
        self.assertEqual(self.verify()["oid"], "o")

    def test_rejects_wrong_nonce_audience_and_issuer(self):
        for changes in ({"nonce": "other"}, {"aud": "other"}, {"iss": "https://login.microsoftonline.com/other/v2.0"}):
            with self.assertRaises(Exception):
                self.verify(**changes)

    def test_rejects_expired(self):
        with self.assertRaises(Exception):
            self.verify(exp=int(time.time()) - 3600)


class IdentityTests(TestCase):
    def test_work_account_needs_verified_domain(self):
        base = dict(tid="t", oid="o", sub="s", email="Camille@Axe.fr")
        self.assertEqual(identity_from_claims({**base, "xms_edov": True}), {"sub": "t:o", "email": "camille@axe.fr", "email_verified": True, "name": ""})
        self.assertFalse(identity_from_claims(base)["email_verified"])
        # preferred_username d'un compte pro n'est pas une adresse fiable.
        self.assertEqual(identity_from_claims({"tid": "t", "oid": "o", "sub": "s", "preferred_username": "x@y.fr"})["email"], "")

    def test_personal_account_is_verified(self):
        identity = identity_from_claims(dict(tid=CONSUMER_TENANT, oid="o", sub="s", preferred_username="camille@outlook.fr"))
        self.assertTrue(identity["email_verified"])
        self.assertEqual(identity["email"], "camille@outlook.fr")


class AuthorizeTests(TestCase):
    def test_authorize_url_uses_pkce(self):
        verifier, challenge = pkce_pair()
        query = parse_qs(urlparse(authorize_url("common", "client", "https://shiftflow.io/api/auth/microsoft/callback", "st", "no", challenge)).query)
        self.assertEqual(query["code_challenge_method"], ["S256"])
        self.assertEqual(query["redirect_uri"], ["https://shiftflow.io/api/auth/microsoft/callback"])
        self.assertNotIn("client_secret", query)
        self.assertGreater(len(verifier), 43)
