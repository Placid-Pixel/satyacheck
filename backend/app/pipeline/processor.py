import re
import os
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import fitz  # PyMuPDF
from PIL import Image
import imagehash
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.encryption import save_encrypted_file
from app.models import Document, Application, AICTEMasterRecord
from app.rules.engine import RuleEngine

class DocumentPipelineProcessor:
    def __init__(self, db: Session):
        self.db = db

    def extract_text_and_metadata(self, file_path: Path) -> Tuple[str, Dict[str, Any]]:
        text = ""
        meta = {}
        if file_path.suffix.lower() == ".pdf":
            try:
                doc = fitz.open(str(file_path))
                meta = {
                    "format": doc.metadata.get("format", "PDF"),
                    "producer": doc.metadata.get("producer", ""),
                    "creator": doc.metadata.get("creator", ""),
                    "creation_date": doc.metadata.get("creationDate", ""),
                    "mod_date": doc.metadata.get("modDate", ""),
                    "page_count": len(doc),
                    "encrypted": doc.is_encrypted
                }
                # Flag suspicious editors
                suspicious = ["photoshop", "canva", "gimp", "illustrator", "paint", "corel"]
                for tool in suspicious:
                    if tool in (meta.get("producer", "") + meta.get("creator", "")).lower():
                        meta["suspicious_editor"] = True
                        break

                for page in doc:
                    text += page.get_text() + "\n"
            except Exception as e:
                text = f"Error reading PDF: {str(e)}"
        else:
            meta = {"format": "IMAGE", "file_ext": file_path.suffix.lower()}
            text = "Scanned Image Evidence"

        return text, meta

    def classify_document(self, text: str, file_name: str) -> str:
        t = (text + " " + file_name).lower()
        if "fire" in t and ("noc" in t or "safety" in t or "clearance" in t):
            return "FIRE_NOC"
        elif "land" in t or "deed" in t or "khasra" in t or "survey no" in t or "sub-registrar" in t:
            return "LAND_DEED"
        elif "naac" in t or "nba" in t or "accreditation" in t or "cgpa" in t:
            return "NAAC_NBA"
        elif "ter" in t or "receipt" in t or "payment" in t or "utr" in t or "regulatory charges" in t:
            return "TER_RECEIPT"
        elif "faculty" in t or "staff" in t or "cadre" in t or "professor" in t:
            return "FACULTY_LIST"
        elif "building" in t or "occupancy" in t or "plan" in t or "dtcp" in t:
            return "BUILDING_PLAN"
        elif file_name.lower().endswith(('.jpg', '.jpeg', '.png')):
            return "INFRA_PHOTO"
        return "GENERAL_COMPLIANCE"

    def extract_structured_fields(self, text: str, doc_type: str) -> Dict[str, Any]:
        fields: Dict[str, Any] = {}
        
        # Regex for Dates (YYYY-MM-DD or DD/MM/YYYY)
        dates = re.findall(r"\b(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})\b", text)
        if dates:
            fields["extracted_dates"] = dates

        # Expiry date pattern
        exp_match = re.search(r"(?:valid strictly up to|valid to|valid up to|valid till|expiry date)[\s:]*([0-9\-/]+)", text, re.IGNORECASE)
        if exp_match:
            fields["expiry_date"] = exp_match.group(1).strip()

        # Certificate / NOC number
        cert_match = re.search(r"(?:certificate no|deed no|ref|utr|noc no)[\s:]*([A-Z0-9\-/]+)", text, re.IGNORECASE)
        if cert_match:
            fields["certificate_no"] = cert_match.group(1).strip()

        # Survey number
        survey_match = re.search(r"(?:survey no|khasra no|plot no)[\s:]*([0-9a-zA-Z\-/]+)", text, re.IGNORECASE)
        if survey_match:
            fields["survey_no"] = survey_match.group(1).strip()

        # Amount pattern
        amt_match = re.search(r"(?:inr|rs\.?)\s*([0-9,]+)", text, re.IGNORECASE)
        if amt_match:
            fields["amount"] = amt_match.group(1).replace(",", "")

        return fields

    def process_document(self, application_id: int, file_path: Path, original_filename: str) -> Document:
        app = self.db.query(Application).filter(Application.id == application_id).first()
        if not app:
            raise ValueError(f"Application {application_id} not found")

        # 1. Text & Metadata
        ocr_text, meta = self.extract_text_and_metadata(file_path)

        # 2. Perceptual Hash
        p_hash = None
        try:
            if file_path.suffix.lower() == ".pdf":
                doc = fitz.open(str(file_path))
                pix = doc.load_page(0).get_pixmap()
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            else:
                img = Image.open(str(file_path))
            p_hash = str(imagehash.phash(img))
        except Exception:
            p_hash = hashlib.md5(file_path.name.encode()).hexdigest()[:16]

        # 3. Classify
        doc_type = self.classify_document(ocr_text, original_filename)

        # 4. Extract fields
        fields = self.extract_structured_fields(ocr_text, doc_type)

        # 5. Save encrypted copy to storage
        vault_path = settings.DATA_DIR / "vault" / f"{app.id}_{file_path.name}"
        save_encrypted_file(vault_path, file_path.read_bytes())

        # 6. Create Document record
        doc_record = Document(
            application_id=app.id,
            doc_type=doc_type,
            file_name=original_filename,
            file_path=str(file_path),
            file_size=file_path.stat().st_size,
            mime_type="application/pdf" if file_path.suffix.lower() == ".pdf" else "image/jpeg",
            perceptual_hash=p_hash,
            ocr_text=ocr_text,
            extracted_fields=fields,
            metadata_info=meta,
            risk_indicators={"risk_score": 0.1}
        )
        self.db.add(doc_record)
        self.db.flush()

        # 7. Run Rule Engine on application
        rule_engine = RuleEngine(self.db)
        new_findings = rule_engine.evaluate_application(app)
        for f in new_findings:
            self.db.add(f)
        self.db.commit()

        return doc_record
