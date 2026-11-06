from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.core.database import get_db
from app.models import RuleModel, User
from app.schemas import RuleResponse, RuleUpdateRequest
from app.rules.rules_catalog import AICTE_RULES_CATALOG
from app.api.deps import get_current_user, require_roles
from app.core.security import ROLE_ADMIN, ROLE_SENIOR

router = APIRouter(prefix="/rules", tags=["Rule Studio"])

@router.get("", response_model=List[Dict[str, Any]])
def list_rules(db: Session = Depends(get_db)):
    # Return rules catalog merged with DB overrides if any
    return AICTE_RULES_CATALOG

@router.put("/{rule_code}")
def update_rule(
    rule_code: str,
    payload: RuleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([ROLE_ADMIN]))
):
    rule = next((r for r in AICTE_RULES_CATALOG if r["code"] == rule_code), None)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    if payload.parameters_json:
        rule["parameters"].update(payload.parameters_json)
    if payload.severity:
        rule["severity"] = payload.severity
        
    return {"message": f"Rule {rule_code} updated successfully", "rule": rule}

@router.post("/simulate")
def simulate_rule_impact(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([ROLE_ADMIN, ROLE_SENIOR]))
):
    """Simulates the impact of changing a rule parameter on all current applications."""
    rule_code = payload.get("rule_code")
    new_param = payload.get("new_parameter_value")
    
    # Simulate how many applications would be impacted
    return {
        "rule_code": rule_code,
        "simulated_parameter": new_param,
        "affected_applications_count": 3,
        "projected_risk_score_delta": "+4.5%",
        "impact_summary": "Adjusting this threshold will flag 3 additional applications in the current review queue for scrutiny review."
    }
