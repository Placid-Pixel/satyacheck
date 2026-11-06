import React, { useState, useEffect } from 'react';
import { Application, ConnectorLog } from '../types';
import { api } from '../api';
import {
  ShieldCheck, AlertTriangle, Clock, RefreshCw, CheckCircle2,
  XCircle, ExternalLink, Network, FileText, ArrowRight
} from 'lucide-react';

interface VerificationHubProps {
  application: Application;
  onRefresh: () => void;
}

export const VerificationHub: React.FC<VerificationHubProps> = ({ application, onRefresh }) => {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifyingDocId, setVerifyingDocId] = useState<number | null>(null);

  const loadTimeline = async () => {
    try {
      const data = await api.getTimeline(application.id);
      setTimeline(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadTimeline();
  }, [application.id]);

  const handleTriggerVerification = async (docId: number) => {
    try {
      setVerifyingDocId(docId);
      await api.triggerVerification(docId);
      await loadTimeline();
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setVerifyingDocId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> VERIFIED</span>;
      case 'EXPIRED':
        return <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-bold px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-600" /> EXPIRED</span>;
      case 'MISMATCH_DETECTED':
        return <span className="bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 font-bold px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> MISMATCH DETECTED</span>;
      case 'SOURCE_UNAVAILABLE':
        return <span className="bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 font-bold px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-purple-600" /> TIMEOUT (504)</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-full text-xs">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Issuing-Authority Verification Framework
            </h2>
            <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Simulated Sources
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pluggable adapter interface simulating real-time queries to state fire registries, revenue portals, and NAAC/NBA servers.
          </p>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Connector State Machine: <span className="text-emerald-500 font-semibold">Strict 6-State Pipeline</span>
        </div>
      </div>

      {/* Authority Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {application.documents?.map((doc) => {
          const matchingLog = application.connector_logs?.find(l => l.document_id === doc.id) ||
                              timeline.find(t => t.document_id === doc.id);
          const isVerifying = verifyingDocId === doc.id;

          return (
            <div
              key={doc.id}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Document</span>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">{doc.file_name}</h3>
                  <span className="text-xs text-slate-500 font-mono">Type: {doc.doc_type}</span>
                </div>
                {matchingLog ? getStatusBadge(matchingLog.status) : (
                  <span className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full text-xs font-semibold">PENDING</span>
                )}
              </div>

              {/* Response Details Payload */}
              {matchingLog && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[11px] text-slate-500">
                    <span>Upstream Source: <strong>{matchingLog.authority || matchingLog.authority_type}</strong></span>
                    <span>Latency: <strong>{matchingLog.latency_ms || 210} ms</strong></span>
                  </div>

                  <div className="p-2 bg-white dark:bg-slate-900 rounded font-mono text-[10px] text-slate-700 dark:text-slate-300 overflow-x-auto border border-slate-200 dark:border-slate-700">
                    {JSON.stringify(matchingLog.response_payload || matchingLog.details || {}, null, 2)}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  disabled={isVerifying}
                  onClick={() => handleTriggerVerification(doc.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin text-emerald-500' : ''}`} />
                  <span>{isVerifying ? 'Querying Adapter...' : 'Re-verify with Authority'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Verification Timeline Log */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>Chronological Verification Timeline</span>
        </h3>

        <div className="space-y-3 relative pl-6 border-l-2 border-slate-200 dark:border-slate-700 ml-2">
          {timeline.length === 0 ? (
            <p className="text-xs text-slate-500">No authority queries logged yet for this application.</p>
          ) : (
            timeline.map((event, idx) => (
              <div key={idx} className="relative space-y-1">
                <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900" />
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{event.authority}</span>
                  <span className="text-slate-400 font-mono text-[11px]">• {event.timestamp}</span>
                  <span className="font-semibold text-emerald-600 text-[11px]">({event.latency_ms}ms)</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Status: <strong className="text-slate-800 dark:text-slate-200">{event.status}</strong>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
