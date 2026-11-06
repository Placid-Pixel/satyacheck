import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { VerticalNavRail } from './components/VerticalNavRail';
import { DocketConsoleView } from './components/DocketConsoleView';
import { RegulatoryWorkbench } from './components/RegulatoryWorkbench';
import { ApplicationDetailView } from './components/ApplicationDetailView';
import { AuditTrailView } from './components/AuditTrailView';
import { RuleStudioView } from './components/RuleStudioView';
import { SelfCheckView } from './components/SelfCheckView';
import { EvaluationView } from './components/EvaluationView';
import { SafeguardsView } from './components/SafeguardsView';
import { DemoTourModal } from './components/DemoTourModal';
import { LiveELAForensicModal } from './components/LiveELAForensicModal';
import { AIVerificationAgentView } from './components/AIVerificationAgentView';

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('ai_agent');
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [selectedAppNumber, setSelectedAppNumber] = useState<string>('AICTE-APP-2026-105');
  const [isDemoTourOpen, setIsDemoTourOpen] = useState<boolean>(false);
  const [isELALabOpen, setIsELALabOpen] = useState<boolean>(false);

  const handleSelectApplication = (appId: number) => {
    setSelectedAppId(appId);
    setCurrentView('detail');
  };

  const handleOpenWorkbench = (appIdentifier: string | number) => {
    setSelectedAppNumber(String(appIdentifier));
    if (typeof appIdentifier === 'number') {
      setSelectedAppId(appIdentifier);
    } else {
      const numeric = parseInt(appIdentifier.replace(/\D/g, ''), 10);
      if (numeric) setSelectedAppId(numeric);
    }
    setCurrentView('workbench');
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0B0F17] text-slate-100 flex font-sans antialiased">
      {/* 1. Vertical Icon Navigation Rail (Far Left Viewport) */}
      <VerticalNavRail
        currentView={currentView}
        setCurrentView={(view) => {
          setCurrentView(view);
          if (view !== 'detail') setSelectedAppId(null);
        }}
        openDemoTour={() => setIsDemoTourOpen(true)}
        openELALab={() => setIsELALabOpen(true)}
      />

      {/* Main Content Workstation Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#0B0F17] relative">
        {/* Primary View: Master-Detail Docket Console */}
        {(currentView === 'queue' || currentView === 'dashboard') && (
          <DocketConsoleView
            onOpenWorkbench={handleOpenWorkbench}
            onSelectApplication={handleSelectApplication}
          />
        )}

        {/* Scrutiny Support Workbench (4-Column Layout) */}
        {currentView === 'workbench' && (
          <div className="flex-1 h-full overflow-y-auto">
            <RegulatoryWorkbench
              onBack={() => setCurrentView('queue')}
            />
          </div>
        )}

        {/* SatyaCheck AI Verification Agent Dashboard (Primary Home View) */}
        {currentView === 'ai_agent' && (
          <div className="flex-1 h-full overflow-hidden flex flex-col">
            <AIVerificationAgentView
              initialAppId={selectedAppId}
              onSelectApplication={handleSelectApplication}
              onOpenWorkbench={handleOpenWorkbench}
              onOpenELALab={() => setIsELALabOpen(true)}
            />
          </div>
        )}

        {/* Compliance Ledger & Tamper-Evident Audit Trail */}
        {currentView === 'audit' && (
          <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full">
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => setCurrentView('queue')}
                className="text-xs font-mono text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 border border-slate-700"
              >
                ← Return to Docket Console
              </button>
              <span className="text-xs font-mono text-slate-400">
                AICTE SHA-256 Ledger
              </span>
            </div>
            <AuditTrailView />
          </div>
        )}

        {/* Rule Studio & Settings */}
        {currentView === 'rules' && (
          <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full">
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => setCurrentView('queue')}
                className="text-xs font-mono text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 border border-slate-700"
              >
                ← Return to Docket Console
              </button>
              <span className="text-xs font-mono text-slate-400">
                AICTE APH 2026-27 Rule Studio
              </span>
            </div>
            <RuleStudioView />
          </div>
        )}

        {/* Deep Application Detail View */}
        {currentView === 'detail' && selectedAppId && (
          <div className="flex-1 h-full overflow-y-auto p-2 sm:p-4 max-w-[1920px] mx-auto w-full">
            <ApplicationDetailView
              applicationId={selectedAppId}
              onBack={() => {
                setSelectedAppId(null);
                setCurrentView('queue');
              }}
            />
          </div>
        )}

        {/* Institution Self-Check View */}
        {currentView === 'selfCheck' && (
          <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full">
            <SelfCheckView />
          </div>
        )}

        {/* Evaluation & Metrics View */}
        {currentView === 'evaluation' && (
          <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full">
            <EvaluationView />
          </div>
        )}

        {/* Data Safeguards View */}
        {currentView === 'safeguards' && (
          <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full">
            <SafeguardsView />
          </div>
        )}
      </div>

      {/* Scripted Guided Demo Tour */}
      <DemoTourModal
        isOpen={isDemoTourOpen}
        onClose={() => setIsDemoTourOpen(false)}
        onSelectApplication={handleSelectApplication}
      />

      {/* Live ELA Document Forensic Lab Modal */}
      <LiveELAForensicModal
        isOpen={isELALabOpen}
        onClose={() => setIsELALabOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
