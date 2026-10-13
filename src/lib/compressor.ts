import type { AppTab, CompressionSettings, ImageFormat } from '../types/compressor';
import { compressGif, compressPng } from './palette';

export const MAX_FILES = 20;

const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

const EXTENSIONS_BY_FORMAT: Record<ImageFormat, string[]> = {
  jpeg: ['.jpg', '.jpeg'],
  png: ['.png'],
  webp: ['.webp'],
  gif: ['.gif'],
  avif: ['.avif'],
};

const ACCEPTED_FORMATS: Record<AppTab, ImageFormat[]> = {
  compressor: ['jpeg', 'png', 'webp', 'gif'],
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
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  for (const format of Object.keys(MIME_BY_FORMAT) as ImageFormat[]) {
    const mimeMatch = type === MIME_BY_FORMAT[format] || (format === 'jpeg' && type === 'image/jpg');
    if (mimeMatch || EXTENSIONS_BY_FORMAT[format].some((ext) => name.endsWith(ext))) return format;
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
  return ACCEPTED_FORMATS[tab].flatMap((format) => EXTENSIONS_BY_FORMAT[format]).join(',');
}

export function canEncode(format: ImageFormat): Promise<boolean> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    canvas.toBlob((blob) => resolve(blob?.type === MIME_BY_FORMAT[format]), MIME_BY_FORMAT[format]);
  });
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const dimensions = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dimensions);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

function canvasEncode(
  file: File,
  format: ImageFormat,
  qualityPercent: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const targetMime = MIME_BY_FORMAT[format];

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

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
          } else if (blob.type !== targetMime) {
            reject(new Error(`This browser cannot create ${format.toUpperCase()} images`));
          } else {
            resolve({ blob, width, height });
          }
        },
        targetMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The image could not be read'));
    };

    img.src = url;
  });
}

export async function convertImage(
  file: File,
  targetFormat: ImageFormat,
  quality: number = 80
): Promise<{ blob: Blob; width: number; height: number; appliedQuality: number }> {
  const result = await canvasEncode(file, targetFormat, quality);
  return { ...result, appliedQuality: quality };
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
    const png = await compressPng(file, settings.maxColors);
    appliedColors = png.colors;
    result = png;
  } else if (format === 'gif') {
    const gif = await compressGif(file, settings.maxColors);
    appliedColors = gif.colors;
    result = gif;
  } else if (format === 'jpeg' || format === 'webp') {
    result = await canvasEncode(file, format, appliedQuality);
    while (result.blob.size >= file.size && appliedQuality > 15) {
      appliedQuality -= 10;
      const lower = await canvasEncode(file, format, appliedQuality);
      if (lower.blob.size < result.blob.size) result = lower;
    }
  } else {
    throw new Error('AVIF files cannot be compressed here. Use the Converter tab instead.');
  }

  if (result.blob.size >= file.size) {
    return { blob: file, width: result.width, height: result.height, appliedQuality, appliedColors, isOptimizedOnly: true };
  }
  return { ...result, appliedQuality, appliedColors, isOptimizedOnly: false };
}
