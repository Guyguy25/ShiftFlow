"""Google ID token validation. Never trust identity fields supplied by the browser."""
import httpx
import jwt


async def verify_google_token(credential, client_id, nonce):
    async with httpx.AsyncClient(timeout=10) as client:
        result = await client.get("https://www.googleapis.com/oauth2/v3/certs")
        result.raise_for_status()
    header = jwt.get_unverified_header(credential)
    key = next(k for k in result.json()["keys"] if k["kid"] == header.get("kid"))
    claims = jwt.decode(
        credential, jwt.PyJWK.from_dict(key).key, algorithms=["RS256"],
        audience=client_id, issuer=["https://accounts.google.com", "accounts.google.com"],
        options={"require": ["exp", "iat", "iss", "aud", "sub", "nonce", "email"]},
    )
    if claims.get("nonce") != nonce or claims.get("email_verified") is not True:
        raise ValueError("Invalid Google identity")
    if claims.get("azp", client_id) != client_id:
        raise ValueError("Invalid authorized party")
    return claims
