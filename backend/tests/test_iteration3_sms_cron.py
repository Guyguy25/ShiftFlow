"""Iteration 3 — backend availability + test-sms 200 handling + sms-stats + cron reminders."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or ""
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
BASE_URL = BASE_URL.rstrip("/")

# Read cron secret
CRON_SECRET = ""
with open("/app/backend/.env") as f:
    for line in f:
        if line.startswith("WEBHOOK_CRON_SECRET"):
            CRON_SECRET = line.split("=", 1)[1].strip().strip('"').strip("'")

ADMIN_EMAIL = "spartanblock4@gmail.com"
ADMIN_PASSWORD = "ShiftFlow2026!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# --- Backend up: no 5xx on public + auth endpoints ---
class TestBackendReachable:
    def test_root_ok(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        j = r.json()
        assert j.get("service") == "shiftflow"
        assert j.get("ok") is True

    @pytest.mark.parametrize("path", [
        "/api/config",
        "/api/auth/me",
        "/api/dashboard/summary",
        "/api/dashboard/sms-stats",
        "/api/notifications/recent",
        "/api/missions",
    ])
    def test_no_5xx(self, path):
        r = requests.get(f"{BASE_URL}{path}")
        assert r.status_code < 500, f"{path} returned {r.status_code}: {r.text[:200]}"
        # idealy 200 or 401
        assert r.status_code in (200, 401), f"{path} unexpected {r.status_code}"


# --- Authed endpoints ---
class TestAuthedEndpoints:
    def test_auth_me(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        j = r.json()
        assert j.get("email") == ADMIN_EMAIL

    def test_dashboard_summary(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dashboard/summary")
        assert r.status_code == 200

    def test_sms_stats_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dashboard/sms-stats")
        assert r.status_code == 200
        j = r.json()
        for k in ("sent_this_month", "sms_total", "demo_total", "invites_sent", "invites_responded", "response_rate"):
            assert k in j, f"missing {k} in sms-stats: {j}"

    def test_notifications_recent(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/notifications/recent")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --- test-sms: MUST return 200 even on Twilio failure ---
class TestTestSms:
    def test_test_sms_returns_200_not_502(self, admin_session):
        payload = {"to": "+33612345678"}
        r = admin_session.post(f"{BASE_URL}/api/notifications/test-sms", json=payload)
        # MUST NOT be 5xx (specifically 502)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:400]}"
        j = r.json()
        assert "success" in j
        # If Twilio trial => success=false with clear error
        if j.get("success") is False:
            err = (j.get("error") or "").lower()
            assert err, f"Empty error message: {j}"
            # allow either 'trial', 'verified', 'twilio', or 'demo' wording
        # channel should be present
        assert "channel" in j or "to" in j, f"Response missing channel/to: {j}"

    def test_test_sms_unauth(self):
        r = requests.post(f"{BASE_URL}/api/notifications/test-sms", json={"to": "+33612345678"})
        assert r.status_code == 401


# --- Cron reminders ---
class TestCronReminders:
    def test_cron_without_auth_401(self):
        r = requests.post(f"{BASE_URL}/api/cron/reminders")
        assert r.status_code == 401

    def test_cron_with_secret_200(self):
        webhook_id = f"test-{uuid.uuid4().hex[:10]}"
        headers = {
            "Authorization": f"Bearer {CRON_SECRET}",
            "X-Webhook-Id": webhook_id,
        }
        r = requests.post(f"{BASE_URL}/api/cron/reminders", headers=headers)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        j = r.json()
        assert j.get("ok") is True
        assert j.get("queued") is True or j.get("duplicate") is True

        # Idempotent: repeat same webhook id
        r2 = requests.post(f"{BASE_URL}/api/cron/reminders", headers=headers)
        assert r2.status_code == 200
        j2 = r2.json()
        assert j2.get("duplicate") is True, f"Expected duplicate=true, got {j2}"


# --- Profile update (regression) ---
class TestProfileUpdate:
    def test_put_auth_me(self, admin_session):
        # fetch current
        cur = admin_session.get(f"{BASE_URL}/api/auth/me").json()
        original_phone = cur.get("phone", "")
        new_phone = "+33600000001"
        r = admin_session.put(f"{BASE_URL}/api/auth/me", json={
            "name": cur.get("name") or "Admin",
            "agency_name": cur.get("agency_name") or "ShiftFlow",
            "phone": new_phone,
        })
        assert r.status_code == 200, r.text
        # verify persisted
        cur2 = admin_session.get(f"{BASE_URL}/api/auth/me").json()
        assert cur2.get("phone") == new_phone
        # restore
        admin_session.put(f"{BASE_URL}/api/auth/me", json={
            "name": cur.get("name") or "Admin",
            "agency_name": cur.get("agency_name") or "ShiftFlow",
            "phone": original_phone,
        })
