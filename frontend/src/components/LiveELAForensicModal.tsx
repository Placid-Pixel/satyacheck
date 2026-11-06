import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  X,
  Flame,
  FileText,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  Info,
  Maximize2,
  Layers,
  ArrowRight
} from 'lucide-react';

interface LiveELAForensicModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveELAForensicModal: React.FC<LiveELAForensicModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [quality, setQuality] = useState<number>(90); // 70 to 95
  const [scaleFactor, setScaleFactor] = useState<number>(18); // 5 to 35
  const [sliderPos, setSliderPos] = useState<number>(50); // Split view 0 to 100
  const [viewMode, setViewMode] = useState<'SPLIT' | 'SIDE_BY_SIDE'>('SIDE_BY_SIDE');

  // Forensic metrics
  const [metrics, setMetrics] = useState<{
    anomalyScore: number;
    meanError: number;
    maxError: number;
    tamperingSuspected: boolean;
    pixelDiscontinuities: number;
  } | null>(null);

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const elaCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Standard JET Colormap Interpolation
  const applyJetColormap = (val: number): [number, number, number] => {
    const v = val / 255.0;
    const r = Math.max(0, Math.min(1, 1.5 - Math.abs(v * 4.0 - 3.0))) * 255;
    const g = Math.max(0, Math.min(1, 1.5 - Math.abs(v * 4.0 - 2.0))) * 255;
    const b = Math.max(0, Math.min(1, 1.5 - Math.abs(v * 4.0 - 1.0))) * 255;
    return [Math.round(r), Math.round(g), Math.round(b)];
  };

  // Perform Error Level Analysis on the loaded image
  const executeELA = (imgElement: HTMLImageElement, qVal: number, scaleVal: number) => {
    setIsProcessing(true);

    try {
      const width = imgElement.naturalWidth || imgElement.width || 600;
      const height = imgElement.naturalHeight || imgElement.height || 400;

      // 1. Draw Original onto hidden canvas
      const origCanvas = document.createElement('canvas');
      origCanvas.width = width;
      origCanvas.height = height;
      const origCtx = origCanvas.getContext('2d');
      if (!origCtx) return;
      origCtx.drawImage(imgElement, 0, 0, width, height);
      const origData = origCtx.getImageData(0, 0, width, height);

      // 2. Resave as JPEG at specified quality
      const resavedDataUrl = origCanvas.toDataURL('image/jpeg', qVal / 100.0);
      const resavedImg = new Image();

      resavedImg.onload = () => {
        // Draw Resaved onto second canvas
        const resavedCanvas = document.createElement('canvas');
        resavedCanvas.width = width;
        resavedCanvas.height = height;
        const resavedCtx = resavedCanvas.getContext('2d');
        if (!resavedCtx) return;
        resavedCtx.drawImage(resavedImg, 0, 0, width, height);
        const resavedData = resavedCtx.getImageData(0, 0, width, height);

        // 3. Compute absolute difference matrix
        const elaCanvas = elaCanvasRef.current;
        if (!elaCanvas) return;
        elaCanvas.width = width;
        elaCanvas.height = height;
        const elaCtx = elaCanvas.getContext('2d');
        if (!elaCtx) return;

        const elaOutput = elaCtx.createImageData(width, height);
        const len = origData.data.length;

        let totalDiff = 0;
        let maxDiff = 0;
        let highDiscontinuities = 0;

        for (let i = 0; i < len; i += 4) {
          const diffR = Math.abs(origData.data[i] - resavedData.data[i]);
          const diffG = Math.abs(origData.data[i + 1] - resavedData.data[i + 1]);
          const diffB = Math.abs(origData.data[i + 2] - resavedData.data[i + 2]);

          // Luminance difference
          const gray = 0.299 * diffR + 0.587 * diffG + 0.114 * diffB;
          totalDiff += gray;
          if (gray > maxDiff) maxDiff = gray;

          const scaled = Math.min(255, gray * scaleVal);
          if (scaled > 160) highDiscontinuities++;

          // Apply JET Forensic False-Color Map
          const [jr, jg, jb] = applyJetColormap(scaled);
          elaOutput.data[i] = jr;
          elaOutput.data[i + 1] = jg;
          elaOutput.data[i + 2] = jb;
          elaOutput.data[i + 3] = 255;
        }

        elaCtx.putImageData(elaOutput, 0, 0);

        // Draw original to preview canvas
        const origPreviewCanvas = originalCanvasRef.current;
        if (origPreviewCanvas) {
          origPreviewCanvas.width = width;
          origPreviewCanvas.height = height;
          const ctx = origPreviewCanvas.getContext('2d');
          ctx?.drawImage(imgElement, 0, 0, width, height);
        }

        const numPixels = width * height;
        const meanErr = totalDiff / numPixels;
        const anomaly = Math.min(1.0, meanErr / 18.0 + (highDiscontinuities / numPixels) * 4.0);

        setMetrics({
          anomalyScore: Math.round(anomaly * 100) / 100,
          meanError: Math.round(meanErr * 100) / 100,
          maxError: Math.round(maxDiff * 100) / 100,
          tamperingSuspected: anomaly > 0.42 || maxDiff > 180,
          pixelDiscontinuities: highDiscontinuities
        });

        setIsProcessing(false);
      };

      resavedImg.src = resavedDataUrl;
    } catch (err) {
      console.error('ELA computation failed:', err);
      setIsProcessing(false);
    }
  };

  // Re-run whenever image, quality or scale factor changes
  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.onload = () => executeELA(img, quality, scaleFactor);
      img.src = imageSrc;
    }
  }, [imageSrc, quality, scaleFactor]);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (selectedFile: File) => {
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setFileSize(`${(selectedFile.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageSrc(event.target.result as string);
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  // Load sample synthetic deed with spliced survey number
  const loadPresetSample = (type: 'spliced_deed' | 'forged_stamp' | 'clean_gazette') => {
    // Generate an illustrative canvas sample representing deed parchment with spliced text
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (type === 'spliced_deed') {
      // Warm parchment background
      ctx.fillStyle = '#f7f2e4';
      ctx.fillRect(0, 0, 640, 420);

      // Title & Border
      ctx.strokeStyle = '#5a4632';
      ctx.lineWidth = 3;
      ctx.strokeRect(15, 15, 610, 390);

      ctx.fillStyle = '#2d2113';
      ctx.font = 'bold 16px serif';
      ctx.textAlign = 'center';
      ctx.fillText('GOVERNMENT OF GUJARAT • REVENUE DEPARTMENT', 320, 50);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('REGISTERED LAND CONVEYANCE TITLE DEED #40002018040', 320, 75);

      ctx.textAlign = 'left';
      ctx.font = '12px serif';
      ctx.fillText('This indenture certifies the campus boundaries allocated to the educational trust.', 40, 120);
      ctx.fillText('Sub-Registrar Taluka confirms freehold status under Gujarat Land Revenue Code.', 40, 145);

      // Spliced block: Survey No 402/A (artificially re-saved with high JPEG noise)
      ctx.fillStyle = '#ede5d0';
      ctx.fillRect(40, 175, 420, 45);
      ctx.strokeStyle = '#c5b593';
      ctx.strokeRect(40, 175, 420, 45);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('Survey Plot: [Survey No: 402/A] • Area: 3.13 Acres', 55, 204);

      // Red spliced bounding marker
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.strokeRect(155, 185, 160, 28);

      // Seal & Signature
      ctx.fillStyle = '#372a72';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('SEAL: SUB-REGISTRAR TALUKA', 80, 340);
      ctx.fillStyle = '#1e3a8a';
      ctx.font = 'italic bold 15px serif';
      ctx.fillText('Ambrish Patel (Magistrate)', 420, 340);

      setFileName('AICTE_Deed_Survey402A_Spliced.jpg');
      setFileSize('142.4 KB');
    } else if (type === 'forged_stamp') {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 640, 420);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FIRE & EMERGENCY SERVICES CLEARANCE NOC', 320, 50);

      ctx.textAlign = 'left';
      ctx.font = '12px sans-serif';
      ctx.fillText('Institutional building inspection certified for educational use.', 40, 110);
      ctx.fillText('Validity: Valid strictly up to 30/06/2026.', 40, 140);

      // Overlaid digital seal
      ctx.beginPath();
      ctx.arc(320, 240, 50, 0, Math.PI * 2);
      ctx.fillStyle = '#991b1b';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('APPROVED NOC', 320, 242);

      setFileName('State_Fire_NOC_PastedSeal.jpg');
      setFileSize('98.2 KB');
    } else {
      // Clean document with uniform noise
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 640, 420);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 15px serif';
      ctx.textAlign = 'center';
      ctx.fillText('UNIVERSITY ACADEMIC AFFILIATION ORDER 2026-27', 320, 50);
      ctx.font = '12px serif';
      ctx.fillText('Continuous affiliation granted in accordance with AICTE approval norms.', 320, 80);

      setFileName('University_Affiliation_Clean_2026.png');
      setFileSize('64.0 KB');
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setImageSrc(dataUrl);
  };

  // Load sample on initial open
  useEffect(() => {
    if (isOpen && !imageSrc) {
      loadPresetSample('spliced_deed');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header Bar */}
        <div className="h-14 px-5 border-b border-slate-800 bg-[#0E131F] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Document Forensic Lab • Error Level Analysis (ELA)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800">
                  LIVE QUANTIZATION ENGINE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Upload any PDF scan or JPEG image to detect compression variances and spliced text
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close Forensic Lab"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Upload Button, Sample Presets, Tuning Sliders */}
        <div className="px-5 py-2.5 bg-[#070A11] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* File Upload Dropzone Trigger */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Custom Document (Image / PDF)</span>
            </button>

            {/* Presets */}
            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400 pl-2 border-l border-slate-800">
              <span className="hidden sm:inline">Presets:</span>
              <button
                onClick={() => loadPresetSample('spliced_deed')}
                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-rose-300 border border-rose-900/40"
              >
                Spliced Land Deed
              </button>
              <button
                onClick={() => loadPresetSample('forged_stamp')}
                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-amber-300 border border-amber-900/40"
              >
                Pasted Fire Seal
              </button>
              <button
                onClick={() => loadPresetSample('clean_gazette')}
                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-emerald-300 border border-emerald-900/40"
              >
                Clean Affiliation
              </button>
            </div>
          </div>

          {/* Interactive Tuning Sliders */}
          <div className="flex items-center gap-4 flex-wrap font-mono text-[11px]">
            {/* JPEG Recompression Quality */}
            <div className="flex items-center gap-1.5 bg-[#0B0F17] px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-400">Quality:</span>
              <input
                type="range"
                min="70"
                max="98"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-16 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-blue-500"
              />
              <span className="font-bold text-blue-400 w-8">{quality}%</span>
            </div>

            {/* Magnification Multiplier */}
            <div className="flex items-center gap-1.5 bg-[#0B0F17] px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-400">Scale:</span>
              <input
                type="range"
                min="5"
                max="35"
                value={scaleFactor}
                onChange={(e) => setScaleFactor(Number(e.target.value))}
                className="w-16 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="font-bold text-cyan-400 w-8">{scaleFactor}x</span>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#0B0F17] p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode('SIDE_BY_SIDE')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  viewMode === 'SIDE_BY_SIDE' ? 'bg-slate-800 text-white' : 'text-slate-400'
                }`}
              >
                Side-by-Side
              </button>
              <button
                onClick={() => setViewMode('SPLIT')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  viewMode === 'SPLIT' ? 'bg-slate-800 text-white' : 'text-slate-400'
                }`}
              >
                Split Wipe
              </button>
            </div>
          </div>
        </div>

        {/* Main Work Area: Dual Canvas Display */}
        <div className="flex-1 overflow-hidden p-4 bg-[#050811] flex flex-col gap-3 min-h-0">
          {viewMode === 'SIDE_BY_SIDE' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-0">
              {/* Left Canvas: Original Document */}
              <div className="bg-[#0B0F19] rounded-xl border border-slate-800 flex flex-col overflow-hidden shadow-xl">
                <div className="p-2.5 border-b border-slate-800 bg-[#0E1422] flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>ORIGINAL UPLOADED DOCUMENT</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {fileName} ({fileSize})
                  </span>
                </div>
                <div className="flex-1 relative overflow-auto p-3 flex items-center justify-center bg-[#070A12]">
                  <canvas
                    ref={originalCanvasRef}
                    className="max-h-full max-w-full rounded shadow-lg object-contain border border-slate-800"
                  />
                </div>
              </div>

              {/* Right Canvas: Real-Time ELA Forensic Heatmap */}
              <div className="bg-[#0B0F19] rounded-xl border border-slate-800 flex flex-col overflow-hidden shadow-xl">
                <div className="p-2.5 border-b border-slate-800 bg-[#0E1422] flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ERROR LEVEL ANALYSIS (ELA) HEATMAP</span>
                  </span>
                  <span className="text-[10px] text-yellow-300 font-bold bg-yellow-950/60 px-1.5 py-0.5 rounded border border-yellow-800/80">
                    JET COLORMAP • Q-{quality}
                  </span>
                </div>
                <div className="flex-1 relative overflow-auto p-3 flex items-center justify-center bg-[#040714]">
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-10 font-mono text-xs text-cyan-300">
                      Computing JPEG Quantization Difference...
                    </div>
                  )}
                  <canvas
                    ref={elaCanvasRef}
                    className="max-h-full max-w-full rounded shadow-lg object-contain border border-blue-900/40"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Split Wipe View */
            <div className="h-full bg-[#0B0F19] rounded-xl border border-slate-800 flex flex-col overflow-hidden shadow-xl">
              <div className="p-2.5 border-b border-slate-800 bg-[#0E1422] flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-slate-200">
                  SPLIT LENS COMPARISON — Move slider below to reveal ELA compression difference
                </span>
                <span className="text-[10px] text-slate-400">{sliderPos}% Split</span>
              </div>

              <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#040714]">
                <div className="relative max-h-full max-w-full">
                  <canvas
                    ref={originalCanvasRef}
                    className="max-h-[60vh] max-w-full rounded object-contain"
                  />
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
                  >
                    <canvas
                      ref={elaCanvasRef}
                      className="max-h-[60vh] max-w-full rounded object-contain"
                    />
                  </div>
                </div>
              </div>

              <div className="p-2 bg-[#0A0E1A] border-t border-slate-800 flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-400">ORIGINAL</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPos}
                  onChange={(e) => setSliderPos(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-700 rounded appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[10px] font-mono text-cyan-400">ELA HEATMAP</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Forensic Telemetry & Finding Determination */}
        <div className="h-20 px-5 border-t border-slate-800 bg-[#0B0F17] flex items-center justify-between shrink-0 font-mono text-xs">
          {metrics ? (
            <div className="flex items-center gap-6 flex-wrap">
              {/* Verdict Banner */}
              <div
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 font-bold ${
                  metrics.tamperingSuspected
                    ? 'bg-rose-950/70 border-rose-800 text-rose-300'
                    : 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                }`}
              >
                {metrics.tamperingSuspected ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>TAMPERING DETECTED: Spliced Compression Discontinuity</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>HOMOGENEOUS COMPRESSION: Uniform Sensor Baseline</span>
                  </>
                )}
              </div>

              {/* Forensic Metrics */}
              <div className="flex items-center gap-4 text-slate-300 text-[11px]">
                <div>
                  <span className="text-slate-500">Anomaly Index: </span>
                  <span className={metrics.anomalyScore > 0.4 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {(metrics.anomalyScore * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Mean ΔE: </span>
                  <span className="font-bold text-white">{metrics.meanError}</span>
                </div>
                <div>
                  <span className="text-slate-500">Peak Spike: </span>
                  <span className="font-bold text-yellow-300">{metrics.maxError} / 255</span>
                </div>
                <div className="hidden sm:inline">
                  <span className="text-slate-500">High-Freq Spikes: </span>
                  <span className="font-bold text-cyan-300">{metrics.pixelDiscontinuities.toLocaleString()} px</span>
                </div>
              </div>
            </div>
          ) : (
            <span className="text-slate-400">Upload or select a sample document to inspect...</span>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const canvas = elaCanvasRef.current;
                if (!canvas) return;
                const link = document.createElement('a');
                link.download = `ELA_Heatmap_${fileName || 'analysis'}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Heatmap</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
