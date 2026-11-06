from app.core.database import Base
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False, default="INSTITUTION_USER")
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    
    institution = relationship("Institution", back_populates="users")

class Institution(Base):
    __tablename__ = "institutions"
    
    id = Column(Integer, primary_key=True, index=True)
    aicte_id = Column(String(30), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    trust_name = Column(String(200), nullable=False)
    address = Column(Text, nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    pin_code = Column(String(10), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    established_year = Column(Integer, nullable=False)
    approved_intake = Column(Integer, default=0)
    land_area_acres = Column(Float, default=0.0)
    faculty_count = Column(Integer, default=0)
    principal_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    users = relationship("User", back_populates="institution")
    applications = relationship("Application", back_populates="institution")

class AICTEMasterRecord(Base):
    __tablename__ = "aicte_master_records"
    
    id = Column(Integer, primary_key=True, index=True)
    aicte_id = Column(String(30), unique=True, index=True, nullable=False)
    institution_name = Column(String(200), nullable=False)
    trust_name = Column(String(200), nullable=False)
    principal_name = Column(String(100), nullable=True)
    approved_programmes = Column(JSON, default=list) # List of {programme, course, intake}
    approved_intake = Column(Integer, default=0)
    land_acres = Column(Float, default=0.0)
    builtup_sqm = Column(Float, default=0.0)
    fire_noc_valid_till = Column(String(20), nullable=True)
    building_plan_approved_by = Column(String(100), nullable=True)
    ter_payment_status = Column(String(20), default="PAID")
    last_year_deficiencies = Column(JSON, default=list)
    accreditation_status = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utc_now)

class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    application_number = Column(String(50), unique=True, index=True, nullable=False)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=False)
    category = Column(String(50), nullable=False, default="EOA") # EOA, INTAKE_INCREASE, NEW_COURSE, CHANGE_NAME, CHANGE_LOCATION, CLOSURE
    academic_year = Column(String(20), default="2026-2027")
    status = Column(String(50), default="UNDER_SCRUTINY") # DRAFT, PRE_CHECK_SUBMITTED, UNDER_SCRUTINY, DEFICIENCIES_COMMUNICATED, ESCALATED, APPROVED, REJECTED
    declared_data = Column(JSON, default=dict)
    risk_score = Column(Float, default=0.0) # 0 to 100
    risk_level = Column(String(20), default="LOW") # LOW, MEDIUM, HIGH, CRITICAL
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    institution = relationship("Institution", back_populates="applications")
    documents = relationship("Document", back_populates="application", cascade="all, delete-orphan")
    findings = relationship("Finding", back_populates="application", cascade="all, delete-orphan")
    connector_logs = relationship("ConnectorLog", back_populates="application", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    doc_type = Column(String(50), nullable=False) # FIRE_NOC, LAND_DEED, NAAC_NBA, BUILDING_PLAN, FACULTY_LIST, BOARD_RESOLUTION, TER_RECEIPT, INFRA_PHOTO
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0)
    mime_type = Column(String(50), default="application/pdf")
    perceptual_hash = Column(String(64), nullable=True, index=True)
    ocr_text = Column(Text, nullable=True)
    extracted_fields = Column(JSON, default=dict)
    metadata_info = Column(JSON, default=dict)
    risk_indicators = Column(JSON, default=dict)
    uploaded_at = Column(DateTime, default=utc_now)
    
    application = relationship("Application", back_populates="documents")
    findings = relationship("Finding", back_populates="document")
    connector_logs = relationship("ConnectorLog", back_populates="document")

class Finding(Base):
    __tablename__ = "findings"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    rule_id = Column(String(50), nullable=False)
    clause = Column(String(50), nullable=False) # e.g. APH-2026 Cl 4.1.2
    category = Column(String(50), nullable=False) # REGULATORY, DOCUMENT_AUTHENTICITY, CONSISTENCY, INFRASTRUCTURE
    severity = Column(String(20), nullable=False) # CRITICAL, HIGH, MEDIUM, LOW, INFO
    reason = Column(Text, nullable=False)
    evidence_bbox = Column(JSON, nullable=True) # {page: 1, x0: 50, y0: 100, x1: 250, y1: 150}
    extracted_value = Column(String(255), nullable=True)
    expected_value = Column(String(255), nullable=True)
    confidence = Column(Float, default=1.0) # 0.0 to 1.0
    status = Column(String(30), default="OPEN") # OPEN, ACCEPTED, DISMISSED, ESCALATED, RESOLVED
    recommended_action = Column(Text, nullable=True)
    officer_notes = Column(Text, nullable=True)
    officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    application = relationship("Application", back_populates="findings")
    document = relationship("Document", back_populates="findings")

class ConnectorLog(Base):
    __tablename__ = "connector_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    authority_type = Column(String(50), nullable=False) # FIRE_DEPT, NAAC_NBA, STATE_GOVT, LAND_REVENUE, UNIVERSITY, DIGITAL_SIG
    status = Column(String(50), nullable=False) # VERIFIED, MISMATCH_DETECTED, EXPIRED, VERIFICATION_PENDING, SOURCE_UNAVAILABLE, MANUAL_REVIEW_REQUIRED
    response_payload = Column(JSON, default=dict)
    response_hash = Column(String(64), nullable=True)
    latency_ms = Column(Integer, default=100)
    simulated = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    
    application = relationship("Application", back_populates="connector_logs")
    document = relationship("Document", back_populates="connector_logs")

class AuditEntry(Base):
    __tablename__ = "audit_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    sequence_id = Column(Integer, unique=True, index=True, nullable=False)
    timestamp = Column(DateTime, default=utc_now)
    actor = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(100), nullable=False)
    payload = Column(JSON, default=dict)
    previous_hash = Column(String(64), nullable=False)
    block_hash = Column(String(64), nullable=False)

