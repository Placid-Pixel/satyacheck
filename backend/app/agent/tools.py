"""
Agent Tools Module for SatyaCheck AI.
Exposes verified existing backend functions as callable tools for the Gemini Agent.
Ensures strict validation, evidence provenance, and defensive error handling.
"""

import os
import time
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.config import settings, BASE_DIR
from app.models import Application, Document, Finding, AICTEMasterRecord, Institution
from app.pipeline.processor import DocumentPipelineProcessor
from app.rules.engine import RuleEngine
from app.rules.rules_catalog import AICTE_RULES_CATALOG
from app.detectors.risk_indicator import calculate_document_risk
from app.connectors.base import registry, STATUS_SOURCE_UNAVAILABLE, STATUS_MANUAL_REVIEW_REQUIRED

logger = logging.getLogger("satyacheck.agent.tools")

def _resolve_doc_path(raw_path: str) -> Path:
    p = Path(raw_path)
    if p.exists():
        return p
    # Try resolving relative to backend or backend/storage
    candidates = [
        settings.DATA_DIR / p.name,
        settings.DATA_DIR / "synthetic" / "documents" / p.name,
        settings.DATA_DIR / "uploads" / p.name,
        BASE_DIR / p,
        BASE_DIR / "backend" / p,
    ]
    for c in candidates:
        if c.exists():
            return c
    return p

