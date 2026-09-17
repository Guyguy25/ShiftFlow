import hashlib
import logging
import os
import time
from typing import Optional

import httpx

logger = logging.getLogger("shiftflow.meta")

META_PIXEL_ID = os.environ.get("META_PIXEL_ID", "").strip()
META_CAPI_ACCESS_TOKEN = os.environ.get("META_CAPI_ACCESS_TOKEN", "").strip()
META_GRAPH_API_VERSION = os.environ.get("META_GRAPH_API_VERSION", "v23.0").strip()
META_CAPI_TEST_EVENT_CODE = os.environ.get("META_CAPI_TEST_EVENT_CODE", "").strip()


def meta_capi_ready() -> bool:
    return bool(META_PIXEL_ID and META_CAPI_ACCESS_TOKEN)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _normalize_email(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return value.strip().lower()


def _normalize_phone(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    raw = value.strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return None
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = "33" + digits[1:]
    return digits


def build_user_data(
    *,
    email: Optional[str],
    phone: Optional[str],
    external_id: Optional[str],
    client_user_agent: Optional[str],
) -> dict:
    user_data = {}

    normalized_email = _normalize_email(email)
    if normalized_email:
        user_data["em"] = [_sha256(normalized_email)]

    normalized_phone = _normalize_phone(phone)
    if normalized_phone:
        user_data["ph"] = [_sha256(normalized_phone)]

    if external_id:
        user_data["external_id"] = [_sha256(str(external_id).strip())]

    if client_user_agent:
        user_data["client_user_agent"] = client_user_agent

    return user_data


async def send_meta_event(
    *,
    event_name: str,
    event_id: str,
    event_source_url: str,
    email: Optional[str],
    phone: Optional[str],
    external_id: Optional[str],
    client_user_agent: Optional[str],
    custom_data: Optional[dict] = None,
    subscription_id: Optional[str] = None,
) -> bool:
    """
    Sends one website event to Meta Conversions API.

    This helper deliberately does not receive/store the access token from callers.
    The secret is read only from server-side environment variables.
    Failures are logged and never break the ShiftFlow user flow.
    """
    if not meta_capi_ready():
        logger.info("Meta CAPI skipped: META_PIXEL_ID or META_CAPI_ACCESS_TOKEN is missing")
        return False

    user_data = build_user_data(
        email=email,
        phone=phone,
        external_id=external_id,
        client_user_agent=client_user_agent,
    )

    if subscription_id:
        # Meta's subscription_id is explicitly a non-hashed identifier.
        user_data["subscription_id"] = subscription_id

    event = {
        "event_name": event_name,
        "event_time": int(time.time()),
        "event_id": event_id,
        "action_source": "website",
        "event_source_url": event_source_url,
        "user_data": user_data,
    }
    if custom_data:
        event["custom_data"] = custom_data

    endpoint = (
        f"https://graph.facebook.com/{META_GRAPH_API_VERSION}/"
        f"{META_PIXEL_ID}/events"
    )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            payload = {"data": [event]}
            if META_CAPI_TEST_EVENT_CODE:
                payload["test_event_code"] = META_CAPI_TEST_EVENT_CODE

            response = await client.post(
                endpoint,
                params={"access_token": META_CAPI_ACCESS_TOKEN},
                json=payload,
            )
            response.raise_for_status()
        logger.info("Meta CAPI event sent: %s id=%s", event_name, event_id)
        return True
    except Exception as exc:
        # Analytics must never make account creation, mission creation or payment fail.
        logger.warning("Meta CAPI event failed: %s id=%s error=%s", event_name, event_id, exc)
        return False
