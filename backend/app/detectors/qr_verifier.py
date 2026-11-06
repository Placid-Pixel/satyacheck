import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional
import fitz
from PIL import Image

def verify_qr_code(file_path: Path, expected_name: str, expected_cert_no: Optional[str] = None) -> Dict[str, Any]:
    """
    Decodes QR/Barcode from document and compares payload against printed fields.
    """
    try:
        if file_path.suffix.lower() == ".pdf":
            doc = fitz.open(str(file_path))
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=200)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            cv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        else:
            cv_img = cv2.imread(str(file_path))

        detector = cv2.QRCodeDetector()
        val, pts, _ = detector.detectAndDecode(cv_img)

        # Fallback to pyzbar if OpenCV detector returns empty
        if not val:
            try:
                from pyzbar.pyzbar import decode
                decoded = decode(cv_img)
                if decoded:
                    val = decoded[0].data.decode("utf-8")
            except Exception:
                pass

        if not val:
            return {
                "qr_present": False,
                "payload": None,
                "is_match": True,
                "anomaly_score": 0.0,
                "notes": "No QR barcode detected on document page."
            }

        # Validate decoded content against expected metadata
        val_upper = val.upper()
        name_clean = expected_name.upper().split()[0] # Check at least primary name token
        is_name_match = (name_clean in val_upper) if expected_name else True
        
        is_cert_match = True
        if expected_cert_no:
            cert_clean = expected_cert_no.replace("/", "").replace("-", "").upper()
            is_cert_match = (cert_clean in val_upper.replace("/", "").replace("-", ""))

        mismatch = not (is_name_match and is_cert_match)

        return {
            "qr_present": True,
            "payload": val,
            "is_match": not mismatch,
            "anomaly_score": 0.95 if mismatch else 0.0,
            "name_verified": is_name_match,
            "cert_verified": is_cert_match,
            "disclaimer": "Preliminary indicator – requires human verification."
        }
    except Exception as e:
        return {
            "qr_present": False,
            "payload": None,
            "is_match": True,
            "error": str(e),
            "anomaly_score": 0.0
        }
