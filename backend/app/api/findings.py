from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import hashlib

from app.core.database import get_db
from app.models import Finding, User, AuditEntry
from app.schemas import FindingResponse, FindingActionRequest
from app.api.deps import get_current_user, require_roles
from app.core.security import ROLE_SCRUTINY, ROLE_SENIOR, ROLE_ADMIN

router = APIRouter(prefix="/findings", tags=["Findings & Decision Support"])

@router.post("/{finding_id}/action", response_model=FindingResponse)
def execute_officer_action(
    finding_id: int,
    payload: FindingActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([ROLE_SCRUTINY, ROLE_SENIOR, ROLE_ADMIN]))
):
    """Executes a human officer decision on a finding with mandatory justification."""
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    action = payload.action.upper()
    if not payload.justification or len(payload.justification.strip()) < 5:
        raise HTTPException(
            status_code=400,
            detail="Mandatory justification required for every officer determination"
        )

    # Status mapping
    if action == "ACCEPT":
        finding.status = "ACCEPTED"
    elif action == "DISMISS":
        finding.status = "DISMISSED"
    elif action == "REQUEST_MORE_EVIDENCE":
        finding.status = "EVIDENCE_REQUESTED"
    elif action == "ESCALATE":
        finding.status = "ESCALATED"
    elif action == "RECOMMEND_INSPECTION":
        finding.status = "INSPECTION_RECOMMENDED"
    else:
        raise HTTPException(status_code=400, detail=f"Invalid action '{action}'")

    finding.officer_id = current_user.id
    finding.officer_notes = payload.justification
    finding.resolved_at = datetime.now(timezone.utc)

    # Append to hash-chained audit trail
    last_block = db.query(AuditEntry).order_by(AuditEntry.sequence_id.desc()).first()
    prev_hash = last_block.block_hash if last_block else "0" * 64
    seq = (last_block.sequence_id + 1) if last_block else 1
    
    audit_payload = {
        "finding_id": finding.id,
        "action": action,
        "justification": payload.justification,
        "rule_id": finding.rule_id
    }
    block_content = f"{seq}:{current_user.username}:{action}:{finding.id}:{prev_hash}"
    block_hash = hashlib.sha256(block_content.encode()).hexdigest()

    audit_entry = AuditEntry(
        sequence_id=seq,
        timestamp=datetime.now(timezone.utc),
        actor=current_user.username,
        role=current_user.role,
        action=f"OFFICER_DECISION_{action}",
        resource_type="FINDING",
        resource_id=str(finding.id),
        payload=audit_payload,
        previous_hash=prev_hash,
        block_hash=block_hash
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(finding)

    return finding
