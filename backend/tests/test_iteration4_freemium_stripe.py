"""Iteration 4 — Onboarding / Freemium quotas / Stripe checkout & portal."""
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = backend_env.get("MONGO_URL")
DB_NAME = backend_env.get("DB_NAME")


@pytest.fixture(scope="session")
def test_credentials():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("missing test_credentials.md")
    c = p.read_text(encoding="utf-8")
    e = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    if not e or not pw:
        pytest.skip("no creds parsed")
    return {"email": e.group(1), "password": pw.group(1)}


@pytest.fixture(scope="session")
def client(test_credentials):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=test_credentials, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code} {r.text[:300]}")
    tok = r.json().get("access_token")
    if not tok:
        pytest.fail("no access_token in login response")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    s.login_body = r.json()
    return s


def _set_user_fields(email, fields):
    """Directly patch mongo user doc (used to simulate a Pro plan)."""
    from pymongo import MongoClient
    mc = MongoClient(MONGO_URL)
    mc[DB_NAME].users.update_one({"email": email.lower()}, {"$set": fields})
    mc.close()


def _unset_user_fields(email, fields):
    from pymongo import MongoClient
    mc = MongoClient(MONGO_URL)
    mc[DB_NAME].users.update_one({"email": email.lower()}, {"$unset": {f: "" for f in fields}})
    mc.close()


# ---------------- auth/me exposes plan info ----------------
class TestAuthMePlan:
    def test_login_payload_has_plan(self, client):
        u = client.login_body["user"]
        assert "plan" in u and "onboarding_completed" in u
        assert "subscription_status" in u
        assert "password_hash" not in u and "_id" not in u

    def test_me_exposes_plan(self, client):
        r = client.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["plan"] in ("free", "pro")
        assert isinstance(d["onboarding_completed"], bool)
        assert "subscription_status" in d
        assert "_id" not in d

    def test_me_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 401


# ---------------- Onboarding ----------------
class TestOnboarding:
    def test_status_flag(self, client):
        r = client.get(f"{BASE_URL}/api/onboarding/status", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json()["completed"], bool)

    def test_submit_sets_completed(self, client):
        payload = {"team_size": "2-5", "monthly_missions": "5-15",
                   "current_tool": "whatsapp", "main_pain": "TEST_relances manuelles"}
        r = client.post(f"{BASE_URL}/api/onboarding", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        assert client.get(f"{BASE_URL}/api/onboarding/status", timeout=30).json()["completed"] is True
        assert client.get(f"{BASE_URL}/api/auth/me", timeout=30).json()["onboarding_completed"] is True

    def test_submit_validation(self, client):
        r = client.post(f"{BASE_URL}/api/onboarding", json={"team_size": "2-5"}, timeout=30)
        assert r.status_code == 422

    def test_submit_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/onboarding", json={
            "team_size": "a", "monthly_missions": "b", "current_tool": "c", "main_pain": "d"}, timeout=30)
        assert r.status_code == 401


