import React from 'react';
import { CompressedFileItem } from '../types/compressor';
import { formatBytes } from '../lib/compressor';
import { Download, Loader2, X, Eye } from 'lucide-react';

interface ThumbnailCarouselProps {
  items: CompressedFileItem[];
  selectedId: string | null;
  onSelectItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onDownloadItem: (item: CompressedFileItem) => void;
}

export const ThumbnailCarousel: React.FC<ThumbnailCarouselProps> = ({
  items,
  selectedId,
  onSelectItem,
  onRemoveItem,
  onDownloadItem,
}) => {
  if (items.length === 0) return null;

  return (
    <div className="w-full mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Queue ({items.length} {items.length === 1 ? 'File' : 'Files'})
        </h3>
        <span className="text-xs text-slate-500">
          Click any card to inspect & compare
        </span>
      </div>

      <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          const displayUrl = item.compressedUrl || item.originalUrl;
          const isDone = item.status === 'completed' || item.status === 'optimized';
          const isCompressing = item.status === 'converting';
          const savings = item.savingsPercentage;

          return (
            <div
              key={item.id}
              onClick={() => onSelectItem(item.id)}
              className={`relative flex-shrink-0 w-64 bg-slate-900 rounded-xl border p-3 cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/30 bg-slate-850 shadow-lg shadow-blue-500/10'
                  : 'border-slate-800 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {item.format}
                </span>

                <div className="flex items-center space-x-1">
                  {isSelected && (
                    <span className="flex items-center text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded font-medium">
                      <Eye className="w-3 h-3 mr-1" /> Active
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item.id);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    title="Remove image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="relative w-full h-32 bg-slate-950 rounded-lg overflow-hidden border border-slate-800/80 mb-2 flex items-center justify-center">
                <img
                  src={displayUrl}
                  alt={item.name}
                  className="max-h-full max-w-full object-contain"
                />

                {isCompressing && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                  </div>
                )}
              </div>

              <p
                className="text-xs font-medium text-slate-200 truncate mb-1"
                title={item.name}
              >
                {item.name}
              </p>

              <div className="text-[11px] space-y-0.5">
                <div className="flex justify-between text-slate-400">
                  <span>Original:</span>
                  <span className="font-mono">{formatBytes(item.originalSize)}</span>
                </div>

                {isDone ? (
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-300">Compressed:</span>
                    <div className="flex items-center space-x-1 font-mono">
                      <span className="text-emerald-400">
                        {formatBytes(item.compressedSize)}
                      </span>
                      {savings > 0 && (
                        <span className="text-[10px] font-bold px-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          -{savings}%
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-500 italic">
                    <span>Compressed:</span>
                    <span>Ready</span>
                  </div>
                )}
              </div>

              {isDone && item.compressedBlob && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadItem(item);
                  }}
                  className="mt-2.5 w-full flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-1.5 rounded-lg transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOWNLOAD</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
