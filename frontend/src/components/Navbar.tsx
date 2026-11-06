import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, UserCheck, Settings, Activity, Lock, HelpCircle, FileCheck2, Globe, Compass } from 'lucide-react';
import { Role } from '../types';

interface NavbarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  openDemoTour: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView, openDemoTour }) => {
  const { user, role, switchRole, lang, toggleLanguage } = useAuth();

  const navLabels = {
    en: {
      dashboard: "Applications Queue",
      workbench: "Scrutiny Workbench",
      selfCheck: "Pre-Check (Self)",
      rules: "Rule Studio",
      evaluation: "Evaluation & Metrics",
      safeguards: "Data Safeguards",
      demo: "5-Min Guided Tour",
      role: "Current Role",
      institution: "Institution",
      scrutiny: "Scrutiny Officer",
      senior: "Senior Authority",
      admin: "Administrator"
    },
    hi: {
      dashboard: "आवेदन कतार",
      workbench: "संवीक्षा वर्कबेंच",
      selfCheck: "पूर्व-जांच (संस्थान)",
      rules: "नियम स्टूडियो",
      evaluation: "मूल्यांकन एवं मेट्रिक्स",
      safeguards: "डेटा सुरक्षा",
      demo: "5-मिनट टूर",
      role: "सक्रिय भूमिका",
      institution: "संस्थान प्रयोक्ता",
      scrutiny: "संवीक्षा अधिकारी",
      senior: "वरिष्ठ प्राधिकारी",
      admin: "प्रशासक"
    }
  }[lang];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      {/* Disclaimer Top Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 py-1 px-4 text-xs font-medium text-amber-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">Decision-Support</span>
          <span>{lang === 'en' ? 'AI outputs are preliminary advisory indicators only. Final decisions rest solely with competent AICTE statutory authorities. No automated adverse rejection.' : 'एआई आउटपुट केवल प्रारंभिक सलाहकार संकेतक हैं। अंतिम निर्णय केवल सक्षम एआईसीटीई सांविधिक अधिकारियों के पास सुरक्षित है।'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400">All External Authority APIs: <strong className="text-emerald-400">Simulated Sources</strong></span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Emblem */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">SatyaCheck</span>
                <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">AICTE Trust Layer</span>
              </div>
              <p className="text-[10px] text-slate-400">Application Validation & Document Authentication Prototype</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {navLabels.dashboard}
            </button>

            <button
              onClick={() => setCurrentView('workbench')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentView === 'workbench'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                  : 'text-cyan-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>{navLabels.workbench}</span>
              <span className="text-[9px] bg-slate-800 text-slate-300 px-1 py-0.2 rounded font-mono border border-slate-700">v2.4</span>
            </button>

            <button
              onClick={() => setCurrentView('selfCheck')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'selfCheck'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {navLabels.selfCheck}
            </button>

            <button
              onClick={() => setCurrentView('rules')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'rules'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {navLabels.rules}
            </button>

            <button
              onClick={() => setCurrentView('evaluation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'evaluation'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {navLabels.evaluation}
            </button>

            <button
              onClick={() => setCurrentView('safeguards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'safeguards'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {navLabels.safeguards}
            </button>
          </nav>

          {/* Right Controls: Role Switcher, Language Toggle, Demo Tour */}
          <div className="flex items-center gap-3">
            {/* Scripted Tour Button */}
            <button
              onClick={openDemoTour}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md shadow-indigo-500/20 transition-all border border-indigo-400/30 animate-pulse"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{navLabels.demo}</span>
            </button>

            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-300 transition-colors"
              title="Toggle English / Hindi"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'en' ? 'EN' : 'हिन्दी'}</span>
            </button>

            {/* Role Switcher Pill */}
            <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700 rounded-lg p-1">
              <span className="text-[10px] text-slate-400 font-medium px-1.5 hidden sm:inline">Role:</span>
              <select
                value={role}
                onChange={(e) => switchRole(e.target.value as Role)}
                className="bg-slate-900 text-emerald-300 font-semibold text-xs rounded border-0 py-1 px-2 focus:ring-1 focus:ring-emerald-500 cursor-pointer outline-none"
              >
                <option value="SCRUTINY_OFFICER">Scrutiny Officer</option>
                <option value="INSTITUTION_USER">Institution User</option>
                <option value="SENIOR_AUTHORITY">Senior Authority</option>
                <option value="ADMIN">System Admin</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
