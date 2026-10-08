import React, { useRef, useState } from 'react';
import { CompressedFileItem } from '../types/compressor';
import { formatBytes } from '../lib/compressor';
import {
  Upload,
  Plus,
  Trash2,
  Download,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';

interface FileAppBoxProps {
  items: CompressedFileItem[];
  selectedId: string | null;
  onFilesSelected: (files: File[]) => void;
  onSelectItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onCompressAll: () => void;
  onDownloadAllZip: () => void;
  onDownloadItem: (item: CompressedFileItem) => void;
  isCompressing: boolean;
  isZipping: boolean;
}

export const FileAppBox: React.FC<FileAppBoxProps> = ({
  items,
  selectedId,
  onFilesSelected,
  onSelectItem,
  onRemoveItem,
  onClearAll,
  onCompressAll,
  onDownloadAllZip,
  onDownloadItem,
  isCompressing,
  isZipping,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)
      );
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const completedCount = items.filter((i) => i.status === 'completed' || i.status === 'optimized').length;

  return (
    <div className="w-full max-w-4xl mx-auto my-6">
      <div className="flex items-center justify-between mb-3">
        <label className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-md cursor-pointer transition-all shadow-md active:scale-95">
          <Plus className="w-4 h-4" />
          <span>SELECT FILES</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.gif,.svg"
            className="hidden"
            onChange={handleInputChange}
          />
        </label>

        <button
          onClick={onClearAll}
          disabled={items.length === 0}
          className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-md transition-all border border-slate-700"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>CLEAR</span>
        </button>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full border-2 border-dashed rounded-2xl bg-slate-900/90 transition-all overflow-hidden min-h-[260px] flex items-center justify-center p-4 ${
          isDragging
            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.002]'
            : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        {items.length === 0 ? (
          <div
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center text-center cursor-pointer py-12 px-4 w-full"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4 text-emerald-400">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-wide">
              Drop Your Files Here
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Supports JPEG, PNG, WebP, GIF, and SVG images.
            </p>
          </div>
        ) : (
          <div className="relative w-full py-2">
            <button
              onClick={() => scroll('left')}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-16 bg-slate-950/80 hover:bg-slate-950 text-slate-300 rounded-r-md flex items-center justify-center border border-slate-800 backdrop-blur-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={() => scroll('right')}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-16 bg-slate-950/80 hover:bg-slate-950 text-slate-300 rounded-l-md flex items-center justify-center border border-slate-800 backdrop-blur-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div
              ref={scrollRef}
              className="flex space-x-3 overflow-x-auto px-10 py-2 scrollbar-none"
            >
              {items.map((item) => {
                const isSelected = item.id === selectedId;
                const displayUrl = item.compressedUrl || item.originalUrl;
                const isDone = item.status === 'completed' || item.status === 'optimized';
                const isItemCompressing = item.status === 'converting';
                const savings = item.savingsPercentage;

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(item.id)}
                    className={`relative flex-shrink-0 w-48 bg-slate-950 rounded-xl border p-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-slate-900 shadow-lg'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {item.format}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveItem(item.id);
                        }}
                        className="p-0.5 text-slate-400 hover:text-red-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="relative w-full h-28 bg-slate-900 rounded-md overflow-hidden border border-slate-800/60 mb-2 flex items-center justify-center">
                      <img
                        src={displayUrl}
                        alt={item.name}
                        className="max-h-full max-w-full object-contain"
                      />
                      {isItemCompressing && (
                        <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] font-semibold text-slate-200 truncate mb-1" title={item.name}>
                      {item.name}
                    </p>

                    <div className="text-[10px] font-mono space-y-0.5">
                      <div className="flex justify-between text-slate-400">
                        <span>{formatBytes(item.originalSize)}</span>
                        {isDone && (
                          <span className="text-emerald-400 font-bold">
                            {formatBytes(item.compressedSize)}
                          </span>
                        )}
                      </div>
                      {isDone && savings > 0 && (
                        <div className="text-right">
                          <span className="bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded text-[9px] font-bold border border-emerald-500/30">
                            -{savings}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          onClick={onCompressAll}
          disabled={items.length === 0 || isCompressing}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-100 font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-md transition-all border border-slate-700"
        >
          {isCompressing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>COMPRESSING...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>COMPRESS</span>
            </>
          )}
        </button>

        <button
          onClick={onDownloadAllZip}
          disabled={completedCount === 0 || isZipping}
          className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-md transition-all shadow-md"
        >
          {isZipping ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>ZIPPING...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>SAVE ALL</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
