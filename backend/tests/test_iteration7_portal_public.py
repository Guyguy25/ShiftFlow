"""Iteration 7 — regression tests for the fixes reported in iteration_6.json.

Covers:
- POST /api/payments/portal : 400 (no customer) / 409 + unset stale customer / 200 for a valid pro customer
- GET /api/public/mission/{token} : legacy slot without shift_id -> 404 'Lien invalide'
- General regression: auth, missions, workers, dashboard, settings, calendar, history
"""
import os
import re
import time
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")

LEGACY_TOKEN = "_IYTBBCfmq1H2y4PpVsLY1lYESTVm1E-"


@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session")
def creds():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("missing test_credentials.md")
    c = p.read_text()
    email = re.search(r"(?im)^\s*-?\s*Email:\s*`?([^`\s]+)", c)
    pwd = re.search(r"(?im)^\s*-?\s*Password:\s*`?([^`\s]+)", c)
    if not email or not pwd:
        pytest.skip("no creds found")
    return {"email": email.group(1), "password": pwd.group(1)}


@pytest.fixture(scope="session")
def admin_client(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    return s


@pytest.fixture(scope="session")
def admin_user(admin_client):
    r = admin_client.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- Auth / health ----------------
class TestAuthBasics:
    def test_login_sets_httponly_cookie(self, creds):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=creds, timeout=30)
        assert r.status_code == 200
        assert any("httponly" in h.lower() for h in r.headers.get("set-cookie", "").split(";")) or any(
            c.has_nonstandard_attr("HttpOnly") or c.has_nonstandard_attr("httponly") for c in s.cookies
        )
        me = s.get(f"{API}/auth/me", timeout=30)
        assert me.status_code == 200
        assert me.json()["email"] == creds["email"]
        assert "_id" not in me.json()

    def test_login_bad_password(self, creds):
        r = requests.post(f"{API}/auth/login", json={"email": creds["email"], "password": "wrong-pass-xyz"}, timeout=30)
        assert r.status_code in (401, 403, 429)

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code in (401, 403)

    def test_password_hash_is_bcrypt_2b(self, mongo, creds):
        u = mongo.users.find_one({"email": creds["email"]})
        assert u is not None
        assert u["password_hash"].startswith("$2b$"), u["password_hash"][:10]


# ---------------- BUG HIGH: billing portal ----------------
class TestBillingPortal:
    def test_portal_free_user_no_customer_returns_400(self, admin_client, admin_user, mongo):
        uid = admin_user["id"]
        before = mongo.users.find_one({"id": uid}, {"stripe_customer_id": 1, "plan": 1})
        mongo.users.update_one({"id": uid}, {"$set": {"stripe_customer_id": None, "plan": "free"}})
        try:
            r = admin_client.post(f"{API}/payments/portal", timeout=45)
            assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:300]}"
            assert "Aucun abonnement actif" in r.json().get("detail", "")
        finally:
            mongo.users.update_one({"id": uid}, {"$set": {
                "stripe_customer_id": before.get("stripe_customer_id"),
                "plan": before.get("plan", "free"),
            }})

    def test_portal_invalid_customer_returns_409_and_unsets(self, admin_client, admin_user, mongo):
        uid = admin_user["id"]
        before = mongo.users.find_one({"id": uid}, {"stripe_customer_id": 1, "plan": 1, "stripe_subscription_id": 1})
        mongo.users.update_one({"id": uid}, {"$set": {
            "stripe_customer_id": "cus_V6pJBuEk7xFA69",  # stale customer from old Stripe account
            "plan": "pro",
            "subscription_status": "active",
        }})
        try:
            r = admin_client.post(f"{API}/payments/portal", timeout=60)
            assert r.status_code == 409, f"expected 409 got {r.status_code}: {r.text[:400]}"
            detail = r.json().get("detail", "")
            assert "Stripe" in detail and "plus valide" in detail, detail
            # verify the stale customer id was unset in DB and plan back to free
            u = mongo.users.find_one({"id": uid}, {"_id": 0})
            assert u.get("stripe_customer_id") in (None, ""), u.get("stripe_customer_id")
            assert u.get("plan") == "free", u.get("plan")
        finally:
            mongo.users.update_one({"id": uid}, {"$set": {
                "stripe_customer_id": before.get("stripe_customer_id"),
                "plan": before.get("plan", "free"),
            }})

    def test_portal_valid_pro_customer_returns_billing_url(self, admin_client, admin_user, mongo):
        """Create a real Stripe test customer, attach it, expect a billing.stripe.com URL."""
        import stripe as stripe_lib
        stripe_lib.api_key = backend_env.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_SECRET_KEY")
        if not stripe_lib.api_key:
            pytest.skip("no STRIPE_SECRET_KEY")
        uid = admin_user["id"]
        before = mongo.users.find_one({"id": uid}, {"stripe_customer_id": 1, "plan": 1})
        cust = stripe_lib.Customer.create(email="TEST_portal_it7@example.com", name="TEST portal it7")
        mongo.users.update_one({"id": uid}, {"$set": {
            "stripe_customer_id": cust.id, "plan": "pro", "subscription_status": "active"}})
        try:
            r = admin_client.post(f"{API}/payments/portal", timeout=60)
            assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text[:400]}"
            url = r.json().get("url", "")
            assert "billing.stripe.com" in url, url
        finally:
            mongo.users.update_one({"id": uid}, {"$set": {
                "stripe_customer_id": before.get("stripe_customer_id"),
                "plan": before.get("plan", "free"),
            }})
            try:
                stripe_lib.Customer.delete(cust.id)
            except Exception:
                pass

    def test_portal_requires_auth(self):
        r = requests.post(f"{API}/payments/portal", timeout=30)
        assert r.status_code in (401, 403)


