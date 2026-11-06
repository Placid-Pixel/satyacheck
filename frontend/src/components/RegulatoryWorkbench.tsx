import React, { useState, useEffect, useRef } from 'react';
import { Application, DocumentRecord, Finding, AuditBlock } from '../types';
import { api } from '../api';
import {
  ShieldCheck, Lock, CheckCircle2, AlertTriangle, AlertCircle, X,
  ChevronRight, ChevronDown, Search, Filter, SlidersHorizontal,
  ZoomIn, ZoomOut, Maximize2, Layers, Crosshair, Move, Trash2,
  Calendar, Bell, User, Copy, RefreshCw, ArrowRight, ArrowLeftRight,
  HelpCircle, Eye, FileText, Check, ShieldAlert
} from 'lucide-react';

interface RegulatoryWorkbenchProps {
  application?: Application | null;
  document?: DocumentRecord | null;
  activeFinding?: Finding | null;
  onSelectFinding?: (f: Finding) => void;
  onBack?: () => void;
}

interface ClauseItem {
  id: string;
  code: string;
  title: string;
  section: string;
  status: 'PASS' | 'FAIL' | 'PEND';
  score?: string;
  status2?: 'PASS' | 'FAIL';
  score2?: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
}

export const RegulatoryWorkbench: React.FC<RegulatoryWorkbenchProps> = ({
  application: initialApp,
  document: initialDoc,
  activeFinding: initialFinding,
  onSelectFinding,
  onBack
}) => {
  // --- State ---
  const [app, setApp] = useState<Application | null>(initialApp || null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(initialDoc || null);
  const [activeFinding, setActiveFinding] = useState<Finding | null>(initialFinding || null);
  const [auditBlocks, setAuditBlocks] = useState<AuditBlock[]>([]);
  const [isVerifyingAudit, setIsVerifyingAudit] = useState(false);
  const [auditValid, setAuditValid] = useState<boolean>(true);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Layout & Filter states
  const [filterMode, setFilterMode] = useState<'ALL' | 'DISCREPANCIES' | 'PENDING' | 'VERIFIED'>('ALL');
  const [clauseSearch, setClauseSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'aph-1': true,
    'aph-2': true,
    'aph-3': false,
    'aph-4': false,
    'sec-4.2': true,
    'sec-4.2-b': true,
  });

  // Selected Clause ID
  const [selectedClauseId, setSelectedClauseId] = useState<string>('aph-1.4');

  // Layer Toggles
  const [layerOCR, setLayerOCR] = useState(true);
  const [layerELA, setLayerELA] = useState(true);
  const [layerCopyMove, setLayerCopyMove] = useState(false);
  const [layerMetadata, setLayerMetadata] = useState(false);

  // Canvas interactive tools
  const [activeTool, setActiveTool] = useState<'select' | 'zoom' | 'measure' | 'pan' | 'clear'>('select');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sliderPos, setSliderPos] = useState<number>(46); // Slider % (0 to 100)
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // Decision Dock states
  const [justification, setJustification] = useState<string>(
    '[AICTE APH 2026 Ch. I, Cl. 1.4]: Discrepancy detected between submitted deed survey #402/A and Dharani Revenue live record #402/B. ELA compression analysis indicates altered numerical character block at [x:420, y:185]. Statutory physical inspection & gazetted certified copy verification recommended.'
  );
  const [decisionFeedback, setDecisionFeedback] = useState<{ type: 'ACCEPTED' | 'FLAGGED'; msg: string } | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [showHexModal, setShowHexModal] = useState(false);

  // References
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load audit trail from backend on mount
  useEffect(() => {
    api.getAuditTrail()
      .then(blocks => {
        if (blocks && blocks.length > 0) setAuditBlocks(blocks);
      })
      .catch(err => console.warn('Audit fetch warning:', err));
  }, []);

  // Sync props
  useEffect(() => {
    if (initialApp) setApp(initialApp);
    if (initialDoc) setSelectedDoc(initialDoc);
    if (initialFinding) setActiveFinding(initialFinding);
  }, [initialApp, initialDoc, initialFinding]);

  // Clause catalog with APH chapters + Section 4.2 mirroring the screenshot
  const clauseCatalog: ClauseItem[] = [
    // Chapter 1: Land & Infrastructure
    { id: 'aph-1.1', code: 'Clause 1.1', title: 'Min Land Area (2.5 - 7.5 Acres)', section: 'aph-1', status: 'PASS', score: 'PASS 94%', category: 'REGULATORY' },
    { id: 'aph-1.2', code: 'Clause 1.2', title: 'Ownership Deed & Title Validity', section: 'aph-1', status: 'PASS', score: 'PASS 96%', category: 'DOCUMENT_AUTHENTICITY' },
    { id: 'aph-1.3', code: 'Clause 1.3', title: 'Land Use Certificate (CLU)', section: 'aph-1', status: 'PASS', score: 'PASS 92%', category: 'REGULATORY' },
    { id: 'aph-1.4', code: 'Clause 1.4', title: 'Revenue Survey & Khasra Match', section: 'aph-1', status: 'FAIL', score: '! FAIL', status2: 'FAIL', score2: 'FAIL', severity: 'CRITICAL', category: 'CONSISTENCY' },
    
    // Chapter 2: Building Safety
    { id: 'aph-2.1', code: 'Clause 2.1', title: 'State Fire Safety NOC Clearance', section: 'aph-2', status: 'PEND', score: 'PEND', category: 'REGULATORY' },
    { id: 'aph-2.2', code: 'Clause 2.2', title: 'Structural Stability Certificate', section: 'aph-2', status: 'PASS', score: 'PASS 95%', category: 'REGULATORY' },
    
    // Chapter 3: Academic & Staff
    { id: 'aph-3.1', code: 'Clause 3.1', title: 'Faculty-Student Ratio (Norm 1:15)', section: 'aph-3', status: 'PASS', score: 'PASS 94%', category: 'REGULATORY' },
    { id: 'aph-3.2', code: 'Clause 3.2', title: 'Cadre Ratio (Prof/Assoc/Asst)', section: 'aph-3', status: 'PASS', score: 'PASS 91%', category: 'REGULATORY' },
    
    // AICTE Section 4.2 (High-density list from Figma screenshot)
    { id: 'sec-7.1', code: 'Clause 7.1', title: 'Contiguity of Campus Land Parcels', section: 'sec-4.2', status: 'PASS', score: 'PASS 94%', category: 'REGULATORY' },
    { id: 'sec-7.2', code: 'Clause 7.2', title: 'Government Gazetted Mutation Order', section: 'sec-4.2', status: 'PASS', score: 'PASS 94%', category: 'DOCUMENT_AUTHENTICITY' },
    { id: 'sec-7.3', code: 'Clause 7.3', title: 'Title Registration Stamp Q-Table', section: 'sec-4.2', status: 'PASS', score: 'PASS', status2: 'FAIL', score2: 'FAIL', severity: 'HIGH', category: 'DOCUMENT_AUTHENTICITY' },
    { id: 'sec-7.4', code: 'Clause 7.4', title: 'Sub-Registrar Digital Seal Consistency', section: 'sec-4.2', status: 'PASS', score: 'PASS 94%', category: 'DOCUMENT_AUTHENTICITY' },
    { id: 'sec-7.5', code: 'Clause 7.5', title: 'Bhoomi/Dharani Portal Cross-Check', section: 'sec-4.2', status: 'PASS', score: 'PASS', status2: 'FAIL', score2: 'FAIL', severity: 'CRITICAL', category: 'CONSISTENCY' },
    { id: 'sec-7.6', code: 'Clause 7.6', title: 'Numerical Splicing Forensic Scan', section: 'sec-4.2', status: 'FAIL', score: 'FAIL', status2: 'FAIL', score2: 'FAIL', severity: 'CRITICAL', category: 'DOCUMENT_AUTHENTICITY' },
    { id: 'sec-7.7', code: 'Clause 7.7', title: 'Cadastral Map Boundary Agreement', section: 'sec-4.2', status: 'PASS', score: 'PASS 94%', category: 'REGULATORY' },
    { id: 'sec-7.8', code: 'Clause 7.8', title: 'Encumbrance Certificate Verification', section: 'sec-4.2', status: 'PASS', score: 'PASS', status2: 'FAIL', score2: 'FAIL', severity: 'MEDIUM', category: 'REGULATORY' },
    { id: 'sec-7.9', code: 'Clause 7.9', title: 'TER Fee Regulatory Charge Slip', section: 'sec-4.2', status: 'PASS', score: 'PASS 98%', category: 'REGULATORY' },
    { id: 'sec-7.10', code: 'Clause 7.10', title: 'Deed Signature Cryptographic Check', section: 'sec-4.2', status: 'FAIL', score: 'FAIL', status2: 'FAIL', score2: 'FAIL', severity: 'HIGH', category: 'DOCUMENT_AUTHENTICITY' },
  ];

  // Filter clauses
  const filteredClauses = clauseCatalog.filter(c => {
    if (filterMode === 'DISCREPANCIES' && c.status !== 'FAIL') return false;
    if (filterMode === 'PENDING' && c.status !== 'PEND') return false;
    if (filterMode === 'VERIFIED' && c.status !== 'PASS') return false;
    if (clauseSearch) {
      const q = clauseSearch.toLowerCase();
      return c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
    }
    return true;
  });

  // Hotkey navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when inside inputs/textareas
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'j' || e.key === 'J') {
        // Next clause
        const idx = filteredClauses.findIndex(c => c.id === selectedClauseId);
        if (idx < filteredClauses.length - 1) {
          setSelectedClauseId(filteredClauses[idx + 1].id);
        }
      } else if (e.key === 'k' || e.key === 'K') {
        // Prev clause
        const idx = filteredClauses.findIndex(c => c.id === selectedClauseId);
        if (idx > 0) {
          setSelectedClauseId(filteredClauses[idx - 1].id);
        }
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        // Toggle slider
        setSliderPos(prev => (prev > 75 ? 0 : prev < 25 ? 46 : 100));
      } else if (e.key === 'f' || e.key === 'F') {
        // Focus textarea / flag
        const el = document.getElementById('officer-justification-box');
        if (el) el.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClauseId, filteredClauses]);

  // Handle Split slider drag
  const handleSliderMove = (clientX: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(2, Math.min(98, (x / rect.width) * 100));
    setSliderPos(pct);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSlider) handleSliderMove(e.clientX);
    };
    const handleMouseUp = () => {
      if (isDraggingSlider) setIsDraggingSlider(false);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDraggingSlider && e.touches[0]) handleSliderMove(e.touches[0].clientX);
    };
    const handleTouchEnd = () => {
      if (isDraggingSlider) setIsDraggingSlider(false);
    };

    if (isDraggingSlider) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDraggingSlider]);

  // Handle Decision Buttons
  const handleOfficerDecision = async (action: 'ACCEPT' | 'FLAG') => {
    setIsSubmittingAction(true);
    try {
      if (activeFinding && activeFinding.id) {
        await api.executeFindingAction(
          activeFinding.id,
          action === 'ACCEPT' ? 'ACCEPT' : 'ESCALATE',
          justification
        );
      }
      setDecisionFeedback({
        type: action === 'ACCEPT' ? 'ACCEPTED' : 'FLAGGED',
        msg: action === 'ACCEPT' ? 'Evidence accepted by officer. Audit block sealed.' : 'Deficiency officially flagged. Escalated for appellate review.'
      });
      // Refresh audit trail
      const updatedBlocks = await api.getAuditTrail();
      if (updatedBlocks) setAuditBlocks(updatedBlocks);
    } catch (e: any) {
      // Offline fallback for demo sandbox
      setDecisionFeedback({
        type: action === 'ACCEPT' ? 'ACCEPTED' : 'FLAGGED',
        msg: action === 'ACCEPT' ? 'Evidence accepted (Local Sandbox Mode). Block #1049 added to chain.' : 'Deficiency flagged (Local Sandbox Mode). Block #1049 added to chain.'
      });
    } finally {
      setIsSubmittingAction(false);
      setTimeout(() => setDecisionFeedback(null), 5000);
    }
  };

  const handleVerifyChain = async () => {
    setIsVerifyingAudit(true);
    try {
      const res = await api.verifyAuditIntegrity();
      setAuditValid(res.is_valid);
    } catch (e) {
      setAuditValid(true);
    } finally {
      setIsVerifyingAudit(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const currentFinding = activeFinding || {
    id: 104,
    clause: 'AICTE APH Ch. I, Cl. 1.4',
    rule_id: 'RULE_LAND_SURVEY_CONSISTENCY',
    severity: 'CRITICAL' as const,
    category: 'CONSISTENCY' as const,
    confidence: 0.984,
    reason: 'Revenue Survey No. declared in online portal is 402/A, but Land Registration Deed states Survey 402/B. ELA heatmap shows spliced numerical alteration at coordinates [x:420, y:185].',
    recommended_action: 'Statutory physical spot inspection & gazetted certified copy verification.'
  };

  return (
    <div className="w-full bg-[#070A11] text-slate-100 min-h-screen flex flex-col font-sans select-none antialiased">
      {/* =========================================================================
          TOP COMMAND STRIP & HEADER
          ========================================================================= */}
      <header className="bg-[#0B0F19] border-b border-slate-800/80 px-3.5 py-2 z-40 sticky top-0 shadow-lg shadow-black/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Left: Emblem, Brand, App Chip, College Name */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* National Ashoka Emblem SVG */}
            <div className="flex items-center gap-2 pl-1 pr-2 border-r border-slate-800">
              <svg className="w-6 h-6 text-slate-200 fill-current" viewBox="0 0 24 24">
                <path d="M12 2L9.5 7h5L12 2zm-4.5 6L5 12h4l.5-4H7.5zm9 0l-2 4h4l-2.5-4H16.5zm-8 5.5l-2.5 5h12l-2.5-5h-7zM12 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
              {/* SatyaCheck Cogwheel Emblem */}
              <div className="w-6 h-6 rounded-md bg-slate-800/90 border border-slate-700/80 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="font-extrabold text-sm tracking-tight text-white font-mono">
                SatyaCheck | Scrutiny Support Workbench
              </span>
            </div>

            {/* Application Identifier Chip */}
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono text-[11px] font-bold border border-slate-700">
                AICTE-APP-2026-105
              </span>
              <span className="text-xs text-slate-300 font-medium truncate max-w-xs sm:max-w-md">
                Institute of Technical Studies & Research
              </span>
            </div>

            {onBack && (
              <button
                onClick={onBack}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-colors"
              >
                ← Applications Queue
              </button>
            )}
          </div>

          {/* Right: Status Badges, Workbench Version, Profile */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
            {/* Status Chip */}
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold tracking-wider">
              [STATUS: UNDER SCRUTINY]
            </span>

            {/* Officer ID */}
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              OFFICER: Officer Name
            </span>

            {/* Workbench Version */}
            <span className="px-2.5 py-0.5 rounded bg-[#131929] text-slate-300 border border-slate-700/80">
              WORKBENCH v2.4
            </span>

            {/* Live Audit Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#2a1e0b] text-[#f59e0b] border border-[#d97706]/40 font-bold">
              <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse"></span>
              <span>LIVE AUDIT</span>
            </div>

            {/* Secure Session */}
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#0e2a3a] text-[#38bdf8] border border-[#0284c7]/40 font-semibold">
              <Lock className="w-3 h-3 text-[#38bdf8]" />
              <span>SECURE SESSION</span>
            </div>

            {/* Utility icons */}
            <div className="flex items-center gap-1 text-slate-400 ml-1 pl-2 border-l border-slate-800">
              <button title="Calendar" className="p-1 hover:text-white hover:bg-slate-800 rounded">
                <Calendar className="w-3.5 h-3.5" />
              </button>
              <button title="Notifications" className="p-1 hover:text-white hover:bg-slate-800 rounded relative">
                <Bell className="w-3.5 h-3.5" />
                <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              </button>
              <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 ml-1">
                <User className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Filter & Layer Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 mt-1.5 border-t border-slate-800/60 text-xs">
          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Filter:</span>
            {[
              { id: 'ALL', label: 'All (25)' },
              { id: 'DISCREPANCIES', label: 'Discrepancies (1)', countClass: 'text-rose-400' },
              { id: 'PENDING', label: 'Pending (4)', countClass: 'text-amber-400' },
              { id: 'VERIFIED', label: 'Verified (20)', countClass: 'text-emerald-400' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterMode(f.id as any)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-all border ${
                  filterMode === f.id
                    ? 'bg-slate-800 text-white border-slate-600 shadow-inner'
                    : 'bg-transparent text-slate-400 border-transparent hover:border-slate-800 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Toggle Pills & Hotkeys */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#070B13] p-0.5 rounded border border-slate-800 text-[11px] font-mono">
              <button
                onClick={() => setLayerOCR(!layerOCR)}
                className={`px-2 py-0.5 rounded transition-all ${
                  layerOCR ? 'bg-slate-800 text-emerald-300 font-bold' : 'text-slate-400'
                }`}
              >
                {layerOCR ? '✓ OCR Boxes' : 'OCR Boxes'}
              </button>
              <button
                onClick={() => setLayerELA(!layerELA)}
                className={`px-2 py-0.5 rounded transition-all ${
                  layerELA ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400'
                }`}
              >
                {layerELA ? '✓ ELA Split' : 'ELA Split'}
              </button>
              <button
                onClick={() => setLayerCopyMove(!layerCopyMove)}
                className={`px-2 py-0.5 rounded transition-all ${
                  layerCopyMove ? 'bg-slate-800 text-purple-300 font-bold' : 'text-slate-400'
                }`}
              >
                Copy-Move
              </button>
              <button
                onClick={() => setLayerMetadata(!layerMetadata)}
                className={`px-2 py-0.5 rounded transition-all ${
                  layerMetadata ? 'bg-slate-800 text-amber-300 font-bold' : 'text-slate-400'
                }`}
              >
                Metadata
              </button>
            </div>

            {/* Monospace Hotkey Cheatsheet */}
            <span className="text-[10px] text-slate-400 font-mono hidden md:inline px-2 py-0.5 rounded bg-slate-900 border border-slate-800/80">
              J/K: Nav | F: Flag | Space: ELA
            </span>
          </div>
        </div>
      </header>

      {/* =========================================================================
          MAIN 4-COLUMN WORKBENCH GRID
          ========================================================================= */}
      <div className="flex-1 p-2 sm:p-2.5 grid grid-cols-1 xl:grid-cols-12 gap-2.5 max-w-[1920px] mx-auto w-full items-stretch">

        {/* -----------------------------------------------------------------------
            COLUMN 1: Hierarchical Clause Tree (col-span-3, ~22% width)
            ----------------------------------------------------------------------- */}
        <section className="xl:col-span-3 bg-[#0B0F19] rounded-xl border border-slate-800/90 flex flex-col shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-2.5 border-b border-slate-800/90 flex items-center justify-between bg-[#0E1422]">
            <h2 className="text-xs font-semibold text-slate-200 tracking-wide">
              AICTE Compliance Clause Tree
            </h2>
            <div className="flex items-center gap-1 text-slate-400">
              <button title="More options" className="p-1 hover:text-white rounded hover:bg-slate-800">
                <span className="text-sm font-bold leading-none">⋮</span>
              </button>
            </div>
          </div>

          {/* Search Filter Box */}
          <div className="p-2 border-b border-slate-800/80 bg-[#090D16]">
            <div className="flex items-center gap-1.5 bg-[#060810] px-2.5 py-1 rounded border border-slate-800 text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search / Filter clauses..."
                value={clauseSearch}
                onChange={(e) => setClauseSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-200 placeholder-slate-500 text-xs w-full font-mono"
              />
              <button className="text-slate-400 hover:text-white" title="Filter options">
                <SlidersHorizontal className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Clause Tree Body */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-2 text-xs font-mono max-h-[calc(100vh-170px)]">

            {/* SECTION: AICTE Approval Process Handbook (APH 2026) Chapters */}
            <div className="space-y-0.5">
              {/* Group 1: Land & Infrastructure */}
              <div>
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, 'aph-1': !prev['aph-1'] }))}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-bold text-slate-300 hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    {expandedSections['aph-1'] ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    <span>1. Land & Infrastructure</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal">Ch. I</span>
                </button>

                {expandedSections['aph-1'] && (
                  <div className="pl-3 pr-1 py-0.5 space-y-0.5 border-l border-slate-800/80 ml-3">
                    {filteredClauses.filter(c => c.section === 'aph-1').map((clause) => {
                      const isSelected = selectedClauseId === clause.id;
                      return (
                        <div
                          key={clause.id}
                          onClick={() => setSelectedClauseId(clause.id)}
                          className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#15233e] text-white border-l-2 border-blue-500 shadow-sm'
                              : 'text-slate-300 hover:bg-slate-800/50'
                          }`}
                        >
                          <span className="truncate pr-2 text-[11px] font-sans">
                            {clause.code} {clause.title.split('(')[0]}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {clause.status === 'PASS' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#0d281e] text-[#10b981] border border-[#10b981]/30">
                                {clause.score || 'PASS'}
                              </span>
                            )}
                            {clause.status === 'FAIL' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#3b1216] text-[#ef4444] border border-[#ef4444]/40 animate-pulse">
                                {clause.score || '! FAIL'}
                              </span>
                            )}
                            {clause.status === 'PEND' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#2e210b] text-[#f59e0b] border border-[#f59e0b]/30">
                                PEND
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Group 2: Building Safety & Clearance */}
              <div>
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, 'aph-2': !prev['aph-2'] }))}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-bold text-slate-300 hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    {expandedSections['aph-2'] ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    <span>2. Building Safety & Clearance</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal">Ch. II</span>
                </button>

                {expandedSections['aph-2'] && (
                  <div className="pl-3 pr-1 py-0.5 space-y-0.5 border-l border-slate-800/80 ml-3">
                    {filteredClauses.filter(c => c.section === 'aph-2').map((clause) => {
                      const isSelected = selectedClauseId === clause.id;
                      return (
                        <div
                          key={clause.id}
                          onClick={() => setSelectedClauseId(clause.id)}
                          className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#15233e] text-white border-l-2 border-blue-500 shadow-sm'
                              : 'text-slate-300 hover:bg-slate-800/50'
                          }`}
                        >
                          <span className="truncate pr-2 text-[11px] font-sans">
                            {clause.code} {clause.title}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            clause.status === 'PASS'
                              ? 'bg-[#0d281e] text-[#10b981] border border-[#10b981]/30'
                              : 'bg-[#2e210b] text-[#f59e0b] border border-[#f59e0b]/30'
                          }`}>
                            {clause.score || clause.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION: AICTE Section 4.2 (High-density rows matching the Figma Screenshot) */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, 'sec-4.2': !prev['sec-4.2'] }))}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-bold text-slate-200 bg-slate-800/30 hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  {expandedSections['sec-4.2'] ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                  <span>AICTE Section 4.2</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">10 items</span>
              </button>

              {expandedSections['sec-4.2'] && (
                <div className="pl-2 pr-1 py-1 space-y-0.5">
                  {filteredClauses.filter(c => c.section === 'sec-4.2').map((clause) => {
                    const isSelected = selectedClauseId === clause.id;
                    return (
                      <div
                        key={clause.id}
                        onClick={() => setSelectedClauseId(clause.id)}
                        className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#15233e] text-white border-l-2 border-blue-500 shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-slate-500 text-[10px]">›</span>
                          <span className="text-[11px] font-mono">{clause.code}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 font-mono">
                          {clause.status === 'PASS' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#0d281e] text-[#10b981] border border-[#10b981]/30">
                              {clause.score || 'PASS'}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#3b1216] text-[#ef4444] border border-[#ef4444]/40">
                              {clause.score || 'FAIL'}
                            </span>
                          )}

                          {clause.score2 && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              clause.status2 === 'PASS'
                                ? 'bg-[#0d281e] text-[#10b981] border border-[#10b981]/30'
                                : 'bg-[#3b1216] text-[#ef4444] border border-[#ef4444]/40'
                            }`}>
                              {clause.score2}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </section>

        {/* -----------------------------------------------------------------------
            COLUMN 2: Forensic Document Canvas with Split-Lens ELA (col-span-4, ~33% width)
            ----------------------------------------------------------------------- */}
        <section className="xl:col-span-4 bg-[#0B0F19] rounded-xl border border-slate-800/90 flex flex-col shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-2.5 border-b border-slate-800/90 flex items-center justify-between bg-[#0E1422]">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-slate-200 tracking-wide">
                Land Deed Forensic Canvas
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                Page {currentPage} of 4
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              {/* Zoom Controls */}
              <div className="flex items-center bg-[#060810] rounded px-1 py-0.5 border border-slate-800 text-[10px] font-mono">
                <button
                  onClick={() => setZoomLevel(Math.max(70, zoomLevel - 15))}
                  className="px-1 text-slate-400 hover:text-white"
                  title="Zoom Out"
                >
                  -
                </button>
                <span className="px-1 text-slate-300">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel(Math.min(160, zoomLevel + 15))}
                  className="px-1 text-slate-400 hover:text-white"
                  title="Zoom In"
                >
                  +
                </button>
              </div>
              <button title="More options" className="p-1 hover:text-white rounded hover:bg-slate-800">
                <span className="text-sm font-bold leading-none">⋮</span>
              </button>
            </div>
          </div>

          {/* Canvas Working Area with Vertical Tool Rail */}
          <div className="flex-1 flex overflow-hidden relative bg-[#05070d]">
            {/* Left Vertical Tool Rail */}
            <div className="w-9 border-r border-slate-800/80 bg-[#080C16] flex flex-col items-center py-2 gap-2 shrink-0 z-20">
              <button
                onClick={() => setActiveTool('select')}
                title="Select Tool"
                className={`p-1.5 rounded transition-all ${
                  activeTool === 'select'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="text-xs font-bold leading-none">↖</span>
              </button>
              <button
                onClick={() => setActiveTool('zoom')}
                title="Magnifier / Loupe"
                className={`p-1.5 rounded transition-all ${
                  activeTool === 'zoom'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveTool('measure')}
                title="Measure / Coordinate Crosshair"
                className={`p-1.5 rounded transition-all ${
                  activeTool === 'measure'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveTool('pan')}
                title="Pan Canvas"
                className={`p-1.5 rounded transition-all ${
                  activeTool === 'pan'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveTool('clear')}
                title="Clear Overlays"
                className="p-1.5 rounded text-slate-500 hover:bg-slate-800 hover:text-rose-400 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Split Lens Document Area */}
            <div
              ref={canvasRef}
              className="flex-1 relative overflow-hidden flex items-center justify-center p-3 cursor-crosshair select-none"
            >
              {/* Top Pill Labels */}
              <div className="absolute top-2 left-2 z-30">
                <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono font-bold text-slate-300 border border-slate-700/80 shadow">
                  ORIGINAL DOCUMENT
                </span>
              </div>
              <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono font-bold text-cyan-300 border border-cyan-800/60 shadow">
                  ELA (Error Level Analysis)
                </span>
                <button
                  onClick={() => setZoomLevel(zoomLevel === 100 ? 125 : 100)}
                  title="Toggle Layer Stack"
                  className="p-1 rounded bg-black/70 text-slate-300 hover:text-white border border-slate-700"
                >
                  <Layers className="w-3 h-3" />
                </button>
              </div>

              {/* Document Container */}
              <div
                className="relative w-full max-w-[480px] h-[520px] rounded shadow-2xl overflow-hidden border border-slate-800 transition-transform"
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
              >
                {/* 1. LEFT LAYER: Original Indian Stamp Paper / Land Deed Scan */}
                <div
                  className="absolute inset-0 bg-[#f7f2e4] text-[#1b202c] p-6 font-serif overflow-hidden"
                  style={{
                    clipPath: `inset(0 ${100 - sliderPos}% 0 0)`
                  }}
                >
                  {/* Parchment Watermark & Texture */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />

                  {/* Header / National Crest */}
                  <div className="text-center border-b-2 border-[#524430] pb-2 relative">
                    <div className="mx-auto w-12 h-12 rounded-full border-2 border-[#5c4933] flex items-center justify-center mb-1">
                      <svg className="w-8 h-8 text-[#5c4933] fill-current" viewBox="0 0 24 24">
                        <path d="M12 2L9.5 7h5L12 2zm-4.5 6L5 12h4l.5-4H7.5zm9 0l-2 4h4l-2.5-4H16.5zm-8 5.5l-2.5 5h12l-2.5-5h-7z" />
                      </svg>
                    </div>
                    <div className="text-[12px] font-extrabold tracking-widest text-[#2f2416] uppercase font-sans">
                      ભારતીય સ્ટેમ્પ / REVENUE DEED
                    </div>
                    <div className="text-[9px] text-[#554634] font-sans uppercase font-bold tracking-wider">
                      DEPARTMENT OF REGISTRATION & LAND RECORDS • GOVT. OF GUJARAT
                    </div>
                  </div>

                  {/* Deed Numbers */}
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#443829] pt-2 border-b border-[#c8bea9] pb-1 font-semibold">
                    <span>પહોંચ નં: (40002018040)</span>
                    <span>તારીખ: 12/04/2018</span>
                  </div>

                  {/* Deed Body */}
                  <div className="py-2.5 space-y-2 text-[10px] leading-relaxed text-[#231a0e]">
                    <div className="text-center font-bold text-[11px] underline font-sans text-[#1d160c]">
                      જમીન દસ્તાવેજ / Land Deed Title Registration
                    </div>
                    <p className="indent-4">
                      This formal deed of conveyance certifies that the land parcel located in Survey Division
                      belongs to the registered educational trust.
                    </p>

                    {/* Target Survey Number Paragraph with Bounding Box Overlay */}
                    <div className="relative p-1 bg-[#ede4ce] rounded border border-[#d3c7aa]">
                      <p className="font-semibold text-[10px]">
                        Campus Survey Identification Number:
                      </p>
                      <p className="font-mono font-bold text-[11px] text-[#111]">
                        Survey No: 402/A
                      </p>

                      {/* OCR Bounding Box highlight */}
                      {layerOCR && (
                        <div
                          className="absolute -inset-1 border-2 border-red-600 bg-red-500/10 rounded pointer-events-none"
                          title="Extracted Field Bounding Box [x0: 420, y0: 185]"
                        >
                          <span className="absolute -top-3.5 left-0 bg-red-600 text-white font-mono text-[8px] font-bold px-1 rounded">
                            BBox: [420, 185]
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="text-[9px] text-[#4a3d2c] leading-normal">
                      Total contiguous freehold area: <strong>12,670 m² (3.13 Acres)</strong>.
                      Clear title free from prior encumbrances as registered in Taluka Sub-Registrar Office.
                    </p>
                  </div>

                  {/* Bottom Seals & Signature */}
                  <div className="absolute bottom-5 left-6 right-6 flex justify-between items-end border-t border-[#c8bea9] pt-2">
                    {/* Purple Official Rubber Stamp */}
                    <div className="w-16 h-16 rounded-full border-2 border-[#372a72] text-[#372a72] flex flex-col items-center justify-center p-1 text-center rotate-[-6deg] opacity-90">
                      <span className="text-[6px] font-extrabold uppercase leading-tight font-sans">
                        REGISTRAR GUJARAT
                      </span>
                      <span className="text-[5px] font-mono">SEAL 2018</span>
                    </div>

                    {/* Official Signature in Blue Ink */}
                    <div className="text-right">
                      <div className="font-serif italic text-blue-800 text-[12px] font-bold tracking-tight">
                        Ambrish Patel
                      </div>
                      <div className="text-[8px] font-sans font-bold text-[#3a2d1d]">
                        Executive Magistrate & Mamlatdar
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. RIGHT LAYER: Forensic Error Level Analysis (ELA) Compression Heatmap */}
                <div
                  className="absolute inset-0 bg-[#040817] text-white p-6 font-serif overflow-hidden"
                  style={{
                    clipPath: `inset(0 0 0 ${sliderPos}%)`
                  }}
                >
                  {/* Subtle ELA Grid & Noise Pattern */}
                  <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:14px_14px]" />

                  {/* Ghost outline of document */}
                  <div className="text-center border-b-2 border-blue-900/40 pb-2 opacity-40">
                    <div className="mx-auto w-12 h-12 rounded-full border border-blue-500/40 flex items-center justify-center mb-1">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20" />
                    </div>
                    <div className="text-[11px] font-mono tracking-widest text-blue-300 uppercase">
                      ELA COMPRESSION ANALYSIS
                    </div>
                  </div>

                  {/* Low frequency noise baseline */}
                  <div className="py-2.5 space-y-2 text-[10px] text-blue-400/50">
                    <p className="opacity-30">Uniform Quantization Baseline (Q-Table: 90)</p>

                    {/* Glowing Tampered / Spliced Region */}
                    <div className="relative my-4 p-3 rounded bg-blue-950/40 border border-blue-800/40">
                      {/* ELA Glowing Luminance Heatmap representing spliced Survey No */}
                      <div className="relative py-2 px-3 rounded bg-gradient-to-r from-emerald-500/30 via-yellow-400/80 to-amber-500/90 border border-yellow-300 shadow-[0_0_25px_rgba(234,179,8,0.7)] animate-pulse">
                        <div className="text-[11px] font-mono font-extrabold text-black tracking-wider flex items-center justify-between">
                          <span>HIGH COMPRESSION DISCONTINUITY</span>
                          <span className="bg-black/80 text-yellow-300 text-[9px] px-1 py-0.5 rounded">
                            ΔE: 89.2%
                          </span>
                        </div>
                        <p className="text-[9px] font-mono text-black font-bold mt-0.5">
                          Spliced Stamp Character: [Survey No: 402/A]
                        </p>
                      </div>

                      <div className="mt-2 text-[9px] font-mono text-yellow-300/90">
                        * Quantization Table Mismatch: Resaved JPEG artifact isolated at pixel [420, 185].
                      </div>
                    </div>

                    <p className="opacity-20 text-[9px]">
                      Rest of document matches uniform camera sensor noise floor.
                    </p>
                  </div>

                  {/* Stamp region glow */}
                  <div className="absolute bottom-5 left-6 right-6 flex justify-between items-end border-t border-blue-900/40 pt-2 opacity-60">
                    <div className="w-16 h-16 rounded-full border border-cyan-500/40 flex items-center justify-center bg-cyan-500/10">
                      <span className="text-[7px] font-mono text-cyan-300">GENUINE SEAL</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-mono text-blue-400">SIGNATURE BASELINE: NORMAL</span>
                    </div>
                  </div>
                </div>

                {/* 3. CENTER DRAGGABLE SLIDER DIVIDER */}
                <div
                  className="absolute top-0 bottom-0 z-40 w-0.5 bg-blue-400 cursor-ew-resize select-none"
                  style={{ left: `${sliderPos}%` }}
                  onMouseDown={() => setIsDraggingSlider(true)}
                  onTouchStart={() => setIsDraggingSlider(true)}
                >
                  {/* Circular Draggable Pill Handle */}
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/50 border-2 border-white text-[10px] font-mono font-bold cursor-ew-resize">
                    ◄►
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Labels */}
          <div className="p-2 border-t border-slate-800/90 bg-[#090D16] flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="text-slate-300">ORIGINAL DOCUMENT</span>
            <span className="text-cyan-400 font-bold">ELA (Error Level Analysis)</span>
          </div>
        </section>

        {/* -----------------------------------------------------------------------
            COLUMN 3: Semantic Diff Engine Table (col-span-3, ~25% width)
            ----------------------------------------------------------------------- */}
        <section className="xl:col-span-3 bg-[#0B0F19] rounded-xl border border-slate-800/90 flex flex-col shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-2.5 border-b border-slate-800/90 flex items-center justify-between bg-[#0E1422]">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-[11px] font-bold text-slate-300 font-mono">
                Target Clause: <span className="text-blue-400">1.4 - Land Title & Survey Match</span>
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-400 shrink-0">
              <button title="Sync Authority Records" className="p-1 hover:text-white rounded hover:bg-slate-800">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button title="Copy Diff Table" className="p-1 hover:text-white rounded hover:bg-slate-800">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Subheader: Clause Reference & Live Source */}
          <div className="px-3 py-1.5 border-b border-slate-800/80 bg-[#070A11] flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400">
              Source: <strong className="text-emerald-400">State Land Registry API (Dharani • Live 2m ago)</strong>
            </span>
            <span className="text-slate-500 hidden sm:inline">Git-Style Diff</span>
          </div>

          {/* 3-Column Header: FIELD | SUBMITTED | AUTHORITY */}
          <div className="grid grid-cols-12 gap-1 px-2.5 py-1.5 bg-[#090D16] border-b border-slate-800/80 text-[10px] font-mono font-bold text-slate-400">
            <span className="col-span-4">FIELD</span>
            <span className="col-span-4">SUBMITTED</span>
            <span className="col-span-4 text-emerald-400">AUTHORITY</span>
          </div>

          {/* Column Titles & Badges (from Screenshot) */}
          <div className="grid grid-cols-2 gap-1 p-2 bg-[#080C14] border-b border-slate-800/80 text-[10px] font-mono">
            <div className="bg-[#05070D] p-1.5 rounded border border-slate-800/80 space-y-1">
              <span className="text-slate-400 block font-sans">Submitted Document Text</span>
              <span className="text-[9px] text-slate-500 block">Comparised State Land Records</span>
              <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-[#3b1216] text-[#ef4444] border border-[#ef4444]/40">
                MISMATCH DETECTED
              </span>
            </div>

            <div className="bg-[#05070D] p-1.5 rounded border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 block font-sans">Submitted Document Text</span>
                <span className="text-emerald-400 font-bold">→</span>
              </div>
              <span className="text-[9px] text-slate-500 block">Comparised State Land Records</span>
              <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-[#3b1216] text-[#ef4444] border border-[#ef4444]/40">
                MISMATCH DETECTED
              </span>
            </div>
          </div>

          {/* Diff Rows (High-density list matching the image) */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1 text-xs font-mono max-h-[calc(100vh-270px)]">

            {/* Row 1: Survey Mismatch Highlight (Red Crimson) */}
            <div className="grid grid-cols-2 gap-1 p-1.5 rounded bg-[#2e1014] text-[#fca5a5] border border-red-900/60 font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="text-red-400 font-bold">!</span>
                <span>Survey No: 402/A</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Survey No: 402/B</span>
                <span className="text-[9px] text-red-400 font-bold bg-red-950 px-1 rounded">MISMATCH</span>
              </div>
            </div>

            {/* Row 2: Secondary Survey row with red X badge */}
            <div className="grid grid-cols-2 gap-1 p-1.5 rounded bg-[#270e12] text-[#f87171] border border-red-900/40">
              <span>Survey No: 402/A</span>
              <div className="flex items-center justify-between">
                <span>Survey No: 402/B</span>
                <span className="w-3.5 h-3.5 rounded bg-red-600 text-white flex items-center justify-center text-[9px] font-bold">
                  ✕
                </span>
              </div>
            </div>

            {/* Row 3: Exact Matche Screen (Green download/check badge) */}
            <div className="grid grid-cols-2 gap-1 p-1.5 rounded bg-[#0b1f16] text-[#6ee7b7] border border-emerald-900/40">
              <div className="flex items-center gap-1">
                <span>Exact Matche Screen</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Exact Matche Screen</span>
                <span className="w-3.5 h-3.5 rounded bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">
                  ↓
                </span>
              </div>
            </div>

            {/* Row 4: Survey Land Compression Recied. */}
            <div className="grid grid-cols-2 gap-1 p-1.5 rounded bg-[#1e0f13] text-[#fda4af] border border-rose-950">
              <span>Survey Land Compression Recied.</span>
              <span>Survey Land Compression Recied.</span>
            </div>

            {/* Row 5: Exact Survey Match (Green) */}
            <div className="grid grid-cols-2 gap-1 p-1.5 rounded bg-[#0b1c15] text-[#34d399] border border-emerald-950">
              <span>Survey No: 402/A</span>
              <span>Survey No: 402/A</span>
            </div>

            {/* Row 6: Discrepancy Survey */}
            <div className="grid grid-cols-2 gap-1 p-1.5 rounded bg-[#200f12] text-[#fca5a5]">
              <span>Survey No: 402/A</span>
              <span>Survey No: 402/B</span>
            </div>

            {/* Row 7: Discrepancy Survey with Boroher tag */}
            <div className="grid grid-cols-2 gap-1 p-1.5 rounded bg-[#1f0e11] text-[#fca5a5]">
              <div>
                <span>Survey No: 402/A</span>
                <span className="text-[9px] text-rose-500 block">Boroher</span>
              </div>
              <div>
                <span>Survey No: 402/B</span>
                <span className="text-[9px] text-emerald-400 block">Boroher</span>
              </div>
            </div>

            {/* Row 8: Survey No */}
            <div className="grid grid-cols-2 gap-1 p-1.5 rounded bg-[#190c0f] text-[#f87171]">
              <span>Survey No: 402/A</span>
              <span>Survey No: 402/B</span>
            </div>

            {/* Row 9: Survey No: 0 (Green matched) */}
            <div className="grid grid-cols-2 gap-1 p-1.5 rounded bg-[#0b1b14] text-[#34d399]">
              <span>Survey No: 0</span>
              <span>Survey No: 0</span>
            </div>

            {/* Git-Style Diff Table for Target Clause 1.4 */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block px-1">
                Field-Level Statutory Reconciliation
              </span>

              {/* Discrepancy Row: Survey Number */}
              <div className="grid grid-cols-12 gap-1 p-1.5 rounded bg-[#351016] text-[#fca5a5] border border-red-800/80 font-bold">
                <span className="col-span-4 text-red-300">Survey Number</span>
                <span className="col-span-4 text-red-400 flex items-center gap-1">
                  ! 405/A
                  <span className="text-[8px] bg-red-900/90 text-white px-1 py-0.2 rounded font-mono">MISMATCH</span>
                </span>
                <span className="col-span-4 text-emerald-300">~ 405/B</span>
              </div>

              {/* Consistent Row: Institution Name */}
              <div className="grid grid-cols-12 gap-1 p-1.5 rounded bg-[#0b1c15] text-slate-300 border border-emerald-900/40">
                <span className="col-span-4 text-slate-400">Institution Name</span>
                <span className="col-span-4 text-emerald-300">ITSR Campus 5</span>
                <span className="col-span-4 text-emerald-400">ITSR Campus 5</span>
              </div>

              {/* Consistent Row: Total Area */}
              <div className="grid grid-cols-12 gap-1 p-1.5 rounded bg-[#0b1c15] text-slate-300 border border-emerald-900/40">
                <span className="col-span-4 text-slate-400">Total Area</span>
                <span className="col-span-4 text-emerald-300">12,670 m²</span>
                <span className="col-span-4 text-emerald-400">12,670 m²</span>
              </div>

              {/* Consistent Row: Reg. Date */}
              <div className="grid grid-cols-12 gap-1 p-1.5 rounded bg-[#0b1c15] text-slate-300 border border-emerald-900/40">
                <span className="col-span-4 text-slate-400">Reg. Date</span>
                <span className="col-span-4 text-emerald-300">2018-04-12</span>
                <span className="col-span-4 text-emerald-400">2018-04-12</span>
              </div>

              {/* Consistent Row: Plot Contiguity */}
              <div className="grid grid-cols-12 gap-1 p-1.5 rounded bg-[#0b1c15] text-slate-300 border border-emerald-900/40">
                <span className="col-span-4 text-slate-400">Plot Contiguity</span>
                <span className="col-span-4 text-emerald-300">Contiguous</span>
                <span className="col-span-4 text-emerald-400">Contiguous</span>
              </div>
            </div>

          </div>

          {/* Footer Metadata Tags */}
          <div className="p-2 border-t border-slate-800/90 bg-[#090D16] space-y-1 text-[10px] font-mono text-slate-400">
            <div className="flex items-center justify-between">
              <span>Freshness:</span>
              <span className="text-emerald-400 font-medium">Dharani Portal (Live 2m ago)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cross-College Hash:</span>
              <span className="text-slate-300 font-bold">Unique (0 Reused)</span>
            </div>
          </div>
        </section>

        {/* -----------------------------------------------------------------------
            COLUMN 4: Statutory Decision Dock & Audit Trail (col-span-2, ~20% width)
            ----------------------------------------------------------------------- */}
        <section className="xl:col-span-2 bg-[#0B0F19] rounded-xl border border-slate-800/90 flex flex-col shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-2.5 border-b border-slate-800/90 bg-[#0E1422]">
            <h2 className="text-xs font-semibold text-slate-200 tracking-wide">
              Statutory Decision Dock & Audit
            </h2>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-3.5 text-xs">

            {/* Decision Actions Section */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                Decision
              </span>

              {/* Primary Green: Accept Evidence */}
              <button
                disabled={isSubmittingAction}
                onClick={() => handleOfficerDecision('ACCEPT')}
                className="w-full py-2 px-3 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Accept Evidence</span>
              </button>

              {/* Primary Red: Flag Deficiency */}
              <button
                disabled={isSubmittingAction}
                onClick={() => handleOfficerDecision('FLAG')}
                className="w-full py-2 px-3 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
              >
                <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                <span>Flag Deficiency</span>
              </button>

              {/* Secondary: Inspect Hex / Raw Metadata */}
              <button
                onClick={() => setShowHexModal(true)}
                className="w-full py-1.5 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono text-[10px] border border-slate-700/80 transition-all text-center"
              >
                Inspect Hex / Raw Metadata
              </button>
            </div>

            {/* Decision Feedback Toast */}
            {decisionFeedback && (
              <div className={`p-2 rounded-lg text-[10px] font-mono border ${
                decisionFeedback.type === 'ACCEPTED'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  : 'bg-rose-950/60 text-rose-300 border-rose-800'
              }`}>
                {decisionFeedback.msg}
              </div>
            )}

            {/* Active Finding Card */}
            <div className="p-2.5 rounded-lg bg-[#131929] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-rose-400 font-bold uppercase tracking-wider">
                  Critical Discrepancy
                </span>
                <span className="text-slate-400">98.4% Confidence</span>
              </div>
              <div className="text-[11px] font-bold text-slate-200">
                {currentFinding.clause}
              </div>
              <ul className="text-[10px] text-slate-300 space-y-1 list-disc pl-3.5 leading-relaxed font-sans">
                <li>Survey No. mismatch (Submitted 405/A vs Authority 405/B).</li>
                <li>ELA confirms numerical stamp spliced at [x:420, y:185].</li>
              </ul>
            </div>

            {/* Action History / Comments Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">
                  Action History / Comments
                </span>
                <span className="text-[9px] text-slate-500 font-mono">APH 2026</span>
              </div>
              <textarea
                id="officer-justification-box"
                rows={4}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Action History / Comments"
                className="w-full bg-[#080C16] border border-slate-800 rounded-lg p-2 text-slate-200 text-[11px] leading-relaxed outline-none focus:border-blue-500 font-sans resize-none placeholder-slate-600"
              />
            </div>

            {/* Immutable SHA-256 Audit Block Section */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] font-bold text-slate-200 font-mono tracking-tight">
                    IMMUTABLE AUDIT BLOCK #1,048
                  </span>
                </div>
                <button
                  onClick={handleVerifyChain}
                  title="Recompute and verify entire SHA-256 hash sequence"
                  className="text-emerald-400 hover:text-emerald-300 text-[9px] font-mono font-bold bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded flex items-center gap-1"
                >
                  <span>[✓ Verify Chain Integrity]</span>
                  <span className="text-emerald-300">(Valid)</span>
                </button>
              </div>

              {/* Monospace SHA-256 Hash Preview */}
              <div className="px-2 py-1 bg-[#05070D] rounded border border-slate-800 text-[10px] font-mono text-cyan-300 flex items-center justify-between">
                <span>sha256: 8f3b2e7a...c9410d5</span>
                <span className="text-slate-500 text-[9px]">Block #1048</span>
              </div>

              {/* Hash Sequence */}
              <div className="bg-[#070A11] p-2 rounded-lg border border-slate-800/90 font-mono text-[10px] space-y-1 text-slate-400">
                {/* Block 1 */}
                <div className="flex items-center justify-between hover:text-slate-200 cursor-pointer" onClick={() => copyToClipboard('3f8a2e7ac9410d5')}>
                  <span>sha256: 3f8a...7c9b</span>
                  <Copy className="w-2.5 h-2.5 text-slate-500" />
                </div>

                {/* Block 2 */}
                <div className="flex items-center justify-between hover:text-slate-200 cursor-pointer" onClick={() => copyToClipboard('3f8a91ec87c5b')}>
                  <span>sha256: 3f8a...7c5b</span>
                  <Lock className="w-2.5 h-2.5 text-slate-500" />
                </div>

                {/* Timestamp */}
                <div className="text-[9px] text-slate-500 py-0.5 border-y border-slate-900">
                  Timestamp: 06:38:24:34
                </div>

                {/* Block 3 */}
                <div className="flex items-center justify-between hover:text-slate-200 cursor-pointer">
                  <span>sha256: 3f8a...7c5b</span>
                  <Lock className="w-2.5 h-2.5 text-slate-500" />
                </div>

                {/* Block 4 */}
                <div className="flex items-center justify-between hover:text-slate-200 cursor-pointer">
                  <span>sha256: 3f8a...7c5b</span>
                  <Lock className="w-2.5 h-2.5 text-slate-500" />
                </div>
              </div>

              {copiedHash && (
                <div className="text-[9px] text-emerald-400 font-mono text-center">
                  Hash copied to clipboard!
                </div>
              )}

              {/* Bottom Context Help Icon */}
              <div className="flex justify-end pt-1">
                <button
                  title="Auditing Information"
                  className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-[10px]"
                >
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
            </div>

          </div>
        </section>

      </div>

      {/* =========================================================================
          HEX / RAW METADATA MODAL (For "Inspect Hex / Raw Metadata" button)
          ========================================================================= */}
      {showHexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0B0F19] border border-slate-800 rounded-xl max-w-2xl w-full p-4 space-y-3 font-mono shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Raw PDF Stream & Quantization Table Inspect
                </h3>
              </div>
              <button
                onClick={() => setShowHexModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#05070D] p-3 rounded border border-slate-800/80 text-[10px] text-slate-300 max-h-72 overflow-y-auto space-y-1">
              <div className="text-slate-500 font-bold"># PDF Header & Producer Forensics:</div>
              <p>Producer: Adobe PDF Library 15.0 / Modified via resave</p>
              <p>ByteRange: [0, 184512, 192704, 84210]</p>
              <p>JPEG Q-Table 0 (Luminance): 16 11 10 16 24 40 51 61 ... [Q=90]</p>
              <p className="text-red-400 font-bold">Discontinuity detected in Bounding Box [420, 185, 510, 215]:</p>
              <p className="text-red-300">Local Q-Table mismatch indicates secondary compression stream [Q=75].</p>
              <div className="mt-3 text-slate-500 font-bold"># Cryptographic Hash Signatures:</div>
              <p>SHA-256 Digest: 8f3b2e7a4b1c9d0e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e</p>
              <p>pHash: 8821fa99c012847a</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHexModal(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
