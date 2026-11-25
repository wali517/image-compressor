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

export async function compressPng(file: Blob, maxColors?: number): Promise<PaletteResult> {
  const decoded = UPNG.decode(await file.arrayBuffer());
  const frames = UPNG.toRGBA8(decoded);
  const delays = decoded.frames.map((f) => f.delay);
  const colors = clampColors(maxColors ?? countColors(new Uint8Array(frames[0])));

  const encoded = UPNG.encode(frames, decoded.width, decoded.height, colors, frames.length > 1 ? delays : undefined);

  return { blob: new Blob([encoded], { type: 'image/png' }), width: decoded.width, height: decoded.height, colors };
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
