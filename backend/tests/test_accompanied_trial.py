"""Offline tests of campaign intake, expiry, validation and owner access."""
import ast
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Literal
from unittest import TestCase
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from fastapi.testclient import TestClient
from pydantic import BaseModel, EmailStr, Field, field_validator
from test_mission_operations import Database, Cursor


class AccompaniedTrialTest(TestCase):
    def setUp(self):
        Cursor.limit = lambda cursor, count: Cursor(cursor.cursor.limit(count))
        self.db = Database()
        async def owner(request: Request):
            if request.headers.get("x-test-owner") != "yes":
                raise HTTPException(403)
        scope = dict(globals(), api=APIRouter(), db=self.db,
                     now_utc=lambda: datetime.now(timezone.utc),
                     new_id=lambda: str(uuid.uuid4()), JWT_SECRET="offline-secret",
                     request_client_ip=lambda request: "127.0.0.1", require_owner=owner)
        tree = ast.parse((Path(__file__).parents[1] / "server.py").read_text(encoding="utf-8"))
        names = {"AccompaniedTrialLead", "create_accompanied_trial_lead", "list_accompanied_trial_leads"}
        nodes = [n for n in tree.body if getattr(n, "name", None) in names]
        exec(compile(ast.Module(body=nodes, type_ignores=[]), "server.py", "exec"), scope)
        app = FastAPI()
        app.include_router(scope["api"], prefix="/api")
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.payload = dict(name="Test", email="test@example.com", company="Agence",
                            mission="Dans les 7 prochains jours", need="Préparer une mission",
                            whatsapp="Je peux le connecter moi-même")

    def test_intake_saved_and_owner_only(self):
        response = self.client.post("/api/public/accompanied-trial", json=self.payload)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(self.client.get("/api/admin/accompanied-trial").status_code, 403)
        result = self.client.get("/api/admin/accompanied-trial", headers={"x-test-owner": "yes"}).json()
        self.assertEqual(result[0]["email"], self.payload["email"])
        self.assertNotIn("fingerprint", result[0])
        row = self.db.raw.accompanied_trial_leads.find_one()
        self.assertAlmostEqual((row["expires_at"] - row["created_at"]).days, 90)

    def test_validation_and_rate_limit(self):
        for invalid in ({"name": " "}, {"email": "invalid"}, {"need": "x" * 801}, {"mission": "unknown"}):
            self.assertEqual(self.client.post("/api/public/accompanied-trial", json={**self.payload, **invalid}).status_code, 422)
        for _ in range(5):
            self.assertEqual(self.client.post("/api/public/accompanied-trial", json=self.payload).status_code, 201)
        self.assertEqual(self.client.post("/api/public/accompanied-trial", json=self.payload).status_code, 429)
