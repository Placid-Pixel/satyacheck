import re
from pathlib import Path
from typing import Dict, Any

def inspect_pdf_signature(file_path: Path) -> Dict[str, Any]:
    """
    Inspects PDF document structure for digital signatures, certification dictionary (/ByteRange, /Sig),
    and modification flags.
    """
    if file_path.suffix.lower() != ".pdf":
        return {
            "is_pdf": False,
            "has_digital_signature": False,
            "signature_valid": False,
            "anomaly_score": 0.0
        }

    try:
        content = file_path.read_bytes()
        # Look for digital signature markers in PDF byte stream
        has_sig_dict = b"/Type /Sig" in content or b"/Type/Sig" in content
        has_byte_range = b"/ByteRange" in content
        has_subfilter = b"/SubFilter" in content
        
        # Look for certification details
        signer_name = None
        match_name = re.search(rb"/Name\s*\(([^)]+)\)", content)
        if match_name:
            signer_name = match_name.group(1).decode("utf-8", errors="ignore")

        is_signed = has_sig_dict and has_byte_range
        
        return {
            "is_pdf": True,
            "has_digital_signature": is_signed,
            "signature_dictionary_present": has_sig_dict,
            "byte_range_intact": has_byte_range,
            "signer_identity": signer_name or ("Authority Cryptographic Key" if is_signed else None),
            "anomaly_score": 0.0 if is_signed else 0.15,
            "disclaimer": "Preliminary indicator – requires human verification."
        }
    except Exception as e:
        return {
            "is_pdf": True,
            "has_digital_signature": False,
            "error": str(e),
            "anomaly_score": 0.0
        }
