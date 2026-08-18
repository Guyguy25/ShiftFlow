"""ShiftFlow backend tests — iteration 2 (Mission -> Shifts -> Slots)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback: read frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "spartanblock4@gmail.com"
ADMIN_PASSWORD = "ShiftFlow2026!"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    token = r.json().get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def worker_ids(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/workers")
    assert r.status_code == 200
    workers = r.json()
    assert len(workers) >= 6, f"Need >=6 workers, got {len(workers)}"
    return [w["id"] for w in workers]


def _mission_payload(name_suffix="", people1=2, people2=2, cascade=True):
    return {
        "name": f"TEST_Mission_{name_suffix or uuid.uuid4().hex[:6]}",
        "location": "Paris Expo",
        "address": "Porte de Versailles",
        "description": "Test mission",
        "cascade_enabled": cascade,
        "followup_hours": 2,
        "shifts": [
            {"date": "2026-10-01", "start_time": "08:00", "end_time": "12:00",
             "people_needed": people1, "rate_hourly": 20, "mission_type": "montage",
             "skill_required": "", "description": "Shift 1"},
            {"date": "2026-10-02", "start_time": "18:00", "end_time": "23:00",
             "people_needed": people2, "rate_hourly": 25, "mission_type": "demontage",
             "skill_required": "", "description": "Shift 2"},
        ],
    }


# ---------------- Auth ----------------
class TestAuth:
    def test_login_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_login_bad(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "bad"})
        assert r.status_code == 401


# ---------------- Config / Notifications ----------------
class TestConfig:
    def test_config(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/config")
        assert r.status_code == 200
        j = r.json()
        assert j["twilio_ready"] is False
        assert j["default_country_code"] == "+33"

    def test_notifications_recent(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/notifications/recent")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- Missions with new schema ----------------
class TestMissionSchema:
    def test_create_mission_with_shifts_and_estimated_cost(self, admin_session):
        payload = _mission_payload("create")
        r = admin_session.post(f"{BASE_URL}/api/missions", json=payload)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["name"] == payload["name"]
        assert len(m["shifts"]) == 2
        # estimated_cost = hours * rate * people
        # shift1: 4h * 20 * 2 = 160.0
        # shift2: 5h * 25 * 2 = 250.0
        costs = sorted(sh["estimated_cost"] for sh in m["shifts"])
        assert costs == [160.0, 250.0], f"Got {costs}"
        assert m["total_needed"] == 4
        assert m["first_date"] == "2026-10-01"
        assert m["last_date"] == "2026-10-02"
        # cleanup
        admin_session.delete(f"{BASE_URL}/api/missions/{m['id']}")

    def test_get_mission_includes_slots_and_aggregates(self, admin_session):
        payload = _mission_payload("get")
        m = admin_session.post(f"{BASE_URL}/api/missions", json=payload).json()
        r = admin_session.get(f"{BASE_URL}/api/missions/{m['id']}")
        assert r.status_code == 200
        m2 = r.json()
        assert "shifts" in m2 and len(m2["shifts"]) == 2
        for sh in m2["shifts"]:
            assert "slots" in sh
            assert sh["slots"] == []
        assert m2["total_needed"] == 4
        assert m2["total_confirmed"] == 0
        admin_session.delete(f"{BASE_URL}/api/missions/{m['id']}")

    def test_overnight_estimate(self, admin_session):
        """22:00 -> 06:00 should compute 8h."""
        p = _mission_payload("overnight")
        p["shifts"] = [{"date": "2026-10-05", "start_time": "22:00", "end_time": "06:00",
                        "people_needed": 3, "rate_hourly": 10, "mission_type": "montage",
                        "skill_required": "", "description": ""}]
        m = admin_session.post(f"{BASE_URL}/api/missions", json=p).json()
        assert m["shifts"][0]["estimated_cost"] == 8 * 10 * 3
        admin_session.delete(f"{BASE_URL}/api/missions/{m['id']}")


# ---------------- Shift-level select-workers + cascade ----------------
class TestShiftCascade:
    def test_select_workers_shift_level(self, admin_session, worker_ids):
        payload = _mission_payload("cascade", people1=2, people2=2)
        m = admin_session.post(f"{BASE_URL}/api/missions", json=payload).json()
        shift1_id = m["shifts"][0]["id"]
        # send 4 workers; first 2 -> contacted, next 2 -> pending
        r = admin_session.post(f"{BASE_URL}/api/shifts/{shift1_id}/select-workers",
                               json={"worker_ids": worker_ids[:4]})
        assert r.status_code == 200, r.text
        assert r.json()["slots_created"] == 4
        # re-fetch
        m2 = admin_session.get(f"{BASE_URL}/api/missions/{m['id']}").json()
        sh1 = next(s for s in m2["shifts"] if s["id"] == shift1_id)
        statuses = [s["status"] for s in sh1["slots"]]
        assert statuses[:2] == ["contacted", "contacted"]
        assert statuses[2:] == ["pending", "pending"]
        admin_session.delete(f"{BASE_URL}/api/missions/{m['id']}")

    def test_cascade_isolated_per_shift(self, admin_session, worker_ids):
        payload = _mission_payload("iso", people1=1, people2=1)
        m = admin_session.post(f"{BASE_URL}/api/missions", json=payload).json()
        sh1 = m["shifts"][0]["id"]
        sh2 = m["shifts"][1]["id"]
        # Fill shift1 with 3 workers (need 1) and shift2 with 3 workers (need 1)
        admin_session.post(f"{BASE_URL}/api/shifts/{sh1}/select-workers",
                           json={"worker_ids": worker_ids[:3]})
        admin_session.post(f"{BASE_URL}/api/shifts/{sh2}/select-workers",
                           json={"worker_ids": worker_ids[3:6]})
        # get slots for shift1 - first is contacted
        m2 = admin_session.get(f"{BASE_URL}/api/missions/{m['id']}").json()
        sh1_data = next(s for s in m2["shifts"] if s["id"] == sh1)
        sh2_data = next(s for s in m2["shifts"] if s["id"] == sh2)
        contacted_slot1 = next(s for s in sh1_data["slots"] if s["status"] == "contacted")
        # Refuse it via public token
        rr = requests.post(f"{BASE_URL}/api/public/mission/{contacted_slot1['token']}/refuse",
                           json={"reason": "no"})
        assert rr.status_code == 200
        # Now shift1: next slot should be contacted; shift2 slots unchanged
        m3 = admin_session.get(f"{BASE_URL}/api/missions/{m['id']}").json()
        sh1_new = next(s for s in m3["shifts"] if s["id"] == sh1)
        sh2_new = next(s for s in m3["shifts"] if s["id"] == sh2)
        # slot 0 refused, slot 1 should now be contacted
        by_prio = sorted(sh1_new["slots"], key=lambda s: s["priority"])
        assert by_prio[0]["status"] == "refused"
        assert by_prio[1]["status"] == "contacted"
        # shift2 must still have exactly 1 contacted (unchanged)
        sh2_contacted = [s for s in sh2_new["slots"] if s["status"] == "contacted"]
        assert len(sh2_contacted) == 1
        # priority 0 of sh2 still contacted, not disturbed
        sh2_by_prio = sorted(sh2_new["slots"], key=lambda s: s["priority"])
        assert sh2_by_prio[0]["status"] == "contacted"
        admin_session.delete(f"{BASE_URL}/api/missions/{m['id']}")

    def test_mission_filled_only_when_all_shifts_filled(self, admin_session, worker_ids):
        payload = _mission_payload("filled", people1=1, people2=1)
        m = admin_session.post(f"{BASE_URL}/api/missions", json=payload).json()
        sh1 = m["shifts"][0]["id"]
        sh2 = m["shifts"][1]["id"]
        admin_session.post(f"{BASE_URL}/api/shifts/{sh1}/select-workers",
                           json={"worker_ids": [worker_ids[0]]})
        admin_session.post(f"{BASE_URL}/api/shifts/{sh2}/select-workers",
                           json={"worker_ids": [worker_ids[1]]})
        # Accept only shift1
        md = admin_session.get(f"{BASE_URL}/api/missions/{m['id']}").json()
        sh1d = next(s for s in md["shifts"] if s["id"] == sh1)
        token1 = sh1d["slots"][0]["token"]
        requests.post(f"{BASE_URL}/api/public/mission/{token1}/accept")
        m2 = admin_session.get(f"{BASE_URL}/api/missions/{m['id']}").json()
        assert m2["status"] == "in_progress", f"Expected in_progress, got {m2['status']}"
        # Accept shift2
        sh2d = next(s for s in m2["shifts"] if s["id"] == sh2)
        token2 = sh2d["slots"][0]["token"]
        requests.post(f"{BASE_URL}/api/public/mission/{token2}/accept")
        m3 = admin_session.get(f"{BASE_URL}/api/missions/{m['id']}").json()
        assert m3["status"] == "filled"
        admin_session.delete(f"{BASE_URL}/api/missions/{m['id']}")


# ---------------- Public endpoints ----------------
class TestPublic:
    def test_public_mission_shape(self, admin_session, worker_ids):
        payload = _mission_payload("public", people1=1, people2=1)
        m = admin_session.post(f"{BASE_URL}/api/missions", json=payload).json()
        sh1 = m["shifts"][0]["id"]
        admin_session.post(f"{BASE_URL}/api/shifts/{sh1}/select-workers",
                           json={"worker_ids": [worker_ids[0]]})
        md = admin_session.get(f"{BASE_URL}/api/missions/{m['id']}").json()
        token = next(s for s in md["shifts"] if s["id"] == sh1)["slots"][0]["token"]
        r = requests.get(f"{BASE_URL}/api/public/mission/{token}")
        assert r.status_code == 200
        j = r.json()
        for k in ("slot", "shift", "mission", "worker", "agency"):
            assert k in j
        for k in ("date", "start_time", "end_time", "rate_hourly", "mission_type"):
            assert k in j["shift"]
        for k in ("name", "location", "address", "status"):
            assert k in j["mission"]
        admin_session.delete(f"{BASE_URL}/api/missions/{m['id']}")

    def test_public_bad_token(self):
        r = requests.get(f"{BASE_URL}/api/public/mission/badtoken")
        assert r.status_code == 404


# ---------------- Cancel / Delete ----------------
class TestMissionLifecycle:
    def test_cancel_mission_cancels_shifts(self, admin_session):
        payload = _mission_payload("cancel")
        m = admin_session.post(f"{BASE_URL}/api/missions", json=payload).json()
        r = admin_session.post(f"{BASE_URL}/api/missions/{m['id']}/cancel")
        assert r.status_code == 200
        m2 = admin_session.get(f"{BASE_URL}/api/missions/{m['id']}").json()
        assert m2["status"] == "cancelled"
        for sh in m2["shifts"]:
            assert sh["status"] == "cancelled"
        admin_session.delete(f"{BASE_URL}/api/missions/{m['id']}")

    def test_delete_mission_removes_shifts_and_slots(self, admin_session, worker_ids):
        payload = _mission_payload("del", people1=1, people2=1)
        m = admin_session.post(f"{BASE_URL}/api/missions", json=payload).json()
        sh1 = m["shifts"][0]["id"]
        admin_session.post(f"{BASE_URL}/api/shifts/{sh1}/select-workers",
                           json={"worker_ids": [worker_ids[0]]})
        r = admin_session.delete(f"{BASE_URL}/api/missions/{m['id']}")
        assert r.status_code == 200
        r2 = admin_session.get(f"{BASE_URL}/api/missions/{m['id']}")
        assert r2.status_code == 404


# ---------------- Multi-tenant isolation ----------------
class TestMultiTenant:
    def test_isolation(self, admin_session):
        payload = _mission_payload("iso_tenant")
        m = admin_session.post(f"{BASE_URL}/api/missions", json=payload).json()
        # Create another user
        s2 = requests.Session()
        email = f"TEST_{uuid.uuid4().hex[:8]}@ex.com"
        r = s2.post(f"{BASE_URL}/api/auth/register",
                    json={"email": email, "password": "pass1234", "name": "B",
                          "agency_name": "AgencyB", "phone": "0600"})
        assert r.status_code == 200
        # User B's missions should be empty (no leakage)
        rb = s2.get(f"{BASE_URL}/api/missions")
        assert rb.status_code == 200
        b_ids = [x["id"] for x in rb.json()]
        assert m["id"] not in b_ids
        # And cannot fetch A's mission by id
        rd = s2.get(f"{BASE_URL}/api/missions/{m['id']}")
        assert rd.status_code == 404
        admin_session.delete(f"{BASE_URL}/api/missions/{m['id']}")
