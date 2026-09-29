import ast
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import List
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch
from pydantic import BaseModel, Field, field_validator, ValidationError

tree = ast.parse((Path(__file__).parents[1] / "server.py").read_text(encoding="utf-8"))
namespace = dict(BaseModel=BaseModel, Field=Field, field_validator=field_validator, List=List)
for node in tree.body:
    if isinstance(node, ast.ClassDef) and node.name.startswith("Registration"):
        exec(compile(ast.Module(body=[node], type_ignores=[]), "server.py", "exec"), namespace)
Draft = namespace["RegistrationDraftIn"]

class HTTPError(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code

class DraftTest(IsolatedAsyncioTestCase):
    def payload(self, **overrides):
        return Draft(**dict(dict(token="a" * 64, step=1, revision=123, fields={"name": "Camille", "password": "secret123"}, answers={}), **overrides))

    def setup_endpoint(self, count=1, completed=False):
        records = SimpleNamespace(find_one=AsyncMock(return_value={"completed_at": True} if completed else None), update_one=AsyncMock())
        db = SimpleNamespace(registration_drafts=records, registration_limits=SimpleNamespace(find_one_and_update=AsyncMock(return_value={"count": count})))
        node = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == "save_registration_draft")
        node.decorator_list = []
        scope = dict(namespace, db=db, Request=object, JWT_SECRET="test", now_utc=lambda: datetime(2026, 9, 29, tzinfo=timezone.utc), timedelta=timedelta, HTTPException=HTTPError)
        exec(compile(ast.Module(body=[node], type_ignores=[]), "server.py", "exec"), scope)
        return scope["save_registration_draft"], records

    async def call(self, fn, payload):
        with patch.dict("sys.modules", {"pymongo": SimpleNamespace(ReturnDocument=SimpleNamespace(AFTER=True))}):
            return await fn(payload, SimpleNamespace(client=SimpleNamespace(host="127.0.0.1")))

    async def test_allowlist_expiry_and_hashed_token(self):
        fn, records = self.setup_endpoint()
        await self.call(fn, self.payload())
        query, update = records.update_one.call_args_list[1].args
        self.assertEqual(query["_id"], hashlib.sha256(("a" * 64).encode()).hexdigest())
        self.assertNotIn("password", update["$set"]["fields"])
        self.assertEqual(update["$set"]["expires_at"] - update["$set"]["updated_at"], timedelta(days=7))
        self.assertIn("visited.1", update["$set"])
        self.assertEqual(query["completed_at"], {"$exists": False})
        self.assertEqual(query["$or"][1], {"revision": {"$lte": 123}})

    async def test_completed_signup_cannot_be_repopulated(self):
        fn, records = self.setup_endpoint(completed=True)
        await self.call(fn, self.payload())
        records.update_one.assert_not_awaited()

    async def test_rate_limited_requests_do_not_write_drafts(self):
        fn, records = self.setup_endpoint(count=1201)
        with self.assertRaises(HTTPError) as error:
            await self.call(fn, self.payload())
        self.assertEqual(error.exception.status_code, 429)
        records.update_one.assert_not_awaited()

    def test_invalid_tokens_steps_and_oversized_fields(self):
        for overrides in ({"token": "guess"}, {"step": 7}, {"fields": {"name": "x" * 255}}, {"answers": {"main_pain": ["x" * 121]}}):
            with self.assertRaises(ValidationError):
                self.payload(**overrides)
