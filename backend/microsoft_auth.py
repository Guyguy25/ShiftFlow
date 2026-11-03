"""Connexion Microsoft (Entra ID / comptes personnels) par le flux « authorization code » + PKCE.

Le navigateur n'est jamais cru sur parole : le code est échangé côté serveur avec le
secret client, puis l'ID token est vérifié (signature, audience, émetteur, nonce).
"""
import base64
import hashlib
import secrets
from urllib.parse import urlencode

import httpx
import jwt

AUTHORITY = "https://login.microsoftonline.com"
# Locataire des comptes Microsoft personnels (outlook.com, hotmail.fr, live.fr…).
CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad"
SCOPES = "openid profile email"


def pkce_pair():
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def authorize_url(tenant, client_id, redirect_uri, state, nonce, challenge, login_hint=None):
    params = {
        "client_id": client_id, "response_type": "code", "redirect_uri": redirect_uri,
        "response_mode": "query", "scope": SCOPES, "state": state, "nonce": nonce,
        "code_challenge": challenge, "code_challenge_method": "S256", "prompt": "select_account",
    }
    if login_hint:
        params["login_hint"] = login_hint
    return f"{AUTHORITY}/{tenant}/oauth2/v2.0/authorize?{urlencode(params)}"


async def exchange_code(tenant, client_id, client_secret, redirect_uri, code, verifier):
    async with httpx.AsyncClient(timeout=10) as client:
        result = await client.post(f"{AUTHORITY}/{tenant}/oauth2/v2.0/token", data={
            "client_id": client_id, "client_secret": client_secret, "grant_type": "authorization_code",
            "code": code, "redirect_uri": redirect_uri, "code_verifier": verifier, "scope": SCOPES,
        })
    if result.status_code != 200:
        raise ValueError("Microsoft token exchange failed")
    token = result.json().get("id_token")
    if not token:
        raise ValueError("Missing ID token")
    return token


async def verify_id_token(token, client_id, nonce):
    async with httpx.AsyncClient(timeout=10) as client:
        result = await client.get(f"{AUTHORITY}/common/discovery/v2.0/keys")
        result.raise_for_status()
    header = jwt.get_unverified_header(token)
    key = next(k for k in result.json()["keys"] if k["kid"] == header.get("kid"))
    claims = jwt.decode(
        token, jwt.PyJWK.from_dict(key).key, algorithms=["RS256"], audience=client_id,
        options={"require": ["exp", "iat", "iss", "aud", "sub", "tid", "nonce"], "verify_iss": False},
        leeway=60,
    )
    # Clés communes à tous les locataires : l'émetteur doit correspondre au locataire du jeton.
    if claims["iss"] != f"{AUTHORITY}/{claims['tid']}/v2.0":
        raise ValueError("Invalid issuer")
    if claims.get("nonce") != nonce:
        raise ValueError("Invalid nonce")
    return claims


def identity_from_claims(claims):
    """Email, nom et identifiant stable. L'email n'est « vérifié » que si Microsoft le garantit."""
    personal = claims.get("tid") == CONSUMER_TENANT
    email = (claims.get("email") or (claims.get("preferred_username") if personal else "") or "").strip().lower()
    # Comptes personnels : email vérifié par Microsoft. Comptes pro : seulement si le domaine
    # est vérifié par l'organisation (claim facultatif « xms_edov »), pour éviter l'usurpation.
    verified = bool(email) and "@" in email and (personal or claims.get("xms_edov") in (True, 1, "1", "true"))
    return {
        "sub": f"{claims['tid']}:{claims.get('oid') or claims['sub']}",
        "email": email, "email_verified": verified,
        "name": (claims.get("name") or "").strip()[:254],
    }
