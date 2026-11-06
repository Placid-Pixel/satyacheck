import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Clock,
  Printer,
  CornerDownRight,
  RotateCcw,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  XCircle,
  Eye,
  Layers
} from 'lucide-react';
import { Application } from '../types';
import { api } from '../api';
import { LiveELAForensicModal } from './LiveELAForensicModal';

export interface DocketItem {
  id: string | number;
  app_id: string;
  college_name: string;
  city_state: string;
  category: string;
  academic_year: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';
  risk_score: number;
  risk_label: string;
  border_accent: 'rose' | 'amber' | 'emerald';
  timestamp: string;
  tags: string[];
  filter_bucket: 'tampering' | 'mismatch' | 'my_desk' | 'clean';
  forensics: {
    alert_title: string;
    alert_description: string;
    alert_severity: 'critical' | 'warning' | 'clean';
    document_title: string;
    document_date: string;
    document_receipt: string;
    survey_declared: string;
    survey_revenue: string;
    acreage_declared: string;
    acreage_revenue: string;
    ocr_bbox_text: string;
    ocr_bbox_coords: string;
    ela_coords: string;
    ela_spike_label: string;
    ela_detail: string;
    gateway_name: string;
    gateway_latency: string;
    gateway_status: 'MATCH FAILURE' | 'DISCREPANCY DETECTED' | 'EXPIRED' | 'SYNC VERIFIED';
    gateway_status_type: 'error' | 'warning' | 'success';
    gateway_detail: string;
    sha256_hash: string;
    block_height: string;
  };
}

