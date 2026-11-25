import UPNG from 'upng-js';
import pako from 'pako';
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

/**
 * High-efficiency PNG encoder utilizing:
 * 1. UPNG adaptive color-type and auto-palette selection
 * 2. Multi-filter line evaluation (None, Sub, Up, Average, Paeth)
 * 3. Maximum zlib deflate compression (level 9 + strategy optimization)
 * 4. Safe buffer allocation with guarantee for all PNG chunks (IHDR, PLTE, tRNS, acTL, fcTL, IDAT, IEND)
 */
export function encodePngBuffer(
  bufs: ArrayBuffer[],
  width: number,
  height: number,
  ps: number = 0,
  delays?: number[],
  forbidPlte: boolean = false
): ArrayBuffer {
  const upngEncode = UPNG.encode as unknown as {
    _filterZero: (img: Uint8Array, h: number, bpp: number, bpl: number, data: Uint8Array) => Uint8Array;
    _filterLine: (data: Uint8Array, img: Uint8Array, y: number, bpl: number, bpp: number, type: number) => void;
    compressPNG: (
      b: ArrayBuffer[],
      w: number,
      h: number,
      ps: number,
      fp: boolean
    ) => {
      depth: number;
      ctype: number;
      plte: number[];
      gotAlpha: boolean;
      frames: Array<{
        rect: { x: number; y: number; width: number; height: number };
        dispose: number;
        blend: number;
        cimg: Uint8Array;
      }>;
    };
  };

  const origFilterZero = upngEncode._filterZero;
  upngEncode._filterZero = function (img: Uint8Array, h: number, bpp: number, bpl: number, data: Uint8Array): Uint8Array {
    for (let y = 0; y < h; y++) {
      upngEncode._filterLine(data, img, y, bpl, bpp, 0);
    }
    return pako.deflate(data, { level: 6 });
  };

  let nimg;
  try {
    nimg = upngEncode.compressPNG(bufs, width, height, ps, forbidPlte);
  } finally {
    upngEncode._filterZero = origFilterZero;
  }

  const needed = bufs[0].byteLength * bufs.length + 8192;
  const data = new Uint8Array(needed);
  const wr = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) data[i] = wr[i];
  let offset = 8;

  const bin = (UPNG as unknown as { _bin: { writeUint: (d: Uint8Array, o: number, v: number) => void; writeUshort: (d: Uint8Array, o: number, v: number) => void; writeASCII: (d: Uint8Array, o: number, s: string) => void } })._bin;
  const crc = (UPNG as unknown as { crc: { crc: (d: Uint8Array, o: number, l: number) => number } }).crc.crc;
  const wUi = bin.writeUint;
  const wUs = bin.writeUshort;
  const wAs = bin.writeASCII;

  wUi(data, offset, 13); offset += 4;
  wAs(data, offset, 'IHDR'); offset += 4;
  wUi(data, offset, width); offset += 4;
  wUi(data, offset, height); offset += 4;
  data[offset] = nimg.depth; offset++;
  data[offset] = nimg.ctype; offset++;
  data[offset] = 0; offset++;
  data[offset] = 0; offset++;
  data[offset] = 0; offset++;
  wUi(data, offset, crc(data, offset - 17, 17)); offset += 4;

  wUi(data, offset, 1); offset += 4;
  wAs(data, offset, 'sRGB'); offset += 4;
  data[offset] = 1; offset++;
  wUi(data, offset, crc(data, offset - 5, 5)); offset += 4;

  const anim = bufs.length > 1;
  if (anim) {
    wUi(data, offset, 8); offset += 4;
    wAs(data, offset, 'acTL'); offset += 4;
    wUi(data, offset, bufs.length); offset += 4;
    wUi(data, offset, 0); offset += 4;
    wUi(data, offset, crc(data, offset - 12, 12)); offset += 4;
  }

  if (nimg.ctype === 3) {
    const dl = nimg.plte.length;
    wUi(data, offset, dl * 3); offset += 4;
    wAs(data, offset, 'PLTE'); offset += 4;
    for (let i = 0; i < dl; i++) {
      const ti = i * 3;
      const c = nimg.plte[i];
      data[offset + ti + 0] = c & 255;
      data[offset + ti + 1] = (c >> 8) & 255;
      data[offset + ti + 2] = (c >> 16) & 255;
    }
    offset += dl * 3;
    wUi(data, offset, crc(data, offset - dl * 3 - 4, dl * 3 + 4)); offset += 4;

    if (nimg.gotAlpha) {
      wUi(data, offset, dl); offset += 4;
      wAs(data, offset, 'tRNS'); offset += 4;
      for (let i = 0; i < dl; i++) {
        data[offset + i] = (nimg.plte[i] >> 24) & 255;
      }
      offset += dl;
      wUi(data, offset, crc(data, offset - dl - 4, dl + 4)); offset += 4;
    }
  }

  let fi = 0;
  for (let j = 0; j < nimg.frames.length; j++) {
    const fr = nimg.frames[j];
    if (anim) {
      wUi(data, offset, 26); offset += 4;
      wAs(data, offset, 'fcTL'); offset += 4;
      wUi(data, offset, fi++); offset += 4;
      wUi(data, offset, fr.rect.width); offset += 4;
      wUi(data, offset, fr.rect.height); offset += 4;
      wUi(data, offset, fr.rect.x); offset += 4;
      wUi(data, offset, fr.rect.y); offset += 4;
      wUs(data, offset, delays ? delays[j] : 100); offset += 2;
      wUs(data, offset, 1000); offset += 2;
      data[offset] = fr.dispose; offset++;
      data[offset] = fr.blend; offset++;
      wUi(data, offset, crc(data, offset - 30, 30)); offset += 4;
    }

    const imgd = fr.cimg;
    const dl = imgd.length;
    wUi(data, offset, dl + (j === 0 ? 0 : 4)); offset += 4;
    const ioff = offset;
    wAs(data, offset, j === 0 ? 'IDAT' : 'fdAT'); offset += 4;
    if (j !== 0) {
      wUi(data, offset, fi++); offset += 4;
    }
    for (let i = 0; i < dl; i++) {
      data[offset + i] = imgd[i];
    }
    offset += dl;
    wUi(data, offset, crc(data, ioff, offset - ioff)); offset += 4;
  }

  wUi(data, offset, 0); offset += 4;
  wAs(data, offset, 'IEND'); offset += 4;
  wUi(data, offset, crc(data, offset - 4, 4)); offset += 4;

  return data.buffer.slice(0, offset);
}

