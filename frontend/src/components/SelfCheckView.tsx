import React, { useState } from 'react';
import { api } from '../api';
import { CheckCircle2, AlertTriangle, Scan, FileText, ArrowRight, ShieldCheck } from 'lucide-react';

export const SelfCheckView: React.FC = () => {
  const [formData, setFormData] = useState({
    applied_intake: 360,
    faculty_count: 20, // Deficient by default to showcase the feature
    survey_no: 'Survey 45/2B',
    fire_noc_expiry: '2024-11-30' // Expired by default
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRunCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await api.runPreCheck(formData);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Pre-Submission</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Institutional Self-Check Sandbox</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Institutions can upload draft metrics and documents to detect deficiencies early and rectify them prior to final formal submission.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Draft Application Parameters</h3>

          <form onSubmit={handleRunCheck} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Sanctioned / Applied Student Intake</label>
              <input
                type="number"
                value={formData.applied_intake}
                onChange={(e) => setFormData({ ...formData, applied_intake: parseInt(e.target.value) || 0 })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Total Full-Time Faculty Count</label>
              <input
                type="number"
                value={formData.faculty_count}
                onChange={(e) => setFormData({ ...formData, faculty_count: parseInt(e.target.value) || 0 })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400">Mandated Cadre Ratio: 1:15 for UG Engineering</span>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Declared Revenue Survey / Parcel No</label>
              <input
                type="text"
                value={formData.survey_no}
                onChange={(e) => setFormData({ ...formData, survey_no: e.target.value })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Fire Safety Certificate Expiry Date</label>
              <input
                type="date"
                value={formData.fire_noc_expiry}
                onChange={(e) => setFormData({ ...formData, fire_noc_expiry: e.target.value })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Scan className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Evaluating Draft...' : 'Run Instant Self-Check'}</span>
            </button>
          </form>
        </div>

        {/* Results Panel */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Self-Check Preliminary Feedback</h3>

          {!result ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
              <ShieldCheck className="w-10 h-10 text-slate-300" />
              <p className="text-xs">Adjust your draft values on the left and click 'Run Instant Self-Check' to receive pre-submission analysis.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                result.deficiencies_count === 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div>
                  <span className="font-bold text-xs block">
                    {result.deficiencies_count === 0 ? 'All Parameters Compliant' : `${result.deficiencies_count} Deficiencies Flagged`}
                  </span>
                  <span className="text-[11px] opacity-80">{result.preliminary_verdict}</span>
                </div>
                <span className="text-xs font-mono font-bold bg-white/70 px-2.5 py-1 rounded">
                  {result.category_detected}
                </span>
              </div>

              {/* Deficiencies Cards */}
              <div className="space-y-3">
                {result.deficiencies.map((d: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-rose-600 dark:text-rose-400">{d.rule}</span>
                      <span className="text-[10px] font-mono text-slate-400">{d.clause}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium">{d.issue}</p>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 pt-1">
                      <strong>Remediation:</strong> {d.remedy}
                    </div>
                  </div>
                ))}
              </div>

              {/* Checklist */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">Mandatory Document Checklist:</span>
                <ul className="space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                  {result.applicable_checklist.map((item: string, i: number) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
