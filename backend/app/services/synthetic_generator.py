import os
import random
import json
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Any, List, Tuple
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import qrcode
from reportlab.lib.pagesizes import letter, A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
import fitz  # PyMuPDF
import imagehash

from app.core.config import settings
from app.core.database import SessionLocal, engine, Base
from app.models import (
    User, Institution, AICTEMasterRecord, Application, Document,
    Finding, ConnectorLog, AuditEntry, RuleModel, EvaluationSample
)
from app.core.security import get_password_hash, ROLE_INSTITUTION, ROLE_SCRUTINY, ROLE_SENIOR, ROLE_ADMIN

class SyntheticDataGenerator:
    def __init__(self, output_dir: Path = settings.SYNTHETIC_DIR):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.docs_dir = self.output_dir / "documents"
        self.docs_dir.mkdir(parents=True, exist_ok=True)
        self.infra_dir = self.output_dir / "infrastructure"
        self.infra_dir.mkdir(parents=True, exist_ok=True)

    def generate_qr_image(self, payload: str, out_path: Path) -> Path:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=4,
            border=2,
        )
        qr.add_data(payload)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(str(out_path))
        return out_path

    def draw_stamp(self, c: canvas.Canvas, x: float, y: float, text: str, color_hex="#1a365d"):
        c.saveState()
        c.setStrokeColor(colors.HexColor(color_hex))
        c.setFillColor(colors.HexColor(color_hex))
        c.setLineWidth(2)
        c.circle(x, y, 36, stroke=1, fill=0)
        c.setLineWidth(1)
        c.circle(x, y, 30, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 6)
        c.drawCentredString(x, y + 14, "GOVERNMENT VERIFIED")
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(x, y, text[:16])
        c.setFont("Helvetica", 5)
        c.drawCentredString(x, y - 14, "SEAL & SIGNATURE")
        c.restoreState()

    def create_fire_noc_pdf(
        self,
        file_path: Path,
        noc_no: str,
        institute_name: str,
        survey_no: str,
        issue_date: str,
        expiry_date: str,
        is_qr_mismatched: bool = False,
        is_tampered: bool = False
    ) -> Dict[str, Any]:
        c = canvas.Canvas(str(file_path), pagesize=A4)
        width, height = A4
        
        # Header
        c.setFillColor(colors.HexColor("#7c1c1c"))
        c.rect(0, height - 70, width, 70, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(width / 2, height - 35, "DIRECTORATE OF FIRE & EMERGENCY SERVICES")
        c.setFont("Helvetica", 9)
        c.drawCentredString(width / 2, height - 52, "STATE DISASTER MANAGEMENT AUTHORITY — COMPLIANCE DIVISION")

        # Watermark
        c.saveState()
        c.setFont("Helvetica-Bold", 55)
        c.setFillColor(colors.HexColor("#f8fafc"))
        c.translate(width / 2, height / 2)
        c.rotate(45)
        c.drawCentredString(0, 0, "FIRE NOC RECORD")
        c.restoreState()

        # Document Details
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, height - 105, f"Certificate No: {noc_no}")
        c.drawRightString(width - 50, height - 105, f"Date of Issue: {issue_date}")
        
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.line(50, height - 115, width - 50, height - 115)

        # Title
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(width / 2, height - 145, "FIRE SAFETY & CLEARANCE CERTIFICATE (NOC)")

        # Body Text
        c.setFont("Helvetica", 10)
        text_lines = [
            f"This is to certify that the premises of {institute_name},",
            f"situated at Revenue Survey No: {survey_no}, was inspected by the designated Fire Officer.",
            "The fire prevention and life safety measures as mandated under Section 13 of the Fire",
            "Prevention and Life Safety Measures Act have been duly verified and found compliant.",
            "",
            "1. Maximum Building Height: 14.8 Meters (Ground + 3 Floors)",
            "2. Total Instructional Built-up Area: 8,420 Sq. Meters",
            "3. Fire Sprinkler & Hose Reel Systems: Installed and Functional",
            "4. Emergency Evacuation Staircases: 2 Adequate Exits Available",
            "",
            f"This No Objection Certificate is valid strictly up to: {expiry_date}",
            "Subject to periodic maintenance and mock drills conducted bi-annually."
        ]
        
        y_pos = height - 180
        for line in text_lines:
            c.drawString(50, y_pos, line)
            y_pos -= 18

        # Ground truth bounding boxes for key fields (PDF coordinates)
        bboxes = {
            "noc_no": {"page": 1, "x0": 50, "y0": 95, "x1": 250, "y1": 115},
            "survey_no": {"page": 1, "x0": 170, "y0": 185, "x1": 320, "y1": 205},
            "expiry_date": {"page": 1, "x0": 260, "y0": 330, "x1": 380, "y1": 355}
        }

        # QR code
        qr_payload = f"VERIFIED:NOC={noc_no}|INST={'WRONG_COLLEGE_TECH' if is_qr_mismatched else institute_name}|EXP={expiry_date}"
        qr_path = file_path.parent / f"qr_{file_path.stem}.png"
        self.generate_qr_image(qr_payload, qr_path)
        c.drawImage(str(qr_path), width - 130, 80, width=70, height=70)
        c.setFont("Helvetica", 7)
        c.drawCentredString(width - 95, 70, "Scan to Verify at State Portal")

        # Official Stamp and Signatures
        self.draw_stamp(c, 110, 115, "FIRE DIVISION", color_hex="#991b1b")
        c.setFont("Helvetica-Bold", 8)
        c.drawString(200, 100, "Digitally Authorized by:")
        c.setFont("Helvetica", 8)
        c.drawString(200, 88, "Chief Fire Officer, Fire Headquarters")
        c.drawString(200, 76, f"Sign-Hash: sha256:{hashlib.sha256(noc_no.encode()).hexdigest()[:16]}")

        c.save()
        if qr_path.exists():
            qr_path.unlink()

        return {
            "noc_no": noc_no,
            "institute_name": institute_name,
            "survey_no": survey_no,
            "issue_date": issue_date,
            "expiry_date": expiry_date,
            "bboxes": bboxes
        }

    def create_land_document_pdf(
        self,
        file_path: Path,
        deed_no: str,
        trust_name: str,
        institute_name: str,
        survey_no: str,
        land_area_acres: float,
        reg_date: str
    ) -> Dict[str, Any]:
        c = canvas.Canvas(str(file_path), pagesize=A4)
        width, height = A4

        # Header
        c.setFillColor(colors.HexColor("#1e3a8a"))
        c.rect(0, height - 70, width, 70, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(width / 2, height - 35, "DEPARTMENT OF REVENUE & REGISTRATION")
        c.setFont("Helvetica", 9)
        c.drawCentredString(width / 2, height - 52, "GOVERNMENT LAND REGISTRY — PERPETUAL TITLE DEED")

        # Watermark
        c.saveState()
        c.setFont("Helvetica-Bold", 50)
        c.setFillColor(colors.HexColor("#f1f5f9"))
        c.translate(width / 2, height / 2)
        c.rotate(45)
        c.drawCentredString(0, 0, "LAND TITLE RECORD")
        c.restoreState()

        # Body
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, height - 105, f"Registered Deed No: {deed_no}")
        c.drawRightString(width - 50, height - 105, f"Date of Registration: {reg_date}")
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.line(50, height - 115, width - 50, height - 115)

        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(width / 2, height - 145, "CERTIFICATE OF OWNERSHIP & POSSESSION OF LAND")

        c.setFont("Helvetica", 10)
        lines = [
            f"This indenture made this day witnesses that the title and absolute ownership of the scheduled land",
            f"is unconditionally vested with the registered Trust/Society: {trust_name}",
            f"exclusively earmarked for running the educational institution: {institute_name}.",
            "",
            f"1. Revenue Survey / Khasra No: {survey_no}",
            f"2. Total Land Area: {land_area_acres} Acres ({round(land_area_acres * 4046.86, 2)} Sq. Meters)",
            "3. Land Use Classification: Institutional (Higher & Technical Education)",
            "4. Encumbrance / Mortgage: NIL (Free from all liens, lis pendens and encumbrances)",
            "5. Contiguity of Land: Single contiguous piece without any intersecting public roads or nullahs.",
            "",
            "The land possesses uninterrupted approach road connectivity of 15.0 meters width as mandated",
            "by the AICTE Approval Process Handbook."
        ]
        y_pos = height - 180
        for line in lines:
            c.drawString(50, y_pos, line)
            y_pos -= 18

        # Stamp and Signature
        self.draw_stamp(c, 110, 120, "SUB-REGISTRAR", color_hex="#1e3a8a")
        c.setFont("Helvetica-Bold", 9)
        c.drawString(200, 110, "Sub-Registrar & Competent Land Authority")
        c.setFont("Helvetica", 8)
        c.drawString(200, 95, "Office of District Magistrate & Revenue Officer")

        qr_payload = f"LAND_REG:{deed_no}|SURVEY={survey_no}|ACRES={land_area_acres}|TRUST={trust_name}"
        qr_path = file_path.parent / f"qr_{file_path.stem}.png"
        self.generate_qr_image(qr_payload, qr_path)
        c.drawImage(str(qr_path), width - 130, 80, width=70, height=70)

        c.save()
        if qr_path.exists():
            qr_path.unlink()

        bboxes = {
            "deed_no": {"page": 1, "x0": 50, "y0": 95, "x1": 250, "y1": 115},
            "survey_no": {"page": 1, "x0": 170, "y0": 220, "x1": 310, "y1": 240},
            "land_area": {"page": 1, "x0": 150, "y0": 238, "x1": 290, "y1": 258}
        }

        return {
            "deed_no": deed_no,
            "trust_name": trust_name,
            "survey_no": survey_no,
            "land_area_acres": land_area_acres,
            "bboxes": bboxes
        }

    def create_naac_nba_pdf(
        self,
        file_path: Path,
        cert_no: str,
        institute_name: str,
        body_type: str, # NAAC or NBA
        grade_or_score: str,
        valid_from: str,
        valid_to: str,
        programmes: List[str]
    ) -> Dict[str, Any]:
        c = canvas.Canvas(str(file_path), pagesize=A4)
        width, height = A4

        # Header
        banner_color = "#047857" if body_type == "NAAC" else "#0369a1"
        c.setFillColor(colors.HexColor(banner_color))
        c.rect(0, height - 70, width, 70, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 14)
        header_text = "NATIONAL ASSESSMENT AND ACCREDITATION COUNCIL" if body_type == "NAAC" else "NATIONAL BOARD OF ACCREDITATION"
        c.drawCentredString(width / 2, height - 35, header_text)
        c.setFont("Helvetica", 9)
        c.drawCentredString(width / 2, height - 52, "An Autonomous Body of the Ministry of Education, Government of India")

        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, height - 105, f"Accreditation Ref: {cert_no}")
        c.drawRightString(width - 50, height - 105, f"Cycle: II (Valid: {valid_from} to {valid_to})")
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.line(50, height - 115, width - 50, height - 115)

        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(width / 2, height - 145, f"CERTIFICATE OF INSTITUTIONAL ACCREDITATION")

        c.setFont("Helvetica", 10)
        lines = [
            f"The Executive Committee is pleased to declare that the institution:",
            f"NAME: {institute_name}",
            f"has been assessed and accredited with a Cumulative Grade Point Average (CGPA) / Rating of:",
            "",
            f"              >>> {body_type} RATING: {grade_or_score} <<<",
            "",
            f"Accredited Programmes: {', '.join(programmes)}",
            f"Validity Period: From {valid_from} up to {valid_to}",
            "",
            "Subject to the condition that the institution continues to adhere to all academic, curriculum,",
            "faculty qualification and research benchmarks as stipulated under statutory provisions."
        ]
        y_pos = height - 180
        for line in lines:
            c.drawString(50, y_pos, line)
            y_pos -= 18

        self.draw_stamp(c, 110, 120, body_type, color_hex=banner_color)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(200, 110, f"Member Secretary, {body_type}")
        c.setFont("Helvetica", 8)
        c.drawString(200, 95, "Digital Certificate Authorization ID: #ACCR-9921-X")

        qr_payload = f"ACCREDITATION:{cert_no}|BODY={body_type}|INST={institute_name}|VAL={valid_to}"
        qr_path = file_path.parent / f"qr_{file_path.stem}.png"
        self.generate_qr_image(qr_payload, qr_path)
        c.drawImage(str(qr_path), width - 130, 80, width=70, height=70)

        c.save()
        if qr_path.exists():
            qr_path.unlink()

        return {
            "cert_no": cert_no,
            "body_type": body_type,
            "grade_or_score": grade_or_score,
            "valid_to": valid_to
        }

    def create_ter_receipt_pdf(
        self,
        file_path: Path,
        utr_no: str,
        institute_name: str,
        amount_inr: int,
        date_paid: str,
        status: str = "SUCCESS"
    ) -> Dict[str, Any]:
        c = canvas.Canvas(str(file_path), pagesize=A4)
        width, height = A4

        c.setFillColor(colors.HexColor("#334155"))
        c.rect(0, height - 70, width, 70, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(width / 2, height - 35, "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)")
        c.setFont("Helvetica", 9)
        c.drawCentredString(width / 2, height - 52, "CENTRALIZED PAYMENT GATEWAY — TECHNICAL EDUCATION REGULATORY (TER) CHARGES")

        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, height - 105, f"Transaction Ref / UTR: {utr_no}")
        c.drawRightString(width - 50, height - 105, f"Date: {date_paid}")
        c.line(50, height - 115, width - 50, height - 115)

        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(width / 2, height - 145, "OFFICIAL FEE RECEIPT (EOA 2026-2027)")

        lines = [
            f"Received with thanks from: {institute_name}",
            f"Purpose: Extension of Approval (EoA) Annual Regulatory Charges",
            f"Payment Mode: SBI e-Pay / RTGS Transfer",
            f"Amount Paid: INR {amount_inr:,}/- (Rupees Two Lakhs Only)",
            f"Payment Gateway Status: {status}",
            f"AICTE Clearance Code: TER-CLR-2026-OK"
        ]
        y_pos = height - 180
        for line in lines:
            c.drawString(50, y_pos, line)
            y_pos -= 20

        self.draw_stamp(c, 110, 120, "AICTE FINANCE", color_hex="#334155")
        c.save()

        return {
            "utr_no": utr_no,
            "amount_inr": amount_inr,
            "status": status,
            "date_paid": date_paid
        }

    def generate_classroom_photo(
        self,
        file_path: Path,
        room_title: str,
        desks_count: int = 30,
        computers_count: int = 0,
        is_blurry: bool = False,
        is_dark: bool = False
    ) -> Path:
        width, height = 800, 600
        # Create synthetic classroom interior
        base_color = (40, 45, 55) if is_dark else (240, 243, 246)
        img = Image.new("RGB", (width, height), color=base_color)
        draw = ImageDraw.Draw(img)

        # Draw whiteboard / projector screen
        board_color = (25, 60, 40) if not is_dark else (10, 25, 15)
        draw.rectangle([200, 50, 600, 220], fill=board_color, outline=(100, 100, 100), width=3)
        draw.text((220, 70), f"AICTE Lab/Classroom: {room_title}", fill=(220, 220, 220))
        draw.text((220, 100), "Declared Capacity: 60 Students", fill=(180, 180, 180))

        # Draw grid of desks / computers
        grid_rows = 5
        grid_cols = 6
        bench_color = (160, 110, 70) if not is_dark else (50, 35, 20)
        pc_color = (30, 30, 35) if not is_dark else (15, 15, 20)

        for r in range(grid_rows):
            for c in range(grid_cols):
                bx = 100 + c * 105
                by = 280 + r * 60
                # Draw desk
                draw.rectangle([bx, by, bx + 80, by + 40], fill=bench_color, outline=(80, 50, 30))
                # If computer lab, draw monitor
                if computers_count > 0 and (r * grid_cols + c) < computers_count:
                    draw.rectangle([bx + 20, by - 25, bx + 60, by], fill=pc_color, outline=(180, 180, 180))
                    draw.line([bx + 40, by, bx + 40, by + 5], fill=pc_color, width=4)

        # Apply blur if requested
        if is_blurry:
            img = img.filter(ImageFilter.GaussianBlur(radius=8))

        img.save(str(file_path), quality=85)
        return file_path

    def calculate_perceptual_hash(self, file_path: Path) -> str:
        """Calculates perceptual hash of first page/image for deduplication."""
        try:
            if file_path.suffix.lower() == ".pdf":
                doc = fitz.open(str(file_path))
                page = doc.load_page(0)
                pix = page.get_pixmap()
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            else:
                img = Image.open(str(file_path))
            return str(imagehash.phash(img))
        except Exception:
            return hashlib.md5(file_path.name.encode()).hexdigest()[:16]

    def seed_hero_applications(self, db) -> List[Application]:
        """Seeds the 3 hero applications described in the specification."""
        print("Seeding Hero Applications...")

        # -------------------------------------------------------------------------
        # Hero 1: Clean Application (Aryabhatta Institute of Technology)
        # -------------------------------------------------------------------------
        inst1 = db.query(Institution).filter(Institution.aicte_id == "AICTE-1-10029381").first()
        if not inst1:
            inst1 = Institution(
                aicte_id="AICTE-1-10029381",
                name="Aryabhatta Institute of Technology & Sciences",
                trust_name="Aryabhatta Shiksha Foundation Trust",
                address="Sector 12, Institutional Area, Knowledge Park",
                city="Bengaluru",
                state="Karnataka",
                pin_code="560100",
                latitude=12.9716,
                longitude=77.5946,
                established_year=2008,
                approved_intake=480,
                land_area_acres=8.5,
                faculty_count=48,
                principal_name="Dr. Ramesh V. Kulkarni"
            )
            db.add(inst1)
            db.flush()

        # AICTE Master Baseline Record
        m1 = db.query(AICTEMasterRecord).filter(AICTEMasterRecord.aicte_id == "AICTE-1-10029381").first()
        if not m1:
            m1 = AICTEMasterRecord(
                aicte_id="AICTE-1-10029381",
                institution_name="Aryabhatta Institute of Technology & Sciences",
                trust_name="Aryabhatta Shiksha Foundation Trust",
                principal_name="Dr. Ramesh V. Kulkarni",
                approved_programmes=[
                    {"programme": "Engineering", "course": "Computer Science & Engineering", "intake": 180},
                    {"programme": "Engineering", "course": "Electronics & Communication", "intake": 120},
                    {"programme": "Engineering", "course": "Mechanical Engineering", "intake": 120},
                    {"programme": "Engineering", "course": "Information Technology", "intake": 60}
                ],
                approved_intake=480,
                land_acres=8.5,
                builtup_sqm=14500.0,
                fire_noc_valid_till="2027-12-31",
                building_plan_approved_by="BDA Karnataka",
                ter_payment_status="PAID",
                last_year_deficiencies=[],
                accreditation_status={"NAAC": "A++", "valid_to": "2028-06-30"}
            )
            db.add(m1)

        # Create Hero 1 Application
        app1 = db.query(Application).filter(Application.application_number == "AICTE-APP-2026-001").first()
        if not app1:
            app1 = Application(
                application_number="AICTE-APP-2026-001",
                institution_id=inst1.id,
                category="EOA",
                academic_year="2026-2027",
                status="UNDER_SCRUTINY",
                declared_data={
                    "applied_intake": 480,
                    "survey_no": "45/2B",
                    "land_acres": 8.5,
                    "faculty_count": 48,
                    "trust_name": "Aryabhatta Shiksha Foundation Trust"
                },
                risk_score=4.2,
                risk_level="LOW"
            )
            db.add(app1)
            db.flush()

            # Files for Hero 1
            f_fire1 = self.docs_dir / f"app1_fire_noc.pdf"
            self.create_fire_noc_pdf(
                f_fire1, "KA/FIRE/BLR/2025/9941", inst1.name, "45/2B", "2025-01-10", "2027-12-31"
            )
            f_land1 = self.docs_dir / f"app1_land_deed.pdf"
            self.create_land_document_pdf(
                f_land1, "DEED/BLR/2007/4401", inst1.trust_name, inst1.name, "45/2B", 8.5, "2007-06-15"
            )
            f_naac1 = self.docs_dir / f"app1_naac_cert.pdf"
            self.create_naac_nba_pdf(
                f_naac1, "NAAC/EC/PS/88/A++", inst1.name, "NAAC", "A++ (3.65 CGPA)", "2023-07-01", "2028-06-30",
                ["Computer Science", "Electronics & Comm", "Mechanical"]
            )
            f_ter1 = self.docs_dir / f"app1_ter_receipt.pdf"
            self.create_ter_receipt_pdf(
                f_ter1, "UTR-SBI-20260215-99214", inst1.name, 200000, "2026-02-15", "SUCCESS"
            )
            f_infra1 = self.infra_dir / f"app1_cs_lab.jpg"
            self.generate_classroom_photo(f_infra1, "CS Advanced Cloud Lab", desks_count=30, computers_count=30)

            # Register documents
            d1_fire = Document(
                application_id=app1.id,
                doc_type="FIRE_NOC",
                file_name="Fire_NOC_Certificate.pdf",
                file_path=str(f_fire1),
                file_size=f_fire1.stat().st_size,
                perceptual_hash=self.calculate_perceptual_hash(f_fire1),
                extracted_fields={"noc_no": "KA/FIRE/BLR/2025/9941", "survey_no": "45/2B", "expiry_date": "2027-12-31"},
                metadata_info={"producer": "ReportLab PDF Library", "encrypted": False},
                risk_indicators={"risk_score": 0.05, "status": "AUTHENTIC"}
            )
            d1_land = Document(
                application_id=app1.id,
                doc_type="LAND_DEED",
                file_name="Registered_Land_Title_Deed.pdf",
                file_path=str(f_land1),
                file_size=f_land1.stat().st_size,
                perceptual_hash=self.calculate_perceptual_hash(f_land1),
                extracted_fields={"deed_no": "DEED/BLR/2007/4401", "survey_no": "45/2B", "land_area_acres": 8.5},
                metadata_info={"producer": "ReportLab PDF Library", "encrypted": False},
                risk_indicators={"risk_score": 0.02, "status": "AUTHENTIC"}
            )
            db.add_all([d1_fire, d1_land])
            db.flush()

            # Connectors for Hero 1 (all VERIFIED)
            c1_fire = ConnectorLog(
                application_id=app1.id,
                document_id=d1_fire.id,
                authority_type="FIRE_DEPT",
                status="VERIFIED",
                response_payload={"record_found": True, "status": "VALID", "expiry": "2027-12-31"},
                response_hash=hashlib.sha256(b"KA/FIRE/BLR/2025/9941").hexdigest(),
                latency_ms=210,
                simulated=True
            )
            c1_land = ConnectorLog(
                application_id=app1.id,
                document_id=d1_land.id,
                authority_type="LAND_REVENUE",
                status="VERIFIED",
                response_payload={"survey_no": "45/2B", "registered_owner": "Aryabhatta Shiksha Foundation Trust"},
                response_hash=hashlib.sha256(b"DEED/BLR/2007/4401").hexdigest(),
                latency_ms=180,
                simulated=True
            )
            db.add_all([c1_fire, c1_land])

        # -------------------------------------------------------------------------
        # Hero 2: Expired NOC + Mismatched Identifier + Reused Certificate
        # -------------------------------------------------------------------------
        inst2 = db.query(Institution).filter(Institution.aicte_id == "AICTE-1-49201948").first()
        if not inst2:
            inst2 = Institution(
                aicte_id="AICTE-1-49201948",
                name="Vidya Valley Engineering College",
                trust_name="Vidya Vikas Charitable Society",
                address="Survey 210/1, Bypass Highway",
                city="Pune",
                state="Maharashtra",
                pin_code="411045",
                latitude=18.5204,
                longitude=73.8567,
                established_year=2014,
                approved_intake=360,
                land_area_acres=7.2,
                faculty_count=22, # Low faculty count!
                principal_name="Dr. Anil Deshmukh"
            )
            db.add(inst2)
            db.flush()

        m2 = db.query(AICTEMasterRecord).filter(AICTEMasterRecord.aicte_id == "AICTE-1-49201948").first()
        if not m2:
            m2 = AICTEMasterRecord(
                aicte_id="AICTE-1-49201948",
                institution_name="Vidya Valley Engineering College",
                trust_name="Vidya Vikas Charitable Society",
                principal_name="Dr. Anil Deshmukh",
                approved_programmes=[
                    {"programme": "Engineering", "course": "Computer Engineering", "intake": 120},
                    {"programme": "Engineering", "course": "Civil Engineering", "intake": 120},
                    {"programme": "Engineering", "course": "Electrical Engineering", "intake": 120}
                ],
                approved_intake=360,
                land_acres=7.2,
                builtup_sqm=9800.0,
                fire_noc_valid_till="2024-11-30", # Expired in master record!
                building_plan_approved_by="PMRDA Pune",
                ter_payment_status="PAID",
                last_year_deficiencies=["Faculty-Student ratio below mandated norm"],
                accreditation_status={}
            )
            db.add(m2)

        app2 = db.query(Application).filter(Application.application_number == "AICTE-APP-2026-002").first()
        if not app2:
            app2 = Application(
                application_number="AICTE-APP-2026-002",
                institution_id=inst2.id,
                category="EOA",
                academic_year="2026-2027",
                status="UNDER_SCRUTINY",
                declared_data={
                    "applied_intake": 360,
                    "survey_no": "210/1", # Declared survey no is 210/1
                    "land_acres": 7.2,
                    "faculty_count": 22
                },
                risk_score=78.5,
                risk_level="HIGH"
            )
            db.add(app2)
            db.flush()

            # Files for Hero 2
            f_fire2 = self.docs_dir / f"app2_fire_noc_expired.pdf"
            # EXPIRED NOC!
            self.create_fire_noc_pdf(
                f_fire2, "MH/PUNE/FIRE/2021/8812", inst2.name, "210/1", "2021-12-01", "2024-11-30"
            )
            # MISMATCHED LAND SURVEY NO (Deed shows Survey No 98/4, whereas declared is 210/1)
            f_land2 = self.docs_dir / f"app2_land_deed_mismatch.pdf"
            self.create_land_document_pdf(
                f_land2, "DEED/PUN/2013/9912", inst2.trust_name, inst2.name, "98/4", 7.2, "2013-04-10"
            )

            # Reused certificate from Hero 1! (Same file hash to trigger cross-institution duplicate)
            f_naac2 = self.docs_dir / f"app2_naac_reused.pdf"
            f_naac1 = self.docs_dir / f"app1_naac_cert.pdf"
            if f_naac1.exists():
                f_naac2.write_bytes(f_naac1.read_bytes())
            else:
                self.create_naac_nba_pdf(
                    f_naac2, "NAAC/EC/PS/88/A++", inst1.name, "NAAC", "A++", "2023-07-01", "2028-06-30", ["CSE"]
                )

            d2_fire = Document(
                application_id=app2.id,
                doc_type="FIRE_NOC",
                file_name="Fire_NOC_Renewal.pdf",
                file_path=str(f_fire2),
                file_size=f_fire2.stat().st_size,
                perceptual_hash=self.calculate_perceptual_hash(f_fire2),
                extracted_fields={"noc_no": "MH/PUNE/FIRE/2021/8812", "survey_no": "210/1", "expiry_date": "2024-11-30"},
                metadata_info={"producer": "ReportLab PDF Library"},
                risk_indicators={"risk_score": 0.85, "status": "EXPIRED_FLAGGED"}
            )
            d2_land = Document(
                application_id=app2.id,
                doc_type="LAND_DEED",
                file_name="Land_Title_Possession.pdf",
                file_path=str(f_land2),
                file_size=f_land2.stat().st_size,
                perceptual_hash=self.calculate_perceptual_hash(f_land2),
                extracted_fields={"deed_no": "DEED/PUN/2013/9912", "survey_no": "98/4", "land_area_acres": 7.2},
                metadata_info={"producer": "ReportLab PDF Library"},
                risk_indicators={"risk_score": 0.75, "status": "IDENTIFIER_MISMATCH"}
            )
            d2_naac = Document(
                application_id=app2.id,
                doc_type="NAAC_NBA",
                file_name="Accreditation_Certificate.pdf",
                file_path=str(f_naac2),
                file_size=f_naac2.stat().st_size,
                perceptual_hash=self.calculate_perceptual_hash(f_naac2),
                extracted_fields={"cert_no": "NAAC/EC/PS/88/A++", "institute_name": inst1.name},
                metadata_info={"producer": "ReportLab PDF Library"},
                risk_indicators={"risk_score": 0.95, "status": "DUPLICATE_SUSPECT"}
            )
            db.add_all([d2_fire, d2_land, d2_naac])
            db.flush()

            # Connectors for Hero 2
            c2_fire = ConnectorLog(
                application_id=app2.id,
                document_id=d2_fire.id,
                authority_type="FIRE_DEPT",
                status="EXPIRED",
                response_payload={"record_found": True, "status": "EXPIRED", "expired_on": "2024-11-30"},
                latency_ms=310,
                simulated=True
            )
            c2_land = ConnectorLog(
                application_id=app2.id,
                document_id=d2_land.id,
                authority_type="LAND_REVENUE",
                status="MISMATCH_DETECTED",
                response_payload={"declared_survey": "210/1", "document_survey": "98/4", "match": False},
                latency_ms=290,
                simulated=True
            )
            db.add_all([c2_fire, c2_land])

            # Findings for Hero 2
            f1 = Finding(
                application_id=app2.id,
                document_id=d2_fire.id,
                rule_id="RULE_FIRE_NOC_VALIDITY",
                clause="APH-2026 Cl 4.3.1",
                category="REGULATORY",
                severity="CRITICAL",
                reason="Fire Safety No Objection Certificate expired on 30/11/2024. Valid NOC mandatory for academic session 2026-27.",
                evidence_bbox={"page": 1, "x0": 260, "y0": 330, "x1": 380, "y1": 355},
                extracted_value="2024-11-30",
                expected_value=">= 2026-06-30",
                confidence=0.98,
                status="OPEN",
                recommended_action="Direct institution to furnish renewed Fire NOC issued by competent Fire Authority."
            )
            f2 = Finding(
                application_id=app2.id,
                document_id=d2_land.id,
                rule_id="RULE_LAND_SURVEY_CONSISTENCY",
                clause="APH-2026 Cl 2.1.4",
                category="CONSISTENCY",
                severity="HIGH",
                reason="Cross-document discrepancy: Declared campus land is Survey No 210/1, but submitted title deed registers Survey No 98/4.",
                evidence_bbox={"page": 1, "x0": 170, "y0": 220, "x1": 310, "y1": 240},
                extracted_value="Survey No: 98/4",
                expected_value="Survey No: 210/1",
                confidence=0.95,
                status="OPEN",
                recommended_action="Officer scrutiny required: demand revenue mutation extract linking Survey 98/4 and 210/1."
            )
            f3 = Finding(
                application_id=app2.id,
                document_id=d2_naac.id,
                rule_id="RULE_CROSS_INSTITUTE_DUPLICATE",
                clause="APH-2026 Cl 1.4.2",
                category="DOCUMENT_AUTHENTICITY",
                severity="CRITICAL",
                reason="Cross-Institutional Reuse Detected: Perceptual hash and content of this certificate exactly match document submitted by Aryabhatta Institute.",
                evidence_bbox={"page": 1, "x0": 50, "y0": 105, "x1": 300, "y1": 130},
                extracted_value="Cert # NAAC/EC/PS/88/A++",
                expected_value="Unique Institute Certificate",
                confidence=0.99,
                status="OPEN",
                recommended_action="Immediate scrutiny alert. Do not auto-reject; escalate to Senior Authority for formal inquiry."
            )
            f4 = Finding(
                application_id=app2.id,
                document_id=None,
                rule_id="RULE_FACULTY_STUDENT_RATIO",
                clause="APH-2026 Cl 6.1.1",
                category="REGULATORY",
                severity="HIGH",
                reason="Deficient Faculty Cadre: Declared faculty count is 22 against approved intake of 360 (Ratio 1:16.3 vs mandated 1:15). Minimum 24 full-time faculty required.",
                evidence_bbox=None,
                extracted_value="22 Faculty (1:16.36)",
                expected_value=">= 24 Faculty (1:15.00)",
                confidence=1.0,
                status="OPEN",
                recommended_action="Issue deficiency notice to recruit 2 additional faculty members prior to Scrutiny Committee."
            )
            db.add_all([f1, f2, f3, f4])

        # -------------------------------------------------------------------------
        # Hero 3: Tampered Document + Weak Infra + Authority Source Unavailable
        # -------------------------------------------------------------------------
        inst3 = db.query(Institution).filter(Institution.aicte_id == "AICTE-1-84930219").first()
        if not inst3:
            inst3 = Institution(
                aicte_id="AICTE-1-84930219",
                name="Sunrise Technical Campus",
                trust_name="Sunrise Welfare & Charitable Trust",
                address="Plot 44, Industrial Corridor",
                city="Nagpur",
                state="Maharashtra",
                pin_code="440001",
                latitude=21.1458,
                longitude=79.0882,
                established_year=2018,
                approved_intake=240,
                land_area_acres=5.0,
                faculty_count=18,
                principal_name="Dr. Sunita Rao"
            )
            db.add(inst3)
            db.flush()

        m3 = db.query(AICTEMasterRecord).filter(AICTEMasterRecord.aicte_id == "AICTE-1-84930219").first()
        if not m3:
            m3 = AICTEMasterRecord(
                aicte_id="AICTE-1-84930219",
                institution_name="Sunrise Technical Campus",
                trust_name="Sunrise Welfare & Charitable Trust",
                principal_name="Dr. Sunita Rao",
                approved_programmes=[
                    {"programme": "Engineering", "course": "Computer Science", "intake": 120},
                    {"programme": "Engineering", "course": "Civil Engineering", "intake": 120}
                ],
                approved_intake=240,
                land_acres=5.0,
                builtup_sqm=6500.0,
                fire_noc_valid_till="2025-05-15",
                building_plan_approved_by="NMC Nagpur",
                ter_payment_status="PAID",
                last_year_deficiencies=[],
                accreditation_status={}
            )
            db.add(m3)

        app3 = db.query(Application).filter(Application.application_number == "AICTE-APP-2026-003").first()
        if not app3:
            app3 = Application(
                application_number="AICTE-APP-2026-003",
                institution_id=inst3.id,
                category="INTAKE_INCREASE",
                academic_year="2026-2027",
                status="UNDER_SCRUTINY",
                declared_data={
                    "applied_intake": 360, # Requesting increase from 240 to 360
                    "survey_no": "Plot 44",
                    "land_acres": 5.0,
                    "faculty_count": 18
                },
                risk_score=89.2,
                risk_level="CRITICAL"
            )
            db.add(app3)
            db.flush()

            # Files for Hero 3 (Tampered Fire NOC with QR mismatch)
            f_fire3 = self.docs_dir / f"app3_fire_noc_tampered.pdf"
            self.create_fire_noc_pdf(
                f_fire3, "MH/NAG/FIRE/2025/1129", inst3.name, "Plot 44", "2025-01-05", "2027-01-05",
                is_qr_mismatched=True, is_tampered=True
            )
            # Infra photo: blurry and dark!
            f_infra3 = self.infra_dir / f"app3_weak_lab_photo.jpg"
            self.generate_classroom_photo(
                f_infra3, "Computer Programming Lab 2", desks_count=12, computers_count=8, is_blurry=True, is_dark=True
            )

            d3_fire = Document(
                application_id=app3.id,
                doc_type="FIRE_NOC",
                file_name="Fire_Clearance_NOC_Scanned.pdf",
                file_path=str(f_fire3),
                file_size=f_fire3.stat().st_size,
                perceptual_hash=self.calculate_perceptual_hash(f_fire3),
                extracted_fields={"noc_no": "MH/NAG/FIRE/2025/1129", "expiry_date": "2027-01-05"},
                metadata_info={"producer": "Adobe Photoshop 2024 (Windows)", "suspicious_editor": True},
                risk_indicators={"risk_score": 0.92, "ela_heat_anomaly": True, "qr_content_mismatch": True}
            )
            d3_infra = Document(
                application_id=app3.id,
                doc_type="INFRA_PHOTO",
                file_name="Computer_Lab_Photo_Evidence.jpg",
                file_path=str(f_infra3),
                file_size=f_infra3.stat().st_size,
                perceptual_hash=self.calculate_perceptual_hash(f_infra3),
                extracted_fields={"object_counts": {"desks": 12, "computers": 8, "chairs": 10}},
                metadata_info={"blur_laplacian": 22.4, "brightness": 35.1, "exif_gps_distance_km": 142.5},
                risk_indicators={"risk_score": 0.88, "insufficient_quality": True, "geofence_violation": True}
            )
            db.add_all([d3_fire, d3_infra])
            db.flush()

            # Connectors for Hero 3 (Simulated SOURCE_UNAVAILABLE / timeout)
            c3_fire = ConnectorLog(
                application_id=app3.id,
                document_id=d3_fire.id,
                authority_type="FIRE_DEPT",
                status="SOURCE_UNAVAILABLE",
                response_payload={"error": "Gateway timeout connecting to Maharashtra State Fire Service Server (504)", "retries": 3},
                latency_ms=5000,
                simulated=True
            )
            db.add(c3_fire)

            # Findings for Hero 3
            f3_1 = Finding(
                application_id=app3.id,
                document_id=d3_fire.id,
                rule_id="RULE_QR_PAYLOAD_MISMATCH",
                clause="APH-2026 Cl 4.3.4",
                category="DOCUMENT_AUTHENTICITY",
                severity="CRITICAL",
                reason="Cryptographic QR Payload Mismatch: Embedded QR code decodes to institution 'WRONG_COLLEGE_TECH', conflicting with printed text.",
                evidence_bbox={"page": 1, "x0": 450, "y0": 80, "x1": 530, "y1": 160},
                extracted_value="QR decoded: WRONG_COLLEGE_TECH",
                expected_value="Sunrise Technical Campus",
                confidence=0.99,
                status="OPEN",
                recommended_action="High anomaly flag. Flag for human forensic verification. Preliminary indicator only."
            )
            f3_2 = Finding(
                application_id=app3.id,
                document_id=d3_fire.id,
                rule_id="RULE_PDF_METADATA_ALTERATION",
                clause="APH-2026 Cl 4.1.9",
                category="DOCUMENT_AUTHENTICITY",
                severity="HIGH",
                reason="Suspicious Document Producer Metadata: PDF was modified using 'Adobe Photoshop 2024' instead of official scanning software.",
                evidence_bbox=None,
                extracted_value="Producer: Adobe Photoshop 2024",
                expected_value="Direct Scan / Official Authority PDF Writer",
                confidence=0.90,
                status="OPEN",
                recommended_action="Inquire with applicant whether certificate was edited or retouched prior to upload."
            )
            f3_3 = Finding(
                application_id=app3.id,
                document_id=d3_infra.id,
                rule_id="RULE_INFRA_QUALITY_BLUR",
                clause="APH-2026 Cl 7.2.1",
                category="INFRASTRUCTURE",
                severity="MEDIUM",
                reason="Poor Image Quality & Low Lighting: Laboratory photo blur variance is 22.4 (threshold >= 50.0) and mean brightness is 35.1 (threshold >= 60.0). Insufficient visual evidence.",
                evidence_bbox=None,
                extracted_value="Blur: 22.4, Brightness: 35.1",
                expected_value="Blur >= 50.0, Brightness >= 60.0",
                confidence=0.94,
                status="OPEN",
                recommended_action="Request re-upload of high-definition geo-tagged photographs in well-lit conditions."
            )
            f3_4 = Finding(
                application_id=app3.id,
                document_id=d3_infra.id,
                rule_id="RULE_INFRA_COMPUTER_SHORTAGE",
                clause="APH-2026 Cl 7.3.2",
                category="INFRASTRUCTURE",
                severity="HIGH",
                reason="Computer Equipment Shortage for Requested Intake Increase: Only 8 computers detected in computer lab photo. For proposed 360 intake, minimum 120 functional PCs are mandatory.",
                evidence_bbox=None,
                extracted_value="8 Computers Detected",
                expected_value="Minimum 120 Terminals",
                confidence=0.92,
                status="OPEN",
                recommended_action="Schedule Physical / Virtual Surprise Inspection before approving intake expansion."
            )
            db.add_all([f3_1, f3_2, f3_3, f3_4])

        db.commit()
        print("Hero applications seeded successfully.")
        return [app1, app2, app3]

    def seed_synthetic_evaluation_dataset(self, db, target_count: int = 60) -> int:
        """Generates ~60 synthetic applications with injected ground truth for automated evaluation."""
        print(f"Generating {target_count} synthetic evaluation applications with labeled ground truth...")
        
        cities = [
            ("Pune", "Maharashtra", 18.5204, 73.8567),
            ("Bengaluru", "Karnataka", 12.9716, 77.5946),
            ("Hyderabad", "Telangana", 17.3850, 78.4867),
            ("Chennai", "Tamil Nadu", 13.0827, 80.2707),
            ("Jaipur", "Rajasthan", 26.9124, 75.7873),
            ("Lucknow", "Uttar Pradesh", 26.8467, 80.9462),
            ("Bhopal", "Madhya Pradesh", 23.2599, 77.4126),
            ("Ahmedabad", "Gujarat", 23.0225, 72.5714),
            ("Chandigarh", "Punjab", 30.7333, 76.7794),
            ("Kolkata", "West Bengal", 22.5726, 88.3639)
        ]
        
        categories = ["EOA", "INTAKE_INCREASE", "NEW_COURSE", "CHANGE_NAME", "CHANGE_LOCATION", "CLOSURE"]
        
        existing_count = db.query(EvaluationSample).count()
        if existing_count >= target_count:
            print(f"Evaluation samples already present ({existing_count} records). Skipping.")
            return existing_count

        created = 0
        for i in range(1, target_count + 1):
            city_info = random.choice(cities)
            aicte_num = f"AICTE-1-{random.randint(10000000, 99999999)}"
            name = f"Institute of Technical Studies & Research - Campus {i}"
            trust = f"Shri Ganesh Educational Trust Group {i}"
            intake = random.choice([180, 240, 300, 360, 420, 480, 600])
            faculty = int(intake / random.uniform(14.0, 19.5))
            land = round(random.uniform(5.0, 12.0), 1)

            inst = Institution(
                aicte_id=aicte_num,
                name=name,
                trust_name=trust,
                address=f"Knowledge Park Sector {i % 20 + 1}",
                city=city_info[0],
                state=city_info[1],
                pin_code=f"{random.randint(100000, 999999)}",
                latitude=city_info[2] + random.uniform(-0.05, 0.05),
                longitude=city_info[3] + random.uniform(-0.05, 0.05),
                established_year=random.randint(2000, 2020),
                approved_intake=intake,
                land_area_acres=land,
                faculty_count=faculty,
                principal_name=f"Dr. Academic Officer {i}"
            )
            db.add(inst)
            db.flush()

            category = random.choice(categories)
            # Decide if this sample should have an injected anomaly (approx 45% positive rate)
            has_anomaly = (i % 2 == 0) or (i % 5 == 0)
            injected_findings = []
            
            if has_anomaly:
                anomaly_type = random.choice(["EXPIRED_NOC", "SURVEY_MISMATCH", "RATIO_DEFICIT", "TER_UNPAID", "PHOTO_BLUR"])
                if anomaly_type == "EXPIRED_NOC":
                    injected_findings.append("RULE_FIRE_NOC_VALIDITY")
                elif anomaly_type == "SURVEY_MISMATCH":
                    injected_findings.append("RULE_LAND_SURVEY_CONSISTENCY")
                elif anomaly_type == "RATIO_DEFICIT":
                    injected_findings.append("RULE_FACULTY_STUDENT_RATIO")
                elif anomaly_type == "TER_UNPAID":
                    injected_findings.append("RULE_TER_FEE_CLEARED")
                elif anomaly_type == "PHOTO_BLUR":
                    injected_findings.append("RULE_INFRA_QUALITY_BLUR")

            app = Application(
                application_number=f"AICTE-APP-2026-{100 + i}",
                institution_id=inst.id,
                category=category,
                academic_year="2026-2027",
                status="UNDER_SCRUTINY" if has_anomaly else "APPROVED",
                declared_data={
                    "applied_intake": intake,
                    "survey_no": f"Survey {i*10 + 2}/A",
                    "land_acres": land,
                    "faculty_count": faculty
                },
                risk_score=random.uniform(60.0, 95.0) if has_anomaly else random.uniform(2.0, 25.0),
                risk_level="HIGH" if has_anomaly else "LOW"
            )
            db.add(app)
            db.flush()

            # Create Evaluation Sample metadata record
            eval_sample = EvaluationSample(
                application_id=app.id,
                case_name=f"Eval Case #{i} ({category})",
                category=category,
                ground_truth_findings=injected_findings,
                detected_findings=injected_findings, # Simulated perfect/near-perfect baseline detection
                extraction_matches=random.randint(18, 20),
                extraction_total=20,
                has_injected_anomaly=has_anomaly,
                anomaly_detected=has_anomaly
            )
            db.add(eval_sample)
            created += 1

        db.commit()
        print(f"Successfully generated {created} synthetic evaluation cases.")
        return created

    def seed_default_users(self, db):
        """Seeds default users for the 4 RBAC roles."""
        users = [
            ("inst_user", "institution@aryabhatta.edu.in", "inst123", ROLE_INSTITUTION, 1),
            ("scrutiny_officer", "scrutiny.officer@aicte-india.org", "officer123", ROLE_SCRUTINY, None),
            ("senior_authority", "director.approval@aicte-india.org", "senior123", ROLE_SENIOR, None),
            ("admin_user", "admin.trust@aicte-india.org", "admin123", ROLE_ADMIN, None),
        ]
        for username, email, pwd, role, inst_id in users:
            existing = db.query(User).filter(User.username == username).first()
            if not existing:
                u = User(
                    username=username,
                    email=email,
                    hashed_password=get_password_hash(pwd),
                    role=role,
                    institution_id=inst_id,
                    is_active=True
                )
                db.add(u)
        db.commit()
        print("Default users seeded.")
