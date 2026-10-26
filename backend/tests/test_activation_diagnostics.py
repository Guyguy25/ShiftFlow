import unittest

from activation_diagnostics import ALLOWED_DETAILS, InteractionIn, ReasonIn, safe_detail
from pydantic import ValidationError


class DiagnosticValidationTests(unittest.TestCase):
    def test_only_known_events(self):
        with self.assertRaises(ValidationError):
            InteractionIn(event="password_typed", detail="test")

    def test_drop_free_text(self):
        self.assertIsNone(safe_detail("whatsapp_pair_error", "+33612345678"))
        self.assertIsNone(safe_detail("mission_form_error", "name=Private"))

    def test_new_activation_events_are_privacy_safe(self):
        for event in ("activation_home_viewed", "activation_cta_clicked", "invitation_send_succeeded"):
            self.assertEqual(InteractionIn(event=event).event, event)
            self.assertIsNone(safe_detail(event, "phone=0612345678"))

    def test_keep_known_reason(self):
        self.assertEqual(safe_detail("mission_form_error", "validation"), "validation")

    def test_reason_enum(self):
        with self.assertRaises(ValidationError):
            ReasonIn(reason="unexpected")

    def test_every_event_has_detail_policy(self):
        self.assertEqual(set(InteractionIn.model_fields["event"].annotation.__args__), set(ALLOWED_DETAILS))


if __name__ == "__main__":
    unittest.main()
