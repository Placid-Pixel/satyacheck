"""
Test suite for FastAPI Agent Endpoints.
Verifies API responses, RBAC authorization, and report retrieval.
"""

import sys
from pathlib import Path
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.main import app

client = TestClient(app)

def test_agent_api():
    print("Testing Agent REST Endpoints...")

    # 1. Login as scrutiny officer
    login_res = client.post("/api/auth/login", json={"username": "scrutiny_officer", "password": "officer123"})
    assert login_res.status_code == 200, "Login failed"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("1. Authentication OK")

    # 2. Check Gemini status endpoint
    status_res = client.get("/api/agent/gemini-status", headers=headers)
    assert status_res.status_code == 200
    st_data = status_res.json()
    assert "connected" in st_data
    print(f"2. Gemini Status Endpoint OK (connected={st_data['connected']}, model={st_data.get('model')})")

    # 3. Trigger verification on Hero 2 (ID 2)
    verify_res = client.post("/api/agent/verify/2", json={"mode": "offline"}, headers=headers)
    assert verify_res.status_code == 200
    report = verify_res.json()
    exec_id = report["execution_id"]
    assert report["application_number"] == "AICTE-APP-2026-002"
    assert len(report["trace"]) >= 5
    print(f"3. Trigger Verification OK (exec_id={exec_id}, status={report['status']}, score={report['overall_risk_score']})")

    # 4. Get Status endpoint
    poll_res = client.get(f"/api/agent/status/{exec_id}", headers=headers)
    assert poll_res.status_code == 200
    p_data = poll_res.json()
    assert p_data["execution_id"] == exec_id
    assert p_data["status"] == report["status"]
    print("4. Get Status Endpoint OK")

    # 5. Get Trace endpoint
    trace_res = client.get(f"/api/agent/trace/{exec_id}", headers=headers)
    assert trace_res.status_code == 200
    t_data = trace_res.json()
    assert t_data["total_steps"] == len(report["trace"])
    print(f"5. Get Trace Endpoint OK ({t_data['total_steps']} steps recorded)")

    # 6. Get Report endpoint
    rep_res = client.get(f"/api/agent/report/{exec_id}", headers=headers)
    assert rep_res.status_code == 200
    r_data = rep_res.json()
    assert r_data["execution_id"] == exec_id
    assert len(r_data["findings"]) == len(report["findings"])
    print("6. Get Full Report Endpoint OK")

    # 7. Get History endpoint
    hist_res = client.get("/api/agent/history/2", headers=headers)
    assert hist_res.status_code == 200
    h_data = hist_res.json()
    assert len(h_data) >= 1
    print(f"7. Get History Endpoint OK ({len(h_data)} past runs listed)")

    # 8. Create New Docket endpoint
    create_res = client.post(
        "/api/agent/create-application",
        json={"institution_name": "Test Engineering Academy", "state": "Maharashtra", "category": "EOA"},
        headers=headers
    )
    assert create_res.status_code == 200
    new_docket = create_res.json()
    assert "id" in new_docket
    assert "application_number" in new_docket
    new_app_id = new_docket["id"]
    print(f"8. Create Docket Endpoint OK (new_app_id={new_app_id}, num={new_docket['application_number']})")

    # 9. Upload Document endpoint
    import io
    dummy_pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<\n/Title (Fire NOC Clearance)\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF"
    upload_res = client.post(
        f"/api/agent/upload-document/{new_app_id}",
        files={"file": ("test_fire_noc.pdf", io.BytesIO(dummy_pdf_bytes), "application/pdf")},
        headers=headers
    )
    assert upload_res.status_code == 200
    up_data = upload_res.json()
    assert up_data["success"] is True
    assert "document_id" in up_data
    print(f"9. Upload Document Endpoint OK (doc_id={up_data['document_id']}, type={up_data['doc_type']})")

    # 10. Get Documents endpoint
    docs_res = client.get(f"/api/agent/documents/{new_app_id}", headers=headers)
    assert docs_res.status_code == 200
    docs_data = docs_res.json()
    assert len(docs_data) >= 1
    assert docs_data[0]["file_name"] == "test_fire_noc.pdf"
    print(f"10. Get Application Documents OK ({len(docs_data)} documents verified)")

    print("\nALL AGENT API ENDPOINT TESTS PASSED!")

if __name__ == "__main__":
    test_agent_api()

