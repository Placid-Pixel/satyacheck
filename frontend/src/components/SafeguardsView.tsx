import React from 'react';
import { ShieldCheck, Lock, EyeOff, FileText, Database, Server, Check } from 'lucide-react';

export const SafeguardsView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Security, Privacy & Data Handling Safeguards</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Statutory compliance guidelines for protecting institutional intellectual property, faculty PII, and official government records.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Safeguard 1: Masking */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <EyeOff className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Sensitive Field Masking by Default</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            All personally identifiable identifiers (Aadhaar numbers, PAN identifiers, private bank accounts) are masked in the UI:
          </p>
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded font-mono text-xs text-slate-700 dark:text-slate-300">
            Aadhaar: XXXX-XXXX-4401<br />
            PAN: XXXXX9921X
          </div>
        </div>

        {/* Safeguard 2: Encryption */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">AES-256 Fernet Encryption at Rest</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Every document uploaded to the SatyaCheck storage vault is immediately encrypted using AES-CBC with 128-bit HMAC authentication before being written to disk.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <Check className="w-4 h-4" />
            <span>Encrypted Vault Active</span>
          </div>
        </div>

        {/* Safeguard 3: RBAC */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Role-Based Access Control (RBAC)</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            JWT session tokens enforce strict server-side authorization. Institution users can only access their own records, while scrutiny officers and senior authorities require dedicated roles.
          </p>
        </div>

        {/* Safeguard 4: Decision-Support */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">No Automated Adverse Rejection</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            In strict compliance with administrative law principles, no adverse regulatory outcome or rejection is automated. All AI outputs remain purely advisory decision-support.
          </p>
        </div>
      </div>
    </div>
  );
};
