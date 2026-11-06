import React, { useState, useEffect } from 'react';
import { Application, Finding, DocumentRecord } from '../types';
import { api } from '../api';
import { EvidenceViewer } from './EvidenceViewer';
import { FindingsPanel } from './FindingsPanel';
import { VerificationHub } from './VerificationHub';
import { InfrastructureHub } from './InfrastructureHub';
import { KnowledgeGraphView } from './KnowledgeGraphView';
import { AuditTrailView } from './AuditTrailView';
import {
  ArrowLeft, Download, ShieldCheck, AlertTriangle, CheckCircle2,
  Clock, FileText, Layers, Network, Lock, Camera, CheckSquare
} from 'lucide-react';

interface ApplicationDetailViewProps {
  applicationId: number;
  onBack: () => void;
}

export const ApplicationDetailView: React.FC<ApplicationDetailViewProps> = ({ applicationId, onBack }) => {
  const [application, setApplication] = useState<Application | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'checklist' | 'evidence' | 'findings' | 'verification' | 'infra' | 'graph' | 'audit'>('overview');
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadApp = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await api.getApplication(applicationId);
      setApplication(data);
      if (data.documents && data.documents.length > 0) {
        setSelectedDoc(data.documents[0]);
      }
      if (data.findings && data.findings.length > 0) {
        setSelectedFinding(data.findings[0]);
      }
    } catch (e) {
      console.error(e);
      setApplication(null);
      setLoadError(
        e instanceof Error
          ? e.message
          : 'Could not load this application. Confirm the backend is running and demo data is seeded.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApp();
  }, [applicationId]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        Loading Application #{applicationId} details...
      </div>
    );
  }

  if (loadError || !application) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-sm font-semibold text-rose-600">Could not open application #{applicationId}</p>
        <p className="text-xs text-slate-500 max-w-md">
          {loadError || 'The record was not found. Seed demo data and keep FastAPI running on port 8000.'}
        </p>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200">
            Back to queue
          </button>
          <button onClick={loadApp} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const inst = application.institution;
  const findings = application.findings || [];

  const handleExportJson = async () => {
    const report = await api.exportReport(application.id);
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SatyaCheck_Report_${application.application_number}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg text-slate-900 dark:text-white font-mono">
                {application.application_number}
              </h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                application.risk_level === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                application.risk_level === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                application.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                Risk: {application.risk_score.toFixed(1)} ({application.risk_level})
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {inst.name} • {inst.city}, {inst.state} (AICTE ID: {inst.aicte_id})
            </p>
          </div>
        </div>

        <button
          onClick={handleExportJson}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Validation Report</span>
        </button>
      </div>

      {/* Navigation Tabs (8 Tabs) */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2 text-xs font-semibold">
        {[
          { id: 'overview', label: '1. Overview', icon: FileText },
          { id: 'checklist', label: '2. Checklist', icon: CheckSquare },
          { id: 'evidence', label: '3. Scrutiny Workbench (v2.4)', icon: Layers },
          { id: 'findings', label: `4. Findings (${findings.length})`, icon: AlertTriangle },
          { id: 'verification', label: '5. Authority Hub', icon: ShieldCheck },
          { id: 'infra', label: '6. Infrastructure CV', icon: Camera },
          { id: 'graph', label: '7. Knowledge Graph', icon: Network },
          { id: 'audit', label: '8. Audit Trail', icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/20 dark:bg-emerald-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Stage */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Institution Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Institution Profile</span>
              <p className="font-bold text-sm text-slate-900 dark:text-white">{inst.name}</p>
              <p className="text-xs text-slate-500">Trust: {inst.trust_name}</p>
              <p className="text-xs text-slate-500">Established: {inst.established_year}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Declared Metrics</span>
              <p className="text-xs text-slate-600 dark:text-slate-300">Sanctioned Intake: <strong>{inst.approved_intake}</strong></p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Faculty Count: <strong>{inst.faculty_count}</strong></p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Contiguous Land: <strong>{inst.land_area_acres} Acres</strong></p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Risk Assessment</span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{application.risk_score.toFixed(1)} / 100</div>
              <p className="text-xs text-slate-500">Status: <strong className="text-slate-800 dark:text-slate-200">{application.status}</strong></p>
              <p className="text-[11px] text-amber-600 font-semibold">{findings.length} Discrepancies Requiring Review</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'checklist' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">AICTE Handbook Regulatory Checklist</h2>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Fire Safety NOC (Valid for 2026-27 session)', valid: !findings.some(f => f.rule_id === 'RULE_FIRE_NOC_VALIDITY') },
              { label: 'Contiguous Land Ownership Deed & Revenue Survey Match', valid: !findings.some(f => f.rule_id === 'RULE_LAND_SURVEY_CONSISTENCY') },
              { label: 'Faculty-Student Ratio Norm (1:15 minimum)', valid: !findings.some(f => f.rule_id === 'RULE_FACULTY_STUDENT_RATIO') },
              { label: 'TER Regulatory Charge Clearance Receipt', valid: true },
              { label: 'Absence of Certificate Duplication across Colleges', valid: !findings.some(f => f.rule_id === 'RULE_CROSS_INSTITUTE_DUPLICATE') },
              { label: 'QR Code Payload Agreement with Printed Authority Text', valid: !findings.some(f => f.rule_id === 'RULE_QR_PAYLOAD_MISMATCH') },
            ].map((item, idx) => (
              <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-800">
                <span className="font-medium text-slate-800 dark:text-slate-200">{item.label}</span>
                {item.valid ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Compliant</span>
                ) : (
                  <span className="text-rose-600 font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Non-Compliant</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'evidence' && selectedDoc && (
        <div className="space-y-4">
          {/* Document Picker Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {application.documents?.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  selectedDoc.id === doc.id
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {doc.file_name}
              </button>
            ))}
          </div>

          <EvidenceViewer
            document={selectedDoc}
            application={application}
            activeFinding={selectedFinding}
            onSelectFinding={(f) => setSelectedFinding(f)}
          />
        </div>
      )}

      {activeTab === 'findings' && (
        <FindingsPanel
          findings={findings}
          selectedFindingId={selectedFinding?.id}
          onSelectFinding={(f) => {
            setSelectedFinding(f);
            if (f.document_id) {
              const doc = application.documents?.find(d => d.id === f.document_id);
              if (doc) setSelectedDoc(doc);
            }
            setActiveTab('evidence');
          }}
          onFindingUpdated={loadApp}
        />
      )}

      {activeTab === 'verification' && (
        <VerificationHub application={application} onRefresh={loadApp} />
      )}

      {activeTab === 'infra' && (
        <InfrastructureHub application={application} />
      )}

      {activeTab === 'graph' && (
        <KnowledgeGraphView application={application} />
      )}

      {activeTab === 'audit' && (
        <AuditTrailView />
      )}
    </div>
  );
};
