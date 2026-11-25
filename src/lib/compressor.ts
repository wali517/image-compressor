import type { AppTab, CompressionSettings, ImageFormat } from '../types/compressor';
import { compressGif, compressPng } from './palette';

export const MAX_FILES = 20;
export const MAX_OUTPUT_SIZE_BYTES = 25 * 1024; // 25,600 bytes (25 KB)

const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

const EXTENSIONS_BY_FORMAT: Record<ImageFormat, string[]> = {
  jpeg: ['.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp'],
  png: ['.png'],
  webp: ['.webp'],
  gif: ['.gif'],
  avif: ['.avif'],
};

const ACCEPTED_FORMATS: Record<AppTab, ImageFormat[]> = {
  compressor: ['jpeg', 'png', 'webp', 'gif', 'avif'],
  converter: ['jpeg', 'png', 'webp', 'gif', 'avif'],
  exif: ['jpeg', 'png', 'webp', 'gif', 'avif'],
};

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function getFileFormat(file: File): ImageFormat | null {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  for (const format of Object.keys(MIME_BY_FORMAT) as ImageFormat[]) {
    const mimeMatch =
      type === MIME_BY_FORMAT[format] ||
      (format === 'jpeg' && (type === 'image/jpg' || type === 'image/jfif' || type === 'image/pjpeg'));
    if (mimeMatch || EXTENSIONS_BY_FORMAT[format].some((ext) => name.endsWith(ext))) return format;
  }

  // Broad fallback for any image upload
  if (type.startsWith('image/')) {
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('gif')) return 'gif';
    if (type.includes('avif')) return 'avif';
    return 'jpeg';
  }

  return null;
}

export function detectImageFormat(file: File): ImageFormat {
  return getFileFormat(file) ?? 'jpeg';
}

export function isAcceptedFile(file: File, tab: AppTab): boolean {
  const format = getFileFormat(file);
  return format !== null && ACCEPTED_FORMATS[tab].includes(format);
}

export function acceptAttribute(tab: AppTab): string {
  const exts = ACCEPTED_FORMATS[tab].flatMap((format) => EXTENSIONS_BY_FORMAT[format]).join(',');
  return `image/*,${exts}`;
}

export function canEncode(format: ImageFormat): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    canvas.toBlob((blob) => resolve(blob?.type === MIME_BY_FORMAT[format]), MIME_BY_FORMAT[format]);
  });
}

export function loadImage(fileOrBlob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(fileOrBlob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The image could not be read'));
    };
    img.src = url;
  });
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    loadImage(file)
      .then((img) => resolve({ width: img.naturalWidth, height: img.naturalHeight }))
      .catch(() => resolve({ width: 0, height: 0 }));
  });
}

export function renderToBlob(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  format: ImageFormat,
  qualityPercent: number
): Promise<Blob> {
  const targetMime = MIME_BY_FORMAT[format];

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(targetWidth));
    canvas.height = Math.max(1, Math.round(targetHeight));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // White background for JPEG / AVIF to handle transparency cleanly
    if (format === 'jpeg' || format === 'avif') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const quality = Math.max(0.05, Math.min(1, qualityPercent / 100));
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas conversion failed'));
        } else if (format !== 'jpeg' && blob.type !== targetMime) {
          reject(new Error(`This browser cannot create ${format.toUpperCase()} images`));
        } else {
          resolve(blob);
        }
      },
      targetMime,
      quality
    );
  });
}

