from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import time

# Exact state machine values
STATUS_VERIFIED = "VERIFIED"
STATUS_MISMATCH_DETECTED = "MISMATCH_DETECTED"
STATUS_EXPIRED = "EXPIRED"
STATUS_VERIFICATION_PENDING = "VERIFICATION_PENDING"
STATUS_SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"
STATUS_MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED"

ALL_CONNECTOR_STATUSES = [
    STATUS_VERIFIED,
    STATUS_MISMATCH_DETECTED,
    STATUS_EXPIRED,
    STATUS_VERIFICATION_PENDING,
    STATUS_SOURCE_UNAVAILABLE,
    STATUS_MANUAL_REVIEW_REQUIRED
]

@dataclass
class VerificationResult:
    authority_type: str
    status: str
    source_name: str
    is_simulated: bool = True
    response_payload: Dict[str, Any] = field(default_factory=dict)
    response_hash: str = ""
    latency_ms: int = 150
    retry_count: int = 0
    needs_manual_review: bool = False
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def __post_init__(self):
        if not self.response_hash and self.response_payload:
            payload_str = str(sorted(self.response_payload.items()))
            self.response_hash = hashlib.sha256(payload_str.encode()).hexdigest()
        if self.status in [STATUS_SOURCE_UNAVAILABLE, STATUS_MANUAL_REVIEW_REQUIRED]:
            self.needs_manual_review = True

class VerificationAdapter(ABC):
    def __init__(self, authority_type: str, source_name: str):
        self.authority_type = authority_type
        self.source_name = source_name

    @abstractmethod
    def verify(self, doc_fields: Dict[str, Any]) -> VerificationResult:
        pass

class ConnectorRegistry:
    def __init__(self):
        self._adapters: Dict[str, VerificationAdapter] = {}

    def register(self, adapter: VerificationAdapter):
        self._adapters[adapter.authority_type] = adapter

    def get(self, authority_type: str) -> Optional[VerificationAdapter]:
        return self._adapters.get(authority_type)

    def verify_document(self, authority_type: str, doc_fields: Dict[str, Any]) -> VerificationResult:
        adapter = self.get(authority_type)
        if not adapter:
            return VerificationResult(
                authority_type=authority_type,
                status=STATUS_MANUAL_REVIEW_REQUIRED,
                source_name="Unknown Authority",
                response_payload={"error": f"No verification connector registered for {authority_type}"},
                needs_manual_review=True
            )
        return adapter.verify(doc_fields)

registry = ConnectorRegistry()
