from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.core.database import get_db
from app.models import AuditEntry, User
from app.schemas import AuditEntryResponse, AuditIntegrityResponse
from app.audit.chain import AuditChain
from app.api.deps import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit Trail & Tamper Verification"])

@router.get("", response_model=List[AuditEntryResponse])
def get_audit_trail(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns hash-chained audit blocks in chronological sequence."""
    return db.query(AuditEntry).order_by(AuditEntry.sequence_id.desc()).limit(limit).all()

@router.post("/verify", response_model=AuditIntegrityResponse)
def verify_audit_trail_integrity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Recomputes the cryptographic SHA-256 hash chain to verify that no record was altered."""
    res = AuditChain.verify_integrity(db)
    return AuditIntegrityResponse(
        is_valid=res["is_valid"],
        total_blocks=res["total_blocks"],
        last_verified_at=res.get("last_verified_at"),
        tampered_blocks=res["tampered_blocks"],
        message=res["message"]
    )
