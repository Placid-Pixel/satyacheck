import React, { useState } from 'react';
import {
  LayoutGrid,
  FileSearch,
  UserCheck,
  FileClock,
  Sliders,
  HelpCircle,
  LogOut,
  ChevronRight,
  Shield,
  Check,
  Globe,
  Flame,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

interface VerticalNavRailProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  openDemoTour: () => void;
  openELALab?: () => void;
}

export const VerticalNavRail: React.FC<VerticalNavRailProps> = ({
  currentView,
  setCurrentView,
  openDemoTour,
  openELALab
}) => {
  const { user, role, switchRole, lang, toggleLanguage, logout } = useAuth();
  const [showRoleModal, setShowRoleModal] = useState(false);

  const navItems = [
    {
      id: 'queue',
      label: 'Docket Queue',
      sublabel: 'Master-Detail Triage',
      icon: LayoutGrid,
      hotkey: 'Alt+1',
      matchViews: ['queue', 'dashboard']
    },
    {
      id: 'workbench',
      label: 'Scrutiny Workbench',
      sublabel: '4-Column Deep Forensics',
      icon: FileSearch,
      hotkey: 'Alt+2',
      matchViews: ['workbench']
    },
    {
      id: 'ai_agent',
      label: 'AI Verification Agent',
      sublabel: 'Gemini Tool-Calling Engine',
      icon: Sparkles,
      hotkey: 'Alt+A',
      matchViews: ['ai_agent']
    },
    ...(openELALab
      ? [
          {
            id: 'ela_lab',
            label: 'Live ELA Forensic Lab',
            sublabel: 'Upload & Test Custom Document',
            icon: Flame,
            hotkey: 'Alt+E',
            action: openELALab,
            matchViews: []
          }
        ]
      : []),
    {
      id: 'user_management',
      label: 'User & Role Management',
      sublabel: 'Authority Access Matrix',
      icon: UserCheck,
      hotkey: 'Alt+3',
      action: () => setShowRoleModal(true),
      matchViews: []
    },
    {
      id: 'audit',
      label: 'Compliance Ledger & Audit',
      sublabel: 'SHA-256 Hash Chain',
      icon: FileClock,
      hotkey: 'Alt+4',
      matchViews: ['audit']
    },
    {
      id: 'rules',
      label: 'Rule Studio & Settings',
      sublabel: 'APH 2026-27 Norm Engine',
      icon: Sliders,
      hotkey: 'Alt+5',
      matchViews: ['rules']
    }
  ];

  const roleLabels: Record<Role, { title: string; badge: string; color: string }> = {
    SCRUTINY_OFFICER: {
      title: 'Scrutiny Officer',
      badge: 'ID-4092 (Western Region)',
      color: 'text-blue-400 bg-blue-950/60 border-blue-800'
    },
    INSTITUTION_USER: {
      title: 'Institution Representative',
      badge: 'Trust Self-Audit Desk',
      color: 'text-amber-400 bg-amber-950/60 border-amber-800'
    },
    SENIOR_AUTHORITY: {
      title: 'Senior Statutory Authority',
      badge: 'Executive Review Panel',
      color: 'text-purple-400 bg-purple-950/60 border-purple-800'
    },
    ADMIN: {
      title: 'System Administrator',
      badge: 'Root Ledger Governance',
      color: 'text-rose-400 bg-rose-950/60 border-rose-800'
    }
  };

  return (
    <>
      <aside
        className="w-[54px] bg-[#0B0F17] border-r border-slate-800 flex flex-col items-center justify-between py-3 select-none z-50 shrink-0 h-full relative"
        aria-label="Primary Navigation Rail"
      >
        {/* Top Section: AICTE Gold Crest / Emblem */}
        <div className="flex flex-col items-center gap-4 w-full">
          <div
            onClick={() => setCurrentView('queue')}
            className="group relative cursor-pointer flex items-center justify-center"
            title="SatyaCheck • AICTE Trust Layer Console"
          >
            {/* AICTE Gold Crest / Emblem SVG */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#261E0B] to-[#120F05] border border-amber-500/50 flex items-center justify-center shadow-lg shadow-amber-950/40 hover:border-amber-400 transition-all hover:scale-105">
              <svg
                viewBox="0 0 48 48"
                className="w-7 h-7 text-amber-400 fill-current drop-shadow-[0_1px_3px_rgba(245,158,11,0.5)]"
              >
                {/* Outer ornamental medallion circle */}
                <circle
                  cx="24"
                  cy="24"
                  r="21"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                  strokeDasharray="2 1.5"
                  opacity="0.8"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="1"
                  opacity="0.6"
                />
                {/* National Ashoka Lion & Dharma Chakra Stylized Crest */}
                <path d="M24 8 L27 15 L32 15 L28 19 L30 25 L24 21 L18 25 L20 19 L16 15 L21 15 Z" fill="#FBBF24" />
                <circle cx="24" cy="30" r="5" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
                <path d="M24 27 L24 33 M21 30 L27 30 M22 28 L26 32 M22 32 L26 28" stroke="#F59E0B" strokeWidth="1" />
                <path d="M14 36 Q24 40 34 36 L34 38 Q24 42 14 38 Z" fill="#B45309" />
              </svg>
            </div>

            {/* Tooltip */}
            <div className="absolute left-full ml-3 top-1 px-2.5 py-1 bg-slate-900/95 text-amber-300 border border-amber-600/50 rounded-md text-[11px] font-mono whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl backdrop-blur-md">
              <div className="font-bold flex items-center gap-1.5">
                <span>AICTE Gold Crest</span>
                <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1 rounded">Trust Layer</span>
              </div>
              <p className="text-[10px] text-slate-300 font-sans">SatyaCheck • Docket Console</p>
            </div>
          </div>

          <div className="w-8 h-[1px] bg-slate-800" />

          {/* Primary Navigation Items */}
          <nav className="flex flex-col items-center gap-2 w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.matchViews.includes(currentView);

              return (
                <div key={item.id} className="relative group w-full flex items-center justify-center">
                  {/* Active Indicator Left Pill */}
                  {isActive && (
                    <div className="absolute left-0 w-1 h-6 bg-blue-500 rounded-r shadow-[0_0_8px_#3b82f6]" />
                  )}

                  <button
                    onClick={() => {
                      if (item.action) {
                        item.action();
                      } else {
                        setCurrentView(item.id);
                      }
                    }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/60 shadow-lg shadow-blue-500/20'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                    }`}
                    aria-label={item.label}
                  >
                    <Icon className="w-5 h-5" />
                  </button>

                  {/* Tooltip Hover */}
                  <div className="absolute left-full ml-3 top-1 px-2.5 py-1.5 bg-slate-900/95 text-slate-200 border border-slate-700/80 rounded-md text-[11px] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{item.label}</span>
                      <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {item.hotkey}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.sublabel}</p>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Help / Docs & Session Logout */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800">
          {/* Help / Docs */}
          <div className="relative group w-full flex items-center justify-center">
            <button
              onClick={openDemoTour}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-300 hover:bg-slate-800/80 transition-all"
              aria-label="Help & Guided Walkthrough"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <div className="absolute left-full ml-3 bottom-1 px-2.5 py-1.5 bg-slate-900/95 text-slate-200 border border-slate-700/80 rounded-md text-[11px] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-2xl backdrop-blur-md">
              <span className="font-semibold text-white">Interactive Guided Tour</span>
              <p className="text-[10px] text-slate-400 mt-0.5">3 Real-World Forensic Case Studies</p>
            </div>
          </div>

          {/* User Role Quick Indicator */}
          <div className="relative group w-full flex items-center justify-center">
            <button
              onClick={() => setShowRoleModal(true)}
              className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center hover:border-slate-500 transition-all font-mono text-[11px] font-bold"
              aria-label="Active Officer Profile"
            >
              AK
            </button>
            <div className="absolute left-full ml-3 bottom-1 px-2.5 py-1.5 bg-slate-900/95 text-slate-200 border border-slate-700/80 rounded-md text-[11px] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-2xl backdrop-blur-md">
              <span className="font-semibold text-white">Officer A. Kumar</span>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID-4092 • Click to Manage Roles</p>
            </div>
          </div>

          {/* Logout / Exit session */}
          <div className="relative group w-full flex items-center justify-center">
            <button
              onClick={logout}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-all"
              aria-label="Exit Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <div className="absolute left-full ml-3 bottom-1 px-2.5 py-1 bg-slate-900/95 text-rose-300 border border-rose-900/60 rounded-md text-[11px] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-2xl backdrop-blur-md">
              <span className="font-semibold">Exit / Switch Officer</span>
            </div>
          </div>
        </div>
      </aside>

      {/* User & Role Management Quick-Flyout Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">User & Role Management</h3>
                  <p className="text-[11px] text-slate-400">Statutory Scrutiny Access Control</p>
                </div>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Officer Details */}
            <div className="bg-[#070A11] p-3 rounded-xl border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Active Profile:</span>
                <span className="text-white font-bold">Officer A. Kumar (ID-4092)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Station:</span>
                <span className="text-slate-300">AICTE Western Regional Office (WRO)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Live State Gateways:</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Dharani & Bhoomi Synced
                </span>
              </div>
            </div>

            {/* Role Switcher Options */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Switch Active Operational Role:</label>
              {(Object.keys(roleLabels) as Role[]).map((r) => {
                const info = roleLabels[r];
                const isSelected = role === r;
                return (
                  <button
                    key={r}
                    onClick={async () => {
                      await switchRole(r);
                      setShowRoleModal(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between text-xs ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500/70 text-white'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/80'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>{info.title}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{info.badge}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${info.color}`}>
                      {r.replace('_', ' ')}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Language & Utilities */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">Language:</span>
                <button
                  onClick={toggleLanguage}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 font-mono text-[11px]"
                >
                  {lang === 'en' ? 'English (EN)' : 'हिन्दी (HI)'}
                </button>
              </div>

              <button
                onClick={() => setShowRoleModal(false)}
                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
