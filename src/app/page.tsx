'use client';

import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { CompressedFileItem, CompressionSettings, AppTab, ImageFormat } from '../types/compressor';
import {
  compressImage,
  convertImage,
  detectImageFormat,
  getImageDimensions,
  extractExifTags,
} from '../lib/compressor';
import { Header } from '../components/Header';
import { MainCardContainer } from '../components/MainCardContainer';
import { ComparisonPanel } from '../components/ComparisonPanel';
import { ExifPanel } from '../components/ExifPanel';
import { HowItWorks } from '../components/HowItWorks';
import { Footer } from '../components/Footer';

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>('compressor');
  
  // SEPARATE FILE QUEUES FOR CONVERTER AND COMPRESSOR
  const [converterItems, setConverterItems] = useState<CompressedFileItem[]>([]);
  const [compressorItems, setCompressorItems] = useState<CompressedFileItem[]>([]);
  const itemsRef = useRef<CompressedFileItem[]>([]);
  useEffect(() => {
    itemsRef.current = [...converterItems, ...compressorItems];
  }, [converterItems, compressorItems]);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [targetFormat, setTargetFormat] = useState<ImageFormat>('webp');

  // Active items list based on active tab
  const items = activeTab === 'converter' ? converterItems : compressorItems;
  const setItems = activeTab === 'converter' ? setConverterItems : setCompressorItems;

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
        if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
      });
    };
  }, []);

  const processSingleItem = async (
    item: CompressedFileItem,
    customSettings?: CompressionSettings
  ): Promise<CompressedFileItem> => {
    const settings = customSettings || item.settings;

    try {
      // Simulate realistic processing time (~1.2s delay) so user sees "PROCESSING..." sign
      await new Promise((res) => setTimeout(res, 1200));

      let result;
      if (activeTab === 'converter') {
        result = await convertImage(item.file, targetFormat, settings.quality);
      } else {
        result = await compressImage(item.file, settings);
      }

      const compressedUrl = URL.createObjectURL(result.blob);
      const compressedSize = result.blob.size;
      const isOptimizedOnly = 'isOptimizedOnly' in result ? result.isOptimizedOnly : false;
      const savings =
        item.originalSize > 0 && !isOptimizedOnly
          ? Math.max(0, Math.round(((item.originalSize - compressedSize) / item.originalSize) * 100))
          : 0;

      if (item.compressedUrl) {
        URL.revokeObjectURL(item.compressedUrl);
      }

      const exifTags = await extractExifTags(item.file);

      return {
        ...item,
        status: isOptimizedOnly ? 'optimized' : 'completed',
        compressedBlob: result.blob,
        compressedUrl,
        compressedSize,
        compressedWidth: result.width,
        compressedHeight: result.height,
        savingsPercentage: savings,
        exifTags,
        settings: {
          ...settings,
          format: activeTab === 'converter' ? targetFormat : settings.format,
          quality: 'appliedQuality' in result ? result.appliedQuality : settings.quality,
        },
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Processing failed';
      console.error(`Error processing ${item.name}:`, err);
      return {
        ...item,
        status: 'error',
        error: errorMessage,
      };
    }
  };

  const handleFilesSelected = async (newFiles: File[]) => {
    const newItems: CompressedFileItem[] = [];

    if (newFiles.length > 0) {
      const firstFmt = detectImageFormat(newFiles[0]);
      if (activeTab === 'converter') {
        // Automatically select a valid target format different from uploaded file
        setTargetFormat(firstFmt === 'png' ? 'webp' : 'png');
      }
    }

    for (const file of newFiles) {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const format = detectImageFormat(file);
      const originalUrl = URL.createObjectURL(file);
      const dimensions = await getImageDimensions(file);

      const newItem: CompressedFileItem = {
        id,
        file,
        name: file.name,
        originalSize: file.size,
        originalWidth: dimensions.width,
        originalHeight: dimensions.height,
        originalUrl,
        format,
        status: 'converting', // Show "PROCESSING..." sign initially
        compressedBlob: null,
        compressedUrl: null,
        compressedSize: 0,
        compressedWidth: 0,
        compressedHeight: 0,
        savingsPercentage: 0,
        settings: {
          quality: 80,
          format: activeTab === 'converter' ? targetFormat : format,
          maxColors: 256,
        },
      };

      newItems.push(newItem);
    }

    setItems((prev) => [...prev, ...newItems]);

    if (!selectedId && newItems.length > 0) {
      setSelectedId(newItems[0].id);
    }

    // Process files with visual "PROCESSING..." status overlay
    for (const item of newItems) {
      setProcessingId(item.id);
      const compressed = await processSingleItem(item);

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? compressed : i))
      );
    }
    setProcessingId(null);
  };

  const handleUpdateSettings = async (
    id: string,
    newSettings: Partial<CompressionSettings>
  ) => {
    const targetItem = items.find((i) => i.id === id);
    if (!targetItem) return;

    setProcessingId(id);
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'converting' } : i))
    );

    const mergedSettings: CompressionSettings = {
      ...targetItem.settings,
      ...newSettings,
    };

    const updatedItem = await processSingleItem(targetItem, mergedSettings);

    setItems((prev) => prev.map((i) => (i.id === id ? updatedItem : i)));
    setProcessingId(null);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const itemToRemove = prev.find((i) => i.id === id);
      if (itemToRemove) {
        if (itemToRemove.originalUrl) URL.revokeObjectURL(itemToRemove.originalUrl);
        if (itemToRemove.compressedUrl) URL.revokeObjectURL(itemToRemove.compressedUrl);
      }

      const filtered = prev.filter((i) => i.id !== id);
      if (selectedId === id) {
        setSelectedId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const handleClearAll = () => {
    items.forEach((item) => {
      if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
    });
    setItems([]);
    setSelectedId(null);
  };

  const handleCompressAll = async () => {
    if (items.length === 0) return;
    setIsProcessing(true);

    for (const item of items) {
      setProcessingId(item.id);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'converting' } : i))
      );

      const compressed = await processSingleItem(item);

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? compressed : i))
      );
    }

    setProcessingId(null);
    setIsProcessing(false);
  };

  const handleDownloadItem = (item: CompressedFileItem) => {
    if (!item.compressedBlob) return;

    let ext = (item.settings.format || item.format).toString();
    if (ext === 'jpeg') ext = 'jpg';

    const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
    const filename = `${baseName}-min.${ext}`;

    const link = document.createElement('a');
    link.href = item.compressedUrl || URL.createObjectURL(item.compressedBlob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllZip = async () => {
    const completedItems = items.filter((i) => i.compressedBlob);
    if (completedItems.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();

      completedItems.forEach((item) => {
        let ext = (item.settings.format || item.format).toString();
        if (ext === 'jpeg') ext = 'jpg';
        const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
        const filename = `${baseName}-min.${ext}`;

        if (item.compressedBlob) {
          zip.file(filename, item.compressedBlob);
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'imagecompressor-files.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error creating ZIP file:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const selectedItem = items.find((i) => i.id === selectedId) || null;

  return (
    <div className="min-h-screen bg-[#fdfdfd] text-[#333] flex flex-col font-sans">
      <Header />

      <main className="grow max-w-242.5 w-full mx-auto px-4 pt-6 pb-16">
        {/* Header Title */}
        <div className="text-center max-w-2xl mx-auto mb-6">
          <h1 className="text-3xl font-extrabold text-[#38404B] tracking-tight">
            {activeTab === 'converter'
              ? 'Convert Images Online'
              : activeTab === 'exif'
              ? 'EXIF Metadata Inspector'
              : 'Compress Images Online'}
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {activeTab === 'converter'
              ? 'Convert your JPEG, PNG, WebP, GIF, SVG, and AVIF images online.'
              : activeTab === 'exif'
              ? 'View camera info, exposure details, and strip metadata from images.'
              : 'Compress and optimize your JPEG, PNG, WebP, GIF, and SVG images.'}
          </p>
        </div>

        {/* Main Card Container */}
        <MainCardContainer
          activeTab={activeTab}
          onTabChange={setActiveTab}
          items={items}
          selectedId={selectedId}
          onFilesSelected={handleFilesSelected}
          onSelectItem={setSelectedId}
          onRemoveItem={handleRemoveItem}
          onClearAll={handleClearAll}
          onCompressAll={handleCompressAll}
          onDownloadAllZip={handleDownloadAllZip}
          onDownloadItem={handleDownloadItem}
          targetFormat={targetFormat}
          onTargetFormatChange={setTargetFormat}
          isProcessing={isProcessing}
          isZipping={isZipping}
        />

        {/* Comparison or EXIF Panel */}
        {activeTab === 'exif' ? (
          <ExifPanel item={selectedItem} />
        ) : (
          <ComparisonPanel
            item={selectedItem}
            onUpdateSettings={handleUpdateSettings}
            onDownloadItem={handleDownloadItem}
            isProcessing={processingId === selectedId}
          />
        )}

        {/* How It Works Section */}
        <HowItWorks />
      </main>

      <Footer />
    </div>
  );
}
