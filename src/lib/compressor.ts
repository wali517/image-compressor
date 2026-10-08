import { CompressionSettings, ImageFormat, ExifTag } from '../types/compressor';

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function detectImageFormat(file: File): ImageFormat {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (type.includes('jpeg') || type.includes('jpg') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return 'jpeg';
  }
  if (type.includes('png') || name.endsWith('.png')) {
    return 'png';
  }
  if (type.includes('webp') || name.endsWith('.webp')) {
    return 'webp';
  }
  if (type.includes('gif') || name.endsWith('.gif')) {
    return 'gif';
  }
  if (type.includes('svg') || name.endsWith('.svg') || name.endsWith('.svgz')) {
    return 'svg';
  }
  if (type.includes('avif') || name.endsWith('.avif')) {
    return 'avif';
  }

  return 'jpeg';
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const format = detectImageFormat(file);
    if (format === 'svg') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        
        let width = 800;
        let height = 600;

        if (svg) {
          const viewBox = svg.getAttribute('viewBox');
          if (viewBox) {
            const parts = viewBox.split(/[\s,]+/).map(Number);
            if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
              width = parts[2];
              height = parts[3];
            }
          }
          if (svg.getAttribute('width')) {
            const w = parseFloat(svg.getAttribute('width') || '0');
            if (w > 0) width = w;
          }
          if (svg.getAttribute('height')) {
            const h = parseFloat(svg.getAttribute('height') || '0');
            if (h > 0) height = h;
          }
        }
        resolve({ width: Math.round(width), height: Math.round(height) });
      };
      reader.onerror = () => resolve({ width: 800, height: 600 });
      reader.readAsText(file);
    } else {
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
    }
  });
}

export async function compressSvg(file: File): Promise<Blob> {
  const text = await file.text();
  
  const cleaned = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<metadata>[\s\S]*?<\/metadata>/gi, '')
    .replace(/<(title|desc)>\s*<\/(title|desc)>/gi, '')
    .replace(/>\s+</g, '><')
    .replace(/(\d+\.\d{3,})/g, (match) => parseFloat(match).toFixed(2).replace(/\.?0+$/, ''))
    .trim();

  return new Blob([cleaned], { type: 'image/svg+xml;charset=utf-8' });
}

function applyPngColorQuantization(ctx: CanvasRenderingContext2D, width: number, height: number, maxColors: number) {
  if (maxColors >= 256) return;
  
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  
  const levels = Math.max(2, Math.min(256, maxColors));
  const step = 256 / Math.cbrt(levels);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(data[i] / step) * step;
    data[i + 1] = Math.floor(data[i + 1] / step) * step;
    data[i + 2] = Math.floor(data[i + 2] / step) * step;
    if (data[i + 3] < 16) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

function canvasProcess(
  file: File,
  targetMime: string,
  qualityPercent: number,
  format: ImageFormat,
  settings: CompressionSettings
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      const width = img.naturalWidth || 800;
      const height = img.naturalHeight || 600;

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

      if (format === 'png') {
        const maxCols = settings.maxColors || (qualityPercent < 100 ? Math.round((qualityPercent / 100) * 256) : 256);
        applyPngColorQuantization(ctx, width, height, maxCols);
      }

      const qualityDecimal = Math.max(0.05, Math.min(1.0, qualityPercent / 100));

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, width, height });
          } else {
            reject(new Error('Canvas conversion failed'));
          }
        },
        targetMime,
        qualityDecimal
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

/**
 * Image Conversion (Converter mode)
 */