// Initial Mock Pool with High-Density Datasets matching specifications
const DEFAULT_DOCKETS: DocketItem[] = [
  {
    id: 105,
    app_id: 'AICTE-APP-2026-105',
    college_name: 'INSTITUTE OF TECHNICAL STUDIES & RESEARCH',
    city_state: 'Ahmedabad, Gujarat',
    category: 'Extension of Approval (EoA)',
    academic_year: '2026-27',
    severity: 'CRITICAL',
    risk_score: 98.4,
    risk_label: '▲ CRITICAL 98.4%',
    border_accent: 'rose',
    timestamp: '12m ago',
    tags: ['Deed Tampered', 'Survey Mismatch 402/A', 'Fire Expired -114d'],
    filter_bucket: 'tampering',
    forensics: {
      alert_title: '▲ CRITICAL ALERT: APH Cl. 1.4 Survey Identification Contradiction',
      alert_description:
        'Discrepancy detected between geographic survey boundaries and registered land deed acreage.',
      alert_severity: 'critical',
      document_title: 'LAND DEED CONVEYANCE • REVENUE DEPARTMENT GUJARAT',
      document_date: '12/04/2018',
      document_receipt: '40002018040',
      survey_declared: '402/A (Spliced)',
      survey_revenue: '402/B (Govt. Grazing Land)',
      acreage_declared: '3.13 Acres (12,670 m²)',
      acreage_revenue: '1.10 Acres (-64.8% Contradiction)',
      ocr_bbox_text: 'Survey No: 402/A',
      ocr_bbox_coords: '[x0: 420, y0: 185, x1: 580, y1: 220]',
      ela_coords: '[x:420, y:185]',
      ela_spike_label: 'ΔE: 89.2% Quantization Discontinuity',
      ela_detail: 'Resaved JPEG compression artifact isolated over numerical digits "402/A". Base flatbed scan baseline: 2018.',
      gateway_name: 'Land Records Authority Adapter (Simulated Sandbox)',
      gateway_latency: 'Response time: 173 ms, 230 ms',
      gateway_status: 'MATCH FAILURE',
      gateway_status_type: 'error',
      gateway_detail: 'Revenue records show Survey 402/A is non-existent in Taluka ledger. Plot 402/B is designated rural common land.',
      sha256_hash: '3a4f8b92c817e08f237d4512b19280d4734892cfa712e89a',
      block_height: '#1428 • Merkle Root: 8b2d...1f9a'
    }
  },
  {
    id: 88,
    app_id: 'AICTE-APP-2026-088',
    college_name: 'SRI VENKATESWARA INSTITUTE OF TECH',
    city_state: 'Tirupati, Andhra Pradesh',
    category: 'Intake Increase (CSE/AIML)',
    academic_year: '2026-27',
    severity: 'CRITICAL',
    risk_score: 96.1,
    risk_label: '▲ CRITICAL 96.1%',
    border_accent: 'rose',
    timestamp: '24m ago',
    tags: ['Deed Tampered', 'Survey Mismatch 405/A', 'Dharani Gateway Fail'],
    filter_bucket: 'tampering',
    forensics: {
      alert_title: '▲ CRITICAL ALERT: APH Cl. 1.4 Survey Identification Contradiction',
      alert_description:
        'Discrepancy detected between geographic survey boundaries and registered land deed acreage. Cadastral overlap detected.',
      alert_severity: 'critical',
      document_title: 'REGISTERED POSSESSION TITLE DEED • AP REVENUE DEPT',
      document_date: '08/09/2019',
      document_receipt: 'AP-REV-8829104',
      survey_declared: '405/A (Declared)',
      survey_revenue: '405/C (Disputed Partition)',
      acreage_declared: '5.20 Acres',
      acreage_revenue: '2.10 Acres (-59.6% Deficit)',
      ocr_bbox_text: 'Survey No: 405/A',
      ocr_bbox_coords: '[x0: 405, y0: 210, x1: 560, y1: 245]',
      ela_coords: '[x:405, y:210]',
      ela_spike_label: 'ΔE: 84.7% Copy-Move Compression Spike',
      ela_detail: 'Cloned survey boundary stamp detected with altered acreage digits. Multi-layer paste artifact confirmed.',
      gateway_name: 'Land Records Authority Adapter (Simulated Sandbox)',
      gateway_latency: 'Response time: 185 ms, 244 ms',
      gateway_status: 'MATCH FAILURE',
      gateway_status_type: 'error',
      gateway_detail: 'Dharani portal returned ACTIVE TITLE DISPUTE (Civil Suit #204/2023). Contiguity requirement violated.',
      sha256_hash: '7f9b2c140e53a812b1029c87d4615a990e1837bc4491a1b2',
      block_height: '#1427 • Merkle Root: 4e11...980c'
    }
  },
  {
    id: 92,
    app_id: 'AICTE-APP-2026-092',
    college_name: 'MAHARASHTRA ACADEMY OF ENGINEERING & TECH',
    city_state: 'Pune, Maharashtra',
    category: 'Extension of Approval (EoA)',
    academic_year: '2026-27',
    severity: 'CRITICAL',
    risk_score: 93.8,
    risk_label: '▲ CRITICAL 93.8%',
    border_accent: 'rose',
    timestamp: '46m ago',
    tags: ['Deed Tampered', 'Forged Municipal Seal', 'Fire Expired -88d'],
    filter_bucket: 'tampering',
    forensics: {
      alert_title: '▲ CRITICAL ALERT: Cl. 2.1 Municipal Building Clearance Stamp Forgery',
      alert_description:
        'Digital circular seal demonstrates artificial pixel-perfect symmetry characteristic of vector stamp insertion.',
      alert_severity: 'critical',
      document_title: 'MUNICIPAL OCCUPANCY CERTIFICATE • PMC PUNE',
      document_date: '19/11/2021',
      document_receipt: 'PMC-OC-2021-994',
      survey_declared: 'Plot 18/B, Kothrud',
      survey_revenue: 'Plot 18/B (Unsanctioned Floors)',
      acreage_declared: '4.50 Acres Built-up',
      acreage_revenue: 'Floor 4 & 5 Unapproved by Town Planning',
      ocr_bbox_text: 'PMC Sanction No: PMC-2021-77',
      ocr_bbox_coords: '[x0: 380, y0: 195, x1: 530, y1: 230]',
      ela_coords: '[x:380, y:195]',
      ela_spike_label: 'ΔE: 91.5% Synthetic Stamp Insertion',
      ela_detail: 'Seal RGB alpha channel shows missing paper grain noise floor. Digital vector stamp overlaid onto scanned PDF.',
      gateway_name: 'Land Records Authority Adapter (Simulated Sandbox)',
      gateway_latency: 'Response time: 162 ms, 215 ms',
      gateway_status: 'MATCH FAILURE',
      gateway_status_type: 'error',
      gateway_detail: 'Pune Municipal Corporation Gateway confirms NOC expired 88 days ago; no renewal application pending.',
      sha256_hash: '91d84f22a104e76c889312bba71e04c4f98103d81b992f3a',
      block_height: '#1425 • Merkle Root: 3c2a...ff01'
    }
  },
  {
    id: 64,
    app_id: 'AICTE-APP-2026-064',
    college_name: 'K.R. MANGALAM COLLEGE OF TECHNOLOGY',
    city_state: 'Gurugram, Haryana',
    category: 'New Course Sanction (Data Science)',
    academic_year: '2026-27',
    severity: 'HIGH',
    risk_score: 87.2,
    risk_label: '⚠️ HIGH 87.2%',
    border_accent: 'amber',
    timestamp: '1h 15m ago',
    tags: ['Survey Mismatch 405/A', 'Cadastral Deviation', 'Pending Re-check'],
    filter_bucket: 'mismatch',
    forensics: {
      alert_title: '⚠️ WARNING: APH Cl. 1.2 Boundary Coordinates Variance (Cadastral Gateway)',
      alert_description:
        'Survey coordinates submitted in application diverge by 42 meters from official State GIS cadastral polygon.',
      alert_severity: 'warning',
      document_title: 'LAND POSSESSION & CADASTRAL MAP • TEHSIL SOHNA',
      document_date: '04/02/2022',
      document_receipt: 'HR-REV-09418',
      survey_declared: 'Survey Khasra #112/4',
      survey_revenue: 'Khasra #112/4 (Sub-divided)',
      acreage_declared: '5.00 Acres',
      acreage_revenue: '4.32 Acres (-13.6% Variance)',
      ocr_bbox_text: 'Khasra No: 112/4 (Total 5.0 Acres)',
      ocr_bbox_coords: '[x0: 410, y0: 220, x1: 570, y1: 250]',
      ela_coords: '[x:410, y:220]',
      ela_spike_label: 'ΔE: 42.1% Edge Resampling Blur',
      ela_detail: 'Moderate edge interpolation detected on cadastral map boundary line. Boundary coordinates re-drawn.',
      gateway_name: 'Land Records Authority Adapter (Simulated Sandbox)',
      gateway_latency: 'Response time: 191 ms, 240 ms',
      gateway_status: 'DISCREPANCY DETECTED',
      gateway_status_type: 'warning',
      gateway_detail: 'Haryana Jamabandi live ping reports unfinalized partition deed between co-owners.',
      sha256_hash: '2c5a918e770213d4b689104fa28bb9c018247df601a941e1',
      block_height: '#1421 • Merkle Root: 994a...55de'
    }
  },
  {
    id: 41,
    app_id: 'AICTE-APP-2026-041',
    college_name: 'BENGAL INSTITUTE OF APPLIED SCIENCES',
    city_state: 'Kolkata, West Bengal',
    category: 'Extension of Approval (EoA)',
    academic_year: '2026-27',
    severity: 'HIGH',
    risk_score: 84.5,
    risk_label: '⚠️ HIGH 84.5%',
    border_accent: 'amber',
    timestamp: '2h ago',
    tags: ['Survey Mismatch 405/A', 'Banglarbhumi Mismatch', 'My Desk Priority'],
    filter_bucket: 'my_desk',
    forensics: {
      alert_title: '⚠️ WARNING: APH Cl. 1.3 Land Use Conversion (CLU) Cross-Check Alert',
      alert_description:
        'Banglarbhumi portal lists property classification as Agricultural (Khamar), contradicting declared Institutional CLU.',
      alert_severity: 'warning',
      document_title: 'COMMERCIAL LAND CONVERSION ORDER • ADM REVENUE WB',
      document_date: '14/06/2020',
      document_receipt: 'WB-CLU-55201',
      survey_declared: 'Dag No: 884, Khatian: 219',
      survey_revenue: 'Dag No: 884 (Class: Agriculture)',
      acreage_declared: '3.75 Acres',
      acreage_revenue: '3.75 Acres (Land Use Unconverted)',
      ocr_bbox_text: 'Classification: Educational / Institutional',
      ocr_bbox_coords: '[x0: 395, y0: 175, x1: 550, y1: 210]',
      ela_coords: '[x:395, y:175]',
      ela_spike_label: 'ΔE: 58.4% Typography Font Mismatch',
      ela_detail: 'Typeface kerning and point size on "Educational" classification differs from government gazette standard.',
      gateway_name: 'Land Records Authority Adapter (Simulated Sandbox)',
      gateway_latency: 'Response time: 210 ms, 290 ms',
      gateway_status: 'DISCREPANCY DETECTED',
      gateway_status_type: 'warning',
      gateway_detail: 'Banglarbhumi API returns record: Land use conversion order pending deposit of statutory conversion fees.',
      sha256_hash: '55df9012c8a14b03e91129bc57448201a0941ecf5698b724',
      block_height: '#1418 • Merkle Root: 11ac...772a'
    }
  },
  {
    id: 118,
    app_id: 'AICTE-APP-2026-118',
    college_name: 'SARASWATI VIDYAPEETH COLLEGE OF PHARMACY',
    city_state: 'Indore, Madhya Pradesh',
    category: 'Extension of Approval (EoA)',
    academic_year: '2026-27',
    severity: 'MEDIUM',
    risk_score: 64.2,
    risk_label: '⚠️ MEDIUM 64.2%',
    border_accent: 'amber',
    timestamp: '2h 45m ago',
    tags: ['Fire Expired -114d', 'State Fire NOC Expired', 'Assigned Scrutiny Desk'],
    filter_bucket: 'my_desk',
    forensics: {
      alert_title: '⚠️ WARNING: APH Cl. 2.1 State Fire Safety NOC Expiry Overdue',
      alert_description:
        'State Fire Services NOC expired 114 days ago. Application lacks valid renewal acknowledgement copy.',
      alert_severity: 'warning',
      document_title: 'STATE DISASTER MANAGEMENT FIRE NOC • MP POLICE',
      document_date: '02/01/2023',
      document_receipt: 'MP-FIRE-2023-881',
      survey_declared: 'Survey #89/2, Indore Bypass',
      survey_revenue: 'Survey #89/2 (Compliant)',
      acreage_declared: '2.50 Acres',
      acreage_revenue: '2.50 Acres (Clear Title)',
      ocr_bbox_text: 'Validity Period: Until 30/06/2026',
      ocr_bbox_coords: '[x0: 430, y0: 240, x1: 590, y1: 275]',
      ela_coords: '[x:430, y:240]',
      ela_spike_label: 'ΔE: 62.0% Date Splicing Discontinuity',
      ela_detail: 'Expiry year "2026" shows higher JPEG noise artifact compared to base issuance year "2023". Original expired 2025.',
      gateway_name: 'Land Records Authority Adapter (Simulated Sandbox)',
      gateway_latency: 'Response time: 145 ms, 198 ms',
      gateway_status: 'EXPIRED',
      gateway_status_type: 'warning',
      gateway_detail: 'MP Fire Services portal confirms NOC expired on 30/06/2025. No renewal inspection logged.',
      sha256_hash: '88c142e09fb4581290bb3a19547d28c94125890eac194511',
      block_height: '#1414 • Merkle Root: 4f02...89aa'
    }
  },
  {
    id: 120,
    app_id: 'AICTE-APP-2026-120',
    college_name: 'RAJASTHAN INSTITUTE OF ENGINEERING & TECH',
    city_state: 'Jaipur, Rajasthan',
    category: 'Extension of Approval (EoA)',
    academic_year: '2026-27',
    severity: 'MEDIUM',
    risk_score: 58.0,
    risk_label: '⚠️ MEDIUM 58.0%',
    border_accent: 'amber',
    timestamp: '3h ago',
    tags: ['Survey Mismatch 405/A', 'Apna Khata Ping Warning', 'My Desk'],
    filter_bucket: 'my_desk',
    forensics: {
      alert_title: '⚠️ WARNING: APH Cl. 1.4 Tehsil Mutation Record Number Mismatch',
      alert_description:
        'Submitted mutation intimation receipt number fails checksum verification on Rajasthan Apna Khata gateway.',
      alert_severity: 'warning',
      document_title: 'REVENUE MUTATION INTIMATION • TEHSIL SANGANER',
      document_date: '11/10/2022',
      document_receipt: 'RJ-MUT-102948',
      survey_declared: 'Khasra #330/1',
      survey_revenue: 'Khasra #330/1 (Pending Mutation Entry)',
      acreage_declared: '5.00 Acres',
      acreage_revenue: '5.00 Acres (Sub-judice Partition)',
      ocr_bbox_text: 'Mutation Order No: RJ-2022-99',
      ocr_bbox_coords: '[x0: 400, y0: 190, x1: 560, y1: 225]',
      ela_coords: '[x:400, y:190]',
      ela_spike_label: 'ΔE: 38.5% Low-level Contrast Shift',
      ela_detail: 'Slight contrast shift on mutation endorsement number. Likely scanner threshold artifact.',
      gateway_name: 'Land Records Authority Adapter (Simulated Sandbox)',
      gateway_latency: 'Response time: 167 ms, 222 ms',
      gateway_status: 'DISCREPANCY DETECTED',
      gateway_status_type: 'warning',
      gateway_detail: 'Rajasthan Apna Khata reports mutation case #RJ-2022-99 adjourned for family partition deed.',
      sha256_hash: '4410a8ef19245100bc8923a104f291048b9914ec7a19283f',
      block_height: '#1410 • Merkle Root: 8c33...66b1'
    }
  },
  {
    id: 122,
    app_id: 'AICTE-APP-2026-122',
    college_name: 'DELHI NCR INSTITUTE OF TECHNOLOGY',
    city_state: 'Greater Noida, Uttar Pradesh',
    category: 'Extension of Approval (EoA)',
    academic_year: '2026-27',
    severity: 'CLEAN',
    risk_score: 11.2,
    risk_label: '✓ CLEAN 11.2%',
    border_accent: 'emerald',
    timestamp: '4h ago',
    tags: ['Deed Verified', 'Bhulekh UP Synced', 'Fire NOC Valid 2027'],
    filter_bucket: 'clean',
    forensics: {
      alert_title: '✓ ALL STATUTORY VERIFICATIONS PASSED: 100% NORMATIVE COMPLIANCE',
      alert_description:
        'All documentary and digital state API gateway checks verified genuine. Zero discrepancies detected.',
      alert_severity: 'clean',
      document_title: 'REGISTERED LEASE DEED • GREATER NOIDA AUTHORITY',
      document_date: '25/08/2023',
      document_receipt: 'GNIDA-LD-2023-401',
      survey_declared: 'Plot 14, Knowledge Park III',
      survey_revenue: 'Plot 14, Knowledge Park III (Match)',
      acreage_declared: '6.50 Acres (Contiguous)',
      acreage_revenue: '6.50 Acres (Full Agreement)',
      ocr_bbox_text: 'GNIDA Possession ID: KP3-14-VALID',
      ocr_bbox_coords: '[x0: 420, y0: 185, x1: 580, y1: 220]',
      ela_coords: '[x:420, y:185]',
      ela_spike_label: 'ΔE: 3.1% Uniform Sensor Baseline',
      ela_detail: 'Flawless uniform sensor noise floor across entire document page. Zero evidence of splicing or manipulation.',
      gateway_name: 'Land Records Authority Adapter (Simulated Sandbox)',
      gateway_latency: 'Response time: 142 ms, 180 ms',
      gateway_status: 'SYNC VERIFIED',
      gateway_status_type: 'success',
      gateway_detail: 'UP Bhulekh Gateway confirms GNIDA registered institutional 90-year lease. All statutory dues paid.',
      sha256_hash: '12b84f901a88204c339178de459104fa28bb9c018247df60',
      block_height: '#1405 • Merkle Root: aa19...440c'
    }
  },
  {
    id: 125,
    app_id: 'AICTE-APP-2026-125',
    college_name: 'COIMBATORE INSTITUTE OF ADVANCED STUDIES',
    city_state: 'Coimbatore, Tamil Nadu',
    category: 'Extension of Approval (EoA)',
    academic_year: '2026-27',
    severity: 'CLEAN',
    risk_score: 9.4,
    risk_label: '✓ CLEAN 9.4%',
    border_accent: 'emerald',
    timestamp: '5h ago',
    tags: ['TN Patta Verified', 'Fire NOC Valid', 'Acreage 7.2ac Met'],
    filter_bucket: 'clean',
    forensics: {
      alert_title: '✓ ALL STATUTORY VERIFICATIONS PASSED: 100% NORMATIVE COMPLIANCE',
      alert_description:
        'Tamil Nadu AnyQuery / Patta Chitta gateway validated ownership with digital QR signature match.',
      alert_severity: 'clean',
      document_title: 'TAMIL NADU PATTA CHITTA EXTRACT • REVENUE DEPT',
      document_date: '10/01/2024',
      document_receipt: 'TN-PATTA-88402',
      survey_declared: 'Survey #214/1A',
      survey_revenue: 'Survey #214/1A (Patta Certified)',
      acreage_declared: '7.20 Acres',
      acreage_revenue: '7.20 Acres (Clear Title)',
      ocr_bbox_text: 'Patta No: 88402 (Contiguous Campus)',
      ocr_bbox_coords: '[x0: 410, y0: 190, x1: 570, y1: 220]',
      ela_coords: '[x:410, y:190]',
      ela_spike_label: 'ΔE: 2.8% Clean Sensor Signature',
      ela_detail: 'Document conforms to official e-Patta PDF generator signature with valid SHA-256 certificate chain.',
      gateway_name: 'Land Records Authority Adapter (Simulated Sandbox)',
      gateway_latency: 'Response time: 138 ms, 175 ms',
      gateway_status: 'SYNC VERIFIED',
      gateway_status_type: 'success',
      gateway_detail: 'Tamil Nadu e-Services Patta gateway confirmed valid ownership and zero encumbrances.',
      sha256_hash: '90ea11bc88347104928bb841920ac34f1982740bc1849102',
      block_height: '#1398 • Merkle Root: 77c1...12ab'
    }
  }
];

