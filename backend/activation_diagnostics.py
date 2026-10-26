"""Minimal, first-party onboarding diagnostics: no free-text or contact data."""
from typing import Literal, Optional
from pydantic import BaseModel, Field

InteractionName = Literal[
    "mission_form_opened", "mission_form_step", "mission_form_error",
    "whatsapp_session_started", "whatsapp_session_error",
    "whatsapp_pair_requested", "whatsapp_pair_error",
    "invitation_review_opened", "invitation_send_attempted",
    "invitation_send_error", "invitation_send_succeeded",
    "activation_home_viewed", "activation_cta_clicked", "onboarding_guide_dismissed",
]
ReasonName = Literal[
    "no_upcoming_mission", "just_exploring", "setup_too_long",
    "whatsapp_concern", "not_relevant", "other",
]

# Only predefined, low-cardinality diagnostic values are accepted.
ALLOWED_DETAILS = {
    "mission_form_opened": set(),
    "mission_form_step": {"schedule", "review"},
    "mission_form_error": {"validation", "request_failed", "quota"},
    "whatsapp_session_started": set(),
    "whatsapp_session_error": {"request_failed"},
    "whatsapp_pair_requested": set(),
    "whatsapp_pair_error": {"missing_phone", "request_failed", "missing_code"},
    "invitation_review_opened": set(),
    "invitation_send_attempted": set(),
    "invitation_send_error": {"validation", "whatsapp_disconnected", "request_failed", "delivery_failed"},
    "invitation_send_succeeded": set(),
    "activation_home_viewed": set(),
    "activation_cta_clicked": set(),
    "onboarding_guide_dismissed": set(),
}
REASON_LABELS = {
    "no_upcoming_mission": "Aucune mission prévue",
    "just_exploring": "Découvre simplement l'outil",
    "setup_too_long": "Mise en place trop longue",
    "whatsapp_concern": "Réticence à connecter WhatsApp",
    "not_relevant": "Pas adapté à son activité",
    "other": "Autre",
}

class InteractionIn(BaseModel):
    event: InteractionName
    detail: Optional[str] = Field(default=None, max_length=40)

class ReasonIn(BaseModel):
    reason: ReasonName

def safe_detail(event: str, detail: Optional[str]) -> Optional[str]:
    """Never store user-provided form values, error texts or phone numbers."""
    return detail if detail in ALLOWED_DETAILS[event] else None
