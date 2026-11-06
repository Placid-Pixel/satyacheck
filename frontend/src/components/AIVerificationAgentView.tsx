import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Cpu,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  FileText,
  Search,
  Scale,
  Building,
  UserCheck,
  Upload,
  Plus,
  Server,
  Check,
  Flame,
  FileSearch,
  Eye,
  CheckCircle,
  Info
} from 'lucide-react';
import { api } from '../api';
import {
  Application,
  AgentVerificationReport,
  AgentTraceStep,
  AgentFinding,
  GeminiStatusResponse
} from '../types';

interface AIVerificationAgentViewProps {
  initialAppId?: number | null;
  onSelectApplication?: (appId: number) => void;
  onOpenWorkbench?: (appIdentifier: string | number) => void;
  onOpenELALab?: () => void;
}

interface AppDoc {
  id: number;
  doc_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  extracted_fields: any;
  uploaded_at: string | null;
}

export const AIVerificationAgentView: React.FC<AIVerificationAgentViewProps> = ({
  initialAppId,
  onSelectApplication,
  onOpenWorkbench,
  onOpenELALab
}) => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(initialAppId || null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [appDocuments, setAppDocuments] = useState<AppDoc[]>([]);
  const [mode, setMode] = useState<'auto' | 'gemini' | 'offline'>('auto');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runningStepIndex, setRunningStepIndex] = useState<number>(0);
  const [report, setReport] = useState<AgentVerificationReport | null>(null);
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatusResponse | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Backend Connection modal & status
  const [showBackendModal, setShowBackendModal] = useState<boolean>(false);
  const [backendUrlInput, setBackendUrlInput] = useState<string>(api.getBaseUrl());
  const [backendStatus, setBackendStatus] = useState<{
    ok: boolean;
    checking: boolean;
    version?: string;
    error?: string;
  }>({ ok: true, checking: false });

  // Document Upload
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Application Docket Modal
  const [showNewDocketModal, setShowNewDocketModal] = useState<boolean>(false);
  const [newDocketName, setNewDocketName] = useState<string>('');
  const [newDocketState, setNewDocketState] = useState<string>('Maharashtra');
  const [newDocketCategory, setNewDocketCategory] = useState<string>('EOA');
  const [isCreatingDocket, setIsCreatingDocket] = useState<boolean>(false);

  // Active Execution steps simulation for user feedback
  const simulatedSteps = [
    'Initializing SatyaCheck AI scrutiny context...',
    'Classifying submitted documents & extracting text...',
    'Performing visual forensics & perceptual visual hashing...',
    'Cross-referencing state authority registry records...',
    'Executing AICTE APH-2026 handbook norm validation...',
    'Cross-auditing land parcels & faculty rolls...',
    'Synthesizing evidence-linked verification report...'
  ];

  // Load initial data
  useEffect(() => {
    loadApplications();
    checkGeminiStatus();
    checkBackend();
  }, []);

  useEffect(() => {
    if (initialAppId) {
      setSelectedAppId(initialAppId);
    }
  }, [initialAppId]);

  useEffect(() => {
    if (selectedAppId && applications.length > 0) {
      const found = applications.find((a) => a.id === selectedAppId);
      if (found) {
        setSelectedApp(found);
      }
      loadAppDocuments(selectedAppId);
    }
  }, [selectedAppId, applications]);

  // Step rotation while running
  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(() => {
        setRunningStepIndex((prev) => (prev + 1) % simulatedSteps.length);
      }, 1600);
    } else {
      setRunningStepIndex(0);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const checkBackend = async () => {
    setBackendStatus((s) => ({ ...s, checking: true }));
    try {
      const res = await api.checkHealth();
      setBackendStatus({
        ok: res.ok,
        checking: false,
        version: res.version,
        error: res.error
      });
    } catch (err: any) {
      setBackendStatus({
        ok: false,
        checking: false,
        error: err.message || 'Offline'
      });
    }
  };

  const loadApplications = async () => {
    try {
      const data = await api.getApplications();
      setApplications(data);
      if (!selectedAppId && data.length > 0) {
        // Default to Hero 2 for interesting demo
        const hero2 = data.find((a) => a.application_number === 'AICTE-APP-2026-002');
        const defaultApp = hero2 || data[0];
        setSelectedAppId(defaultApp.id);
        setSelectedApp(defaultApp);
        loadAppDocuments(defaultApp.id);
      }
    } catch (err: any) {
      console.error('Failed to load applications:', err);
    }
  };

  const loadAppDocuments = async (appId: number) => {
    try {
      const docs = await api.getApplicationDocuments(appId);
      setAppDocuments(docs);
    } catch (err) {
      // If endpoint returns empty or error, keep empty
      setAppDocuments([]);
    }
  };

  const checkGeminiStatus = async () => {
    try {
      const status = await api.getGeminiStatus();
      setGeminiStatus(status);
    } catch (err) {
      setGeminiStatus({ connected: false, model: 'gemini-2.5-flash', error: 'Service unreachable' });
    }
  };

  const handleRunVerification = async (targetAppId?: number) => {
    const appId = targetAppId || selectedAppId;
    if (!appId) return;

    setIsRunning(true);
    setErrorMsg(null);
    setReport(null);
    setExpandedSteps({});

    try {
      const result = await api.runAgentVerification(appId, mode);
      setReport(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification agent execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleQuickHeroSelect = (appNumber: string) => {
    const target = applications.find((a) => a.application_number === appNumber);
    if (target) {
      setSelectedAppId(target.id);
      setSelectedApp(target);
      loadAppDocuments(target.id);
      handleRunVerification(target.id);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedAppId) return;

    const file = files[0];
    setIsUploading(true);
    setErrorMsg(null);
    try {
      const res = await api.uploadDocument(selectedAppId, file);
      setSuccessToast(`Document '${file.name}' uploaded & analyzed successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
      loadAppDocuments(selectedAppId);
    } catch (err: any) {
      setErrorMsg(`Upload failed: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateDocket = async () => {
    if (!newDocketName.trim()) return;
    setIsCreatingDocket(true);
    setErrorMsg(null);
    try {
      const res = await api.createDocket({
        institution_name: newDocketName.trim(),
        category: newDocketCategory,
        state: newDocketState
      });
      setShowNewDocketModal(false);
      setNewDocketName('');
      setSuccessToast(`New Docket '${res.application_number}' created!`);
      setTimeout(() => setSuccessToast(null), 4000);
      await loadApplications();
      setSelectedAppId(res.id);
    } catch (err: any) {
      setErrorMsg(`Failed to create docket: ${err.message || err}`);
    } finally {
      setIsCreatingDocket(false);
    }
  };

  const handleSaveBackendUrl = async () => {
    api.setBaseUrl(backendUrlInput);
    setShowBackendModal(false);
    await checkBackend();
    await loadApplications();
    await checkGeminiStatus();
  };

  const handleResetBackendUrl = async () => {
    api.resetBaseUrl();
    setBackendUrlInput(api.getBaseUrl());
    setShowBackendModal(false);
    await checkBackend();
    await loadApplications();
    await checkGeminiStatus();
  };

  const toggleStepExpand = (stepNumber: number) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber]
    }));
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-950/80 text-red-400 border-red-800/80';
      case 'HIGH':
        return 'bg-amber-950/80 text-amber-400 border-amber-800/80';
      case 'MEDIUM':
        return 'bg-yellow-950/80 text-yellow-400 border-yellow-800/80';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 70) return 'text-red-400 border-red-500 bg-red-950/40';
    if (score >= 40) return 'text-amber-400 border-amber-500 bg-amber-950/40';
    return 'text-emerald-400 border-emerald-500 bg-emerald-950/40';
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0F17] text-slate-100 overflow-hidden font-sans">
      {/* =========================================================================
          TOP STRIP: SATYACHECK AI BRANDING & CONNECTIVITY CONTROLS
          ========================================================================= */}
      <div className="border-b border-slate-800/80 bg-slate-900/40 px-4 sm:px-6 py-3.5 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-900/50 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-white">SatyaCheck AI</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-950/80 border border-blue-800/80 text-blue-400 font-medium">
                  Autonomous Verification Agent
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Multi-step regulatory scrutiny using Gemini function calling and statutory norms.
              </p>
            </div>
          </div>

          {/* Right: Backend & Gemini Connectivity Pills */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Backend Connection Pill */}
            <button
              onClick={() => {
                setBackendUrlInput(api.getBaseUrl());
                setShowBackendModal(true);
              }}
              title="Click to manage backend connection settings"
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
                backendStatus.ok
                  ? 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  : 'bg-rose-950/40 border-rose-800/80 text-rose-300 hover:bg-rose-950/60'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus.ok ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
                }`}
              />
              <span className="font-mono text-[11px]">
                {backendStatus.ok ? 'Backend: Connected' : 'Backend: Offline'}
              </span>
              <Server className="w-3 h-3 text-slate-500 ml-0.5" />
            </button>

            {/* Gemini Model Pill */}
            <div className="flex items-center gap-1.5 text-xs bg-slate-950/80 border border-slate-800 px-2.5 py-1.5 rounded-lg">
              <span
                className={`w-2 h-2 rounded-full ${
                  geminiStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-300 font-mono text-[11px]">
                {geminiStatus?.connected
                  ? `Gemini ${geminiStatus.model}`
                  : 'Deterministic Engine'}
              </span>
              <button
                onClick={checkGeminiStatus}
                title="Refresh API Status"
                className="text-slate-500 hover:text-slate-300 transition"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Verification Mode Selector */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
              <button
                onClick={() => setMode('auto')}
                className={`px-2.5 py-1 rounded transition ${
                  mode === 'auto'
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Auto
              </button>
              <button
                onClick={() => setMode('gemini')}
                className={`px-2.5 py-1 rounded transition ${
                  mode === 'gemini'
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Gemini
              </button>
              <button
                onClick={() => setMode('offline')}
                className={`px-2.5 py-1 rounded transition ${
                  mode === 'offline'
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Offline
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            ACTION BAR: DOSSIER SELECTOR, UPLOAD & HERO PRESETS
            ========================================================================= */}
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">Target Dossier:</span>
            <select
              value={selectedAppId || ''}
              onChange={(e) => {
                const val = Number(e.target.value);
                setSelectedAppId(val);
                const found = applications.find((a) => a.id === val);
                if (found) setSelectedApp(found);
                loadAppDocuments(val);
              }}
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 max-w-[280px] sm:max-w-xs truncate"
            >
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.application_number} — {a.institution?.name?.slice(0, 26)} ({a.category})
                </option>
              ))}
            </select>

            {/* Add New Docket Button */}
            <button
              onClick={() => setShowNewDocketModal(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Create new regulatory test docket"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Docket</span>
            </button>

            {/* Quick Demo Hero Buttons */}
            <div className="hidden lg:flex items-center gap-1.5 ml-2">
              <button
                onClick={() => handleQuickHeroSelect('AICTE-APP-2026-001')}
                className="text-xs px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/50 transition"
              >
                Hero 1: Clean
              </button>
              <button
                onClick={() => handleQuickHeroSelect('AICTE-APP-2026-002')}
                className="text-xs px-2.5 py-1 rounded-md bg-red-950/40 border border-red-800/60 text-red-400 hover:bg-red-900/50 transition"
              >
                Hero 2: Mismatch
              </button>
              <button
                onClick={() => handleQuickHeroSelect('AICTE-APP-2026-003')}
                className="text-xs px-2.5 py-1 rounded-md bg-amber-950/40 border border-amber-800/60 text-amber-400 hover:bg-amber-900/50 transition"
              >
                Hero 3: Timeout
              </button>
            </div>
          </div>

          {/* Right Action: Run Verification Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunVerification()}
              disabled={isRunning || !selectedAppId}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-xs transition shadow-lg ${
                isRunning
                  ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-[0.98]'
              }`}
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Agent Verifying...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run AI Verification</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          NOTIFICATION TOASTS & ALERTS
          ========================================================================= */}
      {successToast && (
        <div className="bg-emerald-950/90 border-b border-emerald-800 px-6 py-2.5 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-950/90 border-b border-rose-800 px-6 py-2.5 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* =========================================================================
          MAIN WORKSPACE BODY
          ========================================================================= */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* 1. DOCUMENT REPOSITORY & UPLOAD CARD */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Application Evidence Dossier
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    {appDocuments.length} Documents
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Statutory certificates inspected by AI agent and hashed to tamper-evident vault.
                </p>
              </div>

              {/* Upload Button */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || !selectedAppId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-medium transition"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Document (PDF / Image)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Document Pills Grid */}
            {appDocuments.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                <Upload className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No documents uploaded for this application yet.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Click 'Upload Document' above to add Fire NOC, Land Deed, or NAAC Certificate.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {appDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 text-xs transition space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/80 text-blue-400">
                        {doc.doc_type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {(doc.file_size / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    <p className="font-medium text-slate-200 truncate text-[11px]" title={doc.file_name}>
                      {doc.file_name}
                    </p>

                    {/* Secondary Actions */}
                    <div className="pt-1 flex items-center gap-2 text-[10px] font-mono">
                      {onOpenWorkbench && (
                        <button
                          onClick={() => onOpenWorkbench(selectedApp?.application_number || doc.id)}
                          className="text-slate-400 hover:text-blue-400 flex items-center gap-1 transition"
                        >
                          <FileSearch className="w-3 h-3" />
                          <span>Workbench</span>
                        </button>
                      )}
                      {onOpenELALab && (
                        <button
                          onClick={onOpenELALab}
                          className="text-slate-400 hover:text-amber-400 flex items-center gap-1 transition"
                        >
                          <Flame className="w-3 h-3" />
                          <span>ELA Lab</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. RUNNING EXECUTION PROGRESS */}
          {isRunning && (
            <div className="py-16 text-center bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-4 animate-pulse">
                <Cpu className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-white">AI Verification Agent in Progress</h3>
              <p className="text-xs text-blue-400 font-mono mt-2 animate-pulse">
                {simulatedSteps[runningStepIndex]}
              </p>
              <div className="w-48 h-1 bg-slate-800 rounded-full mx-auto mt-4 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full animate-pulse w-3/4 mx-auto" />
              </div>
            </div>
          )}

          {/* 3. CLEAN EMPTY STATE BEFORE RUN */}
          {!report && !isRunning && (
            <div className="text-center py-12 px-4 bg-slate-900/20 border border-slate-800/60 rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-500">
                <Scale className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-white">Ready for Verification</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Select an application dossier and click <span className="text-blue-400 font-mono">Run AI Verification</span> to dispatch the multi-tool scrutiny agent.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-3 max-w-3xl mx-auto text-left">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="text-blue-400 font-mono font-medium">Phase 1</span>
                  <p className="font-medium text-slate-200 mt-1">Classification & OCR</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Identifies doc types and baseline quotas</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="text-blue-400 font-mono font-medium">Phase 2</span>
                  <p className="font-medium text-slate-200 mt-1">Forensics & Perceptual Hash</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Detects visual tampering & duplicate submissions</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="text-blue-400 font-mono font-medium">Phase 3</span>
                  <p className="font-medium text-slate-200 mt-1">Authority Verification</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Checks Fire NOC expiry & Land revenue portals</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="text-blue-400 font-mono font-medium">Phase 4</span>
                  <p className="font-medium text-slate-200 mt-1">Statutory Norm Audit</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Audits 26 handbook clauses with evidence links</p>
                </div>
              </div>
            </div>
          )}

          {/* 4. VERIFICATION RESULT DOSSIER */}
          {report && !isRunning && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Progressive Tool Execution Trace (5 Cols) */}
              <div className="lg:col-span-5 bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                      Tool Execution Trace ({report.trace.length} steps)
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {report.duration_seconds}s
                  </span>
                </div>

                <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
                  {report.trace.map((step) => {
                    const isExpanded = expandedSteps[step.step_number];
                    return (
                      <div
                        key={step.step_number}
                        className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs transition"
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer select-none"
                          onClick={() => toggleStepExpand(step.step_number)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-mono text-[10px] text-slate-300">
                              {step.step_number}
                            </span>
                            <span className="font-mono font-medium text-blue-400">
                              {step.tool_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-500">
                              {step.latency_ms}ms
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Thought / Purpose */}
                        {step.thought && (
                          <p className="text-[11px] text-slate-400 italic mt-1.5 pl-7">
                            "{step.thought}"
                          </p>
                        )}

                        {/* Brief Output Summary */}
                        <div className="mt-2 pl-7 text-[11px] text-slate-300">
                          {step.output_summary}
                        </div>

                        {/* Expandable Technical Inputs/Outputs */}
                        {isExpanded && step.full_output && (
                          <div className="mt-2.5 pt-2 border-t border-slate-800 pl-7">
                            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                              Raw Tool Payload:
                            </span>
                            <pre className="text-[10px] font-mono bg-slate-900 p-2 rounded text-slate-300 overflow-x-auto max-h-40">
                              {JSON.stringify(step.full_output, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Evidence Dossier & Findings (7 Cols) */}
              <div className="lg:col-span-7 space-y-6">
                {/* 1. Executive Decision Card */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {report.application_number}
                      </span>
                      <h3 className="text-base font-semibold text-white mt-0.5">
                        {report.institution_name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Mode: <span className="font-mono text-slate-300">{report.execution_mode}</span> | Tools Executed: {report.total_tools_called}
                      </p>
                    </div>

                    {/* Risk Badge */}
                    <div
                      className={`px-4 py-2 rounded-xl border flex flex-col items-center justify-center ${getRiskScoreColor(
                        report.overall_risk_score
                      )}`}
                    >
                      <span className="text-2xl font-bold font-mono">
                        {report.overall_risk_score}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wider">
                        {report.overall_risk_level} RISK
                      </span>
                    </div>
                  </div>

                  {/* Human Review Advisory Callout */}
                  {report.needs_human_review ? (
                    <div className="mt-4 p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/80 text-amber-300 text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Action Required: Route to Human Scrutiny Officer</span>
                      </div>
                      <ul className="mt-2 space-y-1 pl-6 list-disc text-amber-200/90 text-[11px]">
                        {report.human_review_reasons.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-4 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>
                        Eligible for Routine Approval: All statutory handbook criteria verified.
                      </span>
                    </div>
                  )}

                  {/* Recommended Action */}
                  <div className="mt-3 text-xs text-slate-300">
                    <span className="text-slate-400 font-medium">Statutory Recommendation: </span>
                    {report.recommended_action}
                  </div>
                </div>

                {/* 2. Statutory Findings List */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-blue-400" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                        Evidence-Backed Findings ({report.findings.length})
                      </h4>
                    </div>
                    {report.findings.length === 0 && (
                      <span className="text-xs text-emerald-400 font-mono">
                        Zero Statutory Deficiencies Flagged
                      </span>
                    )}
                  </div>

                  {report.findings.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="font-medium text-slate-300">All Evaluated APH Clauses Compliant</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Fire NOC valid, matching land parcels, verified faculty ratio, and authentic document visuals.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {report.findings.map((f) => (
                        <div
                          key={f.finding_id}
                          className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getSeverityBadge(
                                  f.severity
                                )}`}
                              >
                                {f.severity}
                              </span>
                              <span className="font-mono text-slate-300 font-medium">
                                {f.clause}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">
                              Source: <code className="text-blue-400">{f.tool_source}</code>
                            </span>
                          </div>

                          <p className="text-slate-200 text-xs leading-relaxed">
                            {f.explanation}
                          </p>

                          {/* Differential comparison */}
                          {(f.extracted_value || f.expected_value) && (
                            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                              <div>
                                <span className="text-slate-500 block text-[10px]">
                                  Extracted / Submitted:
                                </span>
                                <span className="text-red-400 font-medium truncate block">
                                  {f.extracted_value || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[10px]">
                                  Expected Statutory Norm:
                                </span>
                                <span className="text-emerald-400 font-medium truncate block">
                                  {f.expected_value || 'N/A'}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="mt-2 text-[11px] text-slate-400">
                            <span className="font-medium text-slate-500">Recommended Officer Action: </span>
                            {f.recommended_action}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Executive Scrutiny Dossier Narrative */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-3 mb-3">
                    Statutory Executive Dossier
                  </h4>
                  <div className="prose prose-invert prose-xs text-xs text-slate-300 max-w-none leading-relaxed whitespace-pre-line">
                    {report.summary}
                  </div>
                </div>

                {/* 4. Telemetry Footer & Quick Jumps */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
                  <div>
                    <span>Execution ID: </span>
                    <span className="text-slate-300">{report.execution_id}</span>
                  </div>
                  <div>
                    <span>Tokens: </span>
                    <span className="text-slate-300">
                      {report.token_usage.total_tokens} (est ${report.estimated_cost_usd})
                    </span>
                  </div>
                  <div className="text-slate-500 text-[10px]">
                    Strictly Decision-Support (Non-Rejection Policy)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: BACKEND CONNECTION SETTINGS
          ========================================================================= */}
      {showBackendModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">FastAPI Backend Settings</h3>
              </div>
              <button
                onClick={() => setShowBackendModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Configure the API URL for your deployed FastAPI backend (e.g. Render, Railway, Fly.io, or local host).
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block">Backend Base URL:</label>
              <input
                type="text"
                value={backendUrlInput}
                onChange={(e) => setBackendUrlInput(e.target.value)}
                placeholder="https://satyacheck-api.onrender.com or /api"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-500">
                Current active target: <span className="font-mono text-slate-400">{api.getBaseUrl()}</span>
              </p>
            </div>

            {/* Test Connection Button & Status */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={checkBackend}
                disabled={backendStatus.checking}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5"
              >
                {backendStatus.checking && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>Test Connection</span>
              </button>

              <span
                className={`text-xs font-mono ${
                  backendStatus.ok ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {backendStatus.checking
                  ? 'Testing...'
                  : backendStatus.ok
                  ? '✓ Service Reachable'
                  : '✕ Not Reachable'}
              </span>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetBackendUrl}
                className="text-xs text-slate-400 hover:text-white"
              >
                Reset to Default (/api)
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBackendModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBackendUrl}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition"
                >
                  Save & Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: CREATE NEW REGULATORY TEST DOCKET
          ========================================================================= */}
      {showNewDocketModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Create Regulatory Test Docket</h3>
              </div>
              <button
                onClick={() => setShowNewDocketModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Institution Name:</label>
                <input
                  type="text"
                  value={newDocketName}
                  onChange={(e) => setNewDocketName(e.target.value)}
                  placeholder="e.g. Apex Institute of Engineering & Technology"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">State Jurisdiction:</label>
                <select
                  value={newDocketState}
                  onChange={(e) => setNewDocketState(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="Maharashtra">Maharashtra (WRO)</option>
                  <option value="Karnataka">Karnataka (SWRO)</option>
                  <option value="Telangana">Telangana (SCRO)</option>
                  <option value="Tamil Nadu">Tamil Nadu (SRO)</option>
                  <option value="Delhi">Delhi (NWRO)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Regulatory Category:</label>
                <select
                  value={newDocketCategory}
                  onChange={(e) => setNewDocketCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="EOA">Extension of Approval (EoA)</option>
                  <option value="INTAKE_INCREASE">Increase in Intake</option>
                  <option value="NEW_COURSE">New Course Introduction</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewDocketModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateDocket}
                disabled={isCreatingDocket || !newDocketName.trim()}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition disabled:opacity-50"
              >
                {isCreatingDocket ? 'Creating...' : 'Create Docket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIVerificationAgentView;