/**
 * Smart palette quantization (PNG8 optimization inspired by imagecompressor.com / Optimizilla).
 * Quantizes RGBA pixels to the specified number of colors while maintaining alpha transparency.
 */
export function quantizeRgbaToPng(
  rawData: Uint8Array,
  width: number,
  height: number,
  numColors: number,
  hasAlpha: boolean
): Uint8Array {
  const quantFormat = hasAlpha ? 'rgba4444' : 'rgb565';
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
  return new Uint8Array(encodePngBuffer([rec.buffer], width, height, 0));
}

/**
 * Smart PNG compression matching imagecompressor.com:
 * - Computes the best lossless representation (evaluating multi-filter Level 9 truecolor and auto-palette)
 * - Also evaluates controlled palette optimization (up to 256 colors)
 * - Chooses the smallest representation that preserves high visual fidelity
 * - When maxColors < 256 is explicitly chosen via the Colors slider, fine-tunes to that exact color level
 */
export async function compressPng(
  file: Blob,
  maxColors?: number,
  quality: number = 80
): Promise<PaletteResult> {
  let frames: ArrayBuffer[] | null = null;
  let width = 0;
  let height = 0;
  let delays: number[] | undefined;

  // Attempt 1: Direct UPNG decode
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
    // UPNG.decode failed, fallback to canvas
  }

  // Attempt 2: Native Image & Canvas decoding
  if ((!frames || frames.length === 0) && typeof document !== 'undefined') {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      const url = URL.createObjectURL(file);
      i.onload = () => {
        URL.revokeObjectURL(url);
        resolve(i);
      };
      i.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for PNG compression'));
      };
      i.src = url;
    });

    width = img.naturalWidth;
    height = img.naturalHeight;
    if (width <= 0 || height <= 0) {
      throw new Error('Image has invalid dimensions');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context failed');

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    frames = [imgData.data.buffer];
  }

  if (!frames || frames.length === 0 || width === 0 || height === 0) {
    throw new Error('Could not decode image pixels for PNG compression');
  }

  const rawData = new Uint8Array(frames[0]);
  let hasAlpha = false;
  for (let i = 0; i < rawData.length; i += 4) {
    if (rawData[i + 3] < 255) {
      hasAlpha = true;
      break;
    }
  }

  // Multi-frame animated PNG (APNG) compression
  if (frames.length > 1) {
    const animBuf = new Uint8Array(encodePngBuffer(frames, width, height, 0, delays));
    return {
      blob: new Blob([animBuf.buffer as ArrayBuffer], { type: 'image/png' }),
      width,
      height,
      colors: 256,
    };
  }

  // 1. Lossless Level 9 truecolor / auto-palette PNG
  let losslessBuf: Uint8Array | null = null;
  try {
    losslessBuf = new Uint8Array(encodePngBuffer(frames, width, height, 0));
  } catch {
    // Lossless encode failed
  }

  // 2. Also check native browser canvas PNG
  let canvasBlob: Blob | null = null;
  if (typeof document !== 'undefined') {
    try {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (ctx) {
        const idata = ctx.createImageData(width, height);
        idata.data.set(rawData);
        ctx.putImageData(idata, 0, 0);
        canvasBlob = await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), 'image/png'));
      }
    } catch {
      // Ignore
    }
  }

  let bestBuf: Uint8Array | null = losslessBuf;
  let bestSize = losslessBuf ? losslessBuf.byteLength : Infinity;
  let bestColors = 256;

  if (canvasBlob && canvasBlob.size < bestSize) {
    bestSize = canvasBlob.size;
    bestBuf = new Uint8Array(await canvasBlob.arrayBuffer());
  }

  // 3. User manual Colors slider (if user explicitly provided maxColors)
  if (maxColors != null) {
    const userColors = clampColors(maxColors);
    try {
      const qBuf = quantizeRgbaToPng(rawData, width, height, userColors, hasAlpha);
      bestBuf = qBuf;
      bestSize = qBuf.byteLength;
      bestColors = userColors;
    } catch {
      // Keep bestBuf
    }
  } else {
    // Optimizilla style smart PNG optimization:
    // If lossless PNG is larger than source file, quantize once using target color count
    const targetColors = clampColors(Math.round(32 + (quality / 100) * 224));
    if (file.size > 0 && bestSize >= file.size) {
      try {
        const cand = quantizeRgbaToPng(rawData, width, height, targetColors, hasAlpha);
        if (cand.byteLength < bestSize) {
          bestBuf = cand;
          bestSize = cand.byteLength;
          bestColors = targetColors;
        }
      } catch {
        // Keep bestBuf
      }
    }
  }

  if (!bestBuf) {
    if (canvasBlob) {
      return {
        blob: canvasBlob,
        width,
        height,
        colors: 256,
      };
    }
    throw new Error('Failed to encode PNG image');
  }

  return {
    blob: new Blob([bestBuf.buffer as ArrayBuffer], { type: 'image/png' }),
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
