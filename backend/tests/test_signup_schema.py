"""Check signup compatibility without loading production clients."""
import ast
from pathlib import Path
from typing import Optional, List
from unittest import TestCase
from pydantic import BaseModel, EmailStr, Field, field_validator, ValidationError

tree = ast.parse((Path(__file__).parents[1] / "server.py").read_text(encoding="utf-8"))
scope = dict(BaseModel=BaseModel, EmailStr=EmailStr, Field=Field, field_validator=field_validator, Optional=Optional, List=List)
for name in ["RegisterIn", "RegistrationAnswers"]:
    node = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == name)
    exec(compile(ast.Module(body=[node], type_ignores=[]), "server.py", "exec"), scope)


class SignupSchemaTests(TestCase):
    def test_signup_needs_only_email_and_password(self):
        payload = scope["RegisterIn"](email="user@example.com", password="Secret123")
        self.assertEqual(payload.phone, "")
        self.assertEqual(payload.agency_name, "Mon organisation")

    def test_still_rejects_weak_passwords_and_invalid_optional_phones(self):
        for extra in [dict(password="weak"), dict(password="Secret123", phone="bad")]:
            with self.assertRaises(ValidationError):
                scope["RegisterIn"](email="user@example.com", **extra)

    def test_activity_answers_have_bounds_and_survive_draft_validation(self):
        payload = scope["RegistrationAnswers"](annual_events=40, people_per_mission=15)
        self.assertEqual(payload.annual_events, 40)
        self.assertEqual(payload.people_per_mission, 15)
        with self.assertRaises(ValidationError):
            scope["RegistrationAnswers"](annual_events=301)
