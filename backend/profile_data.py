"""Bounded, non-executable profile images; stored with the authenticated user."""
import base64
import binascii


def validate_avatar(value: str) -> str:
    if not value:
        return ""
    prefix = "data:image/jpeg;base64,"
    if len(value) > 100_000 or not value.startswith(prefix):
        raise ValueError("La photo doit être une image JPEG de moins de 75 Ko.")
    try:
        data = base64.b64decode(value[len(prefix):], validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Photo invalide.") from exc
    if not data.startswith(b"\xff\xd8\xff") or not data.endswith(b"\xff\xd9"):
        raise ValueError("Photo JPEG invalide.")
    return value
