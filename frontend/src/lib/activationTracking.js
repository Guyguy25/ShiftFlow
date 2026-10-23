import { api } from "./api";

// Product diagnostics only: no URLs, typed fields, names, phone numbers,
// WhatsApp content, form inputs, or raw error messages are transmitted.
// Authenticated, first-party events are separated from advertising tracking.
const ALLOWED = new Set([
  "mission_form_opened", "mission_form_step", "mission_form_error",
  "whatsapp_session_started", "whatsapp_session_error",
  "whatsapp_pair_requested", "whatsapp_pair_error",
  "invitation_review_opened", "invitation_send_attempted",
  "invitation_send_error", "onboarding_guide_dismissed",
]);
const DETAILS = {
  mission_form_step: new Set(["schedule", "review"]),
  mission_form_error: new Set(["validation", "request_failed", "quota"]),
  whatsapp_session_error: new Set(["request_failed"]),
  whatsapp_pair_error: new Set(["missing_phone", "request_failed", "missing_code"]),
  invitation_send_error: new Set(["validation", "whatsapp_disconnected", "request_failed", "delivery_failed"]),
};

export function trackActivation(event, detail = null) {
  if (!ALLOWED.has(event)) return;
  const safe = DETAILS[event]?.has(detail) ? detail : null;
  // Best-effort telemetry must never delay or break actual user actions.
  api.post("/activation/interaction", { event, detail: safe }).catch(() => {});
}
