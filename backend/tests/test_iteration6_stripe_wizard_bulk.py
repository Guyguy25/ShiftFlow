"""Iteration 6 backend tests: Stripe reconnect, register wizard payload, bulk import, strict validations."""
import os
import re
import time
import uuid

import pytest
import requests
import stripe as stripe_lib
from dotenv import dotenv_values
from pymongo import MongoClient

FE = dotenv_values("/app/frontend/.env")
BE = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or FE.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "spartanblock4@gmail.com", "password": "ShiftFlow2026!"}
stripe_lib.api_key = BE["STRIPE_SECRET_KEY"]
EXPECTED_PRODUCT = BE["STRIPE_PRODUCT_ID"]

mongo = MongoClient(BE["MONGO_URL"].strip('"'))[BE["DB_NAME"].strip('"')]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code} {r.text[:300]}")
    return s


@pytest.fixture(scope="module")
def admin_id():
    return mongo.users.find_one({"email": ADMIN["email"]})["id"]


def _set_plan(uid, plan, extra=None):
    upd = {"plan": plan}
    if extra:
        upd.update(extra)
    mongo.users.update_one({"id": uid}, {"$set": upd})


# ---------------- Config / health ----------------
class TestConfig:
    def test_config_requires_auth(self):
        assert requests.get(f"{API}/config").status_code == 401

    def test_config_payload(self, admin):
        r = admin.get(f"{API}/config")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["twilio_ready"] is True
        assert d["twilio_from"] == BE["TWILIO_PHONE_NUMBER"].strip('"')
        assert d["default_country_code"] == "+33"

    def test_stripe_keys_are_real_account(self):
        acct = stripe_lib.Account.retrieve()
        assert acct.id == "acct_1NfUSOEElIPXa4JR", f"unexpected stripe account {acct.id}"
        assert BE["STRIPE_SECRET_KEY"].startswith("sk_live_")
        assert BE["STRIPE_PUBLISHABLE_KEY"].startswith("pk_live_")

    def test_product_and_price_exist(self):
        prices = stripe_lib.Price.list(lookup_keys=["shiftflow_pro_monthly"], active=True, limit=1).data
        assert prices, "lookup_key shiftflow_pro_monthly not found"
        p = prices[0]
        assert p.product == EXPECTED_PRODUCT
        assert p.unit_amount == 4900
        assert p.currency == "eur"
        assert p.recurring["interval"] == "month"


# ---------------- Stripe checkout ----------------
class TestCheckout:
    def test_checkout_creates_session_without_tax(self, admin, admin_id):
        r = admin.post(f"{API}/payments/checkout", json={
            "lookup_key": "shiftflow_pro_monthly", "origin_url": BASE_URL})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checkout_url"].startswith("https://checkout.stripe.com/")
        sid = d["session_id"]

        s = stripe_lib.checkout.Session.retrieve(sid, expand=["line_items"])
        assert s.mode == "subscription"
        assert s.amount_total == 4900
        assert s.currency == "eur"
        assert s.customer_email == ADMIN["email"]
        assert s.metadata["user_id"] == admin_id
        # No automatic tax
        at = s.get("automatic_tax") or {}
        assert at.get("enabled") in (False, None), f"automatic_tax enabled: {at}"
        assert s.get("total_details", {}).get("amount_tax", 0) == 0
        # custom text mentioning franchise en base
        ct = s.get("custom_text") or {}
        assert ct.get("submit") and "293 B" in ct["submit"]["message"], ct
        # attached to the user product
        price = s.line_items.data[0].price
        assert price.product == EXPECTED_PRODUCT

        # transaction persisted
        tx = mongo.payment_transactions.find_one({"session_id": sid})
        assert tx and tx["status"] == "initiated" and tx["amount"] == 4900

    def test_checkout_bad_lookup_key(self, admin):
        r = admin.post(f"{API}/payments/checkout", json={
            "lookup_key": "does_not_exist", "origin_url": BASE_URL})
        assert r.status_code == 400
        assert "Prix inconnu" in r.json()["detail"]

    def test_checkout_requires_auth(self):
        r = requests.post(f"{API}/payments/checkout", json={
            "lookup_key": "shiftflow_pro_monthly", "origin_url": BASE_URL})
        assert r.status_code == 401

    def test_status_unknown_session(self):
        r = requests.get(f"{API}/payments/status/cs_test_unknown_{uuid.uuid4().hex[:8]}")
        assert r.status_code == 404

    def test_webhook_rejects_invalid_signature(self):
        r = requests.post(f"{API}/stripe/webhook", data=b'{"type":"checkout.session.completed"}',
                          headers={"stripe-signature": "t=1,v1=bad"})
        assert r.status_code == 400
        assert "Invalid signature" in r.text


