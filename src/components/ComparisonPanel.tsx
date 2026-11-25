import React, { useEffect, useRef, useState } from 'react';
import type { AppTab, CompressedFileItem } from '../types/compressor';
import { compressImage, convertImage, formatBytes } from '../lib/compressor';
import { Loader2 } from 'lucide-react';

interface ComparisonPanelProps {
  item: CompressedFileItem | null;
  activeTab?: AppTab;
  onUpdateSettings: (id: string, newSettings: Partial<CompressedFileItem['settings']>) => void;
  isProcessing: boolean;
}

const STEPS = [-10, -1, 1, 10];

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  item,
  activeTab = 'compressor',
  onUpdateSettings,
  isProcessing,
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [qualityDraft, setQualityDraft] = useState<number | null>(null);
  const [colorsDraft, setColorsDraft] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);

  const itemId = item?.id;
  const hasResult = Boolean(item?.compressedBlob);
  const currentFormat = item?.settings.format || item?.format;
  const usesColors = currentFormat === 'png' || currentFormat === 'gif';
  const appliedQuality = item?.settings.quality ?? 80;
  const appliedColors = item?.settings.maxColors ?? 256;
  const qualityInput = qualityDraft ?? appliedQuality;
  const colorsInput = colorsDraft ?? appliedColors;
  const dirty = usesColors ? colorsInput !== appliedColors : qualityInput !== appliedQuality;

  useEffect(() => {
    setQualityDraft(null);
    setColorsDraft(null);
    setEstimate(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, [itemId, appliedQuality, appliedColors]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setZoom(1);
    setSliderPosition(50);
  }, [itemId]);

  useEffect(() => {
    if (!item || !dirty) {
      setEstimate(null);
      setIsEstimating(false);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    setIsEstimating(true);
    const timer = setTimeout(async () => {
      try {
        const result =
          activeTab === 'converter'
            ? await convertImage(item.file, item.settings.format || 'png', qualityInput, colorsInput)
            : await compressImage(item.file, { ...item.settings, quality: qualityInput, maxColors: colorsInput });
        if (!cancelled) {
          const sz = result.isOptimizedOnly ? item.originalSize : result.blob.size;
          setEstimate(sz);
          const newUrl = URL.createObjectURL(result.blob);
          if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
          }
          previewUrlRef.current = newUrl;
          setPreviewUrl(newUrl);
        }
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setIsEstimating(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [itemId, qualityInput, colorsInput, dirty, activeTab]);

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

  const isLarger = item.compressedSize > item.originalSize;
  const savingsPct =
    item.originalSize > 0 && item.compressedSize < item.originalSize
      ? Math.round(((item.originalSize - item.compressedSize) / item.originalSize) * 100)
      : 0;

  const estimatePct = (size: number) =>
    item.originalSize > 0 && size < item.originalSize
      ? Math.round(((item.originalSize - size) / item.originalSize) * 100)
      : 0;

  return (
    <section className="w-full max-w-[970px] mx-auto px-3 mb-10">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm font-sans overflow-hidden">
        <h2 className="text-center text-lg font-bold text-black px-4 py-3 border-b border-slate-100 break-all">
          {item.name}
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-1 py-3 text-sm text-slate-800 border-b border-slate-100">
          <span>
            Before: <strong className="text-black">{formatBytes(item.originalSize)}</strong>
            {item.originalWidth > 0 && (
              <span className="text-xs text-slate-500 ml-1">
                ({item.originalWidth}x{item.originalHeight}px)
              </span>
            )}
          </span>
          <span>
            After:{' '}
            <strong className={isLarger ? 'text-amber-700' : 'text-[#2e7d32]'}>
              {formatBytes(item.compressedSize)}
              {item.status === 'optimized'
                ? ' (already optimized)'
                : isLarger
                  ? ` (+${Math.round(((item.compressedSize - item.originalSize) / item.originalSize) * 100)}%)`
                  : ` (-${savingsPct}%)`}
            </strong>
            {item.compressedWidth > 0 && (
              <span className="text-xs text-slate-500 ml-1">
                ({item.compressedWidth}x{item.compressedHeight}px)
              </span>
            )}
          </span>
          {dirty && (
            <span className="text-[#2a73d9] font-semibold">
              {isEstimating || estimate === null
                ? 'Estimating...'
                : `After Apply: ~${formatBytes(estimate)} (-${estimatePct(estimate)}%)`}
            </span>
          )}
        </div>

        {item.notice && (
          <div className="bg-amber-50 text-amber-800 text-xs text-center py-1.5 px-4 border-t border-b border-amber-200">
            {item.notice}
          </div>
        )}

        <div className="flex gap-4 px-4 pb-5 pt-3">
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
              src={previewUrl || item.compressedUrl || item.originalUrl}
              alt="Result"
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ transform: `scale(${zoom})`, clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
            />

            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)]"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-300 shadow-md flex items-center justify-center text-[#38404B] text-sm font-bold select-none">
                ‹›
              </div>
            </div>

            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setZoom(1)}
              className="absolute bottom-2 right-2 text-[11px] font-bold bg-black/60 text-white px-2 py-0.5 rounded cursor-pointer"
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
            <span className="text-base font-bold text-[#38404B]">{usesColors ? 'Colors' : 'Quality'}</span>
            <input
              type="number"
              min={min}
              max={max}
              value={value}
              onChange={(e) => e.target.value !== '' && setValue(Number(e.target.value))}
              aria-label={usesColors ? 'Colors' : 'Quality'}
              className="mt-2 w-20 h-10 text-center text-lg font-bold text-[#38404B] border-2 border-[#38404B] rounded-md focus:outline-none focus:ring-1 focus:ring-[#2a73d9]"
            />
            <input
              type="range"
              min={min}
              max={max}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              aria-label={`${usesColors ? 'Colors' : 'Quality'} slider`}
              className="mt-3 h-[210px] accent-[#38404B] [writing-mode:vertical-lr] [direction:rtl] cursor-pointer"
            />

            <div className="mt-3 grid grid-cols-2 gap-1 w-full">
              {STEPS.map((step) => (
                <button
                  key={step}
                  onClick={() => setValue(value + step)}
                  className="h-7 text-xs font-bold border border-slate-300 rounded hover:bg-slate-100 text-[#38404B] cursor-pointer"
                >
                  {step > 0 ? `+${step}` : step}
                </button>
              ))}
            </div>

            <button
              onClick={() => onUpdateSettings(item.id, { quality: qualityInput, maxColors: colorsInput })}
              disabled={!dirty || isProcessing}
              className="mt-3 w-full h-9 text-xs font-semibold uppercase rounded-md bg-[#38404B] hover:bg-[#2c323b] text-white disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center space-x-1"
            >
              {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              <span>Apply</span>
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
};
