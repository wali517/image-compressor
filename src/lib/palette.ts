import UPNG from 'upng-js';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export interface PaletteResult {
  blob: Blob;
  width: number;
  height: number;
  colors: number;
}

const clampColors = (value: number) => Math.min(256, Math.max(2, Math.round(value)));

export function countColors(rgba: Uint8Array, limit = 256): number {
  const seen = new Set<number>();
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3];
    const key = alpha === 0 ? 0 : ((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]) * 256 + alpha;
    seen.add(key);
    if (seen.size > limit) break;
  }
  return seen.size;
}

export async function compressPng(
  file: Blob,
  maxColors?: number,
  quality: number = 80
): Promise<PaletteResult> {
  let frames: ArrayBuffer[] | null = null;
  let width = 0;
  let height = 0;
  let delays: number[] | undefined;

  // Attempt 1: Direct UPNG decode (fast path for standard PNGs)
  try {
    const buffer = await file.arrayBuffer();
    const decoded = UPNG.decode(buffer);
    const rgbaFrames = UPNG.toRGBA8(decoded);
    if (rgbaFrames && rgbaFrames.length > 0 && decoded.width > 0 && decoded.height > 0) {
      frames = rgbaFrames;
      width = decoded.width;
      height = decoded.height;
      delays = decoded.frames ? decoded.frames.map((f: { delay: number }) => f.delay) : undefined;
    }
  } catch {
    // UPNG.decode failed (e.g. non-PNG header, interlaced, 16-bit, or custom chunks)
    // Fallback to browser canvas decoding below
  }

  // Attempt 2: Decode via native Image & Canvas (bulletproof for any image payload)
  if ((!frames || frames.length === 0) && typeof document !== 'undefined') {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        const url = URL.createObjectURL(file);
        i.onload = () => {
          URL.revokeObjectURL(url);
          resolve(i);
        };
        i.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load image'));
        };
        i.src = url;
      });

      width = img.naturalWidth || 800;
      height = img.naturalHeight || 600;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, width, height);
      const imgData = ctx.getImageData(0, 0, width, height);
      frames = [imgData.data.buffer];
    } catch {
      return {
        blob: file,
        width: 0,
        height: 0,
        colors: 256,
      };
    }
  }

  if (!frames || frames.length === 0 || width === 0 || height === 0) {
    return {
      blob: file,
      width: 0,
      height: 0,
      colors: 256,
    };
  }

  const rawData = new Uint8Array(frames[0]);
  let hasAlpha = false;
  for (let i = 0; i < rawData.length; i += 4) {
    if (rawData[i + 3] < 255) {
      hasAlpha = true;
      break;
    }
  }
  const quantFormat = hasAlpha ? 'rgba4444' : 'rgb565';

  const encodeQuantized = (numColors: number): Uint8Array => {
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
      return new Uint8Array(UPNG.encode([rec.buffer], width, height, 0, delays));
    } catch {
      return new Uint8Array(UPNG.encode(frames!, width, height, numColors, delays));
    }
  };

  let losslessBuf: Uint8Array | null = null;
  try {
    losslessBuf = new Uint8Array(UPNG.encode(frames, width, height, 0, delays));
  } catch {
    // Lossless encode failed
  }

  let bestEncoded: Uint8Array | null = null;
  let bestColors = 256;

  if (maxColors != null) {
    const userColors = clampColors(maxColors);
    bestEncoded = encodeQuantized(userColors);
    bestColors = userColors;

    if (bestEncoded.byteLength >= file.size) {
      if (losslessBuf && losslessBuf.byteLength < file.size) {
        bestEncoded = losslessBuf;
        bestColors = 256;
      } else {
        const stepCandidates = [192, 128, 96, 64, 48, 32, 16];
        for (const c of stepCandidates) {
          if (c >= userColors) continue;
          const candidate = encodeQuantized(c);
          if (candidate.byteLength < file.size) {
            bestEncoded = candidate;
            bestColors = c;
            break;
          }
          if (candidate.byteLength < bestEncoded.byteLength) {
            bestEncoded = candidate;
            bestColors = c;
          }
        }
      }
    }
  } else {
    // Automatic compression mode guided by quality
    const targetColors = clampColors(Math.round(2 + (quality / 100) * 254));
    const quantEncoded = encodeQuantized(targetColors);

    bestEncoded = quantEncoded;
    bestColors = targetColors;

    if (quantEncoded.byteLength < file.size) {
      if (losslessBuf && losslessBuf.byteLength < quantEncoded.byteLength) {
        bestEncoded = losslessBuf;
        bestColors = 256;
      }
    } else {
      if (losslessBuf && losslessBuf.byteLength < file.size) {
        bestEncoded = losslessBuf;
        bestColors = 256;
      } else {
        const stepCandidates = [192, 128, 96, 64, 48, 32, 16];
        for (const c of stepCandidates) {
          if (c >= targetColors) continue;
          const candidate = encodeQuantized(c);
          if (candidate.byteLength < file.size) {
            bestEncoded = candidate;
            bestColors = c;
            break;
          }
          if (candidate.byteLength < bestEncoded.byteLength) {
            bestEncoded = candidate;
            bestColors = c;
          }
        }
      }
    }
  }

  if (!bestEncoded && losslessBuf) {
    bestEncoded = losslessBuf;
    bestColors = 256;
  }

  if (!bestEncoded) {
    return {
      blob: file,
      width,
      height,
      colors: 256,
    };
  }

  return {
    blob: new Blob([bestEncoded.buffer as ArrayBuffer], { type: 'image/png' }),
    width,
    height,
    colors: bestColors,
  };
}

