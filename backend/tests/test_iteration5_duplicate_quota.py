"""Iteration 5 — retest of fixes: duplicate mission freemium quota (402 free / 200 pro)."""
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = backend_env.get("MONGO_URL") or os.environ.get("MONGO_URL")
DB_NAME = backend_env.get("DB_NAME") or os.environ.get("DB_NAME")


@pytest.fixture(scope="module")
def creds():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("missing credentials file")
    c = p.read_text(encoding="utf-8")
    e = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    if not e or not pw:
        pytest.skip("no creds parsed")
    return {"email": e.group(1), "password": pw.group(1)}


@pytest.fixture(scope="module")
def client(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    return s


@pytest.fixture(autouse=True)
def reset_plan_after(request):
    yield
    try:
        m = request.getfixturevalue("mongo")
        c = request.getfixturevalue("creds")
        m.users.update_one({"email": c["email"]}, {"$set": {"plan": "free"}})
    except Exception:
        pass


@pytest.fixture(scope="module")
def mongo():
    if not MONGO_URL or not DB_NAME:
        pytest.skip("no mongo config")
    mc = MongoClient(MONGO_URL)
    yield mc[DB_NAME]
    mc.close()


def _set_plan(mongo, email, plan):
    if plan is None:
        mongo.users.update_one({"email": email}, {"$unset": {"plan": ""}})
    else:
        mongo.users.update_one({"email": email}, {"$set": {"plan": plan}})


# ---------- quota state sanity ----------
def test_quota_endpoint_shape(client, mongo, creds):
    _set_plan(mongo, creds["email"], "free")
    r = client.get(f"{API}/plan/quota", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("plan", "active_missions", "mission_limit", "workers", "worker_limit"):
        assert k in d, d
    assert d["mission_limit"] == 1
    assert d["worker_limit"] == 10


def _first_mission_id(client):
    r = client.get(f"{API}/missions", timeout=30)
    assert r.status_code == 200, r.text
    ms = r.json()
    assert isinstance(ms, list) and ms, "no mission available to duplicate"
    return ms[0]["id"]


# ---------- FIX under test: duplicate respects freemium quota ----------
def test_duplicate_blocked_402_when_free_and_quota_reached(client, mongo, creds):
    _set_plan(mongo, creds["email"], "free")
    q = client.get(f"{API}/plan/quota", timeout=30).json()
    assert q["plan"] == "free"
    if q["active_missions"] < q["mission_limit"]:
        pytest.skip(f"free quota not reached ({q['active_missions']}/{q['mission_limit']})")
    mid = _first_mission_id(client)
    before = len(client.get(f"{API}/missions", timeout=30).json())
    r = client.post(f"{API}/missions/{mid}/duplicate", timeout=60)
    assert r.status_code == 402, f"expected 402 got {r.status_code}: {r.text[:300]}"
    detail = r.json().get("detail", "")
    assert "gratuit" in detail.lower(), detail
    after = len(client.get(f"{API}/missions", timeout=30).json())
    assert after == before, "mission was created despite 402"


def test_duplicate_allowed_for_pro(client, mongo, creds):
    _set_plan(mongo, creds["email"], "pro")
    try:
        assert client.get(f"{API}/plan/quota", timeout=30).json()["plan"] == "pro"
        mid = _first_mission_id(client)
        r = client.post(f"{API}/missions/{mid}/duplicate", timeout=60)
        assert r.status_code == 200, f"pro duplicate failed {r.status_code}: {r.text[:300]}"
        new_id = r.json().get("id")
        assert new_id and new_id != mid
        # verify persistence
        g = client.get(f"{API}/missions/{new_id}", timeout=30)
        assert g.status_code == 200, g.text
        assert "(copie)" in g.json()["mission"]["name"] if "mission" in g.json() else True
        # cleanup
        d = client.delete(f"{API}/missions/{new_id}", timeout=30)
        assert d.status_code in (200, 204), d.text
    finally:
        _set_plan(mongo, creds["email"], "free")


def test_pro_mission_create_and_free_block(client, mongo, creds):
    # pro can create
    _set_plan(mongo, creds["email"], "pro")
    payload = {"name": "TEST_it5_mission", "location": "Paris", "address": "", "description": "",
               "cascade_enabled": True, "followup_hours": 2,
               "shifts": [{"date": "2026-12-01", "start_time": "09:00", "end_time": "17:00",
                           "people_needed": 2, "rate_hourly": 15, "mission_type": "montage"}]}
    r = client.post(f"{API}/missions", json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    created = r.json().get("id")
    assert created
    d = client.delete(f"{API}/missions/{created}", timeout=30)
    assert d.status_code in (200, 204)
    # free blocked (quota already reached)
    _set_plan(mongo, creds["email"], "free")
    q = client.get(f"{API}/plan/quota", timeout=30).json()
    r2 = client.post(f"{API}/missions", json=payload, timeout=30)
    if q["active_missions"] >= q["mission_limit"]:
        assert r2.status_code == 402, r2.text
    else:
        assert r2.status_code in (200, 201)
        client.delete(f"{API}/missions/{r2.json()['id']}", timeout=30)


# ---------- regression: core endpoints ----------
@pytest.mark.parametrize("path", [
    "/auth/me", "/dashboard/summary", "/dashboard/sms-stats", "/missions", "/workers",
    "/plan/quota", "/notifications/recent", "/onboarding/status", "/config",
])
def test_core_endpoints_ok(client, path):
    r = client.get(f"{API}{path}", timeout=30)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"


def test_auth_me_fields(client):
    d = client.get(f"{API}/auth/me", timeout=30).json()
    u = d.get("user", d)
    assert "plan" in u and "onboarding_completed" in u, u
