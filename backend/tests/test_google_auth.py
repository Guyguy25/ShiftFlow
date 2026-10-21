import sys
import time
from pathlib import Path
from unittest import TestCase
from unittest.mock import AsyncMock, Mock, patch

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

sys.path.insert(0, str(Path(__file__).parents[1]))
from google_auth import verify_google_token


def complete(coroutine):
    # All I/O is mocked and resolves immediately; no local sockets/event loop needed.
    try:
        coroutine.send(None)
    except StopIteration as result:
        return result.value
    finally:
        coroutine.close()
    raise AssertionError("Unexpected real I/O in token verification test")


class GoogleTokenTests(TestCase):
    def setUp(self):
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        jwk = jwt.algorithms.RSAAlgorithm.to_jwk(self.key.public_key(), as_dict=True)
        jwk["kid"] = "test-key"
        result = Mock()
        result.json.return_value = {"keys": [jwk]}
        self.client = AsyncMock()
        self.client.get.return_value = result
        self.client.__aenter__.return_value = self.client
        self.claims = dict(iss="https://accounts.google.com", aud="client", sub="google-user",
                           nonce="nonce", email="user@gmail.com", email_verified=True,
                           exp=int(time.time()) + 300, iat=int(time.time()))

    async def verify(self, **changes):
        token = jwt.encode({**self.claims, **changes}, self.key, algorithm="RS256", headers={"kid": "test-key"})
        with patch("google_auth.httpx.AsyncClient", return_value=self.client):
            return await verify_google_token(token, "client", "nonce")

    def test_valid_google_identity(self):
        self.assertEqual(complete(self.verify())["sub"], "google-user")

    def test_rejects_invalid_claims(self):
        for changes in [dict(aud="attacker"), dict(iss="https://attacker.test"),
                        dict(exp=1), dict(nonce="wrong"), dict(email_verified=False), dict(azp="other")]:
            with self.subTest(changes=changes), self.assertRaises((ValueError, jwt.InvalidTokenError)):
                complete(self.verify(**changes))

    def test_rejects_forged_signature(self):
        other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        token = jwt.encode(self.claims, other, algorithm="RS256", headers={"kid": "test-key"})
        with patch("google_auth.httpx.AsyncClient", return_value=self.client), self.assertRaises(jwt.InvalidSignatureError):
            complete(verify_google_token(token, "client", "nonce"))
