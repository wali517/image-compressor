import React, { useEffect, useRef, useState } from 'react';
import type { AppTab, CompressedFileItem } from '../types/compressor';
import { compressImage, formatBytes } from '../lib/compressor';
import { Download, Loader2 } from 'lucide-react';

interface ComparisonPanelProps {
  item: CompressedFileItem | null;
  mode: Exclude<AppTab, 'exif'>;
  onUpdateSettings: (id: string, newSettings: Partial<CompressedFileItem['settings']>) => void;
  onDownloadItem: (item: CompressedFileItem) => void;
  isProcessing: boolean;
}

const STEPS = [-10, -1, 1, 10];

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  item,
  mode,
  onUpdateSettings,
  onDownloadItem,
  isProcessing,
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [qualityInput, setQualityInput] = useState(80);
  const [colorsInput, setColorsInput] = useState(256);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const itemId = item?.id;
  const settings = item?.settings;
  const hasResult = Boolean(item?.compressedBlob);
  const usesColors = item?.format === 'png' || item?.format === 'gif';
  const appliedQuality = settings?.quality ?? 80;
  const appliedColors = settings?.maxColors ?? 256;
  const dirty = usesColors ? colorsInput !== appliedColors : qualityInput !== appliedQuality;

  useEffect(() => {
    setQualityInput(appliedQuality);
    setColorsInput(appliedColors);
    setEstimate(null);
  }, [itemId, appliedQuality, appliedColors]);

  useEffect(() => {
    setZoom(1);
    setSliderPosition(50);
  }, [itemId]);

  useEffect(() => {
    if (!item || mode !== 'compressor' || !dirty) {
      setEstimate(null);
      setIsEstimating(false);
      return;
    }
    let cancelled = false;
    setIsEstimating(true);
    const timer = setTimeout(async () => {
      try {
        const result = await compressImage(item.file, {
          ...item.settings,
          quality: qualityInput,
          maxColors: colorsInput,
        });
        if (!cancelled) setEstimate(result.isOptimizedOnly ? item.originalSize : result.blob.size);
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setIsEstimating(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, qualityInput, colorsInput, dirty, mode]);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(8, Math.max(1, Math.round((z + (e.deltaY < 0 ? 0.25 : -0.25)) * 100) / 100)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [itemId, hasResult]);

  if (!item || !item.compressedBlob) return null;

  const moveSlider = (clientX: number) => {
    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSliderPosition(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  };

  const adjust = (delta: number) => {
    if (usesColors) setColorsInput((v) => Math.min(256, Math.max(2, v + delta)));
    else setQualityInput((v) => Math.min(100, Math.max(5, v + delta)));
  };

  const savings = item.originalSize > 0 ? Math.round(((item.originalSize - item.compressedSize) / item.originalSize) * 100) : 0;
  const estimateSavings =
    estimate !== null && item.originalSize > 0 ? Math.round(((item.originalSize - estimate) / item.originalSize) * 100) : 0;
  const afterLabel = mode === 'converter' ? 'Converted' : 'Compressed';

  return (
    <section className="w-full max-w-[970px] mx-auto px-3 mb-10">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 font-sans">
        <h2 className="text-center text-base font-bold text-[#1f2933] break-all mb-3">{item.name}</h2>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-slate-700 mb-4 font-mono">
          <span>
            Before: <strong>{formatBytes(item.originalSize)}</strong>
            {item.originalWidth > 0 && ` (${item.originalWidth}×${item.originalHeight})`}
          </span>
          <span>
            After: <strong>{formatBytes(item.compressedSize)}</strong>
            {item.status === 'optimized' ? ' (already optimal)' : mode === 'compressor' ? ` (-${Math.max(0, savings)}%)` : ''}
          </span>
          {mode === 'compressor' && dirty && (
            <span className="text-[#2a73d9]">
              {isEstimating || estimate === null
                ? 'Estimating...'
                : `After Apply: ~${formatBytes(estimate)} (-${Math.max(0, estimateSavings)}%)`}
            </span>
          )}
        </div>

        <div
          ref={viewerRef}
          className="relative w-full h-[420px] rounded-lg border border-slate-200 overflow-hidden select-none touch-none cursor-ew-resize bg-[linear-gradient(45deg,#e8e8e8_25%,transparent_25%),linear-gradient(-45deg,#e8e8e8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e8e8e8_75%),linear-gradient(-45deg,transparent_75%,#e8e8e8_75%)] [background-size:20px_20px] [background-position:0_0,0_10px,10px_-10px,-10px_0px]"
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            moveSlider(e.clientX);
          }}
          onPointerMove={(e) => draggingRef.current && moveSlider(e.clientX)}
          onPointerUp={() => (draggingRef.current = false)}
        >
          <img
            src={item.originalUrl}
            alt="Original"
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ transform: `scale(${zoom})` }}
          />
          <img
            src={item.compressedUrl || item.originalUrl}
            alt={afterLabel}
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ transform: `scale(${zoom})`, clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
          />

          <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)]" style={{ left: `${sliderPosition}%` }}>
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-8 h-8 rounded-full bg-white border border-slate-300 shadow flex items-center justify-center text-slate-500 text-xs font-bold">
              ⇆
            </div>
          </div>

          <span className="absolute top-2 left-2 text-[11px] font-bold uppercase bg-black/60 text-white px-2 py-0.5 rounded">Original</span>
          <span className="absolute top-2 right-2 text-[11px] font-bold uppercase bg-black/60 text-white px-2 py-0.5 rounded">{afterLabel}</span>

          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setZoom(1)}
            className="absolute bottom-2 right-2 text-[11px] font-bold bg-black/60 text-white px-2 py-0.5 rounded"
            title="Scroll to zoom, click to reset"
          >
            {Math.round(zoom * 100)}%
          </button>

          {isProcessing && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#38404B]" />
            </div>
          )}
        </div>
        <p className="text-center text-xs text-slate-500 mt-2">Drag to compare. Scroll to zoom.</p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          {mode === 'compressor' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-slate-600 w-14">{usesColors ? 'Colors' : 'Quality'}</span>
                {STEPS.slice(0, 2).map((step) => (
                  <button
                    key={step}
                    onClick={() => adjust(step)}
                    className="h-8 px-2 text-xs font-bold border border-slate-300 rounded hover:bg-slate-100"
                  >
                    {step}
                  </button>
                ))}
                <input
                  type="range"
                  min={usesColors ? 2 : 5}
                  max={usesColors ? 256 : 100}
                  value={usesColors ? colorsInput : qualityInput}
                  onChange={(e) => (usesColors ? setColorsInput(Number(e.target.value)) : setQualityInput(Number(e.target.value)))}
                  className="w-40 accent-[#38404B]"
                />
                {STEPS.slice(2).map((step) => (
                  <button
                    key={step}
                    onClick={() => adjust(step)}
                    className="h-8 px-2 text-xs font-bold border border-slate-300 rounded hover:bg-slate-100"
                  >
                    +{step}
                  </button>
                ))}
                <span className="text-sm font-mono font-bold text-slate-800 w-12 text-right">
                  {usesColors ? colorsInput : `${qualityInput}%`}
                </span>
              </div>

              <button
                onClick={() => onUpdateSettings(item.id, { quality: qualityInput, maxColors: colorsInput })}
                disabled={!dirty || isProcessing}
                className="h-9 px-5 text-xs font-semibold uppercase rounded-md bg-[#38404B] hover:bg-[#2c323b] text-white disabled:opacity-40"
              >
                Apply
              </button>
            </>
          )}

          <button
            onClick={() => onDownloadItem(item)}
            className="h-9 px-5 text-xs font-semibold uppercase rounded-md bg-[#1a7030] hover:bg-[#135424] text-white inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </section>
  );
};
