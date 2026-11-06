import React, { useState } from 'react';
import { Application, DocumentRecord } from '../types';
import { api } from '../api';
import {
  Camera, CheckCircle2, AlertTriangle, MapPin, Eye,
  Maximize2, Scan, Monitor, Users, ShieldAlert
} from 'lucide-react';

interface InfrastructureHubProps {
  application: Application;
}

export const InfrastructureHub: React.FC<InfrastructureHubProps> = ({ application }) => {
  const infraDocs = application.documents?.filter(
    d => d.doc_type === 'INFRA_PHOTO' || d.file_name.endsWith('.jpg') || d.file_name.endsWith('.png')
  ) || [];

  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord>(infraDocs[0] || application.documents?.[0]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const runAnalysis = async (docId: number) => {
    try {
      setAnalyzing(true);
      const res = await api.analyzeInfraPhoto(docId);
      setAnalysisResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const isHero3 = application.application_number.includes('003');

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-600" />
            <span>Infrastructure & Facility Computer Vision Verification</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            YOLO object counting, Laplacian blur/lighting checks, and EXIF GPS campus boundary geofencing.
          </p>
        </div>

        <button
          onClick={() => selectedDoc && runAnalysis(selectedDoc.id)}
          disabled={analyzing || !selectedDoc}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
        >
          <Scan className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          <span>{analyzing ? 'Analyzing Image...' : 'Run Vision Inspection'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Image Canvas & Detection Bounding Boxes */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
              Laboratory Visual Evidence: {selectedDoc?.file_name || 'Classroom_Lab_Evidence.jpg'}
            </span>
            {isHero3 ? (
              <span className="bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                Deficient Quality Detected
              </span>
            ) : (
              <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                Compliant Quality
              </span>
            )}
          </div>

          {/* Visual Simulated Classroom Photo */}
          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
            {isHero3 ? (
              /* Simulated Blurry and Dark Lab */
              <div className="w-full h-full bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center space-y-3 filter blur-[1px]">
                <div className="w-24 h-16 bg-slate-800 rounded border border-slate-700 opacity-40" />
                <div className="space-y-1">
                  <p className="text-xs font-mono font-bold text-rose-400">Underexposed & High Blur Variance</p>
                  <p className="text-[11px] text-slate-400">Computer Programming Lab 2 (Under-lit, Motion Blur)</p>
                </div>
              </div>
            ) : (
              /* High quality lab */
              <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="grid grid-cols-4 gap-4 w-4/5">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="p-3 bg-slate-800/80 rounded border border-emerald-500/40 relative">
                      <div className="w-8 h-6 bg-slate-700 mx-auto rounded" />
                      <span className="text-[9px] font-mono text-emerald-400 block mt-1">Terminal #{i + 1}</span>
                    </div>
                  ))}
                </div>
                <span className="text-xs text-slate-400">Computer Science Cloud Lab (30 High-Spec Terminals Verified)</span>
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Computer Vision Telemetry Breakdown */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card 1: Object Counting */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-emerald-600" />
              <span>YOLO & Contour Object Inventory</span>
            </h3>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Computers</span>
                <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {isHero3 ? 8 : 30}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Desks</span>
                <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {isHero3 ? 12 : 30}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Capacity</span>
                <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {isHero3 ? 12 : 60}
                </span>
              </div>
            </div>

            {isHero3 && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-800 dark:text-rose-300">
                <strong>Deficiency Detected:</strong> Only 8 functional PC terminals detected against requested 360 intake expansion (Mandated: &gt;= 120 terminals).
              </div>
            )}
          </div>

          {/* Card 2: Image Quality Telemetry */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200">Optical Quality Telemetry</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Laplacian Blur Variance:</span>
                <span className={`font-mono font-bold ${isHero3 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {isHero3 ? '22.4 (Threshold >= 45.0)' : '118.6 (Pass)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Mean Scene Brightness:</span>
                <span className={`font-mono font-bold ${isHero3 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {isHero3 ? '35.1 / 255 (Dark)' : '142.0 / 255 (Pass)'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: EXIF Geofence */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Campus Geofence Boundary Check</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Declared Campus GPS:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {application.institution?.latitude?.toFixed(4)}, {application.institution?.longitude?.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Distance to Photo Location:</span>
                <span className={`font-mono font-bold ${isHero3 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {isHero3 ? '142.5 km (OUTSIDE BOUNDS)' : '22.4 m (Within 300m Campus)'}
                </span>
              </div>
            </div>

            {isHero3 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg text-xs text-amber-800 dark:text-amber-300 font-medium">
                Photo EXIF GPS resolves 142km away from the declared Nagpur campus. Advisory recommendation: <strong>Recommend Physical / Virtual Spot Inspection</strong>.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
