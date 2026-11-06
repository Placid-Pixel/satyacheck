from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from app.core.database import get_db
from app.models import Application, Institution, Document, Finding, ConnectorLog, User, AuditEntry
from app.schemas import ApplicationResponse, ApplicationDetailResponse, ApplicationBase
from app.api.deps import get_current_user
from app.core.security import ROLE_INSTITUTION, ROLE_SCRUTINY, ROLE_SENIOR, ROLE_ADMIN, mask_sensitive_value

router = APIRouter(prefix="/applications", tags=["Applications"])

CHECKLISTS_BY_CATEGORY = {
    "EOA": [
        "Fire Safety NOC (Valid for 2026-27)",
        "Registered Land Title Deed / Possession Certificate",
        "AICTE Approved Building Plan & Occupancy",
        "TER Payment Clearance Receipt",
        "Faculty Roll & Cadre Distribution (1:15 ratio)",
        "Affiliating University Continuous Affiliation Letter"
    ],
    "INTAKE_INCREASE": [
        "Fire Safety NOC (Valid for 2026-27)",
        "Accreditation Certificate (NBA / NAAC Grade >= B++)",
        "Infrastructure Built-up Area expansion proof",
        "Laboratory & Computer Equipment adequacy (>120 terminals)",
        "Faculty Recruitment Plan for increased cadre",
        "TER Payment Clearance Receipt for Intake Increase"
    ],
    "NEW_COURSE": [
        "NBA / NAAC Institutional Accreditation",
        "Curriculum & Syllabus sanction from Affiliating University",
        "Dedicated Branch Laboratory setup evidence",
        "State Government NOC for New Course Introduction",
        "TER Payment Clearance"
    ],
    "CHANGE_NAME": [
        "Governing Body / Trust Resolution for Name Change",
        "State Government No Objection Certificate",
        "Affiliating University Approval Order",
        "Registrar of Societies / Charity Commissioner Certificate"
    ],
    "CHANGE_LOCATION": [
        "Land Title & Conversion Certificate at New Site",
        "Town Planning & DTCP Sanctioned Building Plan",
        "Fire NOC for New Campus Premises",
        "Distance Certificate & Contiguity Declaration"
    ],
    "CLOSURE": [
        "Trust Board Resolution for Progressive / Complete Closure",
        "Student Re-allocation Plan approved by University",
        "Faculty & Staff Settlement Clearance",
        "No Dues from AICTE & University"
    ]
}

@router.get("", response_model=List[ApplicationResponse])
def list_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    category_filter: Optional[str] = Query(None, alias="category"),
    risk_filter: Optional[str] = Query(None, alias="risk_level"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Application)
    
    # Institution users only see their own applications
    if current_user.role == ROLE_INSTITUTION and current_user.institution_id:
        query = query.filter(Application.institution_id == current_user.institution_id)
        
    if status_filter:
        query = query.filter(Application.status == status_filter)
    if category_filter:
        query = query.filter(Application.category == category_filter)
    if risk_filter:
        query = query.filter(Application.risk_level == risk_filter)
        
    return query.order_by(Application.risk_score.desc(), Application.created_at.desc()).all()

@router.get("/{app_id}", response_model=ApplicationDetailResponse)
def get_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    if current_user.role == ROLE_INSTITUTION and current_user.institution_id:
        if app.institution_id != current_user.institution_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to this application")
            
    return app

