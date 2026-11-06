from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime, timezone
import hashlib

from app.core.database import get_db
from app.models import ConnectorLog, Document, Application, User, AuditEntry
from app.schemas import ConnectorLogResponse
from app.connectors.base import registry, ALL_CONNECTOR_STATUSES
from app.connectors.adapters import *  # Ensure adapters are registered
from app.api.deps import get_current_user

router = APIRouter(prefix="/verification", tags=["Issuing-Authority Verification"])

@router.get("/adapters")
def list_adapters():
    """Lists registered simulated issuing-authority connectors."""
    return [
        {
            "authority_type": "FIRE_DEPT",
            "name": "State Directorate of Fire & Emergency Services",
            "status": "ONLINE",
            "simulated": True,
            "supported_docs": ["FIRE_NOC"]
        },
        {
            "authority_type": "LAND_REVENUE",
            "name": "State Land & Revenue Records Portal (Bhoomi / Mahabhulekh)",
            "status": "ONLINE",
            "simulated": True,
            "supported_docs": ["LAND_DEED"]
        },
        {
            "authority_type": "NAAC_NBA",
            "name": "National Assessment and Accreditation Council Repository",
            "status": "ONLINE",
            "simulated": True,
            "supported_docs": ["NAAC_NBA"]
        },
        {
            "authority_type": "UNIVERSITY",
            "name": "Affiliating University Academic Portal",
            "status": "ONLINE",
            "simulated": True,
            "supported_docs": ["AFFILIATION_ORDER"]
        }
    ]

@router.post("/verify-document/{doc_id}")
def trigger_authority_verification(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Executes verification check against the simulated issuing-authority adapter."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    adapter_type_map = {
        "FIRE_NOC": "FIRE_DEPT",
        "LAND_DEED": "LAND_REVENUE",
        "NAAC_NBA": "NAAC_NBA"
    }
    auth_type = adapter_type_map.get(doc.doc_type, "FIRE_DEPT")

    # Call adapter
    result = registry.verify_document(auth_type, doc.extracted_fields or {})

    # Log connector event
    log = ConnectorLog(
        application_id=doc.application_id,
        document_id=doc.id,
        authority_type=auth_type,
        status=result.status,
        response_payload=result.response_payload,
        response_hash=result.response_hash,
        latency_ms=result.latency_ms,
        simulated=True
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return {
        "document_id": doc.id,
        "authority_type": auth_type,
        "status": result.status,
        "source": result.source_name,
        "latency_ms": result.latency_ms,
        "needs_manual_review": result.needs_manual_review,
        "response_payload": result.response_payload,
        "response_hash": result.response_hash,
        "timestamp": result.timestamp
    }

@router.get("/timeline/{app_id}")
def get_verification_timeline(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns chronologically ordered verification timeline events."""
    logs = db.query(ConnectorLog).filter(ConnectorLog.application_id == app_id).order_by(ConnectorLog.created_at.asc()).all()
    events = []
    for l in logs:
        events.append({
            "id": l.id,
            "document_id": l.document_id,
            "authority": l.authority_type,
            "status": l.status,
            "latency_ms": l.latency_ms,
            "timestamp": l.created_at.isoformat() if l.created_at else "",
            "details": l.response_payload
        })
    return events
