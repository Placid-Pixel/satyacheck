from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# Auth & User
class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str
    role: str
    institution_id: Optional[int] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str
    institution_id: Optional[int] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    institution_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Institution
class InstitutionBase(BaseModel):
    aicte_id: str
    name: str
    trust_name: str
    address: str
    city: str
    state: str
    pin_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    established_year: int
    approved_intake: int
    land_area_acres: float
    faculty_count: int
    principal_name: Optional[str] = None

class InstitutionResponse(InstitutionBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Findings & Bounding Box Evidence
class EvidenceBBox(BaseModel):
    page: int
    x0: float
    y0: float
    x1: float
    y1: float

class FindingBase(BaseModel):
    rule_id: str
    clause: str
    category: str # REGULATORY, DOCUMENT_AUTHENTICITY, CONSISTENCY, INFRASTRUCTURE
    severity: str # CRITICAL, HIGH, MEDIUM, LOW, INFO
    reason: str
    evidence_bbox: Optional[Dict[str, Any]] = None
    extracted_value: Optional[str] = None
    expected_value: Optional[str] = None
    confidence: float = 1.0
    recommended_action: Optional[str] = None

class FindingResponse(FindingBase):
    id: int
    application_id: int
    document_id: Optional[int] = None
    status: str
    officer_notes: Optional[str] = None
    officer_id: Optional[int] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class FindingActionRequest(BaseModel):
    action: str # ACCEPT, DISMISS, REQUEST_MORE_EVIDENCE, ESCALATE, RECOMMEND_INSPECTION
    justification: str # Officer's required explanation

# Documents
class DocumentResponse(BaseModel):
    id: int
    application_id: int
    doc_type: str
    file_name: str
    file_path: str
    file_size: int
    mime_type: str
    perceptual_hash: Optional[str] = None
    ocr_text: Optional[str] = None
    extracted_fields: Dict[str, Any] = {}
    metadata_info: Dict[str, Any] = {}
    risk_indicators: Dict[str, Any] = {}
    uploaded_at: datetime
    
    class Config:
        from_attributes = True

# Connectors
class ConnectorLogResponse(BaseModel):
    id: int
    application_id: int
    document_id: Optional[int] = None
    authority_type: str
    status: str
    response_payload: Dict[str, Any] = {}
    response_hash: Optional[str] = None
    latency_ms: int
    simulated: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Application
class ApplicationBase(BaseModel):
    application_number: str
    institution_id: int
    category: str
    academic_year: str = "2026-2027"
    declared_data: Dict[str, Any] = {}

class ApplicationResponse(ApplicationBase):
    id: int
    status: str
    risk_score: float
    risk_level: str
    created_at: datetime
    updated_at: datetime
    institution: Optional[InstitutionResponse] = None
    
    class Config:
        from_attributes = True

class ApplicationDetailResponse(ApplicationResponse):
    documents: List[DocumentResponse] = []
    findings: List[FindingResponse] = []
    connector_logs: List[ConnectorLogResponse] = []

# Audit Chain
class AuditEntryResponse(BaseModel):
    id: int
    sequence_id: int
    timestamp: datetime
    actor: str
    role: str
    action: str
    resource_type: str
    resource_id: str
    payload: Dict[str, Any] = {}
    previous_hash: str
    block_hash: str
    
    class Config:
        from_attributes = True

class AuditIntegrityResponse(BaseModel):
    is_valid: bool
    total_blocks: int
    last_verified_at: datetime
    tampered_blocks: List[int] = []
    message: str

# Rules
class RuleResponse(BaseModel):
    id: int
    code: str
    title: str
    description: str
    clause: str
    category: str
    severity: str
    condition_json: Dict[str, Any]
    parameters_json: Dict[str, Any]
    is_active: bool
    
    class Config:
        from_attributes = True

class RuleUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    parameters_json: Optional[Dict[str, Any]] = None
    severity: Optional[str] = None

# Evaluation
class EvaluationMetricResponse(BaseModel):
    field_extraction_accuracy: float
    rule_precision: float
    rule_recall: float
    rule_f1: float
    anomaly_precision: float
    anomaly_recall: float
    anomaly_f1: float
    source_verification_success_rate: float
    avg_verification_time_seconds: float
    estimated_manual_effort_reduction_pct: float
    total_samples: int
    confusion_matrix: Dict[str, int]
    breakdown_by_category: Dict[str, Any]
