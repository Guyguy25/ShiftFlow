import { API } from "./api";

// Authenticated, first-party product diagnostics; no ad pixels or recording.
// No URLs, names, phone numbers, message content, entered fields or raw errors.
const ALLOWED = new Set([
  "mission_form_opened", "mission_form_step", "mission_form_error",
  "whatsapp_session_started", "whatsapp_session_error",
  "whatsapp_pair_requested", "whatsapp_pair_error",
  "invitation_review_opened", "invitation_send_attempted",
  "invitation_send_error", "invitation_send_succeeded",
  "activation_home_viewed", "activation_cta_clicked", "onboarding_guide_dismissed",
]);
const DETAILS = {
  mission_form_step: new Set(["schedule", "review"]),
  mission_form_error: new Set(["validation", "request_failed", "quota"]),
  whatsapp_session_error: new Set(["request_failed"]),
  whatsapp_pair_error: new Set(["missing_phone", "request_failed", "missing_code"]),
  invitation_send_error: new Set(["validation", "whatsapp_disconnected", "request_failed", "delivery_failed"]),
};

export function trackActivation(event, detail = null) {
  if (!ALLOWED.has(event) || typeof fetch !== "function") return;
  const safe = DETAILS[event]?.has(detail) ? detail : null;
  // Intentionally separate from the application's axios instance: diagnostic
  // requests must never block or be mistaken for an actual business action.
  try {
    Promise.resolve(fetch(`${API}/activation/interaction`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, detail: safe }),
    })).catch(() => {});
  } catch (_) {
    // Never interrupt the user's mission or invitation.
  }
}
