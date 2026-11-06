"""
SatyaCheck AI — Verification Agent Orchestrator.
Coordinates multi-step regulatory document verification via Gemini Tool Calling
with deterministic fallback, bounded loops, cycle detection, and evidence auditing.
"""

import os
import time
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Application, Document, Finding, AgentExecutionRecord
from app.services.gemini_service import gemini_service, GeminiConfigError, GeminiAPIError
from app.agent.schemas import (
    AgentFinding, AgentTraceStep, AgentVerificationReport,
    ClassifyDocumentsInput, ExtractDocumentFieldsInput, CheckRegulatoryRulesInput,
    CompareApplicationRecordsInput, DetectDocumentAnomaliesInput,
    VerifyAuthorityRecordInput, RetrieveApplicationHistoryInput, GenerateEvidenceReportInput
)
from app.agent.tools import AgentToolRegistry
from app.connectors.base import STATUS_SOURCE_UNAVAILABLE, STATUS_MANUAL_REVIEW_REQUIRED

logger = logging.getLogger("satyacheck.agent.orchestrator")

SYSTEM_INSTRUCTION = """You are SatyaCheck AI, a Senior AICTE Regulatory Verification Agent.
Your responsibility is to conduct thorough, evidence-linked verification of Extension of Approval (EoA) applications.

OPERATING PRINCIPLES:
1. Strict Tool Grounding: Every finding MUST be grounded in actual tool output. NEVER hallucinate or invent document numbers, dates, survey numbers, or verification outcomes.
2. Step-by-Step Scrutiny:
   - Step 1: Inspect application details and retrieve baseline history using `retrieve_application_history`.
   - Step 2: Classify all documents using `classify_documents`.
   - Step 3: Extract structured fields from uploaded certificates using `extract_document_fields`.
   - Step 4: Run forensic anomaly detection (ELA, copy-move, QR, digital signatures) using `detect_document_anomalies`.
   - Step 5: Verify credentials against statutory issuing authorities (Fire, Revenue, NAAC/NBA) via `verify_authority_record`.
   - Step 6: Evaluate statutory AICTE handbook rules using `check_regulatory_rules`.
   - Step 7: Cross-verify declared application parameters against baseline land deed records using `compare_application_records`.
   - Step 8: Synthesize findings into the final dossier with `generate_evidence_report`.
3. Non-Rejection Policy: SatyaCheck AI is a decision-support system. Never issue an automated rejection. Deficiencies and anomalies must be flagged for authorized human scrutiny officers.
4. When all tools are executed, provide a concise, evidence-linked executive summary of compliance, highlighted risks, and recommended officer actions.
"""

