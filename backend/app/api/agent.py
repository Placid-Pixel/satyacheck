"""
FastAPI Router for SatyaCheck AI Verification Agent.
Provides endpoints for initiating verification, polling traces, retrieving evidence reports,
and checking Gemini connectivity.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pathlib import Path
import shutil
import random

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User, Application, Institution, Document, AgentExecutionRecord
from app.agent.schemas import AgentVerificationRequest, AgentVerificationReport
from app.agent.orchestrator import VerificationAgentOrchestrator
from app.services.gemini_service import gemini_service
from app.pipeline.processor import DocumentPipelineProcessor

router = APIRouter(prefix="/agent", tags=["AI Verification Agent"])

@router.get("/gemini-status")
def get_gemini_status(current_user: User = Depends(get_current_user)):
    """
    Returns connection and configuration status of the Gemini GenAI service.
    """
    return gemini_service.verify_connection()

@router.post("/upload-document/{application_id}")
async def upload_document_to_application(
    application_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads a statutory document (PDF, PNG, JPG) to the specified application,
    extracts metadata/text, calculates perceptual visual hash, and stores encrypted in vault.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {application_id} not found"
        )

    file_ext = Path(file.filename).suffix.lower()
    allowed_exts = {".pdf", ".jpg", ".jpeg", ".png"}
    if file_ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{file_ext}'. Allowed formats: PDF, PNG, JPG, JPEG"
        )

    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    safe_filename = f"app{application_id}_{int(datetime.now().timestamp())}_{Path(file.filename).name}"
    dest_path = settings.UPLOAD_DIR / safe_filename

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    processor = DocumentPipelineProcessor(db)
    doc_record = processor.process_document(
        application_id=app.id,
        file_path=dest_path,
        original_filename=file.filename
    )

    return {
        "success": True,
        "document_id": doc_record.id,
        "application_id": app.id,
        "doc_type": doc_record.doc_type,
        "file_name": doc_record.file_name,
        "file_size": doc_record.file_size,
        "extracted_fields": doc_record.extracted_fields,
        "message": f"Successfully processed '{file.filename}' as {doc_record.doc_type}."
    }

@router.post("/create-application")
def create_new_application_docket(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new regulatory application docket for test verification and user uploads.
    """
    inst_name = str(payload.get("institution_name", "")).strip() or "Apex Institute of Technology"
    state = str(payload.get("state", "Maharashtra"))
    city = str(payload.get("city", "Pune"))
    category = str(payload.get("category", "EOA"))

    inst = db.query(Institution).filter(Institution.name == inst_name).first()
    if not inst:
        aicte_id = f"1-{random.randint(100000000, 999999999)}"
        inst = Institution(
            aicte_id=aicte_id,
            name=inst_name,
            state=state,
            city=city,
            trust_name=f"{inst_name} Educational Trust",
            address=f"Plot 42, Knowledge Park, {city}, {state}",
            pin_code="411001",
            established_year=2012,
            approved_intake=360
        )
        db.add(inst)
        db.flush()

    app_num = f"AICTE-APP-2026-{random.randint(500, 999)}"
    new_app = Application(
        application_number=app_num,
        institution_id=inst.id,
        academic_year="2026-2027",
        category=category,
        status="SUBMITTED",
        risk_score=0.0,
        risk_level="LOW",
        declared_data={
            "survey_number": payload.get("survey_no", "101/A"),
            "land_area_acres": 5.0,
            "total_built_up_area_sqm": 9500,
            "applied_intake": 360
        }
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)

    return {
        "id": new_app.id,
        "application_number": new_app.application_number,
        "institution_name": inst.name,
        "category": new_app.category,
        "status": new_app.status
    }