# ---------------- Register wizard payload ----------------
class TestRegisterWizard:
    created = []

    @classmethod
    def teardown_class(cls):
        for e in cls.created:
            mongo.users.delete_one({"email": e})

    def test_register_with_onboarding_answers(self):
        email = f"test_it6_{uuid.uuid4().hex[:8]}@example.com"
        self.created.append(email)
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "name": "TEST Wizard",
            "agency_name": "TEST Agency", "phone": "+33611223344",
            "onboarding_answers": {"team_size": "2-5", "monthly_missions": "5-15",
                                   "current_tool": "whatsapp", "main_pain": "TEST relances"},
        })
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["email"] == email
        assert u["onboarding_completed"] is True
        assert u.get("plan", "free") == "free"
        assert "password_hash" not in u and "_id" not in u

        doc = mongo.users.find_one({"email": email})
        assert doc["onboarding_completed"] is True
        assert doc["onboarding_answers"]["current_tool"] == "whatsapp"
        assert doc["onboarding_completed_at"]
        assert doc["password_hash"].startswith("$2b$")

        me = s.get(f"{API}/auth/me")
        assert me.status_code == 200 and me.json()["onboarding_completed"] is True

    def test_register_without_answers_not_onboarded(self):
        email = f"test_it6_noanswer_{uuid.uuid4().hex[:8]}@example.com"
        self.created.append(email)
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "name": "TEST NoAnswer",
            "agency_name": "TEST Agency", "phone": ""})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["onboarding_completed"] is False

    def test_register_duplicate_email(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": ADMIN["email"], "password": "Passw0rd!", "name": "x",
            "agency_name": "y", "phone": ""})
        assert r.status_code == 400

    def test_login_sets_httponly_cookie(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN)
        assert r.status_code == 200
        raw = r.headers.get("set-cookie", "")
        assert "HttpOnly" in raw, raw

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN["email"], "password": "wrong-pass"})
        assert r.status_code == 401


# ---------------- Strict worker validations ----------------
class TestWorkerValidations:
    base = {"first_name": "Jean", "last_name": "Dupont", "phone": "+33611223344", "email": ""}
    created = []

    @classmethod
    def teardown_class(cls):
        for wid in cls.created:
            mongo.workers.delete_one({"id": wid})

    def _post(self, admin, **over):
        body = {**self.base, **over}
        return admin.post(f"{API}/workers", json=body)

    def test_first_name_too_short(self, admin):
        r = self._post(admin, first_name="X")
        assert r.status_code == 422, r.text
        assert "at least 2 characters" in r.text

    def test_last_name_digits_rejected(self, admin):
        r = self._post(admin, last_name="D3upont")
        assert r.status_code == 422, r.text
        assert "2 à 40 lettres" in r.text

    def test_name_too_long(self, admin):
        r = self._post(admin, first_name="A" * 41)
        assert r.status_code == 422

    def test_phone_invalid(self, admin):
        r = self._post(admin, phone="abc")
        assert r.status_code == 422, r.text
        assert "Numéro de téléphone invalide" in r.text

    def test_phone_too_short(self, admin):
        r = self._post(admin, phone="0612")
        assert r.status_code == 422

    def test_email_invalid(self, admin):
        r = self._post(admin, email="not-an-email")
        assert r.status_code == 422, r.text
        assert "Email invalide" in r.text

    def test_accented_name_and_normalized_email_accepted(self, admin, admin_id):
        _set_plan(admin_id, "pro")
        try:
            r = self._post(admin, first_name="Émilie-Anne", last_name="O'Brien",
                           phone="06 12 34 56 99", email="TEST_Case@Example.COM")
            assert r.status_code == 200, r.text
            w = r.json()
            self.created.append(w["id"])
            assert w["email"] == "test_case@example.com"
            assert w["first_name"] == "Émilie-Anne"
            got = admin.get(f"{API}/workers")
            assert any(x["id"] == w["id"] for x in got.json())
        finally:
            _set_plan(admin_id, "free")


