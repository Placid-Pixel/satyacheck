import React, { useState } from 'react';
import { Compass, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api';

interface DemoTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectApplication: (appId: number) => void;
}

export const DemoTourModal: React.FC<DemoTourModalProps> = ({ isOpen, onClose, onSelectApplication }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  if (!isOpen) return null;

  const stories = [
    {
      title: "Story 1: The Clean Approval Flow",
      college: "Aryabhatta Institute of Technology & Sciences (Bengaluru)",
      applicationNumber: "AICTE-APP-2026-001",
      badge: "Clean Pass (Risk: 4.2)",
      badgeColor: "bg-emerald-100 text-emerald-800",
      description: "Demonstrates an authentic, compliant application. All documents (Fire NOC, Land Deed, NAAC Accreditation) are 100% verified against authority portals. Cross-document survey numbers match (Survey 45/2B), and no deficiencies are found.",
      highlights: [
        "Genuine digital signatures and QR code verification passed",
        "Faculty-student ratio compliant (1:10 vs 1:15 mandate)",
        "Zero anomaly alerts across ELA, copy-move and metadata detectors"
      ]
    },
    {
      title: "Story 2: Expired NOC, Mismatched Survey & Reused Certificate",
      college: "Vidya Valley Engineering College (Pune)",
      applicationNumber: "AICTE-APP-2026-002",
      badge: "High Risk (Risk: 78.5)",
      badgeColor: "bg-orange-100 text-orange-800",
      description: "Demonstrates automated cross-checking and deduplication. Flags an expired Fire NOC (expired Nov 2024), catches a survey number discrepancy (Survey 210/1 declared vs Survey 98/4 on title deed), and catches an NBA certificate reused from Aryabhatta Institute!",
      highlights: [
        "Perceptual hash detector flags cross-institute certificate duplication",
        "Authority adapter detects expired Fire NOC record in state registry",
        "Knowledge graph visually highlights the parcel mismatch in red"
      ]
    },
    {
      title: "Story 3: Altered PDF Metadata, Weak Vision & Authority Timeout",
      college: "Sunrise Technical Campus (Nagpur)",
      applicationNumber: "AICTE-APP-2026-003",
      badge: "Critical Risk (Risk: 89.2)",
      badgeColor: "bg-rose-100 text-rose-800",
      description: "Demonstrates forensic anomaly detection, CV infrastructure checks, and resilient authority fallback. ELA highlights compression anomalies, QR code decodes to a different college, lab photo is blurry and GPS resolves 142km away, and state fire authority times out (504) triggering automatic manual review routing.",
      highlights: [
        "Error Level Analysis (ELA) heatmap reveals tampered dates",
        "YOLO/Vision checks flag underexposed photo and only 8 computers for 360 intake",
        "Resilient state machine routes timeout to officer with exponential backoff"
      ]
    }
  ];

  const story = stories[currentStep];

  const openStoryApplication = async () => {
    setOpening(true);
    setOpenError(null);
    try {
      const match = await api.findApplicationByNumber(story.applicationNumber);
      if (!match) {
        setOpenError(
          `Could not find ${story.applicationNumber}. Start the backend and run python backend/scripts/seed_demo_data.py, then try again.`
        );
        return;
      }
      onSelectApplication(match.id);
      onClose();
    } catch (err: any) {
      setOpenError(
        `Unable to reach backend at ${api.getBaseUrl()}. Please ensure the FastAPI server is running or configure the backend URL in Connection Settings.`
      );
      console.error('DemoTourModal API Error:', err);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-8 shadow-2xl space-y-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">SatyaCheck Demo Tour</h3>
              <p className="text-[11px] text-slate-400">Step {currentStep + 1} of {stories.length}: 3 Guided Regulatory Scenarios</p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
            ✕
          </button>
        </div>

        {/* Story Content */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${story.badgeColor}`}>
              {story.badge}
            </span>
            <span className="text-xs font-bold text-slate-500">Demo Scenario {currentStep + 1}</span>
          </div>

          <h4 className="text-lg font-bold text-slate-900 dark:text-white">{story.title}</h4>
          <p className="text-xs font-semibold text-emerald-600">{story.college}</p>
          <p className="text-[11px] font-mono text-slate-400">{story.applicationNumber}</p>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            {story.description}
          </p>

          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Key AI Capabilities Showcased:</span>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              {story.highlights.map((h, i) => (
                <li key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex gap-2">
            <button
              disabled={currentStep === 0}
              onClick={() => {
                setOpenError(null);
                setCurrentStep(currentStep - 1);
              }}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={currentStep === stories.length - 1}
              onClick={() => {
                setOpenError(null);
                setCurrentStep(currentStep + 1);
              }}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col items-end gap-2">
              {openError && (
                <p className="text-[11px] text-rose-600 font-medium max-w-sm text-right">{openError}</p>
              )}
              <button
                onClick={openStoryApplication}
                disabled={opening}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-60"
              >
                <span>{opening ? 'Opening…' : 'Inspect This Application'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