export async function compressGif(file: Blob, maxColors = 256): Promise<PaletteResult> {
  const colors = clampColors(maxColors);
  const gif = parseGIF(await file.arrayBuffer());
  const frames = decompressFrames(gif, true);
  const { width, height } = gif.lsd;
  if (frames.length === 0) throw new Error('This GIF has no frames');

  const composed: Uint8ClampedArray[] = [];
  const canvas = new Uint8ClampedArray(width * height * 4);
  let snapshot: Uint8ClampedArray | null = null;
  let previous: (typeof frames)[number] | null = null;

  for (const frame of frames) {
    if (previous) {
      if (previous.disposalType === 2) clearRect(canvas, width, previous.dims);
      else if (previous.disposalType === 3 && snapshot) canvas.set(snapshot);
    }
    snapshot = frame.disposalType === 3 ? new Uint8ClampedArray(canvas) : null;
    drawPatch(canvas, width, frame.patch, frame.dims);
    composed.push(new Uint8ClampedArray(canvas));
    previous = frame;
  }

  const encoder = GIFEncoder();
  let base: Uint8ClampedArray = new Uint8ClampedArray(width * height * 4);

  for (let k = 0; k < composed.length; k++) {
    const current = composed[k];
    const next = composed[k + 1];
    const clearAfter = next ? losesPixels(current, next) : false;

    const data = new Uint8ClampedArray(current.length);
    for (let i = 0; i < current.length; i += 4) {
      const bothEmpty = current[i + 3] === 0 && base[i + 3] === 0;
      const unchanged =
        current[i] === base[i] &&
        current[i + 1] === base[i + 1] &&
        current[i + 2] === base[i + 2] &&
        current[i + 3] === base[i + 3];
      if (bothEmpty || unchanged) continue;
      data[i] = current[i];
      data[i + 1] = current[i + 1];
      data[i + 2] = current[i + 2];
      data[i + 3] = current[i + 3];
    }

    const { palette, index, transparentIndex } = buildPalette(data, colors);

    encoder.writeFrame(index, width, height, {
      palette,
      delay: frames[k].delay,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
      dispose: clearAfter ? 2 : 1,
    });

    base = clearAfter ? new Uint8ClampedArray(width * height * 4) : current;
  }

  encoder.finish();
  return { blob: new Blob([encoder.bytes() as BlobPart], { type: 'image/gif' }), width, height, colors };
}

function buildPalette(data: Uint8ClampedArray, colors: number) {
  const opaque: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) opaque.push(data[i], data[i + 1], data[i + 2], 255);
  }
  const hasTransparent = opaque.length < data.length;

  if (opaque.length === 0) {
    return { palette: [[0, 0, 0]], index: new Uint8Array(data.length / 4), transparentIndex: 0 };
  }

  const palette = quantize(new Uint8ClampedArray(opaque), hasTransparent ? Math.max(2, colors - 1) : colors, {
    format: 'rgb565',
  });
  const index = applyPalette(data, palette, 'rgb565');

  let transparentIndex = -1;
  if (hasTransparent) {
    palette.push([0, 0, 0]);
    transparentIndex = palette.length - 1;
    for (let p = 0; p < index.length; p++) {
      if (data[p * 4 + 3] === 0) index[p] = transparentIndex;
    }
  }
  return { palette, index, transparentIndex };
}

function losesPixels(from: Uint8ClampedArray, to: Uint8ClampedArray): boolean {
  for (let i = 3; i < from.length; i += 4) {
    if (from[i] > 0 && to[i] === 0) return true;
  }
  return false;
}

type Dims = { left: number; top: number; width: number; height: number };

function drawPatch(canvas: Uint8ClampedArray, canvasWidth: number, patch: Uint8ClampedArray, dims: Dims) {
  for (let y = 0; y < dims.height; y++) {
    for (let x = 0; x < dims.width; x++) {
      const src = (y * dims.width + x) * 4;
      if (patch[src + 3] === 0) continue;
      const dst = ((dims.top + y) * canvasWidth + dims.left + x) * 4;
      canvas[dst] = patch[src];
      canvas[dst + 1] = patch[src + 1];
      canvas[dst + 2] = patch[src + 2];
      canvas[dst + 3] = patch[src + 3];
    }
  }
}

function clearRect(canvas: Uint8ClampedArray, canvasWidth: number, dims: Dims) {
  for (let y = 0; y < dims.height; y++) {
    const start = ((dims.top + y) * canvasWidth + dims.left) * 4;
    canvas.fill(0, start, start + dims.width * 4);
  }
}
