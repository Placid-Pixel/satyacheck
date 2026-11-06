"""
Pydantic schemas and models for SatyaCheck AI Verification Agent.
Defines strictly typed structures for tool inputs/outputs, traces, findings, and dossiers.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class EvidenceBBox(BaseModel):
    page: int = 1
    x0: float
    y0: float
    x1: float
    y1: float

class AgentFinding(BaseModel):
    finding_id: str
    rule_id: str
    clause: str
    category: str  # REGULATORY, DOCUMENT_AUTHENTICITY, CONSISTENCY, INFRASTRUCTURE
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW, INFO
    explanation: str
    document_id: Optional[int] = None
    document_name: Optional[str] = None
    page: Optional[int] = 1
    evidence_bbox: Optional[Dict[str, Any]] = None
    extracted_value: Optional[str] = None
    expected_value: Optional[str] = None
    tool_source: str
    verification_status: str = "OPEN"
    recommended_action: str

class AgentTraceStep(BaseModel):
    step_number: int
    timestamp: str
    thought: Optional[str] = None
    tool_name: str
    input_params: Dict[str, Any]
    output_summary: str
    full_output: Optional[Dict[str, Any]] = None
    latency_ms: int = 0
    status: str = "SUCCESS"  # SUCCESS, ERROR, SKIPPED

class AgentVerificationRequest(BaseModel):
    mode: str = Field(default="auto", description="Verification mode: 'auto', 'gemini', or 'offline'")
    scrutiny_focus: Optional[str] = Field(default=None, description="Optional focus area e.g. 'FIRE_SAFETY', 'LAND_SURVEY'")

class AgentVerificationReport(BaseModel):
    execution_id: str
    application_id: int
    application_number: str
    institution_name: str
    execution_mode: str  # 'gemini_tool_calling' or 'offline_deterministic'
    status: str  # 'COMPLETED', 'HUMAN_REVIEW_REQUIRED', 'FAILED'
    overall_risk_score: float
    overall_risk_level: str  # 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    recommended_action: str
    total_tools_called: int
    duration_seconds: float
    token_usage: Dict[str, int] = Field(default_factory=dict)
    estimated_cost_usd: float = 0.0
    trace: List[AgentTraceStep] = Field(default_factory=list)
    findings: List[AgentFinding] = Field(default_factory=list)
    summary: str
    needs_human_review: bool = False
    human_review_reasons: List[str] = Field(default_factory=list)
    unsupported_findings_prevented: int = 0
    created_at: str

# Tool Input Schemas for Strict Argument Validation
class ClassifyDocumentsInput(BaseModel):
    application_id: int = Field(description="ID of the AICTE application whose documents to classify")

class ExtractDocumentFieldsInput(BaseModel):
    document_id: int = Field(description="ID of the document to extract structured fields and OCR from")

class CheckRegulatoryRulesInput(BaseModel):
    application_id: int = Field(description="ID of the application to run the 26 AICTE handbook rules against")

class CompareApplicationRecordsInput(BaseModel):
    application_id: int = Field(description="ID of the application to cross-verify against AICTE master baseline and deed records")

class DetectDocumentAnomaliesInput(BaseModel):
    document_id: int = Field(description="ID of the document to run multi-detector forensic analysis (ELA, Copy-Move, QR, Perceptual Hash, Signature)")

class VerifyAuthorityRecordInput(BaseModel):
    document_id: int = Field(description="ID of the document to verify with issuing authority")
    verification_type: str = Field(description="Authority type: 'FIRE_DEPT', 'LAND_REVENUE', 'NAAC_NBA', 'UNIVERSITY', or 'DIGITAL_SIG'")

class RetrieveApplicationHistoryInput(BaseModel):
    application_id: int = Field(description="ID of the application to retrieve AICTE historical baseline and past accreditation records")

class GenerateEvidenceReportInput(BaseModel):
    application_id: int = Field(description="ID of the application")
    findings: List[Dict[str, Any]] = Field(default_factory=list, description="List of validated findings backed by tool output")

