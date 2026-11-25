import type { AppTab, CompressionSettings, ImageFormat } from '../types/compressor';
import { compressGif, compressPng, encodePngBuffer, quantizeRgbaToPng } from './palette';
import { parseGIF, decompressFrames } from 'gifuct-js';

export const MAX_FILES = 20;

export const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

const EXTENSIONS_BY_FORMAT: Record<ImageFormat, string[]> = {
  jpeg: ['.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp'],
  png: ['.png'],
  webp: ['.webp'],
  gif: ['.gif'],
  avif: ['.avif'],
  svg: ['.svg'],
};

const ACCEPTED_FORMATS: Record<AppTab, ImageFormat[]> = {
  compressor: ['jpeg', 'png', 'webp', 'gif', 'avif', 'svg'],
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

/**
 * Inspect magic bytes / file signatures to reliably verify actual format.
 */
export async function getBufferFormat(buffer: ArrayBuffer): Promise<ImageFormat | null> {
  const bytes = new Uint8Array(buffer.slice(0, 128));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return 'gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  // AVIF detection (ISO Base Media File Format: ftyp box with avif, avis, or compatible brands)
  if (bytes.length >= 12) {
    const ftyp = String.fromCharCode(...bytes.slice(4, 8));
    if (ftyp === 'ftyp') {
      const major = String.fromCharCode(...bytes.slice(8, 12));
      if (major === 'avif' || major === 'avis') return 'avif';
      for (let i = 16; i + 4 <= bytes.length; i += 4) {
        const brand = String.fromCharCode(...bytes.slice(i, i + 4));
        if (brand === 'avif' || brand === 'avis') return 'avif';
      }
    }
  }
  return null;
}

export async function verifyBlobFormat(blob: Blob, expectedFormat: ImageFormat): Promise<boolean> {
  const buffer = await blob.slice(0, 128).arrayBuffer();
  const detected = await getBufferFormat(buffer);
  return detected === expectedFormat;
}

export function getFileFormat(file: File): ImageFormat | null {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  for (const format of Object.keys(MIME_BY_FORMAT) as ImageFormat[]) {
    const mimeMatch =
      type === MIME_BY_FORMAT[format] ||
      (format === 'jpeg' && (type === 'image/jpg' || type === 'image/jfif' || type === 'image/pjpeg')) ||
      (format === 'avif' && (type === 'image/avif' || type === 'image/avif-sequence'));
    if (mimeMatch || EXTENSIONS_BY_FORMAT[format].some((ext) => name.endsWith(ext))) return format;
  }

  // Fallback for image MIME types
  if (type.startsWith('image/')) {
    if (type.includes('svg')) return 'svg';
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('gif')) return 'gif';
    if (type.includes('avif')) return 'avif';
    return 'jpeg';
  }

  return null;
}

