import ast
import base64
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock, Mock

sys.path.insert(0, str(Path(__file__).parents[1]))
from profile_data import validate_avatar


class AvatarValidation(TestCase):
    def test_empty_and_bounded_jpeg(self):
        self.assertEqual(validate_avatar(""), "")
        value = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xfftest\xff\xd9").decode()
        self.assertEqual(validate_avatar(value), value)

    def test_rejects_remote_urls_scripts_wrong_formats_and_large_payloads(self):
        for value in ["https://example.com/photo.jpg", "data:image/svg+xml,<svg/>", "data:image/jpeg;base64,!!", "data:image/jpeg;base64,aGVsbG8=", "x" * 100001]:
            with self.subTest(value=value[:45]), self.assertRaises(ValueError):
                validate_avatar(value)


class ProfileUpdate(IsolatedAsyncioTestCase):
    async def test_scoped_update_preserves_omitted_avatar(self):
        tree = ast.parse((Path(__file__).parents[1] / "server.py").read_text(encoding="utf-8"))
        fn = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == "update_me")
        fn.decorator_list = []
        fn.args.defaults = []
        users = SimpleNamespace(update_one=AsyncMock(), find_one=AsyncMock(return_value={"id": "owner"}))
        namespace = {"db": SimpleNamespace(users=users), "UpdateProfileIn": object, "public_user": lambda u: u}
        exec(compile(ast.Module(body=[fn], type_ignores=[]), "server.py", "exec"), namespace)
        payload = SimpleNamespace(model_dump=Mock(return_value={"name": "Camille"}))
        await namespace["update_me"](payload, {"id": "owner"})
        payload.model_dump.assert_called_once_with(exclude_unset=True)
        users.update_one.assert_awaited_once_with({"id": "owner"}, {"$set": {"name": "Camille"}})
