'use client';

import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import type { CompressedFileItem, CompressionSettings, AppTab, ImageFormat } from '../types/compressor';
import {
  MAX_FILES,
  canEncode,
  compressImage,
  convertImage,
  detectImageFormat,
  getImageDimensions,
  isAcceptedFile,
} from '../lib/compressor';
import { readMetadata, stripMetadata } from '../lib/metadata';
import { Header } from '../components/Header';
import { MainCardContainer } from '../components/MainCardContainer';
import { ComparisonPanel } from '../components/ComparisonPanel';
import { ExifPanel } from '../components/ExifPanel';
import { HowItWorks } from '../components/HowItWorks';
import { Footer } from '../components/Footer';

const COPY: Record<AppTab, { title: string; text: string; steps: [string, string] }> = {
  compressor: {
    title: 'Compress Images Online',
    text: 'Shrink JPEG, PNG, WebP and GIF files right in your browser. Nothing is uploaded, and metadata is removed from the results.',
    steps: ['Drop JPEG, PNG, WebP or GIF images (up to 20).', 'Click COMPRESS, then save or fine-tune the quality.'],
  },
  converter: {
    title: 'Convert Images Online',
    text: 'Turn JPEG, PNG, WebP, GIF and AVIF images into JPG, PNG, WebP or AVIF without leaving the page.',
    steps: ['Drop or select up to 20 images.', 'Pick an output format, click CONVERT, then save each file.'],
  },
  exif: {
    title: 'View, Search and Remove File Metadata',
    text: 'See the hidden data inside your photos, such as camera, location and dates, and strip it before you share.',
    steps: ['Drop up to 20 images and click one to see every tag.', 'Search the tags, then REMOVE EXIF or BULK REMOVE and save the clean copies.'],
  },
};

const ZIP_NAMES: Record<AppTab, string> = {
  compressor: 'compressed-images.zip',
  converter: 'converted-images.zip',
  exif: 'cleaned-images.zip',
};

