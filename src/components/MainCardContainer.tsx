import React, { useRef, useState } from 'react';
import type { CompressedFileItem, AppTab, ImageFormat } from '../types/compressor';
import { acceptAttribute } from '../lib/compressor';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Download, Loader2, Settings, X } from 'lucide-react';

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
  onSaveAll: () => void;
  onDownloadItem: (item: CompressedFileItem) => void;
  targetFormat: ImageFormat;
  onTargetFormatChange: (format: ImageFormat) => void;
  unsupportedFormats: ImageFormat[];
  notice: string;
  isProcessing: boolean;
  isZipping: boolean;
}

const TABS: { id: AppTab; label: string }[] = [
  { id: 'converter', label: 'Converter' },
  { id: 'compressor', label: 'Compressor' },
];

const FORMAT_LABEL: Record<ImageFormat, string> = { jpeg: 'JPG', png: 'PNG', webp: 'WEBP', gif: 'GIF', avif: 'AVIF' };
const TARGET_FORMATS: ImageFormat[] = ['jpeg', 'png', 'webp', 'avif'];

const PROCESS_LABEL: Record<AppTab, string> = {
  converter: 'CONVERT',
  compressor: 'COMPRESS',
  exif: 'BULK REMOVE',
};

const tabClass = (active: boolean) =>
  `px-6 py-2.5 rounded-t-lg font-semibold text-sm transition-all border ${
    active
      ? 'bg-white text-[#D44D3B] border-slate-300 border-b-white z-20 shadow-sm'
      : 'bg-[#eaeeef] text-[#38404B] border-slate-300 hover:bg-[#e1e6e8]'
  }`;

const bigButton =
  'relative uppercase text-xs font-semibold h-[2.5em] px-5 rounded-[6px] min-w-[11em] inline-flex items-center justify-center transition-all shadow-sm text-white';