# ---------------- BUG MINOR: public mission legacy slot ----------------
class TestPublicMission:
    def test_legacy_slot_without_shift_id_returns_404(self, mongo):
        slot = mongo.mission_workers.find_one({"token": LEGACY_TOKEN})
        if slot is None:
            pytest.skip("legacy slot token not present in DB")
        assert "shift_id" not in slot or not slot.get("shift_id")
        r = requests.get(f"{API}/public/mission/{LEGACY_TOKEN}", timeout=30)
        assert r.status_code == 404, f"expected 404 got {r.status_code}: {r.text[:300]}"
        assert r.json().get("detail") == "Lien invalide"

    def test_unknown_token_returns_404(self):
        r = requests.get(f"{API}/public/mission/does-not-exist-xyz", timeout=30)
        assert r.status_code == 404
        assert r.json().get("detail") == "Lien invalide"

    def test_valid_token_returns_payload(self, mongo):
        slot = mongo.mission_workers.find_one({"shift_id": {"$exists": True, "$ne": None}, "token": {"$ne": None}})
        if not slot:
            pytest.skip("no valid slot in DB")
        r = requests.get(f"{API}/public/mission/{slot['token']}", timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ("slot", "shift", "mission", "worker", "agency"):
            assert k in d, f"missing {k}"
        assert "\"_id\"" not in str(d)
        assert d["shift"]["date"] and d["mission"]["name"]

    def test_all_existing_tokens_no_500(self, mongo):
        tokens = [s["token"] for s in mongo.mission_workers.find({"token": {"$ne": None}}, {"token": 1}).limit(60)]
        failures = []
        for t in tokens:
            r = requests.get(f"{API}/public/mission/{t}", timeout=30)
            if r.status_code >= 500:
                failures.append((t, r.status_code))
        assert not failures, f"5xx on tokens: {failures}"


# ---------------- Regression: core read endpoints ----------------
class TestCoreRegression:
    @pytest.mark.parametrize("path", [
        "/dashboard/summary",
        "/dashboard/sms-stats",
        "/missions",
        "/workers",
        "/plan/quota",
        "/onboarding/status",
        "/notifications/recent",
        "/config",
    ])
    def test_read_endpoints_ok(self, admin_client, path):
        r = admin_client.get(f"{API}{path}", timeout=45)
        assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text[:300]}"
        assert '"_id"' not in r.text

    def test_read_endpoints_require_auth(self):
        for path in ["/dashboard/summary", "/missions", "/workers", "/plan/quota"]:
            r = requests.get(f"{API}{path}", timeout=30)
            assert r.status_code in (401, 403), f"{path} -> {r.status_code}"


class TestWorkersCrud:
    def test_worker_create_get_update_delete(self, admin_client):
        phone = "06" + str(int(time.time()))[-8:]
        payload = {"first_name": "Testseven", "last_name": "Regression", "phone": phone,
                   "email": "testit7@example.com"}
        r = admin_client.post(f"{API}/workers", json=payload, timeout=45)
        if r.status_code == 402:
            pytest.skip("admin at free worker quota")
        assert r.status_code in (200, 201), r.text[:400]
        w = r.json()
        wid = w["id"]
        assert w["first_name"] == "Testseven"
        assert "_id" not in w
        try:
            lst = admin_client.get(f"{API}/workers", timeout=45).json()
            assert any(x["id"] == wid for x in lst)
            up = admin_client.put(f"{API}/workers/{wid}", json={**payload, "last_name": "Updated"}, timeout=45)
            assert up.status_code == 200, up.text[:300]
            lst2 = admin_client.get(f"{API}/workers", timeout=45).json()
            assert next(x for x in lst2 if x["id"] == wid)["last_name"] == "Updated"
        finally:
            d = admin_client.delete(f"{API}/workers/{wid}", timeout=45)
            assert d.status_code in (200, 204)
            lst3 = admin_client.get(f"{API}/workers", timeout=45).json()
            assert not any(x["id"] == wid for x in lst3)

    def test_worker_invalid_payload_422(self, admin_client):
        r = admin_client.post(f"{API}/workers", json={"first_name": "A1", "last_name": "B", "phone": "123"}, timeout=45)
        assert r.status_code in (400, 422), r.status_code