interface DocketConsoleViewProps {
  onOpenWorkbench: (appId: string | number) => void;
  onSelectApplication?: (appId: number) => void;
}

export const DocketConsoleView: React.FC<DocketConsoleViewProps> = ({
  onOpenWorkbench,
  onSelectApplication
}) => {
  // --- States ---
  const [dockets, setDockets] = useState<DocketItem[]>(DEFAULT_DOCKETS);
  const [selectedDocketId, setSelectedDocketId] = useState<string | number>('AICTE-APP-2026-105');
  const [activeFilterTab, setActiveFilterTab] = useState<'ALL' | 'CRITICAL' | 'MISMATCH' | 'MY_DESK'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'RISK_DESC' | 'RISK_ASC' | 'NEWEST' | 'NAME'>('RISK_DESC');
  const [copiedHash, setCopiedHash] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isELAModalOpen, setIsELAModalOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const docketListRef = useRef<HTMLDivElement>(null);

  // Load from backend if available, merging or falling back gracefully
  useEffect(() => {
    api.getApplications()
      .then((apps) => {
        if (apps && apps.length > 0) {
          // Augment or enrich backend apps into DocketItem model
          const enriched: DocketItem[] = apps.map((app, idx) => {
            const hasTampering = app.findings?.some((f) => f.category === 'DOCUMENT_AUTHENTICITY') || app.risk_level === 'CRITICAL';
            const hasMismatch = app.findings?.some((f) => f.category === 'CONSISTENCY') || app.risk_score > 60;
            const borderAccent: 'rose' | 'amber' | 'emerald' =
              app.risk_level === 'CRITICAL' || app.risk_score >= 85
                ? 'rose'
                : app.risk_level === 'HIGH' || app.risk_level === 'MEDIUM'
                ? 'amber'
                : 'emerald';

            return {
              id: app.id,
              app_id: app.application_number,
              college_name: app.institution?.name || `INSTITUTION #${app.id}`,
              city_state: `${app.institution?.city || 'New Delhi'}, ${app.institution?.state || 'Delhi'}`,
              category: app.category === 'EOA' ? 'Extension of Approval (EoA)' : app.category,
              academic_year: app.academic_year || '2026-27',
              severity: app.risk_level,
              risk_score: app.risk_score,
              risk_label: `${app.risk_level === 'CRITICAL' ? '▲ CRITICAL' : app.risk_level === 'HIGH' ? '⚠️ HIGH' : '✓ CLEAN'} ${app.risk_score.toFixed(1)}%`,
              border_accent: borderAccent,
              timestamp: `${idx * 14 + 12}m ago`,
              tags: [
                hasTampering ? 'Deed Tampered' : 'Document Checked',
                hasMismatch ? 'Survey Mismatch 402/A' : 'Survey Confirmed',
                app.risk_score > 70 ? 'Fire Expired -114d' : 'Clearance Valid'
              ],
              filter_bucket: hasTampering ? 'tampering' : hasMismatch ? 'mismatch' : idx % 2 === 0 ? 'my_desk' : 'clean',
              forensics: {
                alert_title:
                  app.risk_level === 'CRITICAL'
                    ? '▲ CRITICAL ALERT: APH Cl. 1.4 Survey Identification Contradiction'
                    : '⚠️ REGULATORY ADVISORY: Land Title Consistency Review',
                alert_description:
                  'Discrepancy detected between geographic survey boundaries and registered land deed acreage.',
                alert_severity: app.risk_level === 'CRITICAL' ? 'critical' : 'warning',
                document_title: 'LAND DEED CONVEYANCE • REVENUE DEPARTMENT',
                document_date: '12/04/2018',
                document_receipt: '40002018040',
                survey_declared: '402/A (Spliced)',
                survey_revenue: '402/B (Govt. Grazing Land)',
                acreage_declared: `${app.institution?.land_area_acres || 3.5} Acres`,
                acreage_revenue: '1.10 Acres (-64.8% Contradiction)',
                ocr_bbox_text: 'Survey No: 402/A',
                ocr_bbox_coords: '[x0: 420, y0: 185, x1: 580, y1: 220]',
                ela_coords: '[x:420, y:185]',
                ela_spike_label: 'ΔE: 89.2% Quantization Discontinuity',
                ela_detail: 'Resaved JPEG compression table mismatch isolated on Survey No digits.',
                gateway_name: 'Land Records Authority Adapter (Simulated Sandbox)',
                gateway_latency: 'Response time: 173 ms, 230 ms',
                gateway_status: 'MATCH FAILURE',
                gateway_status_type: 'error',
                gateway_detail: 'Revenue records show Survey 402/A is non-existent in Taluka ledger.',
                sha256_hash: '3a4f8b92c817e08f237d4512b19280d4734892cfa712e89a',
                block_height: '#1428 • Merkle Root: 8b2d...1f9a'
              }
            };
          });

          // Ensure default flagship AICTE-APP-2026-105 is present at top if not in backend
          const has105 = enriched.some((e) => e.app_id === 'AICTE-APP-2026-105');
          if (!has105) {
            setDockets([DEFAULT_DOCKETS[0], ...enriched]);
          } else {
            setDockets(enriched);
          }
        }
      })
      .catch((err) => {
        console.warn('Backend offline, using high-density mock pool:', err);
      });
  }, []);

  // Filter & Sort Logic
  const filteredDockets = useMemo(() => {
    return dockets.filter((docket) => {
      // Tab filter
      if (activeFilterTab === 'CRITICAL' && docket.filter_bucket !== 'tampering') return false;
      if (activeFilterTab === 'MISMATCH' && docket.filter_bucket !== 'mismatch') return false;
      if (activeFilterTab === 'MY_DESK' && docket.filter_bucket !== 'my_desk') return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesAppId = docket.app_id.toLowerCase().includes(q);
        const matchesCollege = docket.college_name.toLowerCase().includes(q);
        const matchesCity = docket.city_state.toLowerCase().includes(q);
        const matchesHash = docket.forensics.sha256_hash.toLowerCase().includes(q);
        const matchesTags = docket.tags.some((t) => t.toLowerCase().includes(q));
        const matchesSurvey = docket.forensics.survey_declared.toLowerCase().includes(q);

        if (!matchesAppId && !matchesCollege && !matchesCity && !matchesHash && !matchesTags && !matchesSurvey) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'RISK_DESC') return b.risk_score - a.risk_score;
      if (sortBy === 'RISK_ASC') return a.risk_score - b.risk_score;
      if (sortBy === 'NAME') return a.college_name.localeCompare(b.college_name);
      return 0; // NEWEST preserves initial order
    });
  }, [dockets, activeFilterTab, searchQuery, sortBy]);

  // Active selected docket
  const activeDocket = useMemo(() => {
    const found = filteredDockets.find((d) => d.app_id === selectedDocketId || d.id === selectedDocketId);
    if (found) return found;
    return filteredDockets[0] || dockets[0];
  }, [filteredDockets, selectedDocketId, dockets]);

  // Keep selection synchronized
  useEffect(() => {
    if (activeDocket && activeDocket.app_id !== selectedDocketId) {
      setSelectedDocketId(activeDocket.app_id);
    }
  }, [activeDocket]);

  // Keyboard Hotkey Listener: J/K or Up/Down for selection, Space/Enter for workbench, Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to focus search input
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // If typing inside an input or textarea, do not trigger list shortcuts
      const activeTag = (document.activeElement?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      // Space or Enter: Trigger Scrutiny Workbench
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (activeDocket) {
          onOpenWorkbench(activeDocket.app_id);
        }
        return;
      }

      // J or ArrowDown: Move selection DOWN
      if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIndex = filteredDockets.findIndex(
          (d) => d.app_id === activeDocket?.app_id || d.id === activeDocket?.id
        );
        if (currentIndex < filteredDockets.length - 1) {
          const nextDocket = filteredDockets[currentIndex + 1];
          setSelectedDocketId(nextDocket.app_id);
        }
        return;
      }

      // K or ArrowUp: Move selection UP
      if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = filteredDockets.findIndex(
          (d) => d.app_id === activeDocket?.app_id || d.id === activeDocket?.id
        );
        if (currentIndex > 0) {
          const prevDocket = filteredDockets[currentIndex - 1];
          setSelectedDocketId(prevDocket.app_id);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredDockets, activeDocket, onOpenWorkbench]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2200);
  };

  const showActionToast = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0B0F17] text-slate-100 overflow-hidden font-sans select-none">
      {/* =========================================================================
          SECTION 2: TOP SYSTEM STATUS RIBBON (Header Bar, Height: 42px)
          ========================================================================= */}
      <header className="h-[42px] min-h-[42px] px-3 bg-[#0B0F17] border-b border-slate-800 flex items-center justify-between text-xs shrink-0 select-none z-20">
        {/* Left: Monospace Title & Operational Chips */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
            <span className="font-mono font-bold text-white text-xs tracking-tight">
              SatyaCheck | Docket Console
            </span>
          </div>

          {/* Operational Chips (compact status badges with colored borders, NO large cards) */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {/* Critical Forensic Pill */}
            <button
              onClick={() => setActiveFilterTab('CRITICAL')}
              className={`px-2 py-0.5 rounded border flex items-center gap-1 font-bold transition-all ${
                activeFilterTab === 'CRITICAL'
                  ? 'bg-rose-950 text-rose-200 border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                  : 'bg-[#280c12] text-rose-300 border-rose-800/90 hover:border-rose-600'
              }`}
              title="Click to filter Critical Forensic Tampering dockets"
            >
              <span>▲ CRITICAL FORENSIC: 3</span>
            </button>

            {/* API Mismatch Pill */}
            <button
              onClick={() => setActiveFilterTab('MISMATCH')}
              className={`px-2 py-0.5 rounded border flex items-center gap-1 font-bold transition-all ${
                activeFilterTab === 'MISMATCH'
                  ? 'bg-amber-950 text-amber-200 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : 'bg-[#291708] text-amber-300 border-amber-800/90 hover:border-amber-600'
              }`}
              title="Click to filter API Mismatch dockets"
            >
              <span>API MISMATCH: 7</span>
            </button>

            {/* Expired NOCs Pill */}
            <button
              onClick={() => setActiveFilterTab('MY_DESK')}
              className="px-2 py-0.5 rounded bg-[#291206] text-orange-300 border border-orange-800/90 hover:border-orange-600 transition-colors font-bold flex items-center gap-1"
              title="Expired NOCs requiring statutory escalation"
            >
              <span>EXPIRED NOCs: 5</span>
            </button>

            {/* Clean Pool Pill */}
            <button
              onClick={() => setActiveFilterTab('ALL')}
              className="px-2 py-0.5 rounded bg-[#082215] text-emerald-300 border border-emerald-800/90 hover:border-emerald-600 transition-colors font-bold flex items-center gap-1"
              title="Clean Applications Pool"
            >
              <span>CLEAN POOL: 112</span>
            </button>
          </div>
        </div>

        {/* Right: Officer metadata & Authority status pill */}
        <div className="flex items-center gap-2.5 font-mono text-[11px] shrink-0 pl-2">
          {/* Officer ID */}
          <span className="hidden sm:inline text-slate-300 px-2 py-0.5 rounded bg-[#0F172A] border border-slate-800">
            Officer Name
          </span>

          {/* Authority Sandbox Status Pill */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0A1A24] text-blue-400 border border-blue-800/70">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="font-semibold text-[10px]">Authority Adapters (Sandbox)</span>
          </div>
        </div>
      </header>

      {/* =========================================================================
          SECTION 3: FILTER & QUICK-JUMP TOOLBAR (Height: 44px)
          ========================================================================= */}
      <div className="h-[44px] min-h-[44px] px-3 bg-[#0E131F] border-b border-slate-800 flex items-center justify-between text-xs shrink-0 select-none z-10 gap-2">
        {/* Left Filter Tabs */}
        <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
          <button
            onClick={() => setActiveFilterTab('ALL')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
              activeFilterTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            All Queue (127)
          </button>

          <button
            onClick={() => setActiveFilterTab('CRITICAL')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
              activeFilterTab === 'CRITICAL'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-400 hover:text-rose-200 hover:bg-rose-950/40'
            }`}
          >
            Critical Tampering (3)
          </button>

          <button
            onClick={() => setActiveFilterTab('MISMATCH')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
              activeFilterTab === 'MISMATCH'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-400 hover:text-amber-200 hover:bg-amber-950/40'
            }`}
          >
            API Mismatch (7)
          </button>

          <button
            onClick={() => setActiveFilterTab('MY_DESK')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
              activeFilterTab === 'MY_DESK'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            My Desk (4)
          </button>
        </div>

        {/* Middle: Monospace Search Input [🔍 Search dockets, IDs, survey no, or SHA-256 hash... (Ctrl+K)] */}
        <div className="flex-1 max-w-xl relative">
          <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dockets, IDs, survey no, or SHA-256 hash... (Ctrl+K)"
            className="w-full bg-[#080C14] border border-slate-700/80 rounded-lg pl-8 pr-16 py-1 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
          />
          <div className="absolute inset-y-0 right-2 flex items-center gap-1 pointer-events-none">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="pointer-events-auto text-slate-400 hover:text-white text-[10px] px-1"
              >
                ✕
              </button>
            ) : (
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-400">
                Ctrl+K
              </kbd>
            )}
          </div>
        </div>

        {/* Right: Sort dropdown and Batch actions */}
        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#080C14] border border-slate-700 text-slate-300 rounded-md py-1 pl-2 pr-6 text-xs appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="RISK_DESC">Sort: Risk Descending ↓</option>
              <option value="RISK_ASC">Sort: Risk Ascending ↑</option>
              <option value="NEWEST">Sort: Ingested Newest</option>
              <option value="NAME">Sort: Institution Name</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
          </div>

          {/* Live ELA Lab Button */}
          <button
            onClick={() => setIsELAModalOpen(true)}
            className="px-2.5 py-1 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-800/80 text-cyan-300 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            title="Upload any PDF or image to perform live Error Level Analysis (ELA)"
          >
            <Flame className="w-3.5 h-3.5 text-cyan-400" />
            <span>Live ELA Lab</span>
          </button>

          {/* Batch Actions Button */}
          <button
            onClick={() => showActionToast('Batch verification manifest exported to officer audit queue.')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1 transition-colors"
          >
            <span>Batch Action ▾</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECTION 4: MASTER-DETAIL WORKSTATION LAYOUT (2-Pane Horizontal Split)
          ========================================================================= */}
      <div className="flex-1 flex overflow-hidden w-full h-[calc(100vh-86px)] relative">
        {/* -----------------------------------------------------------------------
            LEFT PANE: Applications Docket List (~36% screen width, scrollable)
            ----------------------------------------------------------------------- */}
        <aside
          ref={docketListRef}
          className="w-[36%] min-w-[340px] max-w-[460px] border-r border-slate-800 bg-[#0B0F17] flex flex-col h-full shrink-0 overflow-hidden"
          aria-label="Applications Queue List"
        >
          {/* Header indicator row */}
          <div className="p-2 border-b border-slate-800/80 bg-[#070A11] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="text-slate-300 font-semibold">
              Showing {filteredDockets.length} Dockets
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">J</kbd> /{' '}
              <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">K</kbd> navigate •{' '}
              <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Space</kbd> inspect
            </span>
          </div>

          {/* Scrollable list of compact triage cards */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredDockets.map((docket) => {
              const isSelected = activeDocket?.app_id === docket.app_id;

              // Border accent class
              const borderAccentClass =
                docket.border_accent === 'rose'
                  ? 'border-l-rose-500'
                  : docket.border_accent === 'amber'
                  ? 'border-l-amber-500'
                  : 'border-l-emerald-500';

              return (
                <div
                  key={docket.app_id}
                  onClick={() => setSelectedDocketId(docket.app_id)}
                  className={`p-2.5 rounded-lg border-l-4 transition-all cursor-pointer relative ${borderAccentClass} ${
                    isSelected
                      ? 'bg-[#131B2E] border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/40'
                      : 'bg-[#0F172A]/70 border-t border-r border-b border-slate-800/80 hover:bg-[#131B2E]/60 hover:border-slate-700'
                  }`}
                >
                  {/* Active Blue Glow Pill Indicator */}
                  {isSelected && (
                    <div className="absolute right-2 top-2.5 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse" />
                  )}

                  {/* Top Row: Monospace App ID, severity tag, and ingestion timestamp */}
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-white tracking-tight">
                      {docket.app_id}
                    </span>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          docket.severity === 'CRITICAL'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : docket.severity === 'HIGH' || docket.severity === 'MEDIUM'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {docket.risk_label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans">
                        {docket.timestamp}
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: College Name */}
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-slate-200 line-clamp-1 leading-snug">
                      {docket.college_name}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                      {docket.city_state} • {docket.category}
                    </p>
                  </div>

                  {/* Bottom Row: Specific tags */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {docket.tags.map((tag, tIdx) => {
                      const isAlertTag = tag.includes('Tampered') || tag.includes('Mismatch') || tag.includes('Expired');
                      return (
                        <span
                          key={tIdx}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium ${
                            isAlertTag
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-900/60'
                              : 'bg-slate-800/90 text-slate-300 border border-slate-700/60'
                          }`}
                        >
                          [{tag}]
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filteredDockets.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <p className="font-semibold text-slate-300">No applications match current filters</p>
                <button
                  onClick={() => {
                    setActiveFilterTab('ALL');
                    setSearchQuery('');
                  }}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-mono"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* -----------------------------------------------------------------------
            RIGHT PANE: Instant Pre-Flight Inspector (~64% screen width, sticky/fixed)
            ----------------------------------------------------------------------- */}
        <main
          className="flex-1 min-w-0 flex flex-col h-full bg-[#080C14] overflow-hidden relative"
          aria-label="Instant Pre-Flight Inspector"
        >
          {activeDocket ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Scrollable Forensic Content Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {/* 1. Dossier Header */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-800/80 pb-2">
                    <div>
                      <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                        <span>Instant Pre-Flight Inspector —</span>
                        <span className="font-mono text-blue-400">{activeDocket.app_id}</span>
                      </h2>
                      <p className="text-xs text-slate-300 mt-0.5 font-medium">
                        {activeDocket.college_name} ({activeDocket.city_state})
                      </p>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                        {activeDocket.category}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800">
                        AY {activeDocket.academic_year}
                      </span>
                    </div>
                  </div>

                  {/* Red / Alert Warning Container */}
                  <div
                    className={`p-3 rounded-lg border flex items-start gap-3 shadow-md ${
                      activeDocket.forensics.alert_severity === 'critical'
                        ? 'bg-[#240c12] border-rose-800/90 text-rose-200'
                        : activeDocket.forensics.alert_severity === 'warning'
                        ? 'bg-[#24170a] border-amber-800/90 text-amber-200'
                        : 'bg-[#0a2318] border-emerald-800/90 text-emerald-200'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {activeDocket.forensics.alert_severity === 'critical' ? (
                        <ShieldAlert className="w-5 h-5 text-rose-400" />
                      ) : activeDocket.forensics.alert_severity === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs font-sans">
                      <div className="font-mono font-bold text-sm tracking-tight">
                        {activeDocket.forensics.alert_title}
                      </div>
                      <p className="text-slate-300 leading-relaxed text-xs">
                        {activeDocket.forensics.alert_description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Evidence Quick-Peek Preview (Side-by-Side Dual Canvas) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>Evidence Quick-Peek Preview (Side-by-Side Dual Canvas)</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      OCR Bounding Coordinates vs ELA Compression Quantization
                    </span>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {/* Left Sub-card: Document Scan */}
                    <div className="bg-[#0B0F19] rounded-xl border border-slate-800 overflow-hidden shadow-lg flex flex-col">
                      <div className="p-2 border-b border-slate-800 bg-[#0E1422] flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5 font-mono text-[11px]">
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Document Scan — Deed Page 1</span>
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/80">
                          OCR BOX ACTIVE
                        </span>
                      </div>

                      {/* Parchment Scan Texture & Deed Body */}
                      <div className="p-3.5 bg-[#f6f1e3] text-[#1b202c] font-serif rounded-b relative overflow-hidden min-h-[260px] flex flex-col justify-between">
                        {/* Header & Emblem */}
                        <div className="border-b border-[#524430] pb-1.5 text-center">
                          <div className="text-[11px] font-bold tracking-widest text-[#2f2416] uppercase font-sans">
                            ભારતીય સ્ટેમ્પ / REVENUE DEED • REGISTERED CONVEYANCE
                          </div>
                          <div className="text-[9px] text-[#554634] font-sans uppercase font-semibold">
                            DEPARTMENT OF REGISTRATION & LAND RECORDS • GOVT. OF GUJARAT
                          </div>
                        </div>

                        {/* Deed Numbers */}
                        <div className="flex justify-between items-center text-[9px] font-mono text-[#443829] py-1 border-b border-[#c8bea9]">
                          <span>Receipt: ({activeDocket.forensics.document_receipt})</span>
                          <span>Reg. Date: {activeDocket.forensics.document_date}</span>
                        </div>

                        {/* Deed Text with Red OCR Bounding Box */}
                        <div className="py-2 space-y-1.5 text-[10px] leading-relaxed text-[#231a0e]">
                          <p className="font-sans font-bold text-[10px] text-[#1d160c]">
                            Land Parcel Title Conveyance & Freehold Certification:
                          </p>

                          {/* Spliced survey text inside Red BBox */}
                          <div className="relative p-1.5 bg-[#ede4ce] rounded border-2 border-red-600 shadow-sm">
                            <span className="absolute -top-3 left-1 bg-red-600 text-white font-mono text-[8px] font-bold px-1 rounded shadow">
                              OCR BBox: {activeDocket.forensics.ocr_bbox_coords}
                            </span>
                            <p className="font-mono font-bold text-[11px] text-[#111]">
                              {activeDocket.forensics.ocr_bbox_text} — Total Area: {activeDocket.forensics.acreage_declared}
                            </p>
                          </div>

                          <p className="text-[9px] text-[#4a3d2c]">
                            Revenue records Taluka Sub-Registrar verified boundaries for educational institution campus.
                          </p>
                        </div>

                        {/* Rubber Stamp & Magistrate Signature */}
                        <div className="flex justify-between items-end border-t border-[#c8bea9] pt-1.5">
                          <div className="w-14 h-14 rounded-full border-2 border-[#372a72] text-[#372a72] flex flex-col items-center justify-center p-0.5 text-center rotate-[-4deg] opacity-90">
                            <span className="text-[6px] font-extrabold font-sans">SUB-REGISTRAR</span>
                            <span className="text-[5px] font-mono">SEAL 2018</span>
                          </div>

                          <div className="text-right">
                            <div className="font-serif italic text-blue-900 text-[11px] font-bold">
                              Ambrish Patel
                            </div>
                            <div className="text-[8px] font-sans font-bold text-[#3a2d1d]">
                              Executive Magistrate
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Sub-card: ELA Analysis (Error Level Analysis) */}
                    <div className="bg-[#0B0F19] rounded-xl border border-slate-800 overflow-hidden shadow-lg flex flex-col">
                      <div className="p-2 border-b border-slate-800 bg-[#0E1422] flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5 font-mono text-[11px]">
                          <Flame className="w-3.5 h-3.5 text-cyan-400" />
                          <span>ELA Analysis (Error Level Analysis)</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setIsELAModalOpen(true)}
                            className="text-[10px] font-mono text-cyan-300 hover:text-white bg-cyan-950/80 hover:bg-cyan-900 px-2 py-0.5 rounded border border-cyan-800/80 transition-colors"
                            title="Upload and test your own document in the Live ELA Lab"
                          >
                            <span>Upload & Test Custom Doc ↗</span>
                          </button>
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/80">
                            Q-TABLE 90
                          </span>
                        </div>
                      </div>

                      {/* Deep Navy/Purple Canvas with Glowing Heatmap Spikes */}
                      <div className="p-3.5 bg-[#040817] text-white font-mono rounded-b relative overflow-hidden min-h-[260px] flex flex-col justify-between">
                        {/* Coordinate Grid Background */}
                        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:14px_14px]" />

                        {/* Top Metadata */}
                        <div className="flex justify-between items-center text-[10px] text-blue-300 border-b border-blue-900/40 pb-1 z-10">
                          <span>UNIFORM QUANTIZATION BASELINE</span>
                          <span className="text-yellow-300 font-bold">SPIKE: {activeDocket.forensics.ela_coords}</span>
                        </div>

                        {/* Glowing Yellow/Red Compression Spikes over Coordinates */}
                        <div className="my-2 p-2.5 rounded bg-blue-950/40 border border-blue-800/40 relative z-10">
                          <div className="relative py-2 px-3 rounded bg-gradient-to-r from-red-600/40 via-yellow-400/90 to-amber-500/90 border border-yellow-300 shadow-[0_0_25px_rgba(234,179,8,0.8)] animate-pulse">
                            <div className="text-[11px] font-mono font-extrabold text-black tracking-wider flex items-center justify-between">
                              <span>HIGH COMPRESSION DISCONTINUITY</span>
                              <span className="bg-black text-yellow-300 text-[9px] px-1 py-0.5 rounded font-bold">
                                {activeDocket.forensics.ela_spike_label}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono text-black font-bold mt-1">
                              Spliced Region: {activeDocket.forensics.ela_coords}
                            </p>
                          </div>

                          <div className="mt-2 text-[10px] text-yellow-200/90 leading-tight">
                            * {activeDocket.forensics.ela_detail}
                          </div>
                        </div>

                        {/* Bottom Calibration */}
                        <div className="flex justify-between items-center text-[9px] text-blue-400/70 border-t border-blue-900/40 pt-1 z-10">
                          <span>Paper sensor floor: OK (ΔE &lt; 4%)</span>
                          <span className="text-cyan-300 font-bold">Tampering Probability: 98.4%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Live Authority Gateway Telemetry */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                    <span>Live Authority Gateway Telemetry</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Panel 1: Land Records Authority Adapter (Simulated Sandbox) */}
                    <div className="bg-[#0B0F19] rounded-xl border border-slate-800 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-200">
                          {activeDocket.forensics.gateway_name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            activeDocket.forensics.gateway_status_type === 'error'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : activeDocket.forensics.gateway_status_type === 'warning'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          [{activeDocket.forensics.gateway_status}]
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-slate-400">
                        {activeDocket.forensics.gateway_latency}
                      </div>

                      <div className="p-2 rounded bg-[#070A11] border border-slate-800 text-[11px] space-y-1 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Declared Survey:</span>
                          <span className="text-rose-400 font-bold">{activeDocket.forensics.survey_declared}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Revenue Portal Live:</span>
                          <span className="text-amber-400 font-bold">{activeDocket.forensics.survey_revenue}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-800 pt-1">
                          <span className="text-slate-400">Acreage Variance:</span>
                          <span className="text-rose-400 font-bold">{activeDocket.forensics.acreage_revenue}</span>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-snug">
                        {activeDocket.forensics.gateway_detail}
                      </p>
                    </div>

                    {/* Panel 2: Immutable SHA-256 Hash */}
                    <div className="bg-[#0B0F19] rounded-xl border border-slate-800 p-3 space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-200">
                            Immutable SHA-256 Hash
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950/60 text-blue-300 border border-blue-800">
                            SEALED IN LEDGER
                          </span>
                        </div>

                        <div className="mt-2 p-2 rounded bg-[#070A11] border border-slate-800 font-mono text-xs flex items-center justify-between text-slate-300">
                          <span className="truncate pr-2 font-bold text-blue-300">
                            {activeDocket.forensics.sha256_hash}
                          </span>
                          <button
                            onClick={() => handleCopyHash(activeDocket.forensics.sha256_hash)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
                            title="Copy to clipboard"
                          >
                            {copiedHash ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1 font-mono text-[10px] text-slate-400 pt-2 border-t border-slate-800">
                        <div className="flex justify-between">
                          <span>Chain Ledger:</span>
                          <span className="text-slate-300">{activeDocket.forensics.block_height}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tamper Verification:</span>
                          <span className="text-emerald-400 font-bold">100% Mathematically Proven</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* -----------------------------------------------------------------------
                  4. ACTION DOCK (Bottom Bar, Height: ~56px)
                  ----------------------------------------------------------------------- */}
              <div className="h-[56px] min-h-[56px] bg-[#0B0F17] border-t border-slate-800 px-4 py-2 flex items-center justify-between gap-3 shrink-0 z-20">
                {/* Secondary buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => showActionToast(`Docket ${activeDocket.app_id} marked as Declined for regulatory non-compliance.`)}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/80 text-rose-300 text-xs font-semibold font-mono transition-colors"
                  >
                    Decline Docket
                  </button>

                  <button
                    onClick={() => showActionToast(`Docket ${activeDocket.app_id} successfully re-routed to State Revenue Desk (Gujarat).`)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold font-mono transition-colors"
                  >
                    Re-route to State Desk
                  </button>

                  <button
                    onClick={() => showActionToast(`Summary manifest sent to local officer print queue.`)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold font-mono transition-colors flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Summary</span>
                  </button>
                </div>

                {/* Primary Call-to-Action: High-contrast blue button */}
                <button
                  onClick={() => onOpenWorkbench(activeDocket.app_id)}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs font-mono shadow-lg shadow-blue-600/30 ring-1 ring-blue-400/60 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Open Full Scrutiny Workbench (Space)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
              Select an application from the docket queue to load live forensic telemetry.
            </div>
          )}

          {/* Toast / Notification pill */}
          {actionFeedback && (
            <div className="absolute top-4 right-4 bg-slate-900/95 border border-blue-500/70 text-slate-100 px-4 py-2 rounded-xl text-xs font-mono shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-2 z-50">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionFeedback}</span>
            </div>
          )}
        </main>
      </div>

      {/* Live ELA Document Upload & Forensic Lab Modal */}
      <LiveELAForensicModal
        isOpen={isELAModalOpen}
        onClose={() => setIsELAModalOpen(false)}
      />
    </div>
  );
};
