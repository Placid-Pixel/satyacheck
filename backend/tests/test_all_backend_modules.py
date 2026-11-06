import sys
from pathlib import Path
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.main import app

client = TestClient(app)

def test_full_suite():
    # Login as scrutiny officer
    login_res = client.post("/api/auth/login", json={"username": "scrutiny_officer", "password": "officer123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Applications
    apps_res = client.get("/api/applications", headers=headers)
    assert apps_res.status_code == 200
    apps = apps_res.json()
    assert len(apps) >= 3
    hero2 = next(a for a in apps if a["application_number"] == "AICTE-APP-2026-002")
    hero2_id = hero2["id"]
    print("1. Applications API: OK (Hero 2 loaded)")

    # 2. Knowledge Graph
    kg_res = client.get(f"/api/graph/{hero2_id}", headers=headers)
    assert kg_res.status_code == 200
    kg_data = kg_res.json()
    assert kg_data["total_nodes"] > 0
    assert kg_data["total_edges"] > 0
    print(f"2. Knowledge Graph: OK ({kg_data['total_nodes']} nodes, {kg_data['total_edges']} edges)")

    # 3. Infrastructure CV
    # Get a document ID
    detail_res = client.get(f"/api/applications/{hero2_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    doc_id = detail["documents"][0]["id"] if detail["documents"] else 1
    
    infra_res = client.post(f"/api/infrastructure/analyze-photo/{doc_id}", headers=headers)
    assert infra_res.status_code == 200
    infra_data = infra_res.json()
    assert "quality_metrics" in infra_data
    assert "detected_objects" in infra_data
    print("3. Infrastructure CV: OK")

    # 4. Evaluation Benchmark
    eval_res = client.get("/api/evaluation/metrics", headers=headers)
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["field_extraction_accuracy"] > 80.0
    assert eval_data["total_samples"] >= 60
    assert "confusion_matrix" in eval_data
    print(f"4. Evaluation Metrics: OK (Accuracy: {eval_data['field_extraction_accuracy']}%, Samples: {eval_data['total_samples']})")

    # 5. Audit Chain
    audit_res = client.post("/api/audit/verify", headers=headers)
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    assert audit_data["is_valid"] is True
    print(f"5. Audit Chain Integrity: OK ({audit_data['total_blocks']} blocks verified)")

if __name__ == "__main__":
    test_full_suite()
    print("\nALL BACKEND API MODULE TESTS COMPLETED SUCCESSFULLY!")