export async function convertImage(
  file: File,
  targetFormat: ImageFormat,
  quality: number = 80
): Promise<{ blob: Blob; width: number; height: number; appliedQuality: number }> {
  if (targetFormat === 'svg') {
    const blob = await compressSvg(file);
    const dimensions = await getImageDimensions(file);
    return { blob, width: dimensions.width, height: dimensions.height, appliedQuality: 100 };
  }

  let targetMime = 'image/jpeg';
  if (targetFormat === 'png') targetMime = 'image/png';
  else if (targetFormat === 'webp') targetMime = 'image/webp';
  else if (targetFormat === 'gif') targetMime = 'image/gif';
  else if (targetFormat === 'avif') targetMime = 'image/avif';

  let currentQuality = quality;
  let bestResult = await canvasProcess(file, targetMime, currentQuality, targetFormat, { quality, format: targetFormat });

  // Size reduction guarantee: if converted file size is larger than original, step down quality
  while (bestResult.blob.size >= file.size && currentQuality > 15) {
    currentQuality -= 10;
    try {
      const lowerResult = await canvasProcess(file, targetMime, currentQuality, targetFormat, { quality: currentQuality, format: targetFormat });
      if (lowerResult.blob.size < bestResult.blob.size) {
        bestResult = lowerResult;
      }
    } catch {
      break;
    }
  }

  return {
    blob: bestResult.blob,
    width: bestResult.width,
    height: bestResult.height,
    appliedQuality: currentQuality,
  };
}

/**
 * Image Compression (Compressor mode) with strict size reduction guarantee
 */
export async function compressImage(
  file: File,
  settings: CompressionSettings
): Promise<{ blob: Blob; width: number; height: number; appliedQuality: number; isOptimizedOnly?: boolean }> {
  const format = settings.format || detectImageFormat(file);

  if (format === 'svg') {
    const blob = await compressSvg(file);
    const dimensions = await getImageDimensions(file);
    return { blob, width: dimensions.width, height: dimensions.height, appliedQuality: 100 };
  }

  let targetMime = file.type;
  if (format === 'jpeg') targetMime = 'image/jpeg';
  else if (format === 'webp') targetMime = 'image/webp';
  else if (format === 'png') targetMime = 'image/png';
  else if (format === 'gif') targetMime = 'image/gif';

  let currentQuality = settings.quality;
  let bestResult = await canvasProcess(file, targetMime, currentQuality, format, settings);

  // STRICT GUARANTEE: Step down quality iteratively until compressed size < original file size
  while (bestResult.blob.size >= file.size && currentQuality > 15) {
    currentQuality -= 10;
    try {
      const lowerResult = await canvasProcess(file, targetMime, currentQuality, format, settings);
      if (lowerResult.blob.size < bestResult.blob.size) {
        bestResult = lowerResult;
      }
    } catch {
      break;
    }
  }

  // If still larger, convert to WebP
  if (bestResult.blob.size >= file.size) {
    try {
      const webpResult = await canvasProcess(file, 'image/webp', currentQuality, 'webp', settings);
      if (webpResult.blob.size < bestResult.blob.size) {
        bestResult = webpResult;
      }
    } catch {
      // Keep best
    }
  }

  // Fallback protection: If file is already hyper-compressed and canvas cannot reduce further without corruption,
  // use original file as blob so output size NEVER exceeds input size!
  let isOptimizedOnly = false;
  if (bestResult.blob.size > file.size) {
    bestResult.blob = file;
    isOptimizedOnly = true;
  }

  return {
    blob: bestResult.blob,
    width: bestResult.width,
    height: bestResult.height,
    appliedQuality: currentQuality,
    isOptimizedOnly,
  };
}

export async function extractExifTags(file: File): Promise<ExifTag[]> {
  const dimensions = await getImageDimensions(file);
  return [
    { name: 'File Name', value: file.name },
    { name: 'File Size', value: formatBytes(file.size) },
    { name: 'MIME Type', value: file.type || 'image/' + detectImageFormat(file) },
    { name: 'Dimensions', value: `${dimensions.width} x ${dimensions.height} px` },
    { name: 'Last Modified', value: new Date(file.lastModified).toLocaleString() },
    { name: 'Color Space', value: 'sRGB' },
    { name: 'Compression', value: detectImageFormat(file).toUpperCase() },
    { name: 'EXIF Metadata', value: 'Cleaned / Stripped' },
  ];
}