const revokeUrls = (item: CompressedFileItem) => {
  if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
  if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('compressor');

  const [items, setItems] = useState<CompressedFileItem[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [targetFormat, setTargetFormat] = useState<ImageFormat>('jpeg');
  const [unsupportedFormats, setUnsupportedFormats] = useState<ImageFormat[]>([]);
  const [notice, setNotice] = useState('');

  const sessionRef = useRef(0);

  const allItemsRef = useRef<CompressedFileItem[]>([]);
  useEffect(() => {
    allItemsRef.current = items;
  });
  useEffect(() => () => allItemsRef.current.forEach(revokeUrls), []);

  useEffect(() => {
    (['webp', 'avif'] as ImageFormat[]).forEach((format) => {
      canEncode(format).then((ok) => {
        if (!ok) setUnsupportedFormats((prev) => [...prev, format]);
      });
    });
  }, []);

  const handleTabChange = (tab: AppTab) => {
    if (tab === activeTab) return;

    sessionRef.current += 1;
    items.forEach(revokeUrls);
    setItems([]);
    setSelectedId(null);
    setProcessingId(null);
    setIsProcessing(false);
    setIsZipping(false);
    setTargetFormat('jpeg');
    setNotice('');
    setActiveTab(tab);
  };

  const processSingleItem = async (
    item: CompressedFileItem,
    customSettings?: CompressionSettings
  ): Promise<CompressedFileItem> => {
    const settings = customSettings || item.settings;

    try {
      const result =
        activeTab === 'converter'
          ? await convertImage(item.file, targetFormat, settings.quality)
          : await compressImage(item.file, settings);

      const isOptimizedOnly = 'isOptimizedOnly' in result ? Boolean(result.isOptimizedOnly) : false;
      const appliedColors = 'appliedColors' in result ? (result.appliedColors as number | undefined) : undefined;
      const compressedSize = result.blob.size;
      const savings =
        item.originalSize > 0 && !isOptimizedOnly
          ? Math.max(0, Math.round(((item.originalSize - compressedSize) / item.originalSize) * 100))
          : 0;

      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);

      return {
        ...item,
        status: isOptimizedOnly ? 'optimized' : 'completed',
        compressedBlob: result.blob,
        compressedUrl: URL.createObjectURL(result.blob),
        compressedSize,
        compressedWidth: result.width,
        compressedHeight: result.height,
        savingsPercentage: savings,
        error: undefined,
        settings: {
          ...settings,
          format: activeTab === 'converter' ? targetFormat : settings.format,
          quality: result.appliedQuality,
          maxColors: appliedColors ?? settings.maxColors,
        },
      };
    } catch (err) {
      return { ...item, status: 'error', error: err instanceof Error ? err.message : 'Processing failed' };
    }
  };

  const stripSingleItem = async (item: CompressedFileItem): Promise<CompressedFileItem> => {
    try {
      const blob = await stripMetadata(item.file, item.format);
      if (!blob) {
        return {
          ...item,
          status: 'error',
          error: `Removing metadata from ${item.format.toUpperCase()} files is not supported yet`,
        };
      }
      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
      const exifTags = await readMetadata(blob);

      return {
        ...item,
        status: 'completed',
        compressedBlob: blob,
        compressedUrl: URL.createObjectURL(blob),
        compressedSize: blob.size,
        compressedWidth: item.originalWidth,
        compressedHeight: item.originalHeight,
        savingsPercentage: 0,
        error: undefined,
        exifTags,
      };
    } catch (err) {
      return { ...item, status: 'error', error: err instanceof Error ? err.message : 'Could not remove metadata' };
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    const accepted = files.filter((file) => isAcceptedFile(file, activeTab));
    const batch = accepted.slice(0, Math.max(0, MAX_FILES - items.length));

    const messages: string[] = [];
    if (accepted.length < files.length) messages.push(`${files.length - accepted.length} unsupported file(s) skipped.`);
    if (batch.length < accepted.length) messages.push(`You can add up to ${MAX_FILES} files at a time.`);
    setNotice(messages.join(' '));
    if (batch.length === 0) return;

    const session = sessionRef.current;
    if (activeTab === 'converter' && items.length === 0) {
      setTargetFormat(detectImageFormat(batch[0]) === 'jpeg' ? 'png' : 'jpeg');
    }

    const newItems: CompressedFileItem[] = [];
    for (const file of batch) {
      const format = detectImageFormat(file);
      const dimensions = await getImageDimensions(file);
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        name: file.name,
        originalSize: file.size,
        originalWidth: dimensions.width,
        originalHeight: dimensions.height,
        originalUrl: URL.createObjectURL(file),
        format,
        status: 'pending',
        compressedBlob: null,
        compressedUrl: null,
        compressedSize: 0,
        compressedWidth: 0,
        compressedHeight: 0,
        savingsPercentage: 0,
        settings: { quality: 80, format },
      });
    }

    if (session !== sessionRef.current) {
      newItems.forEach(revokeUrls);
      return;
    }

    setItems((prev) => [...prev, ...newItems]);
    if (!selectedId) setSelectedId(newItems[0].id);

    if (activeTab === 'exif') {
      newItems.forEach((item) => {
        readMetadata(item.file).then((tags) => {
          if (session !== sessionRef.current) return;
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, exifTags: tags, exifOriginalCount: tags.length } : i))
          );
        });
      });
    }
  };

  const needsWork = (item: CompressedFileItem) => {
    if (activeTab === 'converter') return item.status !== 'completed' || item.settings.format !== targetFormat;
    return item.status === 'pending';
  };

  const handleProcessAll = async () => {
    const todo = items.filter(needsWork);
    if (todo.length === 0) return;
    const session = sessionRef.current;
    setIsProcessing(true);

    for (const item of todo) {
      if (session !== sessionRef.current) return;
      setProcessingId(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'converting' } : i)));
      const done = activeTab === 'exif' ? await stripSingleItem(item) : await processSingleItem(item);
      if (session !== sessionRef.current) {
        revokeUrls(done);
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === item.id ? done : i)));
    }

    setProcessingId(null);
    setIsProcessing(false);
  };

  const handleUpdateSettings = async (id: string, newSettings: Partial<CompressionSettings>) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;

    const session = sessionRef.current;
    setProcessingId(id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'converting' } : i)));
    const updated = await processSingleItem(target, { ...target.settings, ...newSettings });
    if (session !== sessionRef.current) {
      revokeUrls(updated);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    setProcessingId(null);
  };

  const handleRemoveExif = async (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;

    const session = sessionRef.current;
    setProcessingId(id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'converting' } : i)));
    const cleaned = await stripSingleItem(target);
    if (session !== sessionRef.current) {
      revokeUrls(cleaned);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? cleaned : i)));
    setProcessingId(null);
  };

  const handleRemoveItem = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (target) revokeUrls(target);
    if (selectedId === id) setSelectedId(items.find((i) => i.id !== id)?.id ?? null);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearAll = () => {
    items.forEach(revokeUrls);
    setItems([]);
    setSelectedId(null);
    setNotice('');
  };

  const outputName = (item: CompressedFileItem) => {
    let ext: string = item.settings.format || item.format;
    if (ext === 'jpeg') ext = 'jpg';
    const base = item.name.includes('.') ? item.name.substring(0, item.name.lastIndexOf('.')) : item.name;
    const suffix = activeTab === 'compressor' ? '-min' : activeTab === 'exif' ? '-clean' : '';
    return `${base}${suffix}.${ext}`;
  };

  const saveBlob = (blob: Blob, filename: string, existingUrl?: string | null) => {
    const url = existingUrl || URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (!existingUrl) setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadItem = (item: CompressedFileItem) => {
    if (item.compressedBlob) saveBlob(item.compressedBlob, outputName(item), item.compressedUrl);
  };

  const handleSaveAll = async () => {
    const ready = items.filter((i) => i.compressedBlob);
    if (ready.length === 0) return;

    if (ready.length === 1) {
      handleDownloadItem(ready[0]);
      return;
    }

    setIsZipping(true);
    try {
      const zip = new JSZip();
      ready.forEach((item) => item.compressedBlob && zip.file(outputName(item), item.compressedBlob));
      saveBlob(await zip.generateAsync({ type: 'blob' }), ZIP_NAMES[activeTab]);
    } catch (err) {
      console.error('Error creating ZIP file:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const selectedItem = items.find((i) => i.id === selectedId) || null;
  const copy = COPY[activeTab];

  return (
    <div className="min-h-screen bg-[#fdfdfd] text-[#333] flex flex-col font-sans">
      <Header />

      <main className="flex-grow max-w-[970px] w-full mx-auto px-4 pt-6 pb-16">
        <div className="text-center max-w-2xl mx-auto mb-6">
          <h1 className="text-3xl font-extrabold text-[#38404B] tracking-tight">{copy.title}</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">{copy.text}</p>
          <ul className="mt-3 text-sm text-slate-500 space-y-0.5">
            {copy.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>

        <MainCardContainer
          activeTab={activeTab}
          onTabChange={handleTabChange}
          items={items}
          selectedId={selectedId}
          onFilesSelected={handleFilesSelected}
          onSelectItem={setSelectedId}
          onRemoveItem={handleRemoveItem}
          onClearAll={handleClearAll}
          onCompressAll={handleProcessAll}
          onSaveAll={handleSaveAll}
          onDownloadItem={handleDownloadItem}
          targetFormat={targetFormat}
          onTargetFormatChange={setTargetFormat}
          unsupportedFormats={unsupportedFormats}
          notice={notice}
          isProcessing={isProcessing}
          isZipping={isZipping}
        />

        {activeTab === 'exif' && (
          <ExifPanel
            item={selectedItem}
            onRemoveExif={handleRemoveExif}
            onDownloadItem={handleDownloadItem}
            isBusy={processingId === selectedId}
          />
        )}

        {activeTab === 'compressor' && (
          <ComparisonPanel
            item={selectedItem}
            onUpdateSettings={handleUpdateSettings}
            isProcessing={processingId === selectedId}
          />
        )}

        <HowItWorks tab={activeTab} />
      </main>

      <Footer />
    </div>
  );
}