# ---------------- Bulk import ----------------
class TestBulkImport:
    created = []

    @classmethod
    def teardown_class(cls):
        for wid in cls.created:
            mongo.workers.delete_one({"id": wid})

    def test_bulk_empty_list(self, admin):
        r = admin.post(f"{API}/workers/bulk", json={"workers": []})
        assert r.status_code == 400
        assert "Liste vide" in r.text

    def test_bulk_requires_auth(self):
        r = requests.post(f"{API}/workers/bulk", json={"workers": []})
        assert r.status_code == 401

    def test_bulk_invalid_row_rejected_422(self, admin):
        r = admin.post(f"{API}/workers/bulk", json={"workers": [
            {"first_name": "Jean", "last_name": "Dupont", "phone": "+33611223301"},
            {"first_name": "X", "last_name": "Y", "phone": "abc"},
        ]})
        assert r.status_code == 422, r.text

    def test_bulk_creates_pro(self, admin, admin_id):
        _set_plan(admin_id, "pro")
        try:
            tag = uuid.uuid4().hex[:5]
            rows = [{"first_name": "TESTA", "last_name": f"Bulk{tag}", "phone": f"+3361100{i}{tag[:2]}"}
                    for i in range(3)]
            # unique phones (digits only, 8-15)
            rows = [{"first_name": "TESTA", "last_name": "Bulkun", "phone": "+33690000001"},
                    {"first_name": "TESTB", "last_name": "Bulkdeux", "phone": "+33690000002",
                     "email": "test_bulk2@example.com"},
                    {"first_name": "TESTC", "last_name": "Bulktrois", "phone": "0690000003"}]
            for r_ in rows:
                mongo.workers.delete_many({"agency_id": admin_id, "phone": r_["phone"]})
            r = admin.post(f"{API}/workers/bulk", json={"workers": rows})
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["created"] == 3, d
            assert d["skipped_quota"] == 0
            assert d["quota_hit"] is False
            assert d["limit"] is None
            for w in d["workers"]:
                self.created.append(w["id"])
                assert "_id" not in w
            # persistence
            listing = admin.get(f"{API}/workers").json()
            ids = {w["id"] for w in listing}
            assert all(w["id"] in ids for w in d["workers"])
        finally:
            _set_plan(admin_id, "free")

    def test_bulk_duplicate_phone_skipped(self, admin, admin_id):
        _set_plan(admin_id, "pro")
        try:
            row = {"first_name": "TESTDUP", "last_name": "Doublon", "phone": "+33690000009"}
            mongo.workers.delete_many({"agency_id": admin_id, "phone": row["phone"]})
            r1 = admin.post(f"{API}/workers/bulk", json={"workers": [row]})
            assert r1.json()["created"] == 1
            self.created.append(r1.json()["workers"][0]["id"])
            r2 = admin.post(f"{API}/workers/bulk", json={"workers": [row]})
            assert r2.status_code == 200
            assert r2.json()["created"] == 0, r2.text
        finally:
            _set_plan(admin_id, "free")

    def test_bulk_quota_hit_on_free(self, admin, admin_id):
        # admin free with 14+ workers > FREE limit 10
        before = mongo.workers.count_documents({"agency_id": admin_id})
        assert before >= 10, f"precondition: expected >=10 workers, got {before}"
        r = admin.post(f"{API}/workers/bulk", json={"workers": [
            {"first_name": "TESTQ", "last_name": "Quota", "phone": "+33690001111"}]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created"] == 0
        assert d["skipped_quota"] == 1
        assert d["quota_hit"] is True
        assert d["limit"] == 10
        assert mongo.workers.count_documents({"agency_id": admin_id}) == before


# ---------------- Freemium quota regression ----------------
class TestQuotaRegression:
    def test_quota_endpoint_free(self, admin, admin_id):
        r = admin.get(f"{API}/plan/quota")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["plan"] == "free"
        assert d["mission_limit"] == 1
        assert d["worker_limit"] == 10
        assert d["active_missions"] >= 1

    def test_create_mission_402_on_free_at_quota(self, admin):
        r = admin.post(f"{API}/missions", json={
            "name": "TEST_quota_mission", "client": "TEST", "location": "Paris",
            "shifts": [{"date": "2026-12-01", "start_time": "08:00", "end_time": "12:00",
                        "people_needed": 1, "rate_hourly": 15, "mission_type": "montage"}]})
        assert r.status_code == 402, r.text
        assert "detail" in r.json()

    def test_duplicate_mission_402_on_free_at_quota(self, admin):
        missions = admin.get(f"{API}/missions").json()
        assert missions
        mid = missions[0]["id"]
        before = len(missions)
        r = admin.post(f"{API}/missions/{mid}/duplicate")
        assert r.status_code == 402, r.text
        assert len(admin.get(f"{API}/missions").json()) == before

    def test_add_worker_402_on_free_at_quota(self, admin):
        r = admin.post(f"{API}/workers", json={
            "first_name": "TESTZ", "last_name": "Quota", "phone": "+33690002222"})
        assert r.status_code == 402, r.text


# ---------------- Core regression ----------------
class TestCoreRegression:
    def test_dashboard_summary(self, admin):
        r = admin.get(f"{API}/dashboard/summary")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "workers_count" in d or "upcoming" in d, d

    def test_dashboard_sms_stats(self, admin):
        r = admin.get(f"{API}/dashboard/sms-stats")
        assert r.status_code == 200, r.text
        assert "sent_this_month" in r.json()

    def test_missions_list_and_detail(self, admin):
        r = admin.get(f"{API}/missions")
        assert r.status_code == 200
        ms = r.json()
        assert ms and all("_id" not in m for m in ms)
        d = admin.get(f"{API}/missions/{ms[0]['id']}")
        assert d.status_code == 200
        assert "shifts" in d.json()

    def test_mission_404(self, admin, admin_id):
        _set_plan(admin_id, "pro")
        try:
            r = admin.get(f"{API}/missions/{uuid.uuid4()}")
            assert r.status_code == 404
        finally:
            _set_plan(admin_id, "free")

    def test_notifications_recent(self, admin):
        r = admin.get(f"{API}/notifications/recent")
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_public_mission_bad_token(self):
        r = requests.get(f"{API}/public/mission/badtoken123")
        assert r.status_code == 404


# ---------------- Webhook-driven upgrade (proxy for the E2E card payment,
# Stripe Checkout blocks headless automation with an anti-bot challenge) ----------------
class TestWebhookUpgrade:
    ui_email = "test_it6_ui_1787585374@example.com"
    ui_pass = "Passw0rd!"

    @pytest.fixture(scope="class")
    def ui_client(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": self.ui_email, "password": self.ui_pass})
        if r.status_code != 200:
            pytest.skip("UI test account missing (recreate via /register wizard)")
        return s

    @pytest.fixture(scope="class", autouse=True)
    def restore(self):
        yield
        uid = mongo.users.find_one({"email": self.ui_email})
        if uid:
            mongo.users.update_one({"id": uid["id"]}, {"$set": {"plan": "free"},
                "$unset": {"subscription_status": "", "stripe_subscription_id": ""}})

    def _signed_post(self, body: str):
        import hashlib, hmac
        secret = BE["STRIPE_WEBHOOK_SECRET"]
        ts = str(int(time.time()))
        sig = hmac.new(secret.encode(), f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
        return requests.post(f"{API}/stripe/webhook", data=body.encode(),
                             headers={"stripe-signature": f"t={ts},v1={sig}",
                                      "Content-Type": "application/json"})

    def test_checkout_completed_upgrades_user(self, ui_client):
        import json
        u = mongo.users.find_one({"email": self.ui_email})
        r = ui_client.post(f"{API}/payments/checkout", json={
            "lookup_key": "shiftflow_pro_monthly", "origin_url": BASE_URL})
        assert r.status_code == 200, r.text
        sid = r.json()["session_id"]

        body = json.dumps({
            "id": "evt_test_it6", "type": "checkout.session.completed",
            "data": {"object": {"id": sid, "payment_status": "paid",
                                "customer": "cus_TEST_it6", "subscription": "sub_TEST_it6",
                                "metadata": {"user_id": u["id"]}}},
        })
        resp = self._signed_post(body)
        assert resp.status_code == 200, resp.text

        tx = mongo.payment_transactions.find_one({"session_id": sid})
        assert tx["payment_status"] == "paid" and tx["status"] == "completed"
        after = mongo.users.find_one({"id": u["id"]})
        assert after["plan"] == "pro"
        assert after["subscription_status"] == "active"
        assert after["stripe_customer_id"] == "cus_TEST_it6"

        # /api/auth/me and quota reflect pro
        me = ui_client.get(f"{API}/auth/me").json()
        assert me["plan"] == "pro"
        q = ui_client.get(f"{API}/plan/quota").json()
        assert q["plan"] == "pro" and q["mission_limit"] is None

        # payment status endpoint returns paid (used by /payment/success polling)
        st = requests.get(f"{API}/payments/status/{sid}").json()
        assert st["payment_status"] == "paid"

        # pro user can now create a 2nd mission
        cm = ui_client.post(f"{API}/missions", json={
            "name": "TEST_it6_pro_mission", "client": "TEST", "location": "Paris",
            "shifts": [{"date": "2026-12-05", "start_time": "08:00", "end_time": "12:00",
                        "people_needed": 1, "rate_hourly": 15, "mission_type": "montage"}]})
        assert cm.status_code == 200, cm.text
        mongo.missions.delete_one({"id": cm.json()["id"]})

    def test_subscription_deleted_downgrades(self):
        import json
        body = json.dumps({
            "id": "evt_test_it6_del", "type": "customer.subscription.deleted",
            "data": {"object": {"id": "sub_TEST_it6", "customer": "cus_TEST_it6"}},
        })
        resp = self._signed_post(body)
        assert resp.status_code == 200, resp.text
        u = mongo.users.find_one({"email": self.ui_email})
        assert u["plan"] == "free"
        assert u["subscription_status"] == "canceled"
