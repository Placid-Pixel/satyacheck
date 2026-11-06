import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.detectors.ela import perform_ela
from app.detectors.copy_move import detect_copy_move
from app.detectors.qr_verifier import verify_qr_code
from app.detectors.pdf_signature import inspect_pdf_signature
from app.detectors.risk_indicator import calculate_document_risk
from app.connectors.base import registry, STATUS_VERIFIED, STATUS_EXPIRED, STATUS_SOURCE_UNAVAILABLE, STATUS_MISMATCH_DETECTED
from app.connectors.adapters import *
from app.audit.chain import AuditChain
from app.models import AuditEntry

def test_detectors():
    print("Testing Anomaly Detectors...")
    # Find generated test documents
    doc_dir = Path("backend/storage/synthetic/documents")
    test_pdf = next(doc_dir.glob("*.pdf"), None)
    assert test_pdf is not None, "No synthetic PDF found to test"
    
    # ELA Test
    ela_out = Path("backend/storage/synthetic/ela_test.png")
    ela_res = perform_ela(test_pdf, ela_out)
    assert "anomaly_score" in ela_res
    print("1. ELA Detector PASSED. Score:", ela_res["anomaly_score"])

    # Copy-Move Test
    cm_res = detect_copy_move(test_pdf)
    assert "anomaly_score" in cm_res
    print("2. Copy-Move Detector PASSED. Matches count:", cm_res.get("matches_count"))

    # QR Verifier Test
    qr_res = verify_qr_code(test_pdf, "Aryabhatta")
    assert "qr_present" in qr_res
    print("3. QR Verifier PASSED. QR Present:", qr_res["qr_present"])

    # PDF Signature Test
    sig_res = inspect_pdf_signature(test_pdf)
    assert "is_pdf" in sig_res
    print("4. PDF Signature Inspector PASSED. Signed:", sig_res["has_digital_signature"])

    # Composite Risk Indicator Test
    risk_res = calculate_document_risk(test_pdf, "Aryabhatta")
    assert "composite_risk_score" in risk_res
    assert len(risk_res["breakdown"]) == 6
    print("5. Composite Document Risk Indicator PASSED. Risk Level:", risk_res["risk_level"])

def test_connectors():
    print("\nTesting Connector Registry & State Machine...")
    
    # 1. Fire NOC - Valid case
    res_valid = registry.verify_document("FIRE_DEPT", {"noc_no": "KA/FIRE/BLR/2025/9941", "expiry_date": "2027-12-31"})
    assert res_valid.status == STATUS_VERIFIED
    print("1. Fire NOC (Valid):", res_valid.status)

    # 2. Fire NOC - Expired case
    res_expired = registry.verify_document("FIRE_DEPT", {"noc_no": "MH/PUNE/FIRE/2021/8812", "expiry_date": "2024-11-30"})
    assert res_expired.status == STATUS_EXPIRED
    print("2. Fire NOC (Expired):", res_expired.status)

    # 3. Fire NOC - Timeout / Source Unavailable
    res_timeout = registry.verify_document("FIRE_DEPT", {"noc_no": "MH/NAG/FIRE/2025/1129"})
    assert res_timeout.status == STATUS_SOURCE_UNAVAILABLE
    assert res_timeout.needs_manual_review is True
    print("3. Fire NOC (Timeout -> Manual Review Required):", res_timeout.status)

    # 4. Land Revenue - Mismatch
    res_land_mismatch = registry.verify_document("LAND_REVENUE", {"survey_no": "98/4"})
    assert res_land_mismatch.status == STATUS_MISMATCH_DETECTED
    print("4. Land Revenue (Mismatch Detected):", res_land_mismatch.status)

def test_audit_chain():
    print("\nTesting Tamper-Evident Audit Chain...")
    db = SessionLocal()
    try:
        # Append two valid blocks
        b1 = AuditChain.append_entry(
            db, actor="scrutiny_officer", role="SCRUTINY_OFFICER", action="INITIAL_SCRUTINY_STARTED",
            resource_type="APPLICATION", resource_id="1", payload={"note": "Commencing review"}
        )
        b2 = AuditChain.append_entry(
            db, actor="scrutiny_officer", role="SCRUTINY_OFFICER", action="OFFICER_DECISION_ACCEPT",
            resource_type="FINDING", resource_id="101", payload={"justification": "Verified against state land records"}
        )
        assert b2.previous_hash == b1.block_hash
        print(f"Blocks appended. Seq #{b1.sequence_id} -> Seq #{b2.sequence_id}")

        # Check integrity
        check1 = AuditChain.verify_integrity(db)
        assert check1["is_valid"] is True
        print("Integrity verification PASSED. Valid:", check1["is_valid"])

        # Tampering simulation: alter b1's previous hash directly in DB
        b2.previous_hash = "tampered_fake_hash_12345"
        db.commit()

        # Check integrity again -> MUST FLAG TAMPERED!
        check2 = AuditChain.verify_integrity(db)
        assert check2["is_valid"] is False
        assert b2.sequence_id in check2["tampered_blocks"]
        print(f"Tamper detection PASSED! Flagged tampered block: {check2['tampered_blocks']}")

        # Restore
        b2.previous_hash = b1.block_hash
        db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    test_detectors()
    test_connectors()
    test_audit_chain()
    print("\nALL PHASE 3 DETECTOR, CONNECTOR & AUDIT TESTS PASSED!")