# ---------------- Plan quota ----------------
class TestQuota:
    def test_quota_shape_free(self, client):
        r = client.get(f"{BASE_URL}/api/plan/quota", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("plan", "active_missions", "mission_limit", "workers", "worker_limit", "subscription_status"):
            assert k in d, f"missing {k}"
        assert d["plan"] == "free"
        assert d["mission_limit"] == 1
        assert d["worker_limit"] == 10
        assert isinstance(d["active_missions"], int) and d["active_missions"] >= 1
        assert isinstance(d["workers"], int) and d["workers"] >= 10

    def test_quota_requires_auth(self):
        assert requests.get(f"{BASE_URL}/api/plan/quota", timeout=30).status_code == 401


# ---------------- Freemium 402 blocks ----------------
MISSION_PAYLOAD = {
    "name": "TEST_freemium_mission", "location": "Lille", "address": "1 rue test",
    "description": "test", "cascade_enabled": True, "followup_hours": 2,
    "shifts": [{"date": "2026-12-01", "start_time": "08:00", "end_time": "12:00",
                "people_needed": 2, "rate_hourly": 15, "mission_type": "montage"}],
}
WORKER_PAYLOAD = {"first_name": "TEST_Free", "last_name": "Quota", "phone": "0600000999",
                  "email": "", "skills": ["montage"], "note": "", "active": True}


class TestFreemiumBlocks:
    def test_post_mission_blocked_402(self, client):
        r = client.post(f"{BASE_URL}/api/missions", json=MISSION_PAYLOAD, timeout=60)
        assert r.status_code == 402, f"expected 402 got {r.status_code} {r.text[:300]}"
        detail = r.json().get("detail", "")
        assert "gratuit" in detail.lower() and "Pro" in detail

    def test_post_worker_blocked_402(self, client):
        r = client.post(f"{BASE_URL}/api/workers", json=WORKER_PAYLOAD, timeout=60)
        assert r.status_code == 402, f"expected 402 got {r.status_code} {r.text[:300]}"
        assert "gratuit" in r.json().get("detail", "").lower()

    def test_no_leaked_mission_created(self, client):
        ms = client.get(f"{BASE_URL}/api/missions", timeout=60).json()
        assert not [m for m in ms if m["name"] == "TEST_freemium_mission"]


# ---------------- Pro plan bypass ----------------
class TestProBypass:
    created = {"mission": None, "worker": None}

    @pytest.fixture(scope="class", autouse=True)
    def as_pro(self, client, test_credentials):
        _set_user_fields(test_credentials["email"], {"plan": "pro", "subscription_status": "active"})
        yield
        # cleanup created docs then restore free plan
        if self.created["mission"]:
            client.delete(f"{BASE_URL}/api/missions/{self.created['mission']}", timeout=60)
        if self.created["worker"]:
            client.delete(f"{BASE_URL}/api/workers/{self.created['worker']}", timeout=60)
        _set_user_fields(test_credentials["email"], {"plan": "free"})
        _unset_user_fields(test_credentials["email"], ["subscription_status"])

    def test_quota_pro_unlimited(self, client):
        d = client.get(f"{BASE_URL}/api/plan/quota", timeout=30).json()
        assert d["plan"] == "pro"
        assert d["mission_limit"] is None and d["worker_limit"] is None
        assert d["subscription_status"] == "active"

    def test_pro_can_create_mission(self, client):
        r = client.post(f"{BASE_URL}/api/missions", json=MISSION_PAYLOAD, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        m = r.json()
        TestProBypass.created["mission"] = m["id"]
        got = client.get(f"{BASE_URL}/api/missions/{m['id']}", timeout=60)
        assert got.status_code == 200
        assert got.json()["name"] == "TEST_freemium_mission"
        assert len(got.json()["shifts"]) == 1

    def test_pro_can_create_worker(self, client):
        r = client.post(f"{BASE_URL}/api/workers", json=WORKER_PAYLOAD, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        w = r.json()
        TestProBypass.created["worker"] = w["id"]
        assert w["first_name"] == "TEST_Free"
        ws = client.get(f"{BASE_URL}/api/workers", timeout=60).json()
        assert any(x["id"] == w["id"] for x in ws)


# ---------------- Stripe checkout ----------------
class TestStripeCheckout:
    sessions = []

    @pytest.mark.parametrize("lookup_key,expected_amount", [
        ("shiftflow_pro_monthly", 4900),
        ("shiftflow_pro_yearly", 48800),
    ])
    def test_checkout_creates_session(self, client, lookup_key, expected_amount):
        r = client.post(f"{BASE_URL}/api/payments/checkout",
                        json={"lookup_key": lookup_key, "origin_url": BASE_URL}, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:500]}"
        d = r.json()
        assert d["checkout_url"].startswith("https://checkout.stripe.com"), d["checkout_url"]
        assert d["session_id"].startswith("cs_")
        TestStripeCheckout.sessions.append((d["session_id"], expected_amount))

    def test_transaction_persisted(self, client):
        assert TestStripeCheckout.sessions, "no session created"
        from pymongo import MongoClient
        mc = MongoClient(MONGO_URL)
        try:
            for sid, amount in TestStripeCheckout.sessions:
                doc = mc[DB_NAME].payment_transactions.find_one({"session_id": sid})
                assert doc, f"no payment_transactions doc for {sid}"
                assert doc["status"] == "initiated"
                assert doc["payment_status"] == "pending"
                assert doc["amount"] == amount, f"amount {doc['amount']} != {amount}"
                assert doc["currency"] == "eur"
        finally:
            mc.close()

    def test_status_endpoint_no_auth(self):
        sid = TestStripeCheckout.sessions[0][0]
        r = requests.get(f"{BASE_URL}/api/payments/status/{sid}", timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["session_id"] == sid
        assert d["status"] in ("initiated", "completed", "expired")
        assert d["payment_status"] in ("pending", "paid", "unpaid", "expired")

    def test_status_unknown_session_404(self):
        r = requests.get(f"{BASE_URL}/api/payments/status/cs_test_DOESNOTEXIST", timeout=60)
        assert r.status_code == 404

    def test_checkout_bad_lookup_key(self, client):
        r = client.post(f"{BASE_URL}/api/payments/checkout",
                        json={"lookup_key": "TEST_nope", "origin_url": BASE_URL}, timeout=60)
        assert r.status_code == 400, r.text

    def test_checkout_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/payments/checkout",
                          json={"lookup_key": "shiftflow_pro_monthly", "origin_url": BASE_URL}, timeout=60)
        assert r.status_code == 401


# ---------------- Webhook security ----------------
class TestWebhook:
    def test_invalid_signature_400(self):
        r = requests.post(f"{BASE_URL}/api/stripe/webhook",
                          data=b'{"type":"checkout.session.completed","data":{"object":{"id":"cs_x"}}}',
                          headers={"stripe-signature": "t=1,v1=deadbeef",
                                   "Content-Type": "application/json"}, timeout=30)
        assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"

    def test_missing_signature_400(self):
        r = requests.post(f"{BASE_URL}/api/stripe/webhook", data=b'{}', timeout=30)
        assert r.status_code == 400


# ---------------- Billing portal ----------------
class TestPortal:
    def test_portal(self, client):
        """400 'Aucun abonnement actif' when no stripe_customer_id, else a billing portal URL."""
        r = client.post(f"{BASE_URL}/api/payments/portal", json={}, timeout=60)
        assert r.status_code in (200, 400), f"{r.status_code} {r.text[:300]}"
        if r.status_code == 400:
            assert "Aucun abonnement actif" in r.json().get("detail", "")
        else:
            assert r.json()["url"].startswith("https://billing.stripe.com")

    def test_portal_requires_auth(self):
        assert requests.post(f"{BASE_URL}/api/payments/portal", json={}, timeout=30).status_code == 401


# ---------------- Regression on core endpoints ----------------
class TestRegression:
    @pytest.mark.parametrize("path", [
        "/api/", "/api/workers", "/api/missions", "/api/config",
        "/api/notifications/recent", "/api/dashboard/stats",
    ])
    def test_get_endpoints_ok(self, client, path):
        r = client.get(f"{BASE_URL}{path}", timeout=60)
        assert r.status_code in (200, 404), f"{path} -> {r.status_code} {r.text[:200]}"
        if r.status_code == 200:
            assert '"_id"' not in r.text