@router.post("/intake", response_model=ApplicationResponse)
def submit_application_intake(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submits a new application and auto-detects category."""
    inst_id = payload.get("institution_id") or current_user.institution_id
    if not inst_id:
        raise HTTPException(status_code=400, detail="Institution ID required")
        
    inst = db.query(Institution).filter(Institution.id == inst_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    # Category Classifier logic
    requested_intake = payload.get("applied_intake", inst.approved_intake)
    declared_category = payload.get("category")
    
    if not declared_category:
        if requested_intake > inst.approved_intake:
            detected_category = "INTAKE_INCREASE"
        elif payload.get("new_courses"):
            detected_category = "NEW_COURSE"
        elif payload.get("proposed_new_name"):
            detected_category = "CHANGE_NAME"
        elif payload.get("is_closure"):
            detected_category = "CLOSURE"
        else:
            detected_category = "EOA"
    else:
        detected_category = declared_category

    app_count = db.query(Application).count()
    app_num = f"AICTE-APP-2026-{1000 + app_count + 1}"

    new_app = Application(
        application_number=app_num,
        institution_id=inst.id,
        category=detected_category,
        academic_year="2026-2027",
        status="UNDER_SCRUTINY",
        declared_data=payload,
        risk_score=10.0,
        risk_level="LOW"
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app

@router.post("/pre-check")
def pre_submission_self_check(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pre-submission 'Self-Check' mode for institutions to inspect deficiencies before submitting."""
    intake = payload.get("applied_intake", 360)
    faculty = payload.get("faculty_count", 24)
    survey_no = payload.get("survey_no", "")
    fire_expiry = payload.get("fire_noc_expiry", "2026-12-31")
    
    deficiencies = []
    
    # 1. Ratio check
    if faculty > 0 and intake > 0:
        ratio = intake / faculty
        if ratio > 15.0:
            min_req = int(intake / 15.0) + 1
            deficiencies.append({
                "rule": "RULE_FACULTY_STUDENT_RATIO",
                "severity": "HIGH",
                "clause": "APH-2026 Cl 6.1.1",
                "issue": f"Faculty count of {faculty} is deficient for intake of {intake} (1:{ratio:.1f}). Minimum required: {min_req}.",
                "remedy": f"Recruit at least {min_req - faculty} additional full-time faculty member(s) before final submission."
            })
            
    # 2. Fire date check
    if fire_expiry:
        try:
            exp_date = datetime.strptime(fire_expiry, "%Y-%m-%d")
            if exp_date < datetime(2026, 6, 30):
                deficiencies.append({
                    "rule": "RULE_FIRE_NOC_VALIDITY",
                    "severity": "CRITICAL",
                    "clause": "APH-2026 Cl 4.3.1",
                    "issue": f"Fire NOC expires on {fire_expiry}, prior to the 2026-2027 academic session cutoff.",
                    "remedy": "Obtain and upload renewed Fire NOC from State Fire Directorate."
                })
        except ValueError:
            pass

    category = "INTAKE_INCREASE" if intake > 300 else "EOA"
    return {
        "status": "SELF_CHECK_COMPLETED",
        "category_detected": category,
        "applicable_checklist": CHECKLISTS_BY_CATEGORY.get(category, []),
        "deficiencies_count": len(deficiencies),
        "deficiencies": deficiencies,
        "preliminary_verdict": "READY_FOR_SUBMISSION" if len(deficiencies) == 0 else "DEFICIENCIES_DETECTED_RECTIFICATION_RECOMMENDED",
        "disclaimer": "Self-check feedback is advisory. Official validation takes place upon formal application submission."
    }

@router.get("/{app_id}/export-report")
def export_validation_report(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates structured validation report in JSON format."""
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    findings = app.findings
    critical_count = sum(1 for f in findings if f.severity == "CRITICAL")
    high_count = sum(1 for f in findings if f.severity == "HIGH")

    report = {
        "report_id": f"REP-AICTE-{app.application_number}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "institution": {
            "name": app.institution.name,
            "aicte_id": app.institution.aicte_id,
            "address": f"{app.institution.city}, {app.institution.state}",
            "declared_intake": app.declared_data.get("applied_intake", app.institution.approved_intake)
        },
        "application_details": {
            "application_number": app.application_number,
            "category": app.category,
            "academic_year": app.academic_year,
            "status": app.status,
            "risk_score": app.risk_score,
            "risk_level": app.risk_level
        },
        "findings_summary": {
            "total_findings": len(findings),
            "critical_flags": critical_count,
            "high_flags": high_count,
            "open_findings": sum(1 for f in findings if f.status == "OPEN"),
            "resolved_findings": sum(1 for f in findings if f.status in ["ACCEPTED", "DISMISSED", "RESOLVED"])
        },
        "detailed_findings": [
            {
                "id": f.id,
                "rule_id": f.rule_id,
                "clause": f.clause,
                "category": f.category,
                "severity": f.severity,
                "reason": f.reason,
                "status": f.status,
                "confidence": f.confidence,
                "evidence_bbox": f.evidence_bbox,
                "extracted_value": f.extracted_value,
                "expected_value": f.expected_value,
                "recommended_action": f.recommended_action,
                "officer_notes": f.officer_notes
            }
            for f in findings
        ],
        "regulatory_disclaimer": "AI outputs are preliminary decision-support indicators only. Final regulatory determinations rest solely with competent AICTE Scrutiny Officers and Appellate Committees."
    }
    return report
