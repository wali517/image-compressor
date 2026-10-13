import React, { useEffect, useState } from 'react';
import type { CompressedFileItem } from '../types/compressor';
import { Download, Loader2, Search, XCircle } from 'lucide-react';

interface ExifPanelProps {
  item: CompressedFileItem | null;
  onRemoveExif: (id: string) => void;
  onDownloadItem: (item: CompressedFileItem) => void;
  isBusy: boolean;
}

export const ExifPanel: React.FC<ExifPanelProps> = ({ item, onRemoveExif, onDownloadItem, isBusy }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    setQuery('');
  }, [item?.id]);

  if (!item) return null;

  const tags = item.exifTags;
  const cleaned = item.status === 'completed' && Boolean(item.compressedBlob);
  const needle = query.trim().toLowerCase();
  const visible = (tags ?? []).filter(
    (tag) => !needle || tag.name.toLowerCase().includes(needle) || tag.value.toLowerCase().includes(needle)
  );

  let emptyMessage = '';
  if (tags && tags.length === 0) emptyMessage = 'No metadata found in this file.';
  else if (tags && visible.length === 0) emptyMessage = `No tags found for "${query.trim()}"`;

  return (
    <section className="w-full max-w-242.5 mx-auto px-3 mb-10">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 font-sans">
        <h2 className="text-center text-base font-bold text-[#1f2933] break-all mb-4">{item.name}</h2>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <label className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tags..."
              className="w-full h-9 pl-9 pr-3 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[#2a73d9]"
            />
          </label>

          <div className="flex items-center gap-2">
            {cleaned && (
              <button
                onClick={() => onDownloadItem(item)}
                className="h-9 px-4 text-xs font-semibold uppercase rounded-md bg-[#1a7030] hover:bg-[#135424] text-white inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Save
              </button>
            )}
            <button
              onClick={() => onRemoveExif(item.id)}
              disabled={cleaned || isBusy || !tags || item.status === 'error'}
              className="h-9 px-4 text-xs font-semibold uppercase rounded-md border border-[#38404B] bg-[#38404B] text-white hover:bg-white hover:text-[#38404B] disabled:bg-slate-300 disabled:border-slate-300 disabled:text-white disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors"
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Remove EXIF
            </button>
          </div>
        </div>

        {item.status === 'error' && item.error && (
          <p className="text-sm text-red-600 font-semibold mb-3">{item.error}</p>
        )}

        {!tags ? (
          <p className="text-center text-sm text-slate-500 py-8">Reading metadata...</p>
        ) : emptyMessage ? (
          <p className="text-center text-sm text-slate-500 py-8">{emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[#8f8f8f] text-white text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 w-1/3 font-semibold">Tag</th>
                  <th className="px-4 py-3 font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((tag, index) => (
                  <tr key={`${tag.name}-${index}`} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-semibold text-slate-800 align-top">{tag.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600 break-all align-top">{tag.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
