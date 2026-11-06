import React, { useState, useEffect } from 'react';
import { Rule } from '../types';
import { api } from '../api';
import { Settings, Play, Sliders, Shield, Check, AlertCircle, RefreshCw } from 'lucide-react';

export const RuleStudioView: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await api.getRules();
      setRules(data);
      if (data.length > 0) setSelectedRule(data[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleSimulate = async (ruleCode: string) => {
    try {
      setSimulating(true);
      const res = await api.simulateRuleImpact(ruleCode, 15.0);
      setSimulationResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  };

  const filteredRules = rules.filter(r => {
    if (categoryFilter === 'ALL') return true;
    return r.category === categoryFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-600" />
            <span>AICTE Approval Process Handbook — Rule Studio</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure, inspect and simulate the impact of 26 regulatory handbook clauses on active approval queues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">All Categories</option>
            <option value="REGULATORY">Regulatory</option>
            <option value="INFRASTRUCTURE">Infrastructure</option>
            <option value="FACULTY">Faculty & Staff</option>
            <option value="GOVERNANCE">Governance & Committees</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Rules List */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300">
            Handbook Rules ({filteredRules.length})
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[560px] overflow-y-auto">
            {filteredRules.map((r) => {
              const isSelected = selectedRule?.code === r.code;
              return (
                <div
                  key={r.code}
                  onClick={() => {
                    setSelectedRule(r);
                    setSimulationResult(null);
                  }}
                  className={`p-4 transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                    isSelected
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-l-4 border-emerald-500'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{r.title}</span>
                      <span className="bg-slate-100 dark:bg-slate-800 text-[10px] font-mono px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                        {r.clause}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{r.description}</p>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    r.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
                    r.severity === 'HIGH' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {r.severity}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Rule Detail & Impact Simulator */}
        <div className="lg:col-span-5 space-y-4">
          {selectedRule && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{selectedRule.category}</span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">{selectedRule.title}</h3>
                <span className="text-xs font-mono text-slate-500">Statutory Clause: {selectedRule.clause}</span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                {selectedRule.description}
              </p>

              {/* Threshold Parameters */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Statutory Parameters</label>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200">
                  {JSON.stringify(selectedRule.parameters || {}, null, 2)}
                </div>
              </div>

              {/* Simulation Trigger */}
              <div className="pt-2">
                <button
                  onClick={() => handleSimulate(selectedRule.code)}
                  disabled={simulating}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
                  <span>{simulating ? 'Simulating Impact...' : 'Simulate Policy Impact on Queue'}</span>
                </button>
              </div>

              {/* Simulation Output */}
              {simulationResult && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Simulation Projection Complete</span>
                  </div>
                  <p className="text-emerald-800 dark:text-emerald-300">{simulationResult.impact_summary}</p>
                  <div className="flex justify-between pt-1 border-t border-emerald-200/60 font-mono text-[11px] text-emerald-900 dark:text-emerald-200">
                    <span>Applications Affected: <strong>{simulationResult.affected_applications_count}</strong></span>
                    <span>Risk Delta: <strong>{simulationResult.projected_risk_score_delta}</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