const Badge: React.FC<{ value: number; color: string }> = ({ value, color }) => (
  <span
    className={`absolute -top-2 -right-2 ${color} border-2 border-white text-white font-bold text-[10px] w-6 h-6 rounded-full flex items-center justify-center shadow`}
  >
    {value}
  </span>
);

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
  onSaveAll,
  onDownloadItem,
  targetFormat,
  onTargetFormatChange,
  unsupportedFormats,
  notice,
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
    if (e.dataTransfer.files.length > 0) onFilesSelected(Array.from(e.dataTransfer.files));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -260 : 260, behavior: 'smooth' });
  };

  const doneCount = items.filter((i) => i.compressedBlob).length;
  const pendingCount = items.filter((i) =>
    activeTab === 'converter'
      ? i.status !== 'completed' || i.settings.format !== targetFormat
      : i.status === 'pending'
  ).length;
  const sourceFormat = items.length > 0 ? items[0].format : null;
  const allConverted = activeTab === 'converter' && items.length > 0 && pendingCount === 0;

  const isStale = (item: CompressedFileItem) =>
    activeTab === 'converter' && item.status === 'completed' && item.settings.format !== targetFormat;

  const renderOverlay = (item: CompressedFileItem) => {
    if (item.status === 'converting') {
      return (
        <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-2 text-center">
          <Settings className="w-7 h-7 text-[#38404B] animate-spin mb-1" />
          <span className="text-[10px] font-bold text-[#38404B] uppercase tracking-wider">PROCESSING...</span>
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-[repeating-linear-gradient(45deg,#cbd5e1,#cbd5e1_6px,#f1f5f9_6px,#f1f5f9_12px)]" />
        </div>
      );
    }

    if (item.status === 'error') {
      return (
        <div
          className="absolute inset-0 bg-red-900/70 flex flex-col items-center justify-center text-center p-1"
          title={item.error}
        >
          <AlertCircle className="w-5 h-5 text-white mb-0.5" />
          <span className="text-[9px] font-bold text-white uppercase leading-tight">{item.error ?? 'Error'}</span>
        </div>
      );
    }

    if (activeTab === 'exif') {
      if (!item.exifTags) {
        return (
          <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center text-center">
            <Settings className="w-6 h-6 text-white animate-spin mb-1" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">READING...</span>
          </div>
        );
      }
      const now = item.exifTags.length;
      const before = item.exifOriginalCount ?? now;
      const cleaned = item.status === 'completed' && before !== now;
      return (
        <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-2xl font-black text-white font-mono leading-none">
            {cleaned ? `${now} (${before})` : now}
          </span>
          <span className="text-[11px] font-bold text-white mt-1">tags</span>
        </div>
      );
    }

    if (item.status === 'pending' || isStale(item)) {
      return (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
          <span className="text-2xl font-black text-white uppercase tracking-wider font-mono drop-shadow">
            {FORMAT_LABEL[item.format]}
          </span>
        </div>
      );
    }

    if (item.status === 'optimized') {
      return (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-1 pointer-events-none">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-0.5" />
          <span className="text-[9px] font-bold text-white uppercase tracking-wider">OPTIMIZED</span>
        </div>
      );
    }

    if (item.status === 'completed') {
      const label =
        activeTab === 'converter'
          ? FORMAT_LABEL[item.settings.format ?? item.format]
          : item.savingsPercentage > 0
            ? `-${item.savingsPercentage}%`
            : null;
      if (!label) return null;
      return (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <span className="text-2xl font-black text-white tracking-tight font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {label}
          </span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full max-w-242.5 mx-auto my-6 px-3">
      <div className="w-full flex items-center justify-between -mb-px relative z-10 font-sans">
        <div className="flex items-center space-x-1">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => onTabChange(tab.id)} className={tabClass(activeTab === tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={() => onTabChange('exif')} className={tabClass(activeTab === 'exif')}>
          EXIF
        </button>
      </div>

      <div className="w-full bg-white border border-slate-300 rounded-b-xl shadow-[0_5px_16px_-2px_rgba(42,115,217,0.2)] p-6 font-sans">
        <div className="flex items-center justify-center space-x-4 mb-4">
          <label className={`${bigButton} bg-[#2a73d9] hover:bg-[#205db3] cursor-pointer active:scale-95`}>
            <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 16 16">
              <path d="M8 12V4M4 8l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>SELECT FILES</span>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={acceptAttribute(activeTab)}
              className="hidden"
              onChange={handleInputChange}
            />
          </label>

          <button
            onClick={onClearAll}
            disabled={items.length === 0}
            className={`${bigButton} bg-[#D44D3B] hover:bg-[#b83d2e] disabled:opacity-40`}
          >
            <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 16 16">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>CLEAR</span>
          </button>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative w-full h-45.75 mb-4 overflow-hidden rounded-lg transition-colors ${
            isDragging ? 'bg-[#2a73d9]/5' : ''
          }`}
        >
          <button
            onClick={() => scroll('left')}
            disabled={items.length === 0}
            className="absolute left-0 top-0 bottom-0 z-20 w-10 text-[#D44D3B] disabled:opacity-30 hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={items.length === 0}
            className="absolute right-0 top-0 bottom-0 z-20 w-10 text-[#D44D3B] disabled:opacity-30 hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            <ChevronRight className="w-6 h-6 stroke-[2.5]" />
          </button>

          {items.length === 0 ? (
            <div
              onClick={() => inputRef.current?.click()}
              className="absolute inset-[0.5em_3em] border-2 border-dashed border-[#b5cef2] rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:border-[#8ab5ee]"
            >
              <p className="text-base font-semibold text-[#b5cef2] tracking-wide">Drop Your Files Here</p>
            </div>
          ) : (
            <div ref={scrollRef} className="w-full h-full flex items-center space-x-3 overflow-x-auto px-12 py-2 scrollbar-none">
              {items.map((item) => {
                const isSelected = item.id === selectedId;
                const canSave =
                  (item.status === 'completed' || item.status === 'optimized') && item.compressedBlob && !isStale(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(item.id)}
                    className={`relative w-40.75 h-40.75 shrink-0 bg-white rounded-lg border p-2 flex flex-col justify-between cursor-pointer transition-all overflow-hidden ${
                      isSelected ? 'border-[#38404B] ring-4 ring-[#38404B] shadow-md' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
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

                    <div className="relative w-full h-22.5 bg-[linear-gradient(45deg,#e0e0e0_25%,transparent_25%),linear-gradient(-45deg,#e0e0e0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e0e0e0_75%),linear-gradient(-45deg,transparent_75%,#e0e0e0_75%)] bg-size-[16px_16px] bg-position-[0_0,0_8px,8px_-8px,-8px_0px] rounded border border-slate-200 overflow-hidden flex items-center justify-center my-1">
                      <img
                        src={activeTab === 'compressor' ? item.compressedUrl || item.originalUrl : item.originalUrl}
                        alt={item.name}
                        className="max-h-full max-w-full object-contain"
                      />
                      {renderOverlay(item)}
                    </div>

                    {canSave && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadItem(item);
                        }}
                        className="w-full bg-[#c9e7cf] hover:bg-[#b4dbbd] text-[#1a3d24] text-[10px] font-bold uppercase py-1 rounded flex items-center justify-center space-x-1 mt-1 transition-colors"
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

        {notice && <p className="text-center text-xs font-semibold text-amber-700 mb-3">{notice}</p>}

        <div className="flex items-center justify-center flex-wrap gap-4">
          {activeTab === 'converter' && (
            <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-xs font-bold h-[2.5em]">
              {TARGET_FORMATS.map((fmt) => {
                const isSelected = targetFormat === fmt;
                const sameAsSource = sourceFormat === fmt;
                const unsupported = unsupportedFormats.includes(fmt);
                const disabled = items.length === 0 || sameAsSource || unsupported;
                return (
                  <button
                    key={fmt}
                    onClick={() => onTargetFormatChange(fmt)}
                    disabled={disabled}
                    title={unsupported ? `Your browser cannot create ${FORMAT_LABEL[fmt]} images` : undefined}
                    className={`px-4 transition-colors border-r border-slate-300 last:border-r-0 ${
                      isSelected
                        ? items.length === 0
                          ? 'bg-slate-400 text-white'
                          : 'bg-[#38404B] text-white'
                        : disabled
                          ? 'bg-white text-slate-300 cursor-not-allowed'
                          : 'bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {FORMAT_LABEL[fmt]}
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'converter' ? (
            <button
              onClick={allConverted ? onSaveAll : onCompressAll}
              disabled={items.length === 0 || isProcessing || isZipping}
              className={`${bigButton} ${
                allConverted ? 'bg-[#1a7030] hover:bg-[#135424]' : 'bg-[#38404B] hover:bg-[#2c323b]'
              } disabled:opacity-40`}
            >
              {isProcessing || isZipping ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 16 16">
                  <path
                    d={allConverted ? 'M8 4v8M4 8l4 4 4-4' : 'M2 2l4 4M14 2l-4 4M2 14l4-4M14 14l-4-4'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              <span>{allConverted ? 'SAVE ALL' : 'CONVERT'}</span>
              {items.length > 0 && <Badge value={items.length} color={allConverted ? 'bg-[#1a7030]' : 'bg-[#38404B]'} />}
            </button>
          ) : (
            <>
              <button
                onClick={onCompressAll}
                disabled={pendingCount === 0 || isProcessing}
                className={`${bigButton} bg-[#38404B] hover:bg-[#2c323b] disabled:opacity-40`}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 16 16">
                    <path d="M2 2l4 4M14 2l-4 4M2 14l4-4M14 14l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                <span>{PROCESS_LABEL[activeTab]}</span>
                {pendingCount > 0 && <Badge value={pendingCount} color="bg-[#38404B]" />}
              </button>

              <button
                onClick={onSaveAll}
                disabled={doneCount === 0 || isZipping}
                className={`${bigButton} bg-[#1a7030] hover:bg-[#135424] disabled:opacity-40`}
              >
                {isZipping ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 16 16">
                    <path d="M8 4v8M4 8l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span>SAVE ALL</span>
                {doneCount > 0 && <Badge value={doneCount} color="bg-[#1a7030]" />}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
