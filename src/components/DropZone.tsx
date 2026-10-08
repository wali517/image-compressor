import React, { useRef, useState } from 'react';
import { Upload, Plus, Trash2 } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  onClearAll: () => void;
  hasFiles: boolean;
  fileCount: number;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  onClearAll,
  hasFiles,
  fileCount,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const selected = Array.from(e.target.files);
      onFilesSelected(selected);
      e.target.value = ''; // reset input
    }
  };

  return (
    <div className="w-full">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <label className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-4 py-2.5 rounded-lg cursor-pointer transition-all shadow-md shadow-blue-600/20 active:scale-[0.98]">
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
        </div>

        {hasFiles && (
          <button
            onClick={onClearAll}
            className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40 text-slate-300 border border-slate-700 font-medium text-sm px-3.5 py-2 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>CLEAR ({fileCount})</span>
          </button>
        )}
      </div>

      {/* Main Drag & Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative w-full border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-50 ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10 scale-[1.005]'
            : 'border-slate-700 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-900/90'
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400 group-hover:scale-110 transition-transform">
          <Upload className="w-8 h-8" />
        </div>

        <h3 className="text-lg font-bold text-white mb-1">
          Drop Your Files Here
        </h3>
        <p className="text-sm text-slate-400 max-w-md">
          Supports <span className="text-slate-200 font-medium">JPEG, PNG, WebP, GIF, SVG</span>. Up to 50MB per file. Processed 100% locally in your browser.
        </p>

        {/* Format Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {['.JPG', '.PNG', '.WEBP', '.GIF', '.SVG'].map((ext) => (
            <span
              key={ext}
              className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700"
            >
              {ext}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