export async function compressCanvasWithLimit(
  img: HTMLImageElement,
  format: ImageFormat,
  requestedQuality: number = 80,
  maxBytes: number = MAX_OUTPUT_SIZE_BYTES
): Promise<{ blob: Blob; width: number; height: number; appliedQuality: number }> {
  const origWidth = img.naturalWidth || 800;
  const origHeight = img.naturalHeight || 600;

  // Initial scaling cap for large images to avoid excessive memory & time
  let scale = 1.0;
  const maxDim = Math.max(origWidth, origHeight);
  if (maxDim > 1920) {
    scale = 1920 / maxDim;
  }

  let quality = Math.max(5, Math.min(100, requestedQuality));
  let currentWidth = Math.max(1, Math.round(origWidth * scale));
  let currentHeight = Math.max(1, Math.round(origHeight * scale));

  let blob = await renderToBlob(img, currentWidth, currentHeight, format, quality);
  let bestBlob = blob;
  let bestQuality = quality;
  let bestWidth = currentWidth;
  let bestHeight = currentHeight;

  // If already under target size, return immediately
  if (bestBlob.size <= maxBytes) {
    return { blob: bestBlob, width: bestWidth, height: bestHeight, appliedQuality: bestQuality };
  }

  // Stage 1: If quality is high, try stepping down quality first
  while (bestBlob.size > maxBytes && quality > 30) {
    quality = Math.max(25, quality - 15);
    blob = await renderToBlob(img, currentWidth, currentHeight, format, quality);
    if (blob.size < bestBlob.size) {
      bestBlob = blob;
      bestQuality = quality;
    }
    if (bestBlob.size <= maxBytes) {
      return { blob: bestBlob, width: bestWidth, height: bestHeight, appliedQuality: bestQuality };
    }
  }

  // Stage 2: Adaptive scale reduction until strictly <= maxBytes
  let iterations = 0;
  while (bestBlob.size > maxBytes && iterations < 15) {
    iterations++;

    // Calculate scale factor proportionally to sqrt of byte ratio
    const ratio = maxBytes / bestBlob.size;
    const factor = Math.min(0.85, Math.max(0.2, Math.sqrt(ratio) * 0.92));
    scale = Math.max(0.02, scale * factor);

    currentWidth = Math.max(1, Math.round(origWidth * scale));
    currentHeight = Math.max(1, Math.round(origHeight * scale));

    // Restore quality to a crisp level for the newly scaled dimensions
    quality = Math.min(requestedQuality, Math.max(50, quality + 20));

    blob = await renderToBlob(img, currentWidth, currentHeight, format, quality);
    bestBlob = blob;
    bestQuality = quality;
    bestWidth = currentWidth;
    bestHeight = currentHeight;

    if (bestBlob.size <= maxBytes) break;

    // Try lowering quality slightly at this new resolution
    while (bestBlob.size > maxBytes && quality > 20) {
      quality = Math.max(15, quality - 15);
      blob = await renderToBlob(img, currentWidth, currentHeight, format, quality);
      if (blob.size < bestBlob.size) {
        bestBlob = blob;
        bestQuality = quality;
      }
      if (bestBlob.size <= maxBytes) break;
    }
  }

  // Stage 3: Guaranteed fallback safeguard
  if (bestBlob.size > maxBytes) {
    const forcedMax = 350;
    scale = Math.min(scale, forcedMax / Math.max(origWidth, origHeight));
    currentWidth = Math.max(1, Math.round(origWidth * scale));
    currentHeight = Math.max(1, Math.round(origHeight * scale));
    quality = 20;
    bestBlob = await renderToBlob(img, currentWidth, currentHeight, format, quality);
    bestWidth = currentWidth;
    bestHeight = currentHeight;
    bestQuality = quality;
  }

  return { blob: bestBlob, width: bestWidth, height: bestHeight, appliedQuality: bestQuality };
}

export async function convertImage(
  file: File,
  targetFormat: ImageFormat,
  quality: number = 80
): Promise<{ blob: Blob; width: number; height: number; appliedQuality: number }> {
  const img = await loadImage(file);
  return compressCanvasWithLimit(img, targetFormat, quality, MAX_OUTPUT_SIZE_BYTES);
}

export async function compressImage(
  file: File,
  settings: CompressionSettings
): Promise<{
  blob: Blob;
  width: number;
  height: number;
  appliedQuality: number;
  appliedColors?: number;
  isOptimizedOnly?: boolean;
}> {
  const format = detectImageFormat(file);
  let appliedQuality = settings.quality;
  let appliedColors: number | undefined;
  let result: { blob: Blob; width: number; height: number; appliedQuality: number };

  if (format === 'png') {
    const png = await compressPng(file, settings.maxColors);
    appliedColors = png.colors;
    result = { ...png, appliedQuality };
  } else if (format === 'gif') {
    const gif = await compressGif(file, settings.maxColors);
    appliedColors = gif.colors;
    result = { ...gif, appliedQuality };
  } else {
    // jpeg, webp, avif
    const img = await loadImage(file);
    result = await compressCanvasWithLimit(img, format, appliedQuality, MAX_OUTPUT_SIZE_BYTES);
    appliedQuality = result.appliedQuality;
  }

  // If original file was ALREADY under 25KB and our compressed result didn't shrink it,
  // we can keep the original as already optimal.
  // BUT if original file was > 25KB, NEVER keep the original! Always use result.blob <= 25KB.
  if (file.size <= MAX_OUTPUT_SIZE_BYTES && result.blob.size >= file.size) {
    const dims = await getImageDimensions(file);
    return {
      blob: file,
      width: dims.width || result.width,
      height: dims.height || result.height,
      appliedQuality,
      appliedColors,
      isOptimizedOnly: true,
    };
  }

  return {
    blob: result.blob,
    width: result.width,
    height: result.height,
    appliedQuality,
    appliedColors,
    isOptimizedOnly: false,
  };
}
