import React from 'react';
import { CompressedFileItem } from '../types/compressor';
import { ShieldCheck } from 'lucide-react';

interface ExifPanelProps {
  item: CompressedFileItem | null;
}

export const ExifPanel: React.FC<ExifPanelProps> = ({ item }) => {
  if (!item) return null;

  const tags = item.exifTags || [];

  return (
    <section className="w-full max-w-[970px] mx-auto mt-6 bg-white border border-[#f2f2f2] rounded-xl shadow-[0_5px_16px_-2px_rgba(42,115,217,0.2)] p-6 font-sans">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
        <div>
          <h2 className="text-base font-bold text-[#38404B] truncate max-w-lg">
            EXIF Viewer & Metadata Inspector: {item.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspecting metadata, camera info, and color profiles.
          </p>
        </div>

        <div className="flex items-center space-x-1 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>EXIF Stripping Enabled on Download</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tags.map((tag) => (
          <div
            key={tag.name}
            className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs"
          >
            <span className="font-semibold text-slate-600">{tag.name}</span>
            <span className="font-mono font-bold text-[#38404B]">{tag.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
