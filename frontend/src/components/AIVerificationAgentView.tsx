import React, { useState, useEffect } from 'react';
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
  UserCheck
} from 'lucide-react';
import { api } from '../api';
import { Application, AgentVerificationReport, AgentTraceStep, AgentFinding, GeminiStatusResponse } from '../types';

interface AIVerificationAgentViewProps {
  initialAppId?: number | null;
  onSelectApplication?: (appId: number) => void;
}

export const AIVerificationAgentView: React.FC<AIVerificationAgentViewProps> = ({
  initialAppId,
  onSelectApplication
}) => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(initialAppId || null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [mode, setMode] = useState<'auto' | 'gemini' | 'offline'>('auto');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [report, setReport] = useState<AgentVerificationReport | null>(null);
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatusResponse | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load applications and Gemini status on mount
  useEffect(() => {
    loadApplications();
    checkGeminiStatus();
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
    }
  }, [selectedAppId, applications]);

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
      }
    } catch (err: any) {
      console.error('Failed to load applications:', err);
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
      setErrorMsg(err.message || 'Verification failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleQuickHeroSelect = (appNumber: string) => {
    const target = applications.find((a) => a.application_number === appNumber);
    if (target) {
      setSelectedAppId(target.id);
      setSelectedApp(target);
      handleRunVerification(target.id);
    }
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
      {/* Top Header & Control Strip */}
      <div className="border-b border-slate-800/80 bg-slate-900/40 px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                SatyaCheck AI
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-blue-950 border border-blue-800 text-blue-400">
                  Agentic Scrutiny Engine
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Autonomous multi-step regulatory verification via Gemini Tool Calling and deterministic handbook norms.
            </p>
          </div>

          {/* Gemini Connectivity & Mode Pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span
                className={`w-2 h-2 rounded-full ${
                  geminiStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-300 font-mono">
                {geminiStatus?.connected
                  ? `Gemini ${geminiStatus.model}`
                  : 'Offline Engine (Deterministic)'}
              </span>
              <button
                onClick={checkGeminiStatus}
                title="Refresh API Status"
                className="text-slate-500 hover:text-slate-300 ml-1 transition"
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

        {/* Action Bar: Application Selector + 3 Hero Preset Buttons */}
        <div className="max-w-7xl mx-auto mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">Select Dossier:</span>
            <select
              value={selectedAppId || ''}
              onChange={(e) => {
                const val = Number(e.target.value);
                setSelectedAppId(val);
                const found = applications.find((a) => a.id === val);
                if (found) setSelectedApp(found);
              }}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.application_number} — {a.institution?.name?.slice(0, 32)} ({a.category})
                </option>
              ))}
            </select>

            {/* Quick Demo Hero Buttons */}
            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={() => handleQuickHeroSelect('AICTE-APP-2026-001')}
                className="text-xs px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/50 transition"
              >
                Hero 1: Clean Pass
              </button>
              <button
                onClick={() => handleQuickHeroSelect('AICTE-APP-2026-002')}
                className="text-xs px-2.5 py-1 rounded-md bg-red-950/40 border border-red-800/60 text-red-400 hover:bg-red-900/50 transition"
              >
                Hero 2: Survey Mismatch
              </button>
              <button
                onClick={() => handleQuickHeroSelect('AICTE-APP-2026-003')}
                className="text-xs px-2.5 py-1 rounded-md bg-amber-950/40 border border-amber-800/60 text-amber-400 hover:bg-amber-900/50 transition"
              >
                Hero 3: Tampered & Timeout
              </button>
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={() => handleRunVerification()}
            disabled={isRunning || !selectedAppId}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-xs transition shadow-lg ${
              isRunning
                ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Agent In Progress...</span>
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

      {/* Main Content Workspace */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
              <div>
                <p className="font-semibold">Verification Agent Notice</p>
                <p className="text-xs text-red-300/90 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {!report && !isRunning && (
            /* Clean Empty State */
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-500">
                <Scale className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-white">Ready for Verification</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                Select an application and click <span className="text-blue-400 font-mono">Run AI Verification</span> to dispatch the multi-tool agent.
              </p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-3 max-w-3xl mx-auto text-left">
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="text-blue-400 font-mono">Step 1-2</span>
                  <p className="font-medium text-slate-200 mt-1">Classification & Baseline</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Detects doc types & prior quota</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="text-blue-400 font-mono">Step 3-4</span>
                  <p className="font-medium text-slate-200 mt-1">Forensics & Extraction</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">ELA heatmap, Copy-Move, OCR</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="text-blue-400 font-mono">Step 5-6</span>
                  <p className="font-medium text-slate-200 mt-1">Authority & 26 Rules</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Fire/Revenue check, APH norms</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="text-blue-400 font-mono">Step 7-8</span>
                  <p className="font-medium text-slate-200 mt-1">Cross-Audit & Dossier</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Deed mismatch & decision advice</p>
                </div>
              </div>
            </div>
          )}

          {isRunning && (
            /* Loading State */
            <div className="py-20 text-center">
              <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4 animate-pulse">
                <Cpu className="w-8 h-8" />
              </div>
              <h3 className="text-base font-medium text-white">Gemini Agent In Execution</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Calling statutory inspection tools, executing Python forensic detectors, and auditing land parcels...
              </p>
            </div>
          )}

          {report && (
            /* Completed Dossier View */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Progressive Tool Execution Trace (5 Cols) */}
              <div className="lg:col-span-5 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
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

                <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
                  {report.trace.map((step) => {
                    const isExpanded = expandedSteps[step.step_number];
                    return (
                      <div
                        key={step.step_number}
                        className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs transition"
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer"
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
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {report.application_number}
                      </span>
                      <h3 className="text-base font-semibold text-white mt-0.5">
                        {report.institution_name}
                      </h3>
                      <p className="text-xs text-slate-400">
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
                    <div className="mt-4 p-3.5 rounded-lg bg-amber-950/30 border border-amber-800/80 text-amber-300 text-xs">
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
                    <div className="mt-4 p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
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
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
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
                        Fire NOC valid, matching land parcels, verified faculty ratio (1:15), and pristine forensic scores.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {report.findings.map((f) => (
                        <div
                          key={f.finding_id}
                          className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
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
                            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-900/80 p-2 rounded border border-slate-800">
                              <div>
                                <span className="text-slate-500 block text-[10px]">
                                  Extracted / Submitted:
                                </span>
                                <span className="text-red-400 font-medium">
                                  {f.extracted_value || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[10px]">
                                  Expected Statutory Norm:
                                </span>
                                <span className="text-emerald-400 font-medium">
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
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-3 mb-3">
                    Statutory Executive Dossier
                  </h4>
                  <div className="prose prose-invert prose-xs text-xs text-slate-300 max-w-none leading-relaxed whitespace-pre-line">
                    {report.summary}
                  </div>
                </div>

                {/* 4. Telemetry & Governance Safeguard Footer */}
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
                    Strictly Non-Rejection Decision Support
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default AIVerificationAgentView;

