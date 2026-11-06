from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import Application, Document, Finding, AICTEMasterRecord, Institution
from app.rules.rules_catalog import AICTE_RULES_CATALOG

class RuleEngine:
    def __init__(self, db: Session):
        self.db = db

    def evaluate_application(self, application: Application) -> List[Finding]:
        findings: List[Finding] = []
        inst = application.institution
        declared = application.declared_data or {}
        
        # Load baseline master record
        master = self.db.query(AICTEMasterRecord).filter(AICTEMasterRecord.aicte_id == inst.aicte_id).first()
        documents = application.documents

        # Helper lookups by doc_type
        docs_by_type = {}
        for doc in documents:
            docs_by_type.setdefault(doc.doc_type, []).append(doc)

        # 1. Fire NOC Validity (RULE_FIRE_NOC_VALIDITY)
        fire_docs = docs_by_type.get("FIRE_NOC", [])
        if not fire_docs:
            findings.append(Finding(
                application_id=application.id,
                document_id=None,
                rule_id="RULE_FIRE_NOC_VALIDITY",
                clause="APH-2026 Cl 4.3.1",
                category="REGULATORY",
                severity="CRITICAL",
                reason="Mandatory Document Missing: No Fire Safety Certificate (NOC) has been uploaded.",
                expected_value="Valid Fire NOC uploaded",
                extracted_value="Missing",
                confidence=1.0,
                status="OPEN",
                recommended_action="Require applicant to upload Fire Safety NOC before scheduling scrutiny committee."
            ))
        else:
            for fire_doc in fire_docs:
                fields = fire_doc.extracted_fields or {}
                exp_date_str = fields.get("expiry_date")
                if exp_date_str:
                    try:
                        exp_date = datetime.strptime(exp_date_str, "%Y-%m-%d")
                        if exp_date < datetime(2026, 6, 30):
                            findings.append(Finding(
                                application_id=application.id,
                                document_id=fire_doc.id,
                                rule_id="RULE_FIRE_NOC_VALIDITY",
                                clause="APH-2026 Cl 4.3.1",
                                category="REGULATORY",
                                severity="CRITICAL",
                                reason=f"Expired Fire Safety NOC: Certificate expired on {exp_date_str}. Must be valid through June 2026.",
                                evidence_bbox=fields.get("bboxes", {}).get("expiry_date", {"page": 1, "x0": 260, "y0": 330, "x1": 380, "y1": 355}),
                                expected_value=">= 2026-06-30",
                                extracted_value=exp_date_str,
                                confidence=0.98,
                                status="OPEN",
                                recommended_action="Issue deficiency notice for renewed Fire Safety Certificate."
                            ))
                    except ValueError:
                        pass

        # 2. Land Survey Consistency (RULE_LAND_SURVEY_CONSISTENCY)
        land_docs = docs_by_type.get("LAND_DEED", [])
        declared_survey = declared.get("survey_no")
        for land_doc in land_docs:
            fields = land_doc.extracted_fields or {}
            deed_survey = fields.get("survey_no")
            if declared_survey and deed_survey and declared_survey.strip() != deed_survey.strip():
                findings.append(Finding(
                    application_id=application.id,
                    document_id=land_doc.id,
                    rule_id="RULE_LAND_SURVEY_CONSISTENCY",
                    clause="APH-2026 Cl 2.1.4",
                    category="CONSISTENCY",
                    severity="HIGH",
                    reason=f"Survey Number Mismatch: Declared survey is '{declared_survey}', but submitted title deed specifies '{deed_survey}'.",
                    evidence_bbox=fields.get("bboxes", {}).get("survey_no", {"page": 1, "x0": 170, "y0": 220, "x1": 310, "y1": 240}),
                    expected_value=f"Survey No: {declared_survey}",
                    extracted_value=f"Survey No: {deed_survey}",
                    confidence=0.95,
                    status="OPEN",
                    recommended_action="Officer scrutiny required: demand revenue mutation extract linking the two survey numbers."
                ))

        # 3. Faculty Student Ratio (RULE_FACULTY_STUDENT_RATIO)
        intake = declared.get("applied_intake") or inst.approved_intake
        faculty = declared.get("faculty_count") or inst.faculty_count
        if intake > 0 and faculty > 0:
            ratio = intake / faculty
            if ratio > 15.0:
                min_faculty_required = int(intake / 15.0) + (1 if intake % 15 != 0 else 0)
                findings.append(Finding(
                    application_id=application.id,
                    document_id=None,
                    rule_id="RULE_FACULTY_STUDENT_RATIO",
                    clause="APH-2026 Cl 6.1.1",
                    category="FACULTY",
                    severity="HIGH",
                    reason=f"Deficient Faculty-Student Ratio: Ratio is 1:{ratio:.2f} (mandated 1:15.0). Current faculty {faculty} is below minimum requirement of {min_faculty_required}.",
                    expected_value=f">= {min_faculty_required} Faculty (1:15.0)",
                    extracted_value=f"{faculty} Faculty (1:{ratio:.2f})",
                    confidence=1.0,
                    status="OPEN",
                    recommended_action="Applicant must recruit required faculty members before approval committee hearing."
                ))

        # 4. Cross-Institute Duplicate Document (RULE_CROSS_INSTITUTE_DUPLICATE)
        for doc in documents:
            if doc.perceptual_hash:
                duplicate_match = self.db.query(Document).join(Application).filter(
                    Document.perceptual_hash == doc.perceptual_hash,
                    Document.id < doc.id,  # Only flag if previously submitted by earlier institution
                    Application.institution_id != inst.id
                ).first()
                if duplicate_match:
                    other_inst = duplicate_match.application.institution
                    findings.append(Finding(
                        application_id=application.id,
                        document_id=doc.id,
                        rule_id="RULE_CROSS_INSTITUTE_DUPLICATE",
                        clause="APH-2026 Cl 1.4.2",
                        category="DOCUMENT_AUTHENTICITY",
                        severity="CRITICAL",
                        reason=f"Suspected Certificate Duplication: Perceptual visual hash matches document '{duplicate_match.file_name}' previously submitted by '{other_inst.name}'.",
                        evidence_bbox={"page": 1, "x0": 50, "y0": 105, "x1": 300, "y1": 130},
                        expected_value="Unique Institute Certificate",
                        extracted_value=f"Reused from {other_inst.name}",
                        confidence=0.99,
                        status="OPEN",
                        recommended_action="Do not auto-reject. Escalate finding to Senior Authority for formal inquiry."
                    ))

        # 5. Metadata Alteration & Suspicious Editor
        for doc in documents:
            meta = doc.metadata_info or {}
            if meta.get("suspicious_editor"):
                findings.append(Finding(
                    application_id=application.id,
                    document_id=doc.id,
                    rule_id="RULE_PDF_METADATA_ALTERATION",
                    clause="APH-2026 Cl 4.1.9",
                    category="DOCUMENT_AUTHENTICITY",
                    severity="HIGH",
                    reason=f"Suspicious Editing Software Detected: PDF producer metadata contains '{meta.get('producer')}', suggesting post-scan photo editing.",
                    expected_value="Scanner / Official Authority PDF",
                    extracted_value=meta.get("producer", "Photo Editing Tool"),
                    confidence=0.91,
                    status="OPEN",
                    recommended_action="Request applicant to submit original certified paper copy for verification."
                ))

        # 6. QR Code Payload vs Printed Text Mismatch
        for doc in documents:
            risk = doc.risk_indicators or {}
            if risk.get("qr_content_mismatch"):
                findings.append(Finding(
                    application_id=application.id,
                    document_id=doc.id,
                    rule_id="RULE_QR_PAYLOAD_MISMATCH",
                    clause="APH-2026 Cl 4.3.4",
                    category="DOCUMENT_AUTHENTICITY",
                    severity="CRITICAL",
                    reason="QR Verification Payload Mismatch: Decoded QR code points to a different institutional entity than the declared applicant.",
                    evidence_bbox={"page": 1, "x0": 450, "y0": 80, "x1": 530, "y1": 160},
                    expected_value=inst.name,
                    extracted_value="Mismatched Authority Record",
                    confidence=0.99,
                    status="OPEN",
                    recommended_action="Flag for human scrutiny. Preliminary indicator only."
                ))

        # 7. Past Year Deficiencies in Master Record
        if master and master.last_year_deficiencies:
            for def_item in master.last_year_deficiencies:
                findings.append(Finding(
                    application_id=application.id,
                    document_id=None,
                    rule_id="RULE_CONSECUTIVE_DEFICIENCIES",
                    clause="APH-2026 Cl 1.3.4",
                    category="REGULATORY",
                    severity="MEDIUM",
                    reason=f"Historical Unresolved AICTE Deficiency: '{def_item}' flagged in prior cycle.",
                    expected_value="Deficiencies Rectified",
                    extracted_value=f"Deficiency Recorded: {def_item}",
                    confidence=1.0,
                    status="OPEN",
                    recommended_action="Verify compliance affidavit submitted for past deficiencies."
                ))

        # Compute updated application risk score based on findings severity
        severity_weights = {"CRITICAL": 35.0, "HIGH": 20.0, "MEDIUM": 10.0, "LOW": 5.0, "INFO": 0.0}
        total_risk = sum(severity_weights.get(f.severity, 0.0) for f in findings)
        application.risk_score = min(100.0, total_risk)
        if application.risk_score >= 70.0:
            application.risk_level = "CRITICAL" if application.risk_score >= 85.0 else "HIGH"
        elif application.risk_score >= 30.0:
            application.risk_level = "MEDIUM"
        else:
            application.risk_level = "LOW"

        return findings
