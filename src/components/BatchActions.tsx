import React, { useState } from 'react';
import { CompressedFileItem } from '../types/compressor';
import { formatBytes } from '../lib/compressor';
import { Play, Download, Loader2, Sliders, CheckCircle2 } from 'lucide-react';

interface BatchActionsProps {
  items: CompressedFileItem[];
  onCompressAll: () => void;
  onDownloadAllZip: () => void;
  onApplyGlobalQuality: (quality: number) => void;
  isBatchCompressing: boolean;
  isZipping: boolean;
}

export const BatchActions: React.FC<BatchActionsProps> = ({
  items,
  onCompressAll,
  onDownloadAllZip,
  onApplyGlobalQuality,
  isBatchCompressing,
  isZipping,
}) => {
  const [globalQuality, setGlobalQuality] = useState<number>(80);

  if (items.length === 0) return null;

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const totalOriginalSize = items.reduce((acc, i) => acc + i.originalSize, 0);
  const totalCompressedSize = items.reduce(
    (acc, i) => acc + (i.compressedSize > 0 ? i.compressedSize : i.originalSize),
    0
  );
  const totalSavingsBytes = totalOriginalSize - totalCompressedSize;
  const totalSavingsPercent =
    totalOriginalSize > 0
      ? Math.round((totalSavingsBytes / totalOriginalSize) * 100)
      : 0;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 mt-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
      {/* Total Batch Statistics */}
      <div className="flex items-center space-x-4 w-full md:w-auto">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-white">
              Batch Summary ({completedCount}/{items.length} Done)
            </span>
            {totalSavingsPercent > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Total Saved: {totalSavingsPercent}% ({formatBytes(totalSavingsBytes)})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {formatBytes(totalOriginalSize)} &rarr;{' '}
            <span className="text-emerald-400 font-mono font-bold">
              {formatBytes(totalCompressedSize)}
            </span>
          </p>
        </div>
      </div>

      {/* Global Quality Preset & Batch Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
        {/* Global Quality Quick Adjust */}
        <div className="flex items-center space-x-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
          <Sliders className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">All Quality:</span>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={globalQuality}
            onChange={(e) => {
              const q = Number(e.target.value);
              setGlobalQuality(q);
              onApplyGlobalQuality(q);
            }}
            className="w-20 sm:w-28 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-xs font-mono font-bold text-blue-400 w-8">
            {globalQuality}%
          </span>
        </div>

        {/* COMPRESS ALL */}
        <button
          onClick={onCompressAll}
          disabled={isBatchCompressing}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition-all disabled:opacity-50"
        >
          {isBatchCompressing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>COMPRESSING...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-blue-400 fill-blue-400" />
              <span>COMPRESS ALL</span>
            </>
          )}
        </button>

        {/* SAVE ALL ZIP */}
        <button
          onClick={onDownloadAllZip}
          disabled={isZipping || completedCount === 0}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
        >
          {isZipping ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>ZIPPING...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>SAVE ALL (ZIP)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