@router.get("/documents/{application_id}")
def get_application_documents(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists all documents currently associated with the target application.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    docs = db.query(Document).filter(Document.application_id == application_id).all()
    return [
        {
            "id": d.id,
            "doc_type": d.doc_type,
            "file_name": d.file_name,
            "file_size": d.file_size,
            "mime_type": d.mime_type,
            "extracted_fields": d.extracted_fields,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None
        }
        for d in docs
    ]

@router.post("/verify/{application_id}", response_model=AgentVerificationReport)
def run_agent_verification(
    application_id: int,
    request: AgentVerificationRequest = AgentVerificationRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Initiates AI Verification Agent on the target application.
    Supports mode='gemini', 'offline', or 'auto'.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {application_id} not found"
        )

    orchestrator = VerificationAgentOrchestrator(db)
    try:
        report = orchestrator.run_verification(
            application_id=application_id,
            mode=request.mode,
            scrutiny_focus=request.scrutiny_focus
        )
        return report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification agent execution failed: {str(e)}"
        )

@router.get("/status/{execution_id}")
def get_execution_status(
    execution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Polls status and high-level metrics for an agent execution.
    """
    rec = db.query(AgentExecutionRecord).filter(AgentExecutionRecord.execution_id == execution_id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")

    return {
        "execution_id": rec.execution_id,
        "application_id": rec.application_id,
        "application_number": rec.application_number,
        "institution_name": rec.institution_name,
        "execution_mode": rec.execution_mode,
        "status": rec.status,
        "overall_risk_score": rec.overall_risk_score,
        "overall_risk_level": rec.overall_risk_level,
        "needs_human_review": rec.needs_human_review,
        "total_tools_called": rec.total_tools_called,
        "duration_seconds": rec.duration_seconds,
        "created_at": rec.created_at.isoformat() if rec.created_at else None
    }

@router.get("/trace/{execution_id}")
def get_execution_trace(
    execution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves full step-by-step tool invocation trace for an execution.
    """
    rec = db.query(AgentExecutionRecord).filter(AgentExecutionRecord.execution_id == execution_id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")

    return {
        "execution_id": rec.execution_id,
        "application_id": rec.application_id,
        "total_steps": len(rec.trace or []),
        "trace": rec.trace or []
    }

@router.get("/report/{execution_id}", response_model=AgentVerificationReport)
def get_execution_report(
    execution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the complete evidence-linked verification dossier.
    """
    rec = db.query(AgentExecutionRecord).filter(AgentExecutionRecord.execution_id == execution_id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")

    return AgentVerificationReport(
        execution_id=rec.execution_id,
        application_id=rec.application_id,
        application_number=rec.application_number,
        institution_name=rec.institution_name,
        execution_mode=rec.execution_mode,
        status=rec.status,
        overall_risk_score=rec.overall_risk_score,
        overall_risk_level=rec.overall_risk_level,
        recommended_action=rec.recommended_action,
        total_tools_called=rec.total_tools_called,
        duration_seconds=rec.duration_seconds,
        token_usage=rec.token_usage or {},
        estimated_cost_usd=rec.estimated_cost_usd or 0.0,
        trace=rec.trace or [],
        findings=rec.findings or [],
        summary=rec.summary,
        needs_human_review=rec.needs_human_review,
        human_review_reasons=rec.human_review_reasons or [],
        unsupported_findings_prevented=rec.unsupported_findings_prevented or 0,
        created_at=rec.created_at.isoformat() if rec.created_at else ""
    )

@router.get("/history/{application_id}")
def get_application_verification_history(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists past verification runs for a specific application.
    """
    records = db.query(AgentExecutionRecord).filter(
        AgentExecutionRecord.application_id == application_id
    ).order_by(AgentExecutionRecord.created_at.desc()).limit(10).all()

    return [
        {
            "execution_id": r.execution_id,
            "execution_mode": r.execution_mode,
            "status": r.status,
            "overall_risk_score": r.overall_risk_score,
            "overall_risk_level": r.overall_risk_level,
            "duration_seconds": r.duration_seconds,
            "findings_count": len(r.findings or []),
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in records
    ]