class VerificationAgentOrchestrator:
    def __init__(self, db: Session):
        self.db = db
        self.tool_registry = AgentToolRegistry(db)
        self.max_steps = settings.AGENT_MAX_STEPS
        self.timeout_seconds = settings.AGENT_TIMEOUT_SECONDS

    def run_verification(
        self,
        application_id: int,
        mode: str = "auto",
        scrutiny_focus: Optional[str] = None
    ) -> AgentVerificationReport:
        """
        Executes the AI Verification Agent on the target application.
        Supports 'gemini', 'offline', or 'auto' (tries Gemini, falls back cleanly).
        """
        app = self.db.query(Application).filter(Application.id == application_id).first()
        if not app:
            raise ValueError(f"Application with ID {application_id} not found")

        execution_id = f"exec-{uuid.uuid4().hex[:12]}"
        start_time = time.time()

        # Decide execution mode
        should_use_gemini = False
        if mode == "gemini":
            should_use_gemini = True
        elif mode == "offline":
            should_use_gemini = False
        else:  # auto
            should_use_gemini = gemini_service.is_available and not settings.USE_OFFLINE_DETECTORS

        report: Optional[AgentVerificationReport] = None

        if should_use_gemini:
            try:
                logger.info(f"Starting Gemini Tool-Calling Verification for Application {app.application_number}")
                report = self._run_gemini_loop(app, execution_id, start_time, scrutiny_focus)
            except Exception as e:
                logger.warning(f"Gemini execution encountered error: {e}. Falling back to offline deterministic mode.")
                report = self._run_offline_pipeline(
                    app,
                    execution_id,
                    start_time,
                    scrutiny_focus,
                    fallback_reason=f"Gemini unavailable or error: {str(e)}"
                )
        else:
            logger.info(f"Running Offline Deterministic Verification for Application {app.application_number}")
            report = self._run_offline_pipeline(app, execution_id, start_time, scrutiny_focus)

        # Persist execution record in DB
        try:
            self._save_execution_record(report)
        except Exception as e:
            logger.error(f"Failed to persist execution record {execution_id}: {e}")

        return report

    def _execute_tool_by_name(self, tool_name: str, args: Dict[str, Any]) -> Tuple[Dict[str, Any], int, str]:
        """Dispatches tool call with timing, argument validation, and exception safety."""
        t0 = time.time()
        status = "SUCCESS"
        result: Dict[str, Any] = {}

        try:
            if tool_name == "classify_documents":
                app_id = int(args.get("application_id", 0))
                result = self.tool_registry.classify_documents(app_id)
            elif tool_name == "extract_document_fields":
                doc_id = int(args.get("document_id", 0))
                result = self.tool_registry.extract_document_fields(doc_id)
            elif tool_name == "check_regulatory_rules":
                app_id = int(args.get("application_id", 0))
                result = self.tool_registry.check_regulatory_rules(app_id)
            elif tool_name == "compare_application_records":
                app_id = int(args.get("application_id", 0))
                result = self.tool_registry.compare_application_records(app_id)
            elif tool_name == "detect_document_anomalies":
                doc_id = int(args.get("document_id", 0))
                result = self.tool_registry.detect_document_anomalies(doc_id)
            elif tool_name == "verify_authority_record":
                doc_id = int(args.get("document_id", 0))
                v_type = str(args.get("verification_type", "FIRE_DEPT"))
                result = self.tool_registry.verify_authority_record(doc_id, v_type)
            elif tool_name == "retrieve_application_history":
                app_id = int(args.get("application_id", 0))
                result = self.tool_registry.retrieve_application_history(app_id)
            elif tool_name == "generate_evidence_report":
                app_id = int(args.get("application_id", 0))
                f_list = args.get("findings", [])
                result = self.tool_registry.generate_evidence_report(app_id, f_list)
            else:
                status = "ERROR"
                result = {"error": f"Unknown tool '{tool_name}'"}
        except Exception as ex:
            status = "ERROR"
            result = {"error": f"Tool execution failed: {str(ex)}"}
            logger.error(f"Error executing {tool_name} with {args}: {ex}")

        latency_ms = int((time.time() - t0) * 1000)
        return result, latency_ms, status

    def _run_gemini_loop(
        self,
        app: Application,
        execution_id: str,
        start_time: float,
        scrutiny_focus: Optional[str]
    ) -> AgentVerificationReport:
        """Executes full Gemini multi-turn Tool Calling loop."""
        from google.genai import types

        client = gemini_service.get_client()

        # Define callable tools
        def classify_documents(application_id: int) -> Dict[str, Any]:
            """Retrieves and classifies all uploaded application documents (Fire NOC, Land Deed, NAAC, etc.)."""
            return self.tool_registry.classify_documents(application_id)

        def extract_document_fields(document_id: int) -> Dict[str, Any]:
            """Extracts structured fields (dates, certificate nos, survey nos) and OCR text from a document."""
            return self.tool_registry.extract_document_fields(document_id)

        def check_regulatory_rules(application_id: int) -> Dict[str, Any]:
            """Runs the 26 AICTE APH 2026 handbook regulatory rules against the application."""
            return self.tool_registry.check_regulatory_rules(application_id)

        def compare_application_records(application_id: int) -> Dict[str, Any]:
            """Cross-checks declared institutional parameters against the AICTE baseline master and deed records."""
            return self.tool_registry.compare_application_records(application_id)

        def detect_document_anomalies(document_id: int) -> Dict[str, Any]:
            """Performs ELA, copy-move detection, QR code check, perceptual hash deduplication, and digital signature inspection."""
            return self.tool_registry.detect_document_anomalies(document_id)

        def verify_authority_record(document_id: int, verification_type: str) -> Dict[str, Any]:
            """Simulates statutory issuing authority verification (FIRE_DEPT, LAND_REVENUE, NAAC_NBA, UNIVERSITY)."""
            return self.tool_registry.verify_authority_record(document_id, verification_type)

        def retrieve_application_history(application_id: int) -> Dict[str, Any]:
            """Retrieves institutional baseline history, past deficiencies, and prior approved intake."""
            return self.tool_registry.retrieve_application_history(application_id)

        def generate_evidence_report(application_id: int, findings: List[Dict[str, Any]]) -> Dict[str, Any]:
            """Synthesizes all findings into a composite risk assessment and human review advisory."""
            return self.tool_registry.generate_evidence_report(application_id, findings)

        tools = [
            classify_documents,
            extract_document_fields,
            check_regulatory_rules,
            compare_application_records,
            detect_document_anomalies,
            verify_authority_record,
            retrieve_application_history,
            generate_evidence_report,
        ]

        trace: List[AgentTraceStep] = []
        collected_findings: List[AgentFinding] = []
        seen_calls: Dict[str, int] = {}
        total_prompt_tokens = 0
        total_candidate_tokens = 0

        inst = app.institution
        initial_prompt = (
            f"Initiate statutory verification for AICTE Application Number: '{app.application_number}' "
            f"(Internal ID: {app.id}).\n"
            f"Institution Name: {inst.name} (AICTE ID: {inst.aicte_id}).\n"
            f"Category: {app.category}, Academic Year: {app.academic_year}.\n"
            f"Declared Data: {json.dumps(app.declared_data or {})}.\n"
            f"Scrutiny Focus: {scrutiny_focus or 'Complete Comprehensive Statutory Verification'}.\n\n"
            f"Execute the verification workflow by selecting the necessary tools to check document validity, "
            f"detect anomalies, verify external authorities, cross-check records, and evaluate AICTE regulations."
        )

        contents: List[types.Content] = [
            types.Content(role="user", parts=[types.Part.from_text(text=initial_prompt)])
        ]

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.1,
            tools=tools,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
        )

        step_counter = 0
        final_summary = ""

        while step_counter < self.max_steps:
            # Check timeout
            if time.time() - start_time > self.timeout_seconds:
                trace.append(AgentTraceStep(
                    step_number=step_counter + 1,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    thought="Execution reached safety time threshold. Concluding agent loop.",
                    tool_name="safety_timeout",
                    input_params={},
                    output_summary=f"Timeout limit of {self.timeout_seconds}s reached.",
                    status="SKIPPED"
                ))
                break

            step_counter += 1

            response = client.models.generate_content(
                model=gemini_service.model_name,
                contents=contents,
                config=config
            )

            # Accumulate token metrics if available
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                total_prompt_tokens += getattr(response.usage_metadata, "prompt_token_count", 0) or 0
                total_candidate_tokens += getattr(response.usage_metadata, "candidates_token_count", 0) or 0

            # If no function calls requested, Gemini has completed its evaluation
            if not response.function_calls:
                final_summary = (response.text or "").strip()
                break

            # Handle Function Calls in current candidate turn
            candidate_content = response.candidates[0].content
            contents.append(candidate_content)

            tool_response_parts: List[types.Part] = []

            for fc in response.function_calls:
                call_key = f"{fc.name}:{json.dumps(dict(fc.args or {}), sort_keys=True)}"
                seen_calls[call_key] = seen_calls.get(call_key, 0) + 1

                # Protection against infinite repetitive loops
                if seen_calls[call_key] > 2:
                    summary_msg = f"Cycle prevention: tool '{fc.name}' invoked with identical arguments multiple times. Skipping duplicate call."
                    trace.append(AgentTraceStep(
                        step_number=len(trace) + 1,
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        tool_name=fc.name,
                        input_params=dict(fc.args or {}),
                        output_summary=summary_msg,
                        status="FILTERED"
                    ))
                    tool_response_parts.append(types.Part.from_function_response(
                        name=fc.name,
                        response={"status": "SKIPPED_DUPLICATE_CALL", "message": summary_msg}
                    ))
                    continue

                # Execute Python tool
                tool_args = dict(fc.args or {})
                tool_result, latency, status = self._execute_tool_by_name(fc.name, tool_args)

                # Process findings generated by tools
                self._harvest_tool_findings(fc.name, tool_result, collected_findings, app)

                # Generate brief output summary for timeline
                output_str = self._summarize_tool_result(fc.name, tool_result)

                trace.append(AgentTraceStep(
                    step_number=len(trace) + 1,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    tool_name=fc.name,
                    input_params=tool_args,
                    output_summary=output_str,
                    full_output=tool_result,
                    latency_ms=latency,
                    status=status
                ))

                tool_response_parts.append(types.Part.from_function_response(
                    name=fc.name,
                    response={"result": tool_result}
                ))

            # Send function responses back to Gemini
            contents.append(types.Content(role="tool", parts=tool_response_parts))

        # Synthesize final dossier
        evidence_eval = self.tool_registry.generate_evidence_report(
            app.id,
            [f.model_dump() for f in collected_findings]
        )

        duration = round(time.time() - start_time, 2)
        needs_human, reasons = self._determine_human_review(collected_findings, trace)

        if not final_summary:
            final_summary = self._build_deterministic_summary(app, collected_findings, evidence_eval)

        # Cost estimation: roughly $0.075 / 1M prompt, $0.30 / 1M candidate for Flash
        est_cost = ((total_prompt_tokens * 0.075) + (total_candidate_tokens * 0.30)) / 1_000_000

        return AgentVerificationReport(
            execution_id=execution_id,
            application_id=app.id,
            application_number=app.application_number,
            institution_name=app.institution.name,
            execution_mode="gemini_tool_calling",
            status="HUMAN_REVIEW_REQUIRED" if needs_human else "COMPLETED",
            overall_risk_score=evidence_eval["overall_risk_score"],
            overall_risk_level=evidence_eval["overall_risk_level"],
            recommended_action=evidence_eval["recommended_action"],
            total_tools_called=len([t for t in trace if t.status != "SKIPPED"]),
            duration_seconds=duration,
            token_usage={
                "prompt_tokens": total_prompt_tokens,
                "candidate_tokens": total_candidate_tokens,
                "total_tokens": total_prompt_tokens + total_candidate_tokens
            },
            estimated_cost_usd=round(est_cost, 6),
            trace=trace,
            findings=collected_findings,
            summary=final_summary,
            needs_human_review=needs_human,
            human_review_reasons=reasons,
            unsupported_findings_prevented=0,
            created_at=datetime.now(timezone.utc).isoformat()
        )

    def _run_offline_pipeline(
        self,
        app: Application,
        execution_id: str,
        start_time: float,
        scrutiny_focus: Optional[str],
        fallback_reason: Optional[str] = None
    ) -> AgentVerificationReport:
        """
        Executes the identical toolchain in deterministic offline sequence.
        Produces full evidence provenance, timeline trace, and finding dossier.
        """
        trace: List[AgentTraceStep] = []
        collected_findings: List[AgentFinding] = []

        if fallback_reason:
            trace.append(AgentTraceStep(
                step_number=len(trace) + 1,
                timestamp=datetime.now(timezone.utc).isoformat(),
                thought="Offline mode engaged.",
                tool_name="execution_mode_selector",
                input_params={"fallback_reason": fallback_reason},
                output_summary=f"Deterministic Offline Mode Active: {fallback_reason}",
                status="SUCCESS"
            ))

        # 1. Retrieve History
        hist_res, lat, st = self._execute_tool_by_name("retrieve_application_history", {"application_id": app.id})
        trace.append(AgentTraceStep(
            step_number=len(trace) + 1,
            timestamp=datetime.now(timezone.utc).isoformat(),
            thought="Inspecting institution baseline master records and historical accreditation standing.",
            tool_name="retrieve_application_history",
            input_params={"application_id": app.id},
            output_summary=self._summarize_tool_result("retrieve_application_history", hist_res),
            full_output=hist_res,
            latency_ms=lat,
            status=st
        ))

        # 2. Classify Documents
        class_res, lat, st = self._execute_tool_by_name("classify_documents", {"application_id": app.id})
        trace.append(AgentTraceStep(
            step_number=len(trace) + 1,
            timestamp=datetime.now(timezone.utc).isoformat(),
            thought="Classifying uploaded certificates into statutory compliance categories.",
            tool_name="classify_documents",
            input_params={"application_id": app.id},
            output_summary=self._summarize_tool_result("classify_documents", class_res),
            full_output=class_res,
            latency_ms=lat,
            status=st
        ))

        docs = class_res.get("documents", [])

        # 3. Extract Document Fields & 4. Detect Anomalies & 5. Verify Authorities
        for d in docs:
            doc_id = d["document_id"]
            d_type = d["doc_type"]

            # Extraction
            ext_res, lat, st = self._execute_tool_by_name("extract_document_fields", {"document_id": doc_id})
            trace.append(AgentTraceStep(
                step_number=len(trace) + 1,
                timestamp=datetime.now(timezone.utc).isoformat(),
                thought=f"Extracting structured fields and metadata from {d['file_name']}.",
                tool_name="extract_document_fields",
                input_params={"document_id": doc_id},
                output_summary=self._summarize_tool_result("extract_document_fields", ext_res),
                full_output=ext_res,
                latency_ms=lat,
                status=st
            ))

            # Forensic Analysis
            anom_res, lat, st = self._execute_tool_by_name("detect_document_anomalies", {"document_id": doc_id})
            self._harvest_tool_findings("detect_document_anomalies", anom_res, collected_findings, app)
            trace.append(AgentTraceStep(
                step_number=len(trace) + 1,
                timestamp=datetime.now(timezone.utc).isoformat(),
                thought=f"Running ELA heatmap, copy-move matching, and digital signature checks on {d['file_name']}.",
                tool_name="detect_document_anomalies",
                input_params={"document_id": doc_id},
                output_summary=self._summarize_tool_result("detect_document_anomalies", anom_res),
                full_output=anom_res,
                latency_ms=lat,
                status=st
            ))

            # Authority Verification (for verifiable certificates)
            if d_type in ("FIRE_NOC", "LAND_DEED", "NAAC_NBA"):
                auth_type = "FIRE_DEPT" if d_type == "FIRE_NOC" else ("LAND_REVENUE" if d_type == "LAND_DEED" else "NAAC_NBA")
                auth_res, lat, st = self._execute_tool_by_name("verify_authority_record", {"document_id": doc_id, "verification_type": auth_type})
                self._harvest_tool_findings("verify_authority_record", auth_res, collected_findings, app)
                trace.append(AgentTraceStep(
                    step_number=len(trace) + 1,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    thought=f"Cross-referencing {d['file_name']} with external {auth_type} issuing portal.",
                    tool_name="verify_authority_record",
                    input_params={"document_id": doc_id, "verification_type": auth_type},
                    output_summary=self._summarize_tool_result("verify_authority_record", auth_res),
                    full_output=auth_res,
                    latency_ms=lat,
                    status=st
                ))

        # 6. Check Regulatory Rules
        rule_res, lat, st = self._execute_tool_by_name("check_regulatory_rules", {"application_id": app.id})
        self._harvest_tool_findings("check_regulatory_rules", rule_res, collected_findings, app)
        trace.append(AgentTraceStep(
            step_number=len(trace) + 1,
            timestamp=datetime.now(timezone.utc).isoformat(),
            thought="Evaluating 26 statutory AICTE Approval Process Handbook (APH 2026) normative clauses.",
            tool_name="check_regulatory_rules",
            input_params={"application_id": app.id},
            output_summary=self._summarize_tool_result("check_regulatory_rules", rule_res),
            full_output=rule_res,
            latency_ms=lat,
            status=st
        ))

        # 7. Compare Application Records
        comp_res, lat, st = self._execute_tool_by_name("compare_application_records", {"application_id": app.id})
        self._harvest_tool_findings("compare_application_records", comp_res, collected_findings, app)
        trace.append(AgentTraceStep(
            step_number=len(trace) + 1,
            timestamp=datetime.now(timezone.utc).isoformat(),
            thought="Auditing declared application parameters against baseline land parcel and intake quotas.",
            tool_name="compare_application_records",
            input_params={"application_id": app.id},
            output_summary=self._summarize_tool_result("compare_application_records", comp_res),
            full_output=comp_res,
            latency_ms=lat,
            status=st
        ))

        # 8. Generate Evidence Report
        evidence_eval, lat, st = self._execute_tool_by_name("generate_evidence_report", {
            "application_id": app.id,
            "findings": [f.model_dump() for f in collected_findings]
        })
        trace.append(AgentTraceStep(
            step_number=len(trace) + 1,
            timestamp=datetime.now(timezone.utc).isoformat(),
            thought="Compiling immutable evidence dossier and calculating composite risk rating.",
            tool_name="generate_evidence_report",
            input_params={"application_id": app.id, "findings_count": len(collected_findings)},
            output_summary=self._summarize_tool_result("generate_evidence_report", evidence_eval),
            full_output=evidence_eval,
            latency_ms=lat,
            status=st
        ))

        duration = round(time.time() - start_time, 2)
        needs_human, reasons = self._determine_human_review(collected_findings, trace)
        final_summary = self._build_deterministic_summary(app, collected_findings, evidence_eval)

        return AgentVerificationReport(
            execution_id=execution_id,
            application_id=app.id,
            application_number=app.application_number,
            institution_name=app.institution.name,
            execution_mode="offline_deterministic",
            status="HUMAN_REVIEW_REQUIRED" if needs_human else "COMPLETED",
            overall_risk_score=evidence_eval["overall_risk_score"],
            overall_risk_level=evidence_eval["overall_risk_level"],
            recommended_action=evidence_eval["recommended_action"],
            total_tools_called=len(trace),
            duration_seconds=duration,
            token_usage={"prompt_tokens": 0, "candidate_tokens": 0, "total_tokens": 0},
            estimated_cost_usd=0.0,
            trace=trace,
            findings=collected_findings,
            summary=final_summary,
            needs_human_review=needs_human,
            human_review_reasons=reasons,
            unsupported_findings_prevented=0,
            created_at=datetime.now(timezone.utc).isoformat()
        )

    def _harvest_tool_findings(
        self,
        tool_name: str,
        tool_output: Dict[str, Any],
        findings_list: List[AgentFinding],
        app: Application
    ):
        """Standardizes tool findings and eliminates duplicates."""
        existing_keys = {f"{f.rule_id}:{f.document_id}:{f.clause}" for f in findings_list}

        # 1. Findings from check_regulatory_rules
        if tool_name == "check_regulatory_rules":
            for rf in tool_output.get("findings", []):
                key = f"{rf['rule_id']}:{rf.get('document_id')}:{rf.get('clause')}"
                if key not in existing_keys:
                    existing_keys.add(key)
                    findings_list.append(AgentFinding(
                        finding_id=f"FIND-{len(findings_list) + 1:03d}",
                        rule_id=rf["rule_id"],
                        clause=rf["clause"],
                        category=rf.get("category", "REGULATORY"),
                        severity=rf.get("severity", "HIGH"),
                        explanation=rf.get("reason", ""),
                        document_id=rf.get("document_id"),
                        evidence_bbox=rf.get("evidence_bbox"),
                        extracted_value=str(rf.get("extracted_value", "")),
                        expected_value=str(rf.get("expected_value", "")),
                        tool_source="check_regulatory_rules",
                        verification_status="OPEN",
                        recommended_action=rf.get("recommended_action", "Review against APH norms.")
                    ))

        # 2. Findings from compare_application_records
        elif tool_name == "compare_application_records":
            for disc in tool_output.get("discrepancies", []):
                key = f"{disc['type']}:{disc.get('document_id')}:{disc.get('clause')}"
                if key not in existing_keys:
                    existing_keys.add(key)
                    findings_list.append(AgentFinding(
                        finding_id=f"FIND-{len(findings_list) + 1:03d}",
                        rule_id=disc["type"],
                        clause=disc.get("clause", "APH-2026 Cl 4.1"),
                        category="CONSISTENCY",
                        severity=disc.get("severity", "CRITICAL"),
                        explanation=disc.get("explanation", ""),
                        document_id=disc.get("document_id"),
                        extracted_value=str(disc.get("extracted_value", "")),
                        expected_value=str(disc.get("declared_value", "")),
                        tool_source="compare_application_records",
                        verification_status="OPEN",
                        recommended_action=disc.get("recommended_action", "Cross-examine land revenue records.")
                    ))

        # 3. Findings from detect_document_anomalies
        elif tool_name == "detect_document_anomalies":
            doc_id = tool_output.get("document_id")
            score = tool_output.get("composite_risk_score", 0.0)
            if score >= 0.35:
                key = f"ANOMALY_RISK:{doc_id}:APH-2026 Cl 4.4"
                if key not in existing_keys:
                    existing_keys.add(key)
                    breakdown = tool_output.get("breakdown", [])
                    reasons = []
                    if isinstance(breakdown, list):
                        for item in breakdown:
                            if item.get("flagged") or item.get("score", 0) > 0.3:
                                reasons.append(f"{item.get('detector')}: score {item.get('score', 0):.2f}")
                    elif isinstance(breakdown, dict):
                        if breakdown.get("ela_anomaly_score", 0) > 0.15:
                            reasons.append("ELA highlights altered compression blocks around critical dates")
                        if breakdown.get("duplicate_reuse_flag"):
                            reasons.append("Perceptual hash duplicate detected across distinct institutions")
                        if breakdown.get("suspicious_metadata"):
                            reasons.append("Producer metadata flagged suspicious desktop editor")

                    explanation = "; ".join(reasons) if reasons else f"Multi-detector composite forensic anomaly rating: {score * 100:.1f}/100."
                    bboxes = tool_output.get("evidence_bboxes") or []
                    evidence_bbox = bboxes[0] if bboxes else None

                    findings_list.append(AgentFinding(
                        finding_id=f"FIND-{len(findings_list) + 1:03d}",
                        rule_id="RULE_DOCUMENT_FORENSIC_ANOMALY",
                        clause="APH-2026 Cl 4.4",
                        category="DOCUMENT_AUTHENTICITY",
                        severity="CRITICAL" if score >= 0.70 else "HIGH",
                        explanation=explanation,
                        document_id=doc_id,
                        evidence_bbox=evidence_bbox,
                        extracted_value=f"Forensic Score {score:.2f}",
                        expected_value="< 0.20 (Pristine)",
                        tool_source="detect_document_anomalies",
                        verification_status="OPEN",
                        recommended_action="Subject physical original certificate to forensic scrutiny panel."
                    ))

        # 4. Findings from verify_authority_record
        elif tool_name == "verify_authority_record":
            status = tool_output.get("status")
            auth_type = tool_output.get("authority_type")
            doc_id = tool_output.get("document_id")
            if status in ("EXPIRED", "MISMATCH_DETECTED", "SOURCE_UNAVAILABLE"):
                key = f"AUTH_{status}:{doc_id}:{auth_type}"
                if key not in existing_keys:
                    existing_keys.add(key)
                    sev = "CRITICAL" if status in ("EXPIRED", "MISMATCH_DETECTED") else "HIGH"
                    action = "Verify offline directly with issuing directorate." if status == "SOURCE_UNAVAILABLE" else "Reject invalid certificate and request current renewal."
                    findings_list.append(AgentFinding(
                        finding_id=f"FIND-{len(findings_list) + 1:03d}",
                        rule_id=f"RULE_AUTHORITY_{status}",
                        clause="APH-2026 Cl 5.1",
                        category="REGULATORY",
                        severity=sev,
                        explanation=f"{auth_type} issuing portal returned status: {status}. {json.dumps(tool_output.get('response_payload', {}))}",
                        document_id=doc_id,
                        extracted_value=status,
                        expected_value="VERIFIED",
                        tool_source="verify_authority_record",
                        verification_status="OPEN",
                        recommended_action=action
                    ))

    def _determine_human_review(
        self,
        findings: List[AgentFinding],
        trace: List[AgentTraceStep]
    ) -> Tuple[bool, List[str]]:
        """Determines whether statutory review requires human officer intervention."""
        reasons = []
        for f in findings:
            if f.severity == "CRITICAL":
                reasons.append(f"Critical Finding: {f.explanation} ({f.clause})")
            elif "MISMATCH" in f.rule_id:
                reasons.append(f"Cross-Record Discrepancy: {f.explanation}")
            elif "EXPIRED" in f.rule_id:
                reasons.append(f"Statutory Validity Lapse: {f.explanation}")

        for t in trace:
            if t.tool_name == "verify_authority_record":
                full = t.full_output or {}
                if full.get("needs_manual_review") or full.get("status") == STATUS_SOURCE_UNAVAILABLE:
                    reasons.append(f"Issuing Portal Timeout/Manual Review: {full.get('authority_type')} ({full.get('source_name')})")

        needs_human = len(reasons) > 0
        return needs_human, reasons[:6]  # Return top 6 distinct reasons

    def _summarize_tool_result(self, tool_name: str, result: Dict[str, Any]) -> str:
        """Constructs human-readable timeline summary for the frontend rail."""
        if "error" in result:
            return f"Error: {result['error']}"

        if tool_name == "retrieve_application_history":
            inst = result.get("institution", {})
            return f"Retrieved baseline: Intake={inst.get('approved_intake')}, Faculty={inst.get('faculty_count')}, Land={inst.get('land_acres')} acres."
        elif tool_name == "classify_documents":
            total = result.get("total_documents", 0)
            types_list = [d["doc_type"] for d in result.get("documents", [])]
            return f"Classified {total} documents: {', '.join(types_list[:4])}{'...' if len(types_list) > 4 else ''}."
        elif tool_name == "extract_document_fields":
            fields = result.get("extracted_fields", {})
            return f"Extracted {len(fields)} statutory fields: {', '.join(list(fields.keys())[:4])}."
        elif tool_name == "detect_document_anomalies":
            score = result.get("composite_risk_score", 0.0)
            lvl = result.get("risk_level", "LOW")
            return f"Forensics: Risk={score * 100:.1f}/100 ({lvl})."
        elif tool_name == "verify_authority_record":
            return f"{result.get('authority_type')} verification returned '{result.get('status')}' via {result.get('source_name')} ({result.get('latency_ms')}ms)."
        elif tool_name == "check_regulatory_rules":
            count = result.get("findings_count", 0)
            return f"Evaluated 26 AICTE APH clauses; flagged {count} compliance findings."
        elif tool_name == "compare_application_records":
            disc = result.get("discrepancies_found", 0)
            return f"Cross-record audit identified {disc} discrepancies between deed & declared data."
        elif tool_name == "generate_evidence_report":
            return f"Composite risk score: {result.get('overall_risk_score')}/100 ({result.get('overall_risk_level')}). Action: {result.get('recommended_action')}."
        return json.dumps(result)[:120]

    def _build_deterministic_summary(
        self,
        app: Application,
        findings: List[AgentFinding],
        report: Dict[str, Any]
    ) -> str:
        """Constructs rich narrative executive summary grounded exclusively in tool output."""
        inst = app.institution
        crit_count = sum(1 for f in findings if f.severity == "CRITICAL")
        high_count = sum(1 for f in findings if f.severity == "HIGH")

        summary_lines = [
            f"### Executive Regulatory Scrutiny Dossier — {app.application_number}",
            f"**Institution:** {inst.name} (AICTE ID: {inst.aicte_id})",
            f"**Application Category:** {app.category} | **Academic Year:** {app.academic_year}",
            f"**Composite Compliance Risk:** {report['overall_risk_score']}/100 ({report['overall_risk_level']})",
            "",
            "#### Statutory Verification Summary:"
        ]

        if not findings:
            summary_lines.append(
                "- **Full Regulatory Compliance:** All evaluated statutory requirements (Fire Safety, Land Title, "
                "Faculty-Student ratios, and mandatory infrastructure) meet AICTE Approval Process Handbook (APH 2026) criteria."
            )
            summary_lines.append(
                "- **Forensic Authenticity:** Document Error Level Analysis, QR payloads, and digital signatures show "
                "zero evidence of post-issuance tampering or duplicate submission."
            )
        else:
            summary_lines.append(
                f"- **Deficiencies & Risk Indicators:** The agent identified {len(findings)} statutory finding(s) "
                f"({crit_count} Critical, {high_count} High)."
            )
            for f in findings[:5]:
                summary_lines.append(
                    f"  * **[{f.severity}] {f.clause}:** {f.explanation} *(Evidence Source: `{f.tool_source}`)*"
                )

        summary_lines.extend([
            "",
            "#### Administrative Determination & Officer Recommendation:",
            f"**Recommended Action:** {report['recommended_action']}",
            "",
            "> **Statutory Safeguard Notice:** *Under AICTE administrative governance norms, this report serves exclusively "
            "as preliminary advisory decision-support. Strictly NO automated rejection has occurred. Final statutory determinations "
            "belong solely to the Competent Scrutiny Authority.*"
        ])

        return "\n".join(summary_lines)

    def _save_execution_record(self, report: AgentVerificationReport):
        """Persists the execution trace and dossier into the database."""
        rec = AgentExecutionRecord(
            execution_id=report.execution_id,
            application_id=report.application_id,
            application_number=report.application_number,
            institution_name=report.institution_name,
            execution_mode=report.execution_mode,
            status=report.status,
            overall_risk_score=report.overall_risk_score,
            overall_risk_level=report.overall_risk_level,
            recommended_action=report.recommended_action,
            total_tools_called=report.total_tools_called,
            duration_seconds=report.duration_seconds,
            token_usage=report.token_usage,
            estimated_cost_usd=report.estimated_cost_usd,
            trace=[t.model_dump() for t in report.trace],
            findings=[f.model_dump() for f in report.findings],
            summary=report.summary,
            needs_human_review=report.needs_human_review,
            human_review_reasons=report.human_review_reasons,
            unsupported_findings_prevented=report.unsupported_findings_prevented,
            created_at=datetime.fromisoformat(report.created_at) if isinstance(report.created_at, str) else report.created_at
        )
        self.db.add(rec)
        self.db.commit()