class AgentToolRegistry:
    def __init__(self, db: Session):
        self.db = db
        self.pipeline = DocumentPipelineProcessor(db)
        self.rule_engine = RuleEngine(db)

    def classify_documents(self, application_id: int) -> Dict[str, Any]:
        """
        Retrieves and classifies all uploaded documents associated with an application.
        Detects document categories: FIRE_NOC, LAND_DEED, NAAC_NBA, BUILDING_PLAN, FACULTY_LIST, TER_RECEIPT, INFRA_PHOTO.
        """
        app = self.db.query(Application).filter(Application.id == application_id).first()
        if not app:
            return {"error": f"Application {application_id} not found", "documents": []}

        docs = app.documents
        result_docs = []
        for d in docs:
            # Refresh doc_type heuristic if needed
            detected_type = d.doc_type
            if not detected_type or detected_type == "GENERAL_COMPLIANCE":
                detected_type = self.pipeline.classify_document(d.ocr_text or "", d.file_name)
                d.doc_type = detected_type
            result_docs.append({
                "document_id": d.id,
                "file_name": d.file_name,
                "doc_type": detected_type,
                "file_size_bytes": d.file_size,
                "mime_type": d.mime_type,
                "has_ocr_text": bool(d.ocr_text and len(d.ocr_text.strip()) > 10)
            })
        self.db.commit()
        return {
            "application_id": application_id,
            "total_documents": len(result_docs),
            "documents": result_docs
        }

    def extract_document_fields(self, document_id: int) -> Dict[str, Any]:
        """
        Extracts structured statutory fields (expiry dates, certificate numbers, survey numbers, acreage, transaction amounts)
        and OCR text metadata from a specific document.
        """
        doc = self.db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return {"error": f"Document {document_id} not found"}

        # If fields not extracted, run pipeline extraction
        fields = doc.extracted_fields or {}
        if not fields and doc.ocr_text:
            fields = self.pipeline.extract_structured_fields(doc.ocr_text, doc.doc_type)
            doc.extracted_fields = fields
            self.db.commit()

        # Text preview safely truncated
        ocr_preview = (doc.ocr_text or "")[:400].strip()

        return {
            "document_id": doc.id,
            "application_id": doc.application_id,
            "doc_type": doc.doc_type,
            "file_name": doc.file_name,
            "extracted_fields": fields,
            "metadata_info": doc.metadata_info or {},
            "ocr_text_preview": ocr_preview
        }

    def check_regulatory_rules(self, application_id: int) -> Dict[str, Any]:
        """
        Evaluates the 26 AICTE Approval Process Handbook (APH 2026) statutory clauses
        including Fire NOC validity, Faculty-Student ratio, land requirements, TER payments, and past deficiencies.
        """
        app = self.db.query(Application).filter(Application.id == application_id).first()
        if not app:
            return {"error": f"Application {application_id} not found", "findings": []}

        rule_findings = self.rule_engine.evaluate_application(app)
        findings_summary = []
        for f in rule_findings:
            findings_summary.append({
                "rule_id": f.rule_id,
                "clause": f.clause,
                "category": f.category,
                "severity": f.severity,
                "reason": f.reason,
                "document_id": f.document_id,
                "extracted_value": f.extracted_value,
                "expected_value": f.expected_value,
                "evidence_bbox": f.evidence_bbox,
                "confidence": f.confidence,
                "recommended_action": f.recommended_action
            })

        return {
            "application_id": application_id,
            "total_rules_evaluated": len(AICTE_RULES_CATALOG),
            "findings_count": len(findings_summary),
            "findings": findings_summary
        }

    def compare_application_records(self, application_id: int) -> Dict[str, Any]:
        """
        Cross-checks declared institutional parameters against the AICTE Master Historical Baseline
        and extracted document values (e.g. Declared Land Survey No vs Land Deed Survey No, Approved vs Applied Intake).
        """
        app = self.db.query(Application).filter(Application.id == application_id).first()
        if not app:
            return {"error": f"Application {application_id} not found"}

        inst = app.institution
        master = self.db.query(AICTEMasterRecord).filter(AICTEMasterRecord.aicte_id == inst.aicte_id).first()
        declared = app.declared_data or {}

        discrepancies = []

        # 1. Check Land Survey Number Mismatch
        declared_survey = str(declared.get("survey_no", "")).strip()
        land_docs = [d for d in app.documents if d.doc_type == "LAND_DEED"]
        deed_survey = None
        land_doc_id = None
        for ld in land_docs:
            fields = ld.extracted_fields or {}
            if "survey_no" in fields:
                deed_survey = str(fields["survey_no"]).strip()
                land_doc_id = ld.id
                break

        if declared_survey and deed_survey and declared_survey.lower() != deed_survey.lower():
            discrepancies.append({
                "type": "SURVEY_NUMBER_MISMATCH",
                "severity": "CRITICAL",
                "clause": "APH-2026 Cl 4.1.2",
                "document_id": land_doc_id,
                "declared_value": declared_survey,
                "extracted_value": deed_survey,
                "explanation": f"Discrepancy in Campus Parcel: Application declared Survey No '{declared_survey}' whereas registered Land Deed specifies Survey No '{deed_survey}'.",
                "recommended_action": "Require applicant to submit Sub-Registrar Rectification Deed or explain parcel change."
            })

        # 2. Check Sponsoring Trust Consistency
        if master and master.trust_name and inst.trust_name:
            if master.trust_name.strip().lower() != inst.trust_name.strip().lower():
                discrepancies.append({
                    "type": "TRUST_NAME_MISMATCH",
                    "severity": "HIGH",
                    "clause": "APH-2026 Cl 2.4",
                    "document_id": None,
                    "declared_value": inst.trust_name,
                    "extracted_value": master.trust_name,
                    "explanation": f"Sponsoring body divergence: Current trust '{inst.trust_name}' does not match AICTE baseline record '{master.trust_name}'.",
                    "recommended_action": "Verify Charity Commissioner / Registrar of Societies certificate for trust name modification."
                })

        # 3. Check Applied Intake vs Baseline Intake Expansion
        applied_intake = declared.get("applied_intake")
        if master and applied_intake is not None:
            baseline_intake = master.approved_intake
            if int(applied_intake) > int(baseline_intake) * 1.5:
                discrepancies.append({
                    "type": "AGGRESSIVE_INTAKE_EXPANSION",
                    "severity": "MEDIUM",
                    "clause": "APH-2026 Cl 3.2.1",
                    "document_id": None,
                    "declared_value": str(applied_intake),
                    "extracted_value": str(baseline_intake),
                    "explanation": f"Applied intake {applied_intake} exceeds past baseline intake {baseline_intake} by > 50%. Demands infrastructure expansion scrutiny.",
                    "recommended_action": "Verify classroom carpet area and faculty cadre ratios before granting expansion."
                })

        return {
            "application_id": application_id,
            "institution_name": inst.name,
            "aicte_id": inst.aicte_id,
            "has_master_record": master is not None,
            "discrepancies_found": len(discrepancies),
            "discrepancies": discrepancies
        }

    def detect_document_anomalies(self, document_id: int) -> Dict[str, Any]:
        """
        Executes multi-factor forensic anomaly detectors on a document:
        - Error Level Analysis (ELA) for JPEG resave & tampering
        - Copy-Move keypoint cloning detection
        - QR Code verification against document metadata
        - PDF digital signature cryptographic validity
        - Cross-institution perceptual hash deduplication
        """
        doc = self.db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return {"error": f"Document {document_id} not found"}

        file_path = _resolve_doc_path(doc.file_path)
        if not file_path.exists():
            return {"error": f"Document file {doc.file_name} not found on disk at {file_path}"}

        inst_name = doc.application.institution.name if doc.application and doc.application.institution else "Institution"

        # Check duplicate hash across other institutions
        is_duplicate = False
        if doc.perceptual_hash:
            other_doc = self.db.query(Document).join(Application).filter(
                Document.perceptual_hash == doc.perceptual_hash,
                Document.id < doc.id,
                Application.institution_id != doc.application.institution_id
            ).first()
            if other_doc:
                is_duplicate = True

        suspicious_meta = bool((doc.metadata_info or {}).get("suspicious_editor", False))

        try:
            risk_res = calculate_document_risk(
                file_path=file_path,
                expected_institute_name=inst_name,
                suspicious_metadata=suspicious_meta,
                is_duplicate_hash=is_duplicate
            )
            return {
                "document_id": doc.id,
                "file_name": doc.file_name,
                "composite_risk_score": risk_res["composite_risk_score"],
                "risk_level": risk_res["risk_level"],
                "breakdown": risk_res["breakdown"],
                "evidence_bboxes": risk_res.get("evidence_bboxes", []),
                "is_duplicate_across_institutions": is_duplicate,
                "suspicious_metadata": suspicious_meta
            }
        except Exception as e:
            logger.error(f"Error analyzing document {document_id}: {e}")
            return {
                "document_id": doc.id,
                "file_name": doc.file_name,
                "composite_risk_score": 0.5,
                "risk_level": "MEDIUM",
                "error": str(e),
                "breakdown": {"analysis_error": 1.0}
            }

    def verify_authority_record(self, document_id: int, verification_type: str) -> Dict[str, Any]:
        """
        Simulates statutory issuing authority API verification (Fire Dept, Land Revenue, NAAC/NBA, University Affiliation).
        Returns state machine status: VERIFIED, MISMATCH_DETECTED, EXPIRED, SOURCE_UNAVAILABLE, or MANUAL_REVIEW_REQUIRED.
        """
        doc = self.db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return {"error": f"Document {document_id} not found"}

        doc_fields = dict(doc.extracted_fields or {})
        doc_fields.setdefault("noc_no", doc_fields.get("certificate_no", ""))
        doc_fields.setdefault("file_name", doc.file_name)

        # Call simulated adapter registry
        result = registry.verify_document(verification_type, doc_fields)

        return {
            "document_id": doc.id,
            "authority_type": result.authority_type,
            "status": result.status,
            "source_name": result.source_name,
            "latency_ms": result.latency_ms,
            "needs_manual_review": result.needs_manual_review,
            "response_payload": result.response_payload,
            "simulated": True
        }

    def retrieve_application_history(self, application_id: int) -> Dict[str, Any]:
        """
        Retrieves institutional historical performance, prior approved programmes,
        deficiency history from previous scrutiny cycles, and current accreditation standing.
        """
        app = self.db.query(Application).filter(Application.id == application_id).first()
        if not app:
            return {"error": f"Application {application_id} not found"}

        inst = app.institution
        master = self.db.query(AICTEMasterRecord).filter(AICTEMasterRecord.aicte_id == inst.aicte_id).first()

        history_data = {
            "application_id": app.id,
            "application_number": app.application_number,
            "category": app.category,
            "academic_year": app.academic_year,
            "institution": {
                "name": inst.name,
                "aicte_id": inst.aicte_id,
                "city": inst.city,
                "state": inst.state,
                "established_year": inst.established_year,
                "approved_intake": inst.approved_intake,
                "faculty_count": inst.faculty_count,
                "land_acres": inst.land_area_acres
            },
            "master_record": None
        }

        if master:
            history_data["master_record"] = {
                "past_approved_intake": master.approved_intake,
                "land_acres": master.land_acres,
                "fire_noc_valid_till": master.fire_noc_valid_till,
                "ter_payment_status": master.ter_payment_status,
                "last_year_deficiencies": master.last_year_deficiencies or [],
                "accreditation_status": master.accreditation_status or {}
            }

        return history_data

    def generate_evidence_report(self, application_id: int, findings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Synthesizes all tool findings into an evidence-linked dossier.
        Calculates composite risk, checks human review triggers, and recommends statutory actions.
        Strict rule: Never automatically rejects an application.
        """
        app = self.db.query(Application).filter(Application.id == application_id).first()
        if not app:
            return {"error": f"Application {application_id} not found"}

        critical_count = sum(1 for f in findings if f.get("severity") == "CRITICAL")
        high_count = sum(1 for f in findings if f.get("severity") == "HIGH")
        medium_count = sum(1 for f in findings if f.get("severity") == "MEDIUM")

        # Multi-factor risk calculation
        risk_score = min(100.0, (critical_count * 35.0) + (high_count * 18.0) + (medium_count * 6.0))
        if not findings:
            risk_score = 4.2  # Baseline clean score

        if risk_score >= 70.0 or critical_count > 0:
            risk_level = "CRITICAL" if critical_count > 1 else "HIGH"
            needs_human = True
            rec_action = "Escalate to Scrutiny Committee for detailed manual evidence hearing."
        elif risk_score >= 40.0:
            risk_level = "MEDIUM"
            needs_human = True
            rec_action = "Request rectification documents from institution within 7 calendar days."
        else:
            risk_level = "LOW"
            needs_human = False
            rec_action = "Recommend routine administrative verification and schedule regular approval docket."

        return {
            "application_id": application_id,
            "application_number": app.application_number,
            "overall_risk_score": round(risk_score, 1),
            "overall_risk_level": risk_level,
            "total_findings": len(findings),
            "critical_findings": critical_count,
            "high_findings": high_count,
            "medium_findings": medium_count,
            "needs_human_review": needs_human,
            "recommended_action": rec_action,
            "decision_principle": "NO_AUTO_REJECTION_ADVISORY_ONLY"
        }
