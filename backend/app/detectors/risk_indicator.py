from pathlib import Path
from typing import Dict, Any, Optional
from app.detectors.ela import perform_ela
from app.detectors.copy_move import detect_copy_move
from app.detectors.qr_verifier import verify_qr_code
from app.detectors.pdf_signature import inspect_pdf_signature

def calculate_document_risk(
    file_path: Path,
    expected_institute_name: str,
    output_ela_heatmap: Optional[Path] = None,
    suspicious_metadata: bool = False,
    is_duplicate_hash: bool = False
) -> Dict[str, Any]:
    """
    Computes an explainable multi-detector Document Risk Indicator.
    NOT a black box: returns explicit weighted contributions for each detector.
    """
    if not output_ela_heatmap:
        output_ela_heatmap = file_path.parent / f"ela_{file_path.stem}.png"

    # 1. ELA
    ela_res = perform_ela(file_path, output_ela_heatmap)
    ela_score = ela_res.get("anomaly_score", 0.0)

    # 2. Copy-Move
    cm_res = detect_copy_move(file_path)
    cm_score = cm_res.get("anomaly_score", 0.0)

    # 3. QR code
    qr_res = verify_qr_code(file_path, expected_institute_name)
    qr_score = qr_res.get("anomaly_score", 0.0)

    # 4. Digital signature
    sig_res = inspect_pdf_signature(file_path)
    sig_score = sig_res.get("anomaly_score", 0.0)

    # 5. Metadata anomaly
    meta_score = 0.85 if suspicious_metadata else 0.0

    # 6. Cross-college reuse
    dup_score = 0.95 if is_duplicate_hash else 0.0

    # Weights
    weights = {
        "ela_weight": 0.20,
        "copy_move_weight": 0.15,
        "qr_mismatch_weight": 0.25,
        "signature_weight": 0.10,
        "metadata_weight": 0.10,
        "duplicate_reuse_weight": 0.20
    }

    composite_score = (
        ela_score * weights["ela_weight"] +
        cm_score * weights["copy_move_weight"] +
        qr_score * weights["qr_mismatch_weight"] +
        sig_score * weights["signature_weight"] +
        meta_score * weights["metadata_weight"] +
        dup_score * weights["duplicate_reuse_weight"]
    )
    composite_score = round(min(1.0, max(0.0, composite_score)), 3)

    risk_level = "LOW"
    if composite_score >= 0.70:
        risk_level = "CRITICAL" if composite_score >= 0.85 else "HIGH"
    elif composite_score >= 0.35:
        risk_level = "MEDIUM"

    breakdown = [
        {"detector": "Error Level Analysis (ELA)", "score": ela_score, "weight": weights["ela_weight"], "flagged": ela_res.get("tampering_suspected", False)},
        {"detector": "Copy-Move Cloned Region", "score": cm_score, "weight": weights["copy_move_weight"], "flagged": cm_res.get("cloned_regions_found", False)},
        {"detector": "QR Payload Integrity", "score": qr_score, "weight": weights["qr_mismatch_weight"], "flagged": not qr_res.get("is_match", True)},
        {"detector": "Digital Signature Inspection", "score": sig_score, "weight": weights["signature_weight"], "flagged": not sig_res.get("has_digital_signature", False)},
        {"detector": "Producer Metadata Analysis", "score": meta_score, "weight": weights["metadata_weight"], "flagged": suspicious_metadata},
        {"detector": "Cross-Institute Deduplication", "score": dup_score, "weight": weights["duplicate_reuse_weight"], "flagged": is_duplicate_hash}
    ]

    return {
        "composite_risk_score": composite_score,
        "risk_level": risk_level,
        "breakdown": breakdown,
        "details": {
            "ela": ela_res,
            "copy_move": cm_res,
            "qr": qr_res,
            "signature": sig_res
        },
        "disclaimer": "Preliminary indicator – requires human verification. No automated adverse decision is taken."
    }
