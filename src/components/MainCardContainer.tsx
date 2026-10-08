import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { CompressedFileItem, AppTab, ImageFormat } from '../types/compressor';
import { formatBytes } from '../lib/compressor';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Download,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface MainCardContainerProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  items: CompressedFileItem[];
  selectedId: string | null;
  onFilesSelected: (files: File[]) => void;
  onSelectItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onCompressAll: () => void;
  onDownloadAllZip: () => void;
  onDownloadItem: (item: CompressedFileItem) => void;
  targetFormat: ImageFormat;
  onTargetFormatChange: (format: ImageFormat) => void;
  isProcessing: boolean;
  isZipping: boolean;
}

export const MainCardContainer: React.FC<MainCardContainerProps> = ({
  activeTab,
  onTabChange,
  items,
  selectedId,
  onFilesSelected,
  onSelectItem,
  onRemoveItem,
  onClearAll,
  onCompressAll,
  onDownloadAllZip,
  onDownloadItem,
  targetFormat,
  onTargetFormatChange,
  isProcessing,
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
        file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp|gif|svg|avif)$/i)
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
      const amount = direction === 'left' ? -260 : 260;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const completedCount = items.filter((i) => i.status === 'completed' || i.status === 'optimized').length;
  const currentFormat = items.length > 0 ? items[0].format : null;

  return (
    <div className="w-full max-w-242.5 mx-auto my-6 px-3">
      {/* 1. SITE-SWITCH TABS BAR (Exact match to imagecompressor.com) */}
      <div className="w-full flex items-center justify-between -mb-px relative z-10 font-sans">
        <div className="flex items-center space-x-1">
          {/* Converter Tab */}
          <button
            onClick={() => onTabChange('converter')}
            className={`px-6 py-2.5 rounded-t-lg font-semibold text-sm transition-all border ${
              activeTab === 'converter'
                ? 'bg-white text-[#D44D3B] border-slate-300 border-b-white z-20 shadow-sm'
                : 'bg-[#eaeeef] text-[#38404B] border-slate-300 hover:bg-[#e1e6e8]'
            }`}
          >
            Converter
          </button>

          {/* Compressor Tab */}
          <button
            onClick={() => onTabChange('compressor')}
            className={`px-6 py-2.5 rounded-t-lg font-semibold text-sm transition-all border ${
              activeTab === 'compressor'
                ? 'bg-white text-[#D44D3B] border-slate-300 border-b-white z-20 shadow-sm'
                : 'bg-[#eaeeef] text-[#38404B] border-slate-300 hover:bg-[#e1e6e8]'
            }`}
          >
            Compressor
          </button>
        </div>

        {/* EXIF Tab */}
        <button
          onClick={() => onTabChange('exif')}
          className={`px-6 py-2.5 rounded-t-lg font-semibold text-sm transition-all border ${
            activeTab === 'exif'
              ? 'bg-white text-[#D44D3B] border-slate-300 border-b-white z-20 shadow-sm'
              : 'bg-[#eaeeef] text-[#38404B] border-slate-300 hover:bg-[#e1e6e8]'
          }`}
        >
          EXIF
        </button>
      </div>

      {/* 2. MAIN CARD CONTAINER (.files) */}
      <div className="w-full bg-white border border-slate-300 rounded-b-xl shadow-[0_5px_16px_-2px_rgba(42,115,217,0.2)] p-6 font-sans">
        
        {/* Converter Target Format Bar */}
        {activeTab === 'converter' && (
          <div className="w-full flex flex-col items-center justify-center mb-5 bg-[#f8fafc] p-3 rounded-lg border border-slate-200 text-xs font-semibold text-[#38404B]">
            <span className="uppercase tracking-wider mb-2">Convert To Target Format:</span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {(['jpeg', 'png', 'webp', 'svg', 'avif'] as ImageFormat[]).map((fmt) => {
                const isSameAsOriginal = currentFormat === fmt;
                const isSelected = targetFormat === fmt;

                return (
                  <button
                    key={fmt}
                    onClick={() => {
                      if (!isSameAsOriginal) {
                        onTargetFormatChange(fmt);
                      }
                    }}
                    disabled={isSameAsOriginal}
                    className={`px-4 py-1.5 rounded text-xs font-bold font-mono uppercase transition-all ${
                      isSameAsOriginal
                        ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
                        : isSelected
                        ? 'bg-[#2a73d9] text-white shadow-sm ring-2 ring-[#2a73d9]/30'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 cursor-pointer'
                    }`}
                  >
                    {fmt} {isSameAsOriginal && '(Same)'}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TOP BUTTONS (.files__buttons) */}
        <div className="flex items-center justify-center space-x-4 mb-4">
          {/* SELECT FILES button */}
          <label className="bg-[#2a73d9] hover:bg-[#205db3] text-white uppercase text-xs font-semibold h-[2.5em] px-5 rounded-md min-w-[11em] inline-flex items-center justify-center cursor-pointer transition-all shadow-sm active:scale-95">
            <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 16 16">
              <path d="M8 12V4M4 8l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>SELECT FILES</span>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.avif"
              className="hidden"
              onChange={handleInputChange}
            />
          </label>

          {/* CLEAR button */}
          <button
            onClick={onClearAll}
            disabled={items.length === 0}
            className="bg-[#D44D3B] hover:bg-[#b83d2e] disabled:opacity-40 text-white uppercase text-xs font-semibold h-[2.5em] px-5 rounded-md min-w-[11em] inline-flex items-center justify-center transition-all shadow-sm"
          >
            <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 16 16">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>CLEAR</span>
          </button>
        </div>

        {/* INNER DROP ZONE (.files__list-outer) */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative w-full h-45.75 mb-4 overflow-hidden rounded-lg transition-colors ${
            isDragging ? 'bg-[#2a73d9]/5' : ''
          }`}
        >
          {/* Scroll Prev Button */}
          <button
            onClick={() => scroll('left')}
            disabled={items.length === 0}
            className="absolute left-0 top-0 bottom-0 z-20 w-10 text-[#D44D3B] disabled:opacity-30 hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Scroll Next Button */}
          <button
            onClick={() => scroll('right')}
            disabled={items.length === 0}
            className="absolute right-0 top-0 bottom-0 z-20 w-10 text-[#D44D3B] disabled:opacity-30 hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            <ChevronRight className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Empty Drop Caption */}
          {items.length === 0 ? (
            <div
              onClick={() => inputRef.current?.click()}
              className="absolute inset-[0.5em_3em] border-2 border-dashed border-[#b5cef2] rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:border-[#8ab5ee]"
            >
              <p className="text-base font-semibold text-[#b5cef2] tracking-wide">
                Drop Your Files Here
              </p>
            </div>
          ) : (
            /* Uploaded Image Cards List (1:1 Template matching imagecompressor.com) */
            <div
              ref={scrollRef}
              className="w-full h-full flex items-center space-x-3 overflow-x-auto px-12 py-2 scrollbar-none"
            >
              {items.map((item) => {
                const isSelected = item.id === selectedId;
                const displayUrl = item.compressedUrl || item.originalUrl;
                const isDone = item.status === 'completed';
                const isOptimized = item.status === 'optimized';
                const isItemCompressing = item.status === 'converting';
                const savings = item.savingsPercentage;

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(item.id)}
                    className={`relative w-40.75 h-40.75 shrink-0 bg-white rounded-lg border p-2 flex flex-col justify-between cursor-pointer transition-all overflow-hidden ${
                      isSelected
                        ? 'border-[#38404B] ring-4 ring-[#38404B] shadow-md'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Header Row: File Name & Close Button */}
                    <div className="flex items-center justify-between z-10 text-[10px] font-sans">
                      <span className="truncate font-semibold text-slate-800 max-w-27.5" title={item.name}>
                        {item.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveItem(item.id);
                        }}
                        className="text-slate-400 hover:text-red-500 p-0.5"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Viewport Box with Imagecompressor.com Status Overlays */}
                    <div className="relative w-full h-22.5 bg-[linear-gradient(45deg,#e0e0e0_25%,transparent_25%),linear-gradient(-45deg,#e0e0e0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e0e0e0_75%),linear-gradient(-45deg,transparent_75%,#e0e0e0_75%)] bg-size-[16px_16px] bg-position-[0_0,0_8px,8px_-8px,-8px_0px] rounded border border-slate-200 overflow-hidden flex items-center justify-center my-1">
                      <Image
                        src={displayUrl}
                        alt={item.name}
                        fill
                        unoptimized
                        sizes="100vw"
                        className="object-contain"
                      />

                      {/* State 1: Pending Format Sign */}
                      {item.status === 'pending' && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                          <span className="text-2xl font-black text-white uppercase tracking-wider font-mono drop-shadow">
                            {item.format}
                          </span>
                        </div>
                      )}

                      {/* State 2: Processing Progress Overlay ("PROCESSING...") */}
                      {isItemCompressing && (
                        <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-2 text-center">
                          <RefreshCw className="w-6 h-6 text-[#2a73d9] animate-spin mb-1" />
                          <span className="text-[10px] font-bold text-[#38404B] uppercase tracking-wider">
                            PROCESSING...
                          </span>
                        </div>
                      )}

                      {/* State 3: Completed Savings Sign Overlay (-42% Large Text) */}
                      {isDone && savings > 0 && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                          <span className="text-2xl font-black text-white tracking-tight font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            -{savings}%
                          </span>
                        </div>
                      )}

                      {/* State 4: Optimized Only Sign */}
                      {isOptimized && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-1 pointer-events-none">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-0.5" />
                          <span className="text-[9px] font-bold text-white uppercase tracking-wider">
                            OPTIMIZED
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer Info inside Card */}
                    <div className="text-[10px] font-mono flex justify-between items-center text-slate-600">
                      <span>{formatBytes(item.originalSize)}</span>
                      {isDone && (
                        <span className="font-bold text-[#1a7030]">
                          {formatBytes(item.compressedSize)}
                        </span>
                      )}
                    </div>

                    {/* Individual Card SAVE Button */}
                    {(isDone || isOptimized) && item.compressedBlob && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadItem(item);
                        }}
                        className="w-full bg-[#1a7030] hover:bg-[#135424] text-white text-[10px] font-bold uppercase py-1 rounded flex items-center justify-center space-x-1 mt-1 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>SAVE</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTTOM BUTTONS (.files__buttons with counter badges) */}
        <div className="flex items-center justify-center space-x-4">
          {/* COMPRESS / CONVERT button with counter badge */}
          <button
            onClick={onCompressAll}
            disabled={items.length === 0 || isProcessing}
            className="relative bg-[#38404B] hover:bg-[#2c323b] disabled:opacity-40 text-white uppercase text-xs font-semibold h-[2.5em] px-5 rounded-md min-w-[11em] inline-flex items-center justify-center transition-all shadow-sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" />
                <span>PROCESSING...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 16 16">
                  <path d="M2 2l4 4M14 2l-4 4M2 14l4-4M14 14l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>{activeTab === 'converter' ? 'CONVERT' : 'COMPRESS'}</span>
              </>
            )}

            {items.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#38404B] border-2 border-white text-white font-bold text-[10px] w-6 h-6 rounded-full flex items-center justify-center shadow">
                {items.length}
              </span>
            )}
          </button>

          {/* SAVE ALL button with counter badge */}
          <button
            onClick={onDownloadAllZip}
            disabled={completedCount === 0 || isZipping}
            className="relative bg-[#1a7030] hover:bg-[#135424] disabled:opacity-40 text-white uppercase text-xs font-semibold h-[2.5em] px-5 rounded-md min-w-[11em] inline-flex items-center justify-center transition-all shadow-sm"
          >
            {isZipping ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" />
                <span>ZIPPING...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 16 16">
                  <path d="M8 4v8M4 8l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>SAVE ALL</span>
              </>
            )}

            {completedCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#1a7030] border-2 border-white text-white font-bold text-[10px] w-6 h-6 rounded-full flex items-center justify-center shadow">
                {completedCount}
              </span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
