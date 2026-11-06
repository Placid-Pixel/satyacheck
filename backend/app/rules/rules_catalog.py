from typing import Dict, Any, List, Optional
from datetime import datetime

AICTE_RULES_CATALOG = [
    {
        "code": "RULE_FIRE_NOC_VALIDITY",
        "clause": "APH-2026 Cl 4.3.1",
        "title": "Fire Safety Certificate (NOC) Validity",
        "category": "REGULATORY",
        "severity": "CRITICAL",
        "description": "Institutions must possess a valid Fire NOC issued by the State Fire Services Authority covering the academic session.",
        "parameters": {"min_valid_date": "2026-06-30"}
    },
    {
        "code": "RULE_LAND_SURVEY_CONSISTENCY",
        "clause": "APH-2026 Cl 2.1.4",
        "title": "Land Title & Revenue Survey Number Consistency",
        "category": "REGULATORY",
        "severity": "HIGH",
        "description": "The Revenue Survey / Khasra number on the submitted Title Deed must match declared application records exactly.",
        "parameters": {}
    },
    {
        "code": "RULE_LAND_AREA_MINIMUM",
        "clause": "APH-2026 Cl 2.1.1",
        "title": "Minimum Contiguous Land Area Mandate",
        "category": "INFRASTRUCTURE",
        "severity": "CRITICAL",
        "description": "Technical institutions in Mega/Metro, Urban, and Rural regions must hold minimum 2.5, 4.0, or 7.5 acres respectively.",
        "parameters": {"min_acres_rural": 7.5, "min_acres_urban": 4.0, "min_acres_metro": 2.5}
    },
    {
        "code": "RULE_FACULTY_STUDENT_RATIO",
        "clause": "APH-2026 Cl 6.1.1",
        "title": "Faculty to Student Mandated Cadre Ratio",
        "category": "FACULTY",
        "severity": "HIGH",
        "description": "Undergraduate Engineering requires 1:15 ratio, Management 1:20, Pharmacy 1:15 based on total sanctioned intake.",
        "parameters": {"target_ratio_eng": 15.0}
    },
    {
        "code": "RULE_CADRE_RATIO_PROFESSORS",
        "clause": "APH-2026 Cl 6.1.3",
        "title": "Faculty Cadre Proportion (1:2:6)",
        "category": "FACULTY",
        "severity": "MEDIUM",
        "description": "Faculty structure should adhere to 1 Professor : 2 Associate Professors : 6 Assistant Professors.",
        "parameters": {"min_prof_pct": 10.0}
    },
    {
        "code": "RULE_PRINCIPAL_QUALIFICATION",
        "clause": "APH-2026 Cl 6.2.1",
        "title": "Principal / Director Statutory Eligibility",
        "category": "FACULTY",
        "severity": "HIGH",
        "description": "Principal must possess Ph.D. degree in appropriate discipline and minimum 15 years teaching/research experience.",
        "parameters": {"phd_required": True}
    },
    {
        "code": "RULE_CLASSROOM_CARPET_AREA",
        "clause": "APH-2026 Cl 7.1.2",
        "title": "Minimum Classroom Carpet Area",
        "category": "INFRASTRUCTURE",
        "severity": "HIGH",
        "description": "Classrooms must measure at least 66 sq. meters carpet area each for a batch of 60 students.",
        "parameters": {"min_classroom_sqm": 66.0}
    },
    {
        "code": "RULE_TOTAL_INSTRUCTIONAL_AREA",
        "clause": "APH-2026 Cl 7.1.5",
        "title": "Total Instructional Built-up Area per Student",
        "category": "INFRASTRUCTURE",
        "severity": "HIGH",
        "description": "Total instructional carpet area must meet or exceed 4.0 sq. meters per enrolled student.",
        "parameters": {"min_sqm_per_student": 4.0}
    },
    {
        "code": "RULE_COMPUTER_TERMINAL_RATIO",
        "clause": "APH-2026 Cl 7.3.1",
        "title": "Computer Terminal Availability Norms",
        "category": "INFRASTRUCTURE",
        "severity": "HIGH",
        "description": "Minimum 1 terminal per 4 students in UG Engineering, equipped with licensed software and cyber security tools.",
        "parameters": {"ratio": 4.0}
    },
    {
        "code": "RULE_INTERNET_BANDWIDTH",
        "clause": "APH-2026 Cl 7.3.4",
        "title": "High-Speed Leased Line Internet Bandwidth",
        "category": "INFRASTRUCTURE",
        "severity": "MEDIUM",
        "description": "Institutions must provide minimum 100 Mbps dedicated optical fiber leased line connectivity.",
        "parameters": {"min_mbps": 100}
    },
    {
        "code": "RULE_BUILDING_PLAN_APPROVAL",
        "clause": "APH-2026 Cl 4.2.1",
        "title": "Competent Authority Building Plan Approval",
        "category": "REGULATORY",
        "severity": "CRITICAL",
        "description": "Building plan must be formally sanctioned by Town Planning / Municipal Corporation / DTCP.",
        "parameters": {}
    },
    {
        "code": "RULE_BARRIER_FREE_ENVIRONMENT",
        "clause": "APH-2026 Cl 7.4.1",
        "title": "Barrier-Free Access for Divyangjan Students",
        "category": "INFRASTRUCTURE",
        "severity": "HIGH",
        "description": "Mandatory ramps, tactile paths, braille-enabled lifts, and accessible restrooms for persons with disabilities.",
        "parameters": {}
    },
    {
        "code": "RULE_TER_FEE_CLEARED",
        "clause": "APH-2026 Cl 1.5.1",
        "title": "Technical Education Regulatory (TER) Fee Clearance",
        "category": "REGULATORY",
        "severity": "CRITICAL",
        "description": "Prescribed TER application charges must be paid and verified via SBI e-Pay payment gateway.",
        "parameters": {}
    },
    {
        "code": "RULE_LABORATORY_ADEQUACY",
        "clause": "APH-2026 Cl 7.2.3",
        "title": "Core Laboratory Availability per Programme",
        "category": "INFRASTRUCTURE",
        "severity": "HIGH",
        "description": "Each engineering branch must provide minimum 4 specialized laboratories per academic year curriculum.",
        "parameters": {"min_labs_per_branch": 4}
    },
    {
        "code": "RULE_INTAKE_EXPANSION_CAP",
        "clause": "APH-2026 Cl 3.1.2",
        "title": "Maximum Permissible Intake Expansion Cap",
        "category": "REGULATORY",
        "severity": "HIGH",
        "description": "Intake increase cannot exceed 50% of the currently approved intake in a single academic cycle.",
        "parameters": {"max_increase_pct": 50.0}
    },
    {
        "code": "RULE_CONSECUTIVE_DEFICIENCIES",
        "clause": "APH-2026 Cl 1.3.4",
        "title": "Resolution of Past Year AICTE Deficiencies",
        "category": "REGULATORY",
        "severity": "CRITICAL",
        "description": "No pending unrectified deficiencies from the preceding two academic approval cycles.",
        "parameters": {}
    },
    {
        "code": "RULE_ACCREDITATION_FOR_EXPANSION",
        "clause": "APH-2026 Cl 3.2.1",
        "title": "Accreditation Prerequisite for New Courses / Expansion",
        "category": "REGULATORY",
        "severity": "HIGH",
        "description": "Institutions applying for intake expansion must have at least 50% of eligible courses accredited by NBA/NAAC.",
        "parameters": {"min_accreditation_pct": 50.0}
    },
    {
        "code": "RULE_UNIVERSITY_AFFILIATION_VALIDITY",
        "clause": "APH-2026 Cl 4.4.1",
        "title": "Affiliating University Continuous Affiliation",
        "category": "REGULATORY",
        "severity": "CRITICAL",
        "description": "Current continuation of affiliation letter issued by the affiliating State/Central University.",
        "parameters": {}
    },
    {
        "code": "RULE_ANTI_RAGGING_COMMITTEE",
        "clause": "APH-2026 Cl 8.1.1",
        "title": "Constitution of Statutory Anti-Ragging Committee",
        "category": "GOVERNANCE",
        "severity": "HIGH",
        "description": "Anti-ragging committee and squad duly notified with police and civil administration nominees.",
        "parameters": {}
    },
    {
        "code": "RULE_INTERNAL_COMPLAINT_COMMITTEE",
        "clause": "APH-2026 Cl 8.1.2",
        "title": "Internal Complaints Committee (ICC / POSH)",
        "category": "GOVERNANCE",
        "severity": "HIGH",
        "description": "Constituted as per Section 4 of Sexual Harassment of Women at Workplace Act 2013.",
        "parameters": {}
    },
    {
        "code": "RULE_STUDENT_GRIEVANCE_REDS",
        "clause": "APH-2026 Cl 8.1.3",
        "title": "Student Grievance Redressal Committee (SGRC)",
        "category": "GOVERNANCE",
        "severity": "MEDIUM",
        "description": "Online portal and SGRC committee with Ombi-person appointment notified to students.",
        "parameters": {}
    },
    {
        "code": "RULE_LIBRARY_BOOK_TITLES",
        "clause": "APH-2026 Cl 7.5.1",
        "title": "Library Volumes and Digital Journal Access",
        "category": "INFRASTRUCTURE",
        "severity": "MEDIUM",
        "description": "Minimum 100 book titles and 500 volumes per course, along with national and international e-journal subscriptions.",
        "parameters": {"min_titles_per_course": 100, "min_volumes_per_course": 500}
    },
    {
        "code": "RULE_INDUSTRY_INTERACTION_CELL",
        "clause": "APH-2026 Cl 8.3.1",
        "title": "Industry-Institute Interaction Cell (IIIC) & Active MoUs",
        "category": "GOVERNANCE",
        "severity": "LOW",
        "description": "Minimum 3 active Memorandums of Understanding with relevant industries for internships and training.",
        "parameters": {"min_mous": 3}
    },
    {
        "code": "RULE_INNOVATION_COUNCIL_IIC",
        "clause": "APH-2026 Cl 8.3.2",
        "title": "Institution's Innovation Council (IIC) & IPR Cell",
        "category": "GOVERNANCE",
        "severity": "LOW",
        "description": "Registered with Ministry of Education Innovation Cell (MIC) to foster entrepreneurship and patents.",
        "parameters": {}
    },
    {
        "code": "RULE_CROSS_INSTITUTE_DUPLICATE",
        "clause": "APH-2026 Cl 1.4.2",
        "title": "Duplicate Document Reuse Across Institutions",
        "category": "DOCUMENT_AUTHENTICITY",
        "severity": "CRITICAL",
        "description": "Certificate perceptual hash or certificate identifier matches documents submitted by a different institution.",
        "parameters": {}
    },
    {
        "code": "RULE_QR_PAYLOAD_MISMATCH",
        "clause": "APH-2026 Cl 4.3.4",
        "title": "Cryptographic QR Code vs Printed Certificate Text Mismatch",
        "category": "DOCUMENT_AUTHENTICITY",
        "severity": "CRITICAL",
        "description": "Digital QR payload fields must verify and agree with printed institution name, certificate number, and dates.",
        "parameters": {}
    }
]