export async function detectFileFormatAccurate(file: File): Promise<ImageFormat> {
  try {
    const head = await file.slice(0, 128).arrayBuffer();
    const sig = await getBufferFormat(head);
    if (sig) return sig;
  } catch {
    // Continue with extension / mime detection
  }
  return getFileFormat(file) ?? 'jpeg';
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

export function canEncode(_format: ImageFormat): Promise<boolean> {
  // All formats are supported: AVIF via fast backend API, others via native canvas
  return Promise.resolve(true);
}

export async function convertViaApi(
  file: File | Blob,
  targetFormat: ImageFormat,
  quality: number,
  maxColors?: number
): Promise<ProcessResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('format', targetFormat);
  formData.append('quality', String(quality));
  if (maxColors) formData.append('maxColors', String(maxColors));

  const res = await fetch('/api/convert', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Conversion to ${targetFormat.toUpperCase()} failed`);
  }

  const blob = await res.blob();
  const width = Number(res.headers.get('X-Image-Width')) || 0;
  const height = Number(res.headers.get('X-Image-Height')) || 0;
  const isLarger = file.size > 0 && blob.size > file.size;

  return {
    blob,
    width,
    height,
    appliedQuality: quality,
    appliedColors: maxColors,
    isOptimizedOnly: false,
    isLargerThanSource: isLarger,
    message: isLarger
      ? `${targetFormat.toUpperCase()} conversion completed, but the file is larger than the original.`
      : undefined,
  };
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
      reject(new Error('The image could not be read or is corrupted'));
    };
    img.src = url;
  });
}

export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  // If it's a GIF, check LSD dimensions to be accurate
  try {
    const head = await file.slice(0, 16).arrayBuffer();
    const sig = await getBufferFormat(head);
    if (sig === 'gif') {
      const full = await file.arrayBuffer();
      const gif = parseGIF(full);
      if (gif.lsd.width > 0 && gif.lsd.height > 0) {
        return { width: gif.lsd.width, height: gif.lsd.height };
      }
    }
  } catch {
    // Fallback to loadImage
  }

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
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (width <= 0 || height <= 0) {
      reject(new Error('Invalid image dimensions'));
      return;
    }

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

    // White background for transparent areas when converting to JPEG or AVIF without transparency
    if (format === 'jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);

    const quality = Math.max(0.05, Math.min(1, qualityPercent / 100));
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas conversion failed'));
        } else if (blob.type !== targetMime && format !== 'jpeg') {
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

export interface ProcessResult {
  blob: Blob;
  width: number;
  height: number;
  appliedQuality: number;
  appliedColors?: number;
  isOptimizedOnly?: boolean;
  isLargerThanSource?: boolean;
  message?: string;
}

/**
 * High-performance conversion ensuring 100% genuine output format,
 * exact pixel dimensions preservation, transparency handling, and format signature validation.
 */
export async function convertImage(
  file: File,
  targetFormat: ImageFormat,
  quality: number = 80,
  maxColors?: number
): Promise<ProcessResult> {
  // Always try server API (sharp / libvips) first for instant C++ conversion, EXIF auto-rotation, and full color fidelity
  try {
    const apiResult = await convertViaApi(file, targetFormat, quality, maxColors);
    if (apiResult && apiResult.blob && apiResult.blob.size > 0) {
      return apiResult;
    }
  } catch {
    // Fall back to client-side conversion (e.g. offline or unit test environment)
  }

  const srcFormat = await detectFileFormatAccurate(file);

  // If source is an animated GIF and target is PNG, preserve animation into APNG!
  if (srcFormat === 'gif' && targetFormat === 'png') {
    try {
      const buffer = await file.arrayBuffer();
      const gif = parseGIF(buffer);
      const frames = decompressFrames(gif, true);
      const width = gif.lsd.width;
      const height = gif.lsd.height;

      if (frames.length > 1) {
        // Multi-frame animated GIF -> APNG
        const composed: ArrayBuffer[] = [];
        const canvas = new Uint8ClampedArray(width * height * 4);
        let snapshot: Uint8ClampedArray | null = null;
        let previous: (typeof frames)[number] | null = null;

        for (const frame of frames) {
          if (previous) {
            if (previous.disposalType === 2) {
              for (let y = 0; y < previous.dims.height; y++) {
                const s = ((previous.dims.top + y) * width + previous.dims.left) * 4;
                canvas.fill(0, s, s + previous.dims.width * 4);
              }
            } else if (previous.disposalType === 3 && snapshot) {
              canvas.set(snapshot);
            }
          }
          snapshot = frame.disposalType === 3 ? new Uint8ClampedArray(canvas) : null;
          // draw patch
          for (let y = 0; y < frame.dims.height; y++) {
            for (let x = 0; x < frame.dims.width; x++) {
              const src = (y * frame.dims.width + x) * 4;
              if (frame.patch[src + 3] === 0) continue;
              const dst = ((frame.dims.top + y) * width + frame.dims.left + x) * 4;
              canvas[dst] = frame.patch[src];
              canvas[dst + 1] = frame.patch[src + 1];
              canvas[dst + 2] = frame.patch[src + 2];
              canvas[dst + 3] = frame.patch[src + 3];
            }
          }
          composed.push(canvas.slice().buffer);
          previous = frame;
        }

        const delays = frames.map((f) => f.delay);
        const apngBuf = encodePngBuffer(composed, width, height, 0, delays);
        const apngBlob = new Blob([apngBuf], { type: 'image/png' });

        return {
          blob: apngBlob,
          width,
          height,
          appliedQuality: quality,
          isOptimizedOnly: false,
          isLargerThanSource: apngBlob.size > file.size,
          message:
            apngBlob.size > file.size
              ? 'PNG conversion completed, but the PNG file is larger than the original GIF.'
              : undefined,
        };
      }
    } catch {
      // Fallback to static frame conversion below
    }
  }

  // Load image to extract exact dimensions & pixels
  const img = await loadImage(file);
  const width = img.naturalWidth;
  const height = img.naturalHeight;

  if (width <= 0 || height <= 0) {
    throw new Error('Image dimensions could not be determined or are invalid.');
  }

  if (targetFormat === 'png') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create canvas context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const rawData = new Uint8Array(imgData.data.buffer);

    let hasAlpha = false;
    for (let i = 0; i < rawData.length; i += 4) {
      if (rawData[i + 3] < 255) {
        hasAlpha = true;
        break;
      }
    }

    // 1. Lossless truecolor / auto-palette PNG (Level 9 multi-filter)
    let bestBlob: Blob;
    try {
      const losslessBuf = encodePngBuffer([rawData.buffer], width, height, 0);
      bestBlob = new Blob([losslessBuf], { type: 'image/png' });
    } catch {
      bestBlob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('Canvas toBlob failed'))), 'image/png')
      );
    }

    // 2. Also compare with browser native canvas PNG
    try {
      const canvasBlob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/png'));
      if (canvasBlob && canvasBlob.size < bestBlob.size) {
        bestBlob = canvasBlob;
      }
    } catch {
      // Keep bestBlob
    }

    // 3. Controlled palette quantization only if user explicitly requested maxColors < 256
    let appliedColors = 256;
    if (maxColors != null && maxColors < 256) {
      try {
        const qBuf = quantizeRgbaToPng(rawData, width, height, maxColors, hasAlpha);
        bestBlob = new Blob([qBuf.buffer as ArrayBuffer], { type: 'image/png' });
        appliedColors = maxColors;
      } catch {
        // Keep bestBlob
      }
    }

    // Strictly verify signature of generated PNG (never return non-PNG data)
    const isValid = await verifyBlobFormat(bestBlob, 'png');
    if (!isValid) {
      throw new Error('Generated file failed PNG signature validation');
    }

    const isLarger = file.size > 0 && bestBlob.size > file.size;

    return {
      blob: bestBlob,
      width,
      height,
      appliedQuality: quality,
      appliedColors,
      isOptimizedOnly: false,
      isLargerThanSource: isLarger,
      message: isLarger
        ? `PNG conversion completed, but the PNG file (${formatBytes(bestBlob.size)}) is larger than the original ${srcFormat.toUpperCase()} (${formatBytes(file.size)}).`
        : undefined,
    };
  }

  if (targetFormat === 'avif') {
    return convertViaApi(file, 'avif', quality);
  }

  // Target formats: jpeg, webp
  const result = await renderToBlob(img, targetFormat, quality);

  // Validate format signature
  const isValid = await verifyBlobFormat(result.blob, targetFormat);
  if (!isValid) {
    throw new Error(`Generated file failed ${targetFormat.toUpperCase()} signature validation`);
  }

  const isLarger = file.size > 0 && result.blob.size > file.size;

  return {
    blob: result.blob,
    width,
    height,
    appliedQuality: quality,
    isOptimizedOnly: false,
    isLargerThanSource: isLarger,
    message: isLarger
      ? `${targetFormat.toUpperCase()} conversion completed, but the file is larger than the original.`
      : undefined,
  };
}

/**
 * Intelligent compression preserving exact pixel dimensions and aspect ratio.
 */
export async function compressImage(
  file: File | Blob,
  settings: CompressionSettings
): Promise<ProcessResult> {
  const format =
    settings.format ||
    (file instanceof File ? await detectFileFormatAccurate(file) : 'jpeg');

  let appliedQuality = settings.quality;
  let appliedColors: number | undefined;
  let resultBlob: Blob;
  let width = 0;
  let height = 0;

  if (format === 'svg') {
    // SVG optimization: remove comments, redundant whitespace, metadata
    const text = await (file as Blob).text();
    const cleaned = text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\?xml[\s\S]*?\?>/i, '')
      .replace(/>\s+</g, '><')
      .trim();
    resultBlob = new Blob([cleaned], { type: 'image/svg+xml' });
    width = 100;
    height = 100;
  } else if (format === 'png') {
    const png = await compressPng(file, settings.maxColors, appliedQuality);
    appliedColors = png.colors;
    resultBlob = png.blob;
    width = png.width;
    height = png.height;
  } else if (format === 'gif') {
    const gif = await compressGif(file, settings.maxColors);
    appliedColors = gif.colors;
    resultBlob = gif.blob;
    width = gif.width;
    height = gif.height;
  } else if (format === 'avif') {
    const apiResult = await convertViaApi(file, 'avif', appliedQuality);
    resultBlob = apiResult.blob;
    width = apiResult.width;
    height = apiResult.height;
  } else {
    // jpeg, webp
    const img = await loadImage(file);
    width = img.naturalWidth;
    height = img.naturalHeight;

    const render = await renderToBlob(img, format, appliedQuality);
    resultBlob = render.blob;
  }

  if (width <= 0 || height <= 0) {
    throw new Error('Processed image dimensions could not be verified.');
  }

  // Validate output file signature
  if (format !== 'svg') {
    const isValid = await verifyBlobFormat(resultBlob, format);
    if (!isValid) {
      throw new Error(`Compressed file failed ${format.toUpperCase()} signature validation.`);
    }
  }

  const isCustomSettings =
    (settings.quality !== undefined && settings.quality !== 80) ||
    settings.maxColors !== undefined;
  const isOptimizedOnly = !isCustomSettings && file.size > 0 && resultBlob.size >= file.size;

  return {
    blob: isOptimizedOnly ? file : resultBlob,
    width,
    height,
    appliedQuality,
    appliedColors,
    isOptimizedOnly,
    message: isOptimizedOnly ? 'Already optimized' : undefined,
  };
}
