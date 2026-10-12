import React, { useState, useRef, useEffect } from 'react';
import { CompressedFileItem, ImageFormat } from '../types/compressor';
import { formatBytes } from '../lib/compressor';
import { RefreshCw, Loader2, Download, Maximize2 } from 'lucide-react';

interface ComparisonPanelProps {
  item: CompressedFileItem | null;
  onUpdateSettings: (id: string, newSettings: Partial<CompressedFileItem['settings']>) => void;
  onDownloadItem: (item: CompressedFileItem) => void;
  isProcessing: boolean;
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  item,
  onUpdateSettings,
  onDownloadItem,
  isProcessing,
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [qualityInput, setQualityInput] = useState<number>(80);
  const [maxColorsInput, setMaxColorsInput] = useState<number>(256);
  const [selectedFormat, setSelectedFormat] = useState<ImageFormat>('jpeg');

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (item) {
      setQualityInput(item.settings.quality);
      setMaxColorsInput(item.settings.maxColors || 256);
      setSelectedFormat(item.settings.format || item.format);
    }
  }, [item?.id, item?.settings]);

  if (!item) return null;

  const originalUrl = item.originalUrl;
  const compressedUrl = item.compressedUrl || originalUrl;

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    handleMove(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      handleMove(e.clientX);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const triggerRealtimeUpdate = (newQuality: number, newColors: number, newFormat: ImageFormat) => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      onUpdateSettings(item.id, {
        quality: newQuality,
        maxColors: newColors,
        format: newFormat,
      });
    }, 250);
  };

  const handleQualityChange = (val: number) => {
    setQualityInput(val);
    triggerRealtimeUpdate(val, maxColorsInput, selectedFormat);
  };

  const handleColorsChange = (val: number) => {
    setMaxColorsInput(val);
    triggerRealtimeUpdate(qualityInput, val, selectedFormat);
  };

  const handleFormatChange = (fmt: ImageFormat) => {
    setSelectedFormat(fmt);
    triggerRealtimeUpdate(qualityInput, maxColorsInput, fmt);
  };

  const handleApplySettings = () => {
    onUpdateSettings(item.id, {
      quality: qualityInput,
      maxColors: maxColorsInput,
      format: selectedFormat,
    });
  };

  return (
    <section className="w-full max-w-[970px] mx-auto mt-6 bg-white border border-[#f2f2f2] rounded-xl shadow-[0_5px_16px_-2px_rgba(42,115,217,0.2)] font-sans">
      <div className="py-2.5 px-4 border-b border-[#f2f2f2] text-center flex items-center justify-center relative">
        <span className="font-semibold text-base text-[#38404B] truncate max-w-lg">
          {item.name}
        </span>
        {isProcessing && (
          <div className="absolute right-4 flex items-center text-xs font-semibold text-[#2a73d9]">
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 flex flex-col">
          <div className="flex items-center justify-between mb-3 text-sm tracking-wide">
            <div className="w-1/2 text-center">
              <span className="text-slate-500 font-medium">Before: </span>
              <span className="font-bold text-[#333] font-mono">
                {formatBytes(item.originalSize)}
              </span>
            </div>

            <div className="w-1/2 text-center">
              <span className="text-slate-500 font-medium">After: </span>
              <span className="font-bold text-[#2e7d32] font-mono">
                {item.compressedSize > 0 ? formatBytes(item.compressedSize) : 'Processing...'}
              </span>
              {item.savingsPercentage > 0 && (
                <span className="ml-1.5 font-bold text-[#2e7d32] font-mono">
                  (-{item.savingsPercentage}%)
                </span>
              )}
            </div>
          </div>

          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleTouchMove}
            className="relative w-full h-[320px] bg-[linear-gradient(45deg,#e0e0e0_25%,transparent_25%),linear-gradient(-45deg,#e0e0e0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e0e0e0_75%),linear-gradient(-45deg,transparent_75%,#e0e0e0_75%)] [background-size:16px_16px] [background-position:0_0,0_8px,8px_-8px,-8px_0px] rounded-lg border border-slate-300 overflow-hidden cursor-ew-resize select-none flex items-center justify-center"
          >
            <div
              className="absolute inset-0 flex items-center justify-center overflow-hidden"
              style={{
                clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`,
              }}
            >
              <img
                src={originalUrl}
                alt="Original"
                className="max-w-full max-h-full object-contain pointer-events-none"
                style={{ transform: `scale(${zoomLevel})` }}
              />
              <span className="absolute top-2 left-2 bg-[#38404B]/90 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                ORIGINAL
              </span>
            </div>

            <div
              className="absolute inset-0 flex items-center justify-center overflow-hidden"
              style={{
                clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)`,
              }}
            >
              <img
                src={compressedUrl}
                alt="Compressed"
                className="max-w-full max-h-full object-contain pointer-events-none"
                style={{ transform: `scale(${zoomLevel})` }}
              />
              <span className="absolute top-2 right-2 bg-[#1a7030]/90 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                COMPRESSED
              </span>
            </div>

            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#D44D3B] shadow-[0_0_6px_rgba(212,77,59,0.8)] pointer-events-none"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#D44D3B] text-white border-2 border-white flex items-center justify-center shadow">
                <span className="text-[8px] font-bold">⯇⯈</span>
              </div>
            </div>

            <button
              onClick={() => setZoomLevel((z) => (z === 1 ? 1.5 : 1))}
              className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-slate-700 border border-slate-300 font-mono text-xs font-semibold px-2 py-1 rounded shadow-sm flex items-center space-x-1"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3 h-3 text-slate-500" />
              <span>{zoomLevel === 1 ? '100%' : '150%'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-4 pt-1 sm:pt-6 border-t sm:border-t-0 sm:border-l border-slate-200 sm:pl-4">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#38404B] border-b border-slate-200 pb-2">
              Compression Settings
            </h3>

            <div>
              <div className="flex justify-between items-center mb-1.5 text-xs">
                <label className="font-semibold text-slate-700">Quality</label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={qualityInput}
                  onChange={(e) => handleQualityChange(Number(e.target.value))}
                  className="w-12 bg-white border border-slate-300 text-center font-mono font-bold text-[#2a73d9] text-xs py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={qualityInput}
                onChange={(e) => handleQualityChange(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-[#2a73d9]"
              />
            </div>

            {selectedFormat === 'png' && (
              <div>
                <div className="flex justify-between items-center mb-1.5 text-xs">
                  <label className="font-semibold text-slate-700">PNG Colors</label>
                  <span className="font-mono font-bold text-[#2a73d9] text-xs">
                    {maxColorsInput} colors
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="256"
                  step="2"
                  value={maxColorsInput}
                  onChange={(e) => handleColorsChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-[#2a73d9]"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Output Format
              </label>
              <select
                value={selectedFormat}
                onChange={(e) => handleFormatChange(e.target.value as ImageFormat)}
                className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded px-2.5 py-1.5 focus:outline-none"
              >
                <option value="jpeg">JPEG (.jpg)</option>
                <option value="webp">WebP (.webp)</option>
                <option value="png">PNG (.png)</option>
                <option value="avif">AVIF (.avif)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <button
              onClick={handleApplySettings}
              disabled={isProcessing}
              className="w-full bg-[#2a73d9] hover:bg-[#205db3] disabled:opacity-40 text-white font-semibold text-xs uppercase h-[2.3em] rounded-[6px] flex items-center justify-center transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>APPLY</span>
            </button>

            {item.compressedBlob && (
              <button
                onClick={() => onDownloadItem(item)}
                className="w-full bg-[#1a7030] hover:bg-[#135424] text-white font-semibold text-xs uppercase h-[2.3em] rounded-[6px] flex items-center justify-center transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                <span>SAVE</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </section>
  );
};
