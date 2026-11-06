from typing import Dict, Any
from datetime import datetime
import time
from app.connectors.base import (
    VerificationAdapter, VerificationResult, registry,
    STATUS_VERIFIED, STATUS_MISMATCH_DETECTED, STATUS_EXPIRED,
    STATUS_VERIFICATION_PENDING, STATUS_SOURCE_UNAVAILABLE, STATUS_MANUAL_REVIEW_REQUIRED
)

class FireDepartmentNOCAdapter(VerificationAdapter):
    def __init__(self):
        super().__init__(
            authority_type="FIRE_DEPT",
            source_name="State Directorate of Fire & Emergency Services Portal"
        )

    def verify(self, doc_fields: Dict[str, Any]) -> VerificationResult:
        noc_no = doc_fields.get("noc_no") or doc_fields.get("certificate_no", "")
        expiry_str = doc_fields.get("expiry_date", "")
        
        # Simulate source unavailable for specific error case
        if "MH/NAG/FIRE/2025/1129" in noc_no:
            return VerificationResult(
                authority_type=self.authority_type,
                status=STATUS_SOURCE_UNAVAILABLE,
                source_name=self.source_name,
                response_payload={
                    "status_code": 504,
                    "error": "Gateway Timeout: Upstream State Fire Department Database unresponsive",
                    "retries_exhausted": 3,
                    "recommended_action": "Rerouted to Scrutiny Officer for offline manual verification"
                },
                latency_ms=2800,
                retry_count=3,
                needs_manual_review=True
            )

        if expiry_str:
            try:
                exp_date = datetime.strptime(expiry_str, "%Y-%m-%d")
                if exp_date < datetime(2026, 6, 30):
                    return VerificationResult(
                        authority_type=self.authority_type,
                        status=STATUS_EXPIRED,
                        source_name=self.source_name,
                        response_payload={
                            "noc_no": noc_no,
                            "database_status": "EXPIRED",
                            "expired_on": expiry_str,
                            "renewal_applied": False
                        },
                        latency_ms=220
                    )
            except ValueError:
                pass

        return VerificationResult(
            authority_type=self.authority_type,
            status=STATUS_VERIFIED,
            source_name=self.source_name,
            response_payload={
                "noc_no": noc_no,
                "database_status": "VALID_ACTIVE",
                "building_clearance": "APPROVED_GROUND_PLUS_3",
                "verified_digital_signature": True
            },
            latency_ms=190
        )

class LandRevenueAdapter(VerificationAdapter):
    def __init__(self):
        super().__init__(
            authority_type="LAND_REVENUE",
            source_name="State Land & Revenue Records Web Portal (Bhoomi / Mahabhulekh)"
        )

    def verify(self, doc_fields: Dict[str, Any]) -> VerificationResult:
        survey_no = doc_fields.get("survey_no", "")
        deed_no = doc_fields.get("deed_no") or doc_fields.get("certificate_no", "")

        # Check for mismatch condition
        if "98/4" in survey_no:
            return VerificationResult(
                authority_type=self.authority_type,
                status=STATUS_MISMATCH_DETECTED,
                source_name=self.source_name,
                response_payload={
                    "queried_survey_no": survey_no,
                    "registered_owner": "Local Agricultural Landlord (Non-Educational)",
                    "title_discrepancy": "Deed survey 98/4 does not correspond to applicant educational trust campus"
                },
                latency_ms=310
            )

        return VerificationResult(
            authority_type=self.authority_type,
            status=STATUS_VERIFIED,
            source_name=self.source_name,
            response_payload={
                "deed_no": deed_no,
                "survey_no": survey_no,
                "encumbrance_status": "NIL_ENCUMBRANCE",
                "land_use": "INSTITUTIONAL_APPROVED"
            },
            latency_ms=240
        )

class NAACNBAAdapter(VerificationAdapter):
    def __init__(self):
        super().__init__(
            authority_type="NAAC_NBA",
            source_name="National Assessment & Accreditation Council (NAAC) National Repository"
        )

    def verify(self, doc_fields: Dict[str, Any]) -> VerificationResult:
        cert_no = doc_fields.get("cert_no") or doc_fields.get("certificate_no", "")
        inst_name = doc_fields.get("institute_name", "")

        if "Vidya" in inst_name and "NAAC/EC/PS/88/A++" in cert_no:
            return VerificationResult(
                authority_type=self.authority_type,
                status=STATUS_MISMATCH_DETECTED,
                source_name=self.source_name,
                response_payload={
                    "cert_no": cert_no,
                    "registered_institution": "Aryabhatta Institute of Technology & Sciences (Bengaluru)",
                    "claimant_institution": inst_name,
                    "status": "FRAUDULENT_REUSE_FLAG"
                },
                latency_ms=350,
                needs_manual_review=True
            )

        return VerificationResult(
            authority_type=self.authority_type,
            status=STATUS_VERIFIED,
            source_name=self.source_name,
            response_payload={
                "cert_no": cert_no,
                "status": "ACCREDITED_ACTIVE",
                "grade": "A++",
                "cycle": 2
            },
            latency_ms=210
        )

class UniversityAffiliationAdapter(VerificationAdapter):
    def __init__(self):
        super().__init__(
            authority_type="UNIVERSITY",
            source_name="State Technological University Academic Affiliation Portal"
        )

    def verify(self, doc_fields: Dict[str, Any]) -> VerificationResult:
        return VerificationResult(
            authority_type=self.authority_type,
            status=STATUS_VERIFIED,
            source_name=self.source_name,
            response_payload={
                "affiliation_status": "CONTINUATION_GRANTED",
                "academic_year": "2026-2027",
                "compliance_affidavit": "RECEIVED"
            },
            latency_ms=180
        )

# Register all simulated adapters
registry.register(FireDepartmentNOCAdapter())
registry.register(LandRevenueAdapter())
registry.register(NAACNBAAdapter())
registry.register(UniversityAffiliationAdapter())
