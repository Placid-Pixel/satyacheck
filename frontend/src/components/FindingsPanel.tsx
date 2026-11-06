import React, { useState } from 'react';
import { Finding } from '../types';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, CheckCircle, XCircle, ArrowUpRight, Search, FileQuestion,
  ShieldCheck, MessageSquare, ExternalLink, Filter
} from 'lucide-react';

interface FindingsPanelProps {
  findings: Finding[];
  onSelectFinding: (finding: Finding) => void;
  selectedFindingId?: number | null;
  onFindingUpdated: () => void;
}

export const FindingsPanel: React.FC<FindingsPanelProps> = ({
  findings,
  onSelectFinding,
  selectedFindingId,
  onFindingUpdated
}) => {
  const { role } = useAuth();
  const [activeModalAction, setActiveModalAction] = useState<string | null>(null);
  const [targetFinding, setTargetFinding] = useState<Finding | null>(null);
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  const openActionModal = (finding: Finding, action: string) => {
    setTargetFinding(finding);
    setActiveModalAction(action);
    setJustification('');
    setErrorMessage('');
  };

  const submitAction = async () => {
    if (!targetFinding || !activeModalAction) return;
    if (!justification || justification.trim().length < 5) {
      setErrorMessage('A detailed officer justification is legally required.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.executeFindingAction(targetFinding.id, activeModalAction, justification);
      setActiveModalAction(null);
      setTargetFinding(null);
      onFindingUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record officer determination');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFindings = findings.filter(f => {
    if (filterSeverity === 'ALL') return true;
    return f.severity === filterSeverity;
  });

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>AI Regulatory & Document Findings ({findings.length})</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Every finding provides evidence coordinates, confidence scores, and handbook references.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Filter Severity:</span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Only</option>
            <option value="MEDIUM">Medium Only</option>
          </select>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-4">
        {filteredFindings.map((finding) => {
          const isSelected = selectedFindingId === finding.id;
          const isCritical = finding.severity === 'CRITICAL';
          const isHigh = finding.severity === 'HIGH';

          return (
            <div
              key={finding.id}
              onClick={() => onSelectFinding(finding)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                      isCritical ? 'bg-rose-600 text-white' :
                      isHigh ? 'bg-orange-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {finding.severity}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                      {finding.rule_id}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      Clause: {finding.clause}
                    </span>
                    <span className="text-[11px] text-emerald-600 font-semibold">
                      Confidence: {(finding.confidence * 100).toFixed(0)}%
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      finding.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' :
                      finding.status === 'DISMISSED' ? 'bg-slate-200 text-slate-800' :
                      finding.status === 'ESCALATED' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      Status: {finding.status}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                    {finding.reason}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-[11px]">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                      <span className="text-slate-400 block font-medium">Extracted Value:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">{finding.extracted_value || 'N/A'}</span>
                    </div>
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                      <span className="text-emerald-600 dark:text-emerald-400 block font-medium">Statutory Mandate:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">{finding.expected_value || 'Mandated Norm'}</span>
                    </div>
                  </div>

                  {finding.officer_notes && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200">
                      <strong>Recorded Officer Determination:</strong> {finding.officer_notes}
                    </div>
                  )}
                </div>

                {/* Officer Action Buttons */}
                <div className="flex flex-wrap lg:flex-col gap-2 pt-2 lg:pt-0 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6 min-w-[190px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openActionModal(finding, 'ACCEPT');
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
                  >
                    Accept Finding
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openActionModal(finding, 'DISMISS');
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg transition-all"
                  >
                    Dismiss with Reason
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openActionModal(finding, 'REQUEST_MORE_EVIDENCE');
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all"
                  >
                    Request Evidence
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openActionModal(finding, 'RECOMMEND_INSPECTION');
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
                  >
                    Spot Inspection
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Officer Determination Dialog Modal */}
      {activeModalAction && targetFinding && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Record Scrutiny Determination: {activeModalAction}</span>
              </h3>
              <button
                onClick={() => setActiveModalAction(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Target Finding:</span>
              <p className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded font-medium">{targetFinding.reason}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Officer Justification & Reason (Mandatory for Tamper-Evident Audit Trail) *
              </label>
              <textarea
                rows={4}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Specify regulatory rationale, physical verification notes, or evidence citation..."
                className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
              />
              {errorMessage && <p className="text-xs font-semibold text-rose-600">{errorMessage}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveModalAction(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={submitAction}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Recording...' : 'Confirm Determination'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