class RuleModel(Base):
    __tablename__ = "rules"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    clause = Column(String(50), nullable=False)
    category = Column(String(50), nullable=False) # REGULATORY, INFRASTRUCTURE, FACULTY, GOVERNANCE
    severity = Column(String(20), nullable=False) # CRITICAL, HIGH, MEDIUM, LOW
    condition_json = Column(JSON, nullable=False)
    parameters_json = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

class EvaluationSample(Base):
    __tablename__ = "evaluation_samples"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, nullable=True)
    case_name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)
    ground_truth_findings = Column(JSON, default=list) # List of expected finding codes
    detected_findings = Column(JSON, default=list)
    extraction_matches = Column(Integer, default=0)
    extraction_total = Column(Integer, default=0)
    has_injected_anomaly = Column(Boolean, default=False)
    anomaly_detected = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

class AgentExecutionRecord(Base):
    __tablename__ = "agent_execution_records"
    
    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(String(64), unique=True, index=True, nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    application_number = Column(String(50), nullable=False)
    institution_name = Column(String(200), nullable=False)
    execution_mode = Column(String(50), nullable=False) # 'gemini_tool_calling', 'offline_deterministic'
    status = Column(String(50), nullable=False) # 'COMPLETED', 'HUMAN_REVIEW_REQUIRED', 'FAILED'
    overall_risk_score = Column(Float, default=0.0)
    overall_risk_level = Column(String(20), default="LOW")
    recommended_action = Column(Text, nullable=False)
    total_tools_called = Column(Integer, default=0)
    duration_seconds = Column(Float, default=0.0)
    token_usage = Column(JSON, default=dict)
    estimated_cost_usd = Column(Float, default=0.0)
    trace = Column(JSON, default=list)
    findings = Column(JSON, default=list)
    summary = Column(Text, nullable=False)
    needs_human_review = Column(Boolean, default=False)
    human_review_reasons = Column(JSON, default=list)
    unsupported_findings_prevented = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)

