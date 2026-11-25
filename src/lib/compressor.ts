import type { AppTab, CompressionSettings, ImageFormat } from '../types/compressor';
import { compressGif, compressPng } from './palette';
import UPNG from 'upng-js';
import { quantize, applyPalette } from 'gifenc';

export const MAX_FILES = 20;

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

  // Fallback for image MIME types
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
  format: ImageFormat,
  qualityPercent: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const targetMime = MIME_BY_FORMAT[format];

  return new Promise((resolve, reject) => {
    const width = img.naturalWidth || 800;
    const height = img.naturalHeight || 600;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // White background for JPEG / AVIF when converting transparent images
    if (format === 'jpeg' || format === 'avif') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);

    const quality = Math.max(0.05, Math.min(1, qualityPercent / 100));
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas conversion failed'));
        } else if (format !== 'jpeg' && blob.type !== targetMime) {
          reject(new Error(`This browser cannot create ${format.toUpperCase()} images`));
        } else {
          resolve({ blob, width, height });
        }
      },
      targetMime,
      quality
    );
  });
}

export async function convertImage(
  file: File,
  targetFormat: ImageFormat,
  quality: number = 80
): Promise<{
  blob: Blob;
  width: number;
  height: number;
  appliedQuality: number;
  isOptimizedOnly?: boolean;
}> {
  const img = await loadImage(file);
  const width = img.naturalWidth || 800;
  const height = img.naturalHeight || 600;

  if (targetFormat === 'png') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const rawData = imgData.data;

    let hasAlpha = false;
    for (let i = 0; i < rawData.length; i += 4) {
      if (rawData[i + 3] < 255) {
        hasAlpha = true;
        break;
      }
    }
    const quantFormat = hasAlpha ? 'rgba4444' : 'rgb565';

    // 1. Lossless truecolor PNG
    let bestBlob: Blob;
    try {
      const losslessBuf = new Uint8Array(UPNG.encode([rawData.buffer], width, height, 0));
      bestBlob = new Blob([losslessBuf.buffer as ArrayBuffer], { type: 'image/png' });
    } catch {
      bestBlob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('Canvas toBlob failed'))), 'image/png')
      );
    }

    // 2. Compare against native canvas PNG
    try {
      const canvasBlob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/png'));
      if (canvasBlob && canvasBlob.size < bestBlob.size) {
        bestBlob = canvasBlob;
      }
    } catch {
      // Keep bestBlob
    }

    // 3. If PNG is larger than source file, attempt compression across color steps
    // to achieve size reduction without increasing above original file size
    if (file.size > 0 && bestBlob.size >= file.size) {
      const colorSteps = [256, 192, 128, 96, 64, 48, 32, 16];
      for (const numColors of colorSteps) {
        try {
          const pal = quantize(rawData, numColors, { format: quantFormat });
          const idx = applyPalette(rawData, pal, quantFormat);
          const rec = new Uint8Array(width * height * 4);
          for (let i = 0; i < width * height; i++) {
            const c = pal[idx[i]];
            rec[i * 4] = c[0];
            rec[i * 4 + 1] = c[1];
            rec[i * 4 + 2] = c[2];
            rec[i * 4 + 3] = hasAlpha ? c[3] : 255;
          }
          const quantizedBuf = new Uint8Array(UPNG.encode([rec.buffer], width, height, 0));
          if (quantizedBuf.byteLength < bestBlob.size) {
            bestBlob = new Blob([quantizedBuf.buffer as ArrayBuffer], { type: 'image/png' });
          }
          if (bestBlob.size < file.size) {
            break; // Successfully compressed below original size
          }
        } catch {
          // Keep bestBlob
        }
      }
    }

    // 4. If it could not be compressed during converting (bestBlob.size >= file.size):
    // Do NOT increase size! Keep the exact original size and file stable.
    if (file.size > 0 && bestBlob.size >= file.size) {
      const originalBlob = new Blob([await file.arrayBuffer()], {
        type: MIME_BY_FORMAT[targetFormat] || file.type,
      });
      return {
        blob: originalBlob,
        width,
        height,
        appliedQuality: quality,
        isOptimizedOnly: true,
      };
    }

    return {
      blob: bestBlob,
      width,
      height,
      appliedQuality: quality,
      isOptimizedOnly: false,
    };
  }

  // Other formats: jpeg, webp, avif
  const result = await renderToBlob(img, targetFormat, quality);
  if (file.size > 0 && result.blob.size >= file.size) {
    const originalBlob = new Blob([await file.arrayBuffer()], {
      type: MIME_BY_FORMAT[targetFormat] || file.type,
    });
    return {
      blob: originalBlob,
      width: result.width,
      height: result.height,
      appliedQuality: quality,
      isOptimizedOnly: true,
    };
  }

  return { ...result, appliedQuality: quality, isOptimizedOnly: false };
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
  let result: { blob: Blob; width: number; height: number };

  if (format === 'png') {
    const png = await compressPng(file, settings.maxColors, appliedQuality);
    appliedColors = png.colors;
    result = png;
  } else if (format === 'gif') {
    const gif = await compressGif(file, settings.maxColors);
    appliedColors = gif.colors;
    result = gif;
  } else {
    // jpeg, webp, avif
    const img = await loadImage(file);
    result = await renderToBlob(img, format, appliedQuality);

    // Iteratively search for quality reduction if result is larger than original file
    while (result.blob.size >= file.size && appliedQuality > 15) {
      appliedQuality -= 10;
      const lower = await renderToBlob(img, format, appliedQuality);
      if (lower.blob.size < result.blob.size) {
        result = lower;
      }
    }
  }

  if (result.blob.size >= file.size) {
    return {
      blob: file,
      width: result.width,
      height: result.height,
      appliedQuality,
      appliedColors,
      isOptimizedOnly: true,
    };
  }

  return {
    ...result,
    appliedQuality,
    appliedColors,
    isOptimizedOnly: false,
  };
}
