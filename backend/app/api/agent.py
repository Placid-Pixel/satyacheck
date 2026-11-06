"""
FastAPI Router for SatyaCheck AI Verification Agent.
Provides endpoints for initiating verification, polling traces, retrieving evidence reports,
and checking Gemini connectivity.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User, Application, AgentExecutionRecord
from app.agent.schemas import AgentVerificationRequest, AgentVerificationReport
from app.agent.orchestrator import VerificationAgentOrchestrator
from app.services.gemini_service import gemini_service

router = APIRouter(prefix="/agent", tags=["AI Verification Agent"])

@router.get("/gemini-status")
def get_gemini_status(current_user: User = Depends(get_current_user)):
    """
    Returns connection and configuration status of the Gemini GenAI service.
    """
    return gemini_service.verify_connection()

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

