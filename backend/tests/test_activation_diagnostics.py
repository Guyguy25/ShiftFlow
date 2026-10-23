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

    def test_keep_known_reason(self):
        self.assertEqual(safe_detail("mission_form_error", "validation"), "validation")

    def test_reason_enum(self):
        with self.assertRaises(ValidationError):
            ReasonIn(reason="unexpected")

    def test_every_event_has_detail_policy(self):
        self.assertEqual(set(InteractionIn.model_fields["event"].annotation.__args__), set(ALLOWED_DETAILS))


if __name__ == "__main__":
    unittest.main()
