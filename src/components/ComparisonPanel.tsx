import React, { useEffect, useRef, useState } from 'react';
import type { CompressedFileItem } from '../types/compressor';
import { compressImage, formatBytes } from '../lib/compressor';
import { Loader2 } from 'lucide-react';

interface ComparisonPanelProps {
  item: CompressedFileItem | null;
  onUpdateSettings: (id: string, newSettings: Partial<CompressedFileItem['settings']>) => void;
  isProcessing: boolean;
}

const STEPS = [-10, -1, 1, 10];

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({ item, onUpdateSettings, isProcessing }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [qualityDraft, setQualityDraft] = useState<number | null>(null);
  const [colorsDraft, setColorsDraft] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const itemId = item?.id;
  const hasResult = Boolean(item?.compressedBlob);
  const usesColors = item?.format === 'png' || item?.format === 'gif';
  const appliedQuality = item?.settings.quality ?? 80;
  const appliedColors = item?.settings.maxColors ?? 256;
  const qualityInput = qualityDraft ?? appliedQuality;
  const colorsInput = colorsDraft ?? appliedColors;
  const dirty = usesColors ? colorsInput !== appliedColors : qualityInput !== appliedQuality;

  useEffect(() => {
    setQualityDraft(null);
    setColorsDraft(null);
    setEstimate(null);
  }, [itemId, appliedQuality, appliedColors]);

  useEffect(() => {
    setZoom(1);
    setSliderPosition(50);
  }, [itemId]);

  useEffect(() => {
    if (!item || !dirty) {
      setEstimate(null);
      setIsEstimating(false);
      return;
    }
    let cancelled = false;
    setIsEstimating(true);
    const timer = setTimeout(async () => {
      try {
        const result = await compressImage(item.file, { ...item.settings, quality: qualityInput, maxColors: colorsInput });
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
  }, [itemId, qualityInput, colorsInput, dirty]);

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

  const min = usesColors ? 2 : 5;
  const max = usesColors ? 256 : 100;
  const value = usesColors ? colorsInput : qualityInput;
  const setValue = (next: number) => {
    const clamped = Math.min(max, Math.max(min, Math.round(next)));
    if (usesColors) setColorsDraft(clamped);
    else setQualityDraft(clamped);
  };

  const moveSlider = (clientX: number) => {
    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSliderPosition(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  };

  const percent = (size: number) =>
    item.originalSize > 0 ? Math.round(((item.originalSize - size) / item.originalSize) * 100) : 0;

  return (
    <section className="w-full max-w-[970px] mx-auto px-3 mb-10">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm font-sans overflow-hidden">
        <h2 className="text-center text-lg font-bold text-black px-4 py-3 border-b border-slate-100 break-all">
          {item.name}
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-1 py-3 text-sm text-slate-800">
          <span>
            Before: <strong className="text-black">{formatBytes(item.originalSize)}</strong>
          </span>
          <span>
            After:{' '}
            <strong className="text-[#2e7d32]">
              {formatBytes(item.compressedSize)}
              {item.status === 'optimized' ? ' (already optimal)' : ` (-${Math.max(0, percent(item.compressedSize))}%)`}
            </strong>
          </span>
          {dirty && (
            <span className="text-[#2a73d9] font-semibold">
              {isEstimating || estimate === null
                ? 'Estimating...'
                : `After Apply: ~${formatBytes(estimate)} (-${Math.max(0, percent(estimate))}%)`}
            </span>
          )}
        </div>

        <div className="flex gap-4 px-4 pb-5">
          <div
            ref={viewerRef}
            className="relative flex-1 min-w-0 h-[420px] rounded-xl border border-slate-200 overflow-hidden select-none touch-none cursor-ew-resize bg-[linear-gradient(45deg,#e8e8e8_25%,transparent_25%),linear-gradient(-45deg,#e8e8e8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e8e8e8_75%),linear-gradient(-45deg,transparent_75%,#e8e8e8_75%)] [background-size:20px_20px] [background-position:0_0,0_10px,10px_-10px,-10px_0px]"
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
              alt="Compressed"
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ transform: `scale(${zoom})`, clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
            />

            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.5)]"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-slate-300 shadow flex items-center justify-center text-slate-600 text-sm font-bold">
                ‹›
              </div>
            </div>

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

          <aside className="w-24 flex flex-col items-center shrink-0">
            <span className="text-base font-bold text-black">{usesColors ? 'Colors' : 'Quality'}</span>
            <input
              type="number"
              min={min}
              max={max}
              value={value}
              onChange={(e) => e.target.value !== '' && setValue(Number(e.target.value))}
              aria-label={usesColors ? 'Colors' : 'Quality'}
              className="mt-2 w-20 h-10 text-center text-lg font-bold text-slate-800 border-2 border-[#38404B] rounded-md focus:outline-none"
            />
            <input
              type="range"
              min={min}
              max={max}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              aria-label={`${usesColors ? 'Colors' : 'Quality'} slider`}
              className="mt-3 h-[210px] accent-[#38404B] [writing-mode:vertical-lr] [direction:rtl]"
            />

            <div className="mt-3 grid grid-cols-2 gap-1 w-full">
              {STEPS.map((step) => (
                <button
                  key={step}
                  onClick={() => setValue(value + step)}
                  className="h-7 text-xs font-bold border border-slate-300 rounded hover:bg-slate-100"
                >
                  {step > 0 ? `+${step}` : step}
                </button>
              ))}
            </div>

            <button
              onClick={() => onUpdateSettings(item.id, { quality: qualityInput, maxColors: colorsInput })}
              disabled={!dirty || isProcessing}
              className="mt-3 w-full h-9 text-xs font-semibold uppercase rounded-md bg-[#38404B] hover:bg-[#2c323b] text-white disabled:opacity-40"
            >
              Apply
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
};
