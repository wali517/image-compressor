import type { AppTab, CompressionSettings, ImageFormat } from '../types/compressor';
import { compressGif, compressPng } from './palette';
import UPNG from 'upng-js';

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
): Promise<{ blob: Blob; width: number; height: number; appliedQuality: number }> {
  const img = await loadImage(file);
  const width = img.naturalWidth || 800;
  const height = img.naturalHeight || 600;

  if (targetFormat === 'png') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // When converting JPEG to PNG, standard canvas PNG can balloon heavily.
    // Ensure size does not increase by more than 25 KB above the original file.
    const maxAllowedBytes = file.size > 0 ? file.size + 25 * 1024 : Infinity;

    // Check standard canvas PNG first (in case it is already within limits)
    const canvasBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );

    if (canvasBlob && canvasBlob.size <= maxAllowedBytes) {
      return { blob: canvasBlob, width, height, appliedQuality: quality };
    }

    // Standard canvas PNG is too large; compress using UPNG palette quantization
    // while keeping 100% of the original width, height, shape, and pixel resolution!
    const imgData = ctx.getImageData(0, 0, width, height);
    const frames = [imgData.data.buffer];

    let colors = 256;
    let encoded = UPNG.encode(frames, width, height, colors);

    while (encoded.byteLength > maxAllowedBytes && colors > 32) {
      colors = Math.max(32, Math.floor(colors * 0.75));
      const nextEncoded = UPNG.encode(frames, width, height, colors);
      if (nextEncoded.byteLength < encoded.byteLength) {
        encoded = nextEncoded;
      }
    }

    const pngBlob = new Blob([encoded], { type: 'image/png' });
    return { blob: pngBlob, width, height, appliedQuality: quality };
  }

  const result = await renderToBlob(img, targetFormat, quality);
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
