import sys
from pathlib import Path
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.main import app

import pytest

client = TestClient(app)

@pytest.fixture
def auth_token() -> str:
    res = client.post("/api/auth/login", json={"username": "scrutiny_officer", "password": "officer123"})
    assert res.status_code == 200
    token = res.json()
    return token["access_token"]

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    print("Health check PASSED:", data)

def test_auth_login():
    res = client.post("/api/auth/login", json={"username": "scrutiny_officer", "password": "officer123"})
    assert res.status_code == 200
    token = res.json()
    assert "access_token" in token
    assert token["role"] == "SCRUTINY_OFFICER"
    print("Auth login PASSED. Token role:", token["role"])

def test_list_applications(auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    res = client.get("/api/applications", headers=headers)
    assert res.status_code == 200
    apps = res.json()
    assert len(apps) >= 3
    print(f"List applications PASSED. Found {len(apps)} applications.")
    return apps[0]["id"]

def test_pre_check(auth_token: str):
    res = client.post("/api/applications/pre-check", json={
        "applied_intake": 480,
        "faculty_count": 20, # Deficient ratio!
        "fire_noc_expiry": "2024-05-10" # Expired!
    }, headers={"Authorization": f"Bearer {auth_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["deficiencies_count"] >= 2
    print("Pre-submission Self-Check PASSED. Detected deficiencies:", data["deficiencies_count"])

def test_rules_catalog():
    res = client.get("/api/rules")
    assert res.status_code == 200
    rules = res.json()
    assert len(rules) >= 20
    print(f"Rules catalog PASSED. Loaded {len(rules)} AICTE rules.")

if __name__ == "__main__":
    test_health()
    tok_res = client.post("/api/auth/login", json={"username": "scrutiny_officer", "password": "officer123"}).json()
    tok = tok_res["access_token"]
    test_list_applications(tok)
    test_pre_check(tok)
    test_rules_catalog()
    print("\nALL PHASE 2 UNIT TESTS PASSED!")
