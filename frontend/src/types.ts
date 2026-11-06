export type Role = 'INSTITUTION_USER' | 'SCRUTINY_OFFICER' | 'SENIOR_AUTHORITY' | 'ADMIN';

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  institution_id?: number | null;
  is_active: boolean;
}

export interface Institution {
  id: number;
  aicte_id: string;
  name: string;
  trust_name: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  latitude?: number;
  longitude?: number;
  established_year: number;
  approved_intake: number;
  land_area_acres: number;
  faculty_count: number;
  principal_name?: string;
}

export interface EvidenceBBox {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Finding {
  id: number;
  application_id: number;
  document_id?: number | null;
  rule_id: string;
  clause: string;
  category: 'REGULATORY' | 'DOCUMENT_AUTHENTICITY' | 'CONSISTENCY' | 'INFRASTRUCTURE' | 'FACULTY' | 'GOVERNANCE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  reason: string;
  evidence_bbox?: EvidenceBBox | null;
  extracted_value?: string | null;
  expected_value?: string | null;
  confidence: number;
  status: 'OPEN' | 'ACCEPTED' | 'DISMISSED' | 'EVIDENCE_REQUESTED' | 'ESCALATED' | 'INSPECTION_RECOMMENDED' | 'RESOLVED';
  recommended_action?: string | null;
  officer_notes?: string | null;
  officer_id?: number | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface DocumentRecord {
  id: number;
  application_id: number;
  doc_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  perceptual_hash?: string;
  ocr_text?: string;
  extracted_fields: Record<string, any>;
  metadata_info: Record<string, any>;
  risk_indicators: Record<string, any>;
  uploaded_at: string;
}

export interface ConnectorLog {
  id: number;
  application_id: number;
  document_id?: number | null;
  authority_type: string;
  status: 'VERIFIED' | 'MISMATCH_DETECTED' | 'EXPIRED' | 'VERIFICATION_PENDING' | 'SOURCE_UNAVAILABLE' | 'MANUAL_REVIEW_REQUIRED';
  response_payload: Record<string, any>;
  response_hash?: string;
  latency_ms: number;
  simulated: boolean;
  created_at: string;
}

export interface Application {
  id: number;
  application_number: string;
  institution_id: number;
  category: string;
  academic_year: string;
  status: string;
  declared_data: Record<string, any>;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  created_at: string;
  updated_at: string;
  institution: Institution;
  documents?: DocumentRecord[];
  findings?: Finding[];
  connector_logs?: ConnectorLog[];
}

export interface Rule {
  code: string;
  clause: string;
  title: string;
  category: string;
  severity: string;
  description: string;
  parameters: Record<string, any>;
  is_active?: boolean;
}

export interface AuditBlock {
  id: number;
  sequence_id: number;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  resource_type: string;
  resource_id: string;
  payload: Record<string, any>;
  previous_hash: string;
  block_hash: string;
}

export interface EvaluationMetrics {
  field_extraction_accuracy: number;
  rule_precision: number;
  rule_recall: number;
  rule_f1: number;
  anomaly_precision: number;
  anomaly_recall: number;
  anomaly_f1: number;
  source_verification_success_rate: number;
  avg_verification_time_seconds: number;
  estimated_manual_effort_reduction_pct: number;
  total_samples: number;
  confusion_matrix: {
    true_positives: number;
    false_positives: number;
    true_negatives: number;
    false_negatives: number;
  };
  breakdown_by_category: Record<string, any>;
}

export interface AgentFinding {
  finding_id: string;
  rule_id: string;
  clause: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  explanation: string;
  document_id?: number | null;
  document_name?: string | null;
  page?: number | null;
  evidence_bbox?: EvidenceBBox | null;
  extracted_value?: string | null;
  expected_value?: string | null;
  tool_source: string;
  verification_status: string;
  recommended_action: string;
}

export interface AgentTraceStep {
  step_number: number;
  timestamp: string;
  thought?: string | null;
  tool_name: string;
  input_params: Record<string, any>;
  output_summary: string;
  full_output?: Record<string, any> | null;
  latency_ms: number;
  status: 'SUCCESS' | 'ERROR' | 'SKIPPED' | 'FILTERED';
}

export interface AgentVerificationReport {
  execution_id: string;
  application_id: number;
  application_number: string;
  institution_name: string;
  execution_mode: 'gemini_tool_calling' | 'offline_deterministic';
  status: 'COMPLETED' | 'HUMAN_REVIEW_REQUIRED' | 'FAILED';
  overall_risk_score: number;
  overall_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommended_action: string;
  total_tools_called: number;
  duration_seconds: number;
  token_usage: {
    prompt_tokens: number;
    candidate_tokens: number;
    total_tokens: number;
  };
  estimated_cost_usd: number;
  trace: AgentTraceStep[];
  findings: AgentFinding[];
  summary: string;
  needs_human_review: boolean;
  human_review_reasons: string[];
  unsupported_findings_prevented: number;
  created_at: string;
}

export interface GeminiStatusResponse {
  connected: boolean;
  model: string;
  latency_ms?: number;
  response?: string;
  error?: string;
}
