import exifr from 'exifr';
import type { ExifTag, ImageFormat } from '../types/compressor';

const MAX_VALUE_LENGTH = 200;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const humanizeTagName = (name: string) =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toLocaleString();
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return null;
  if (Array.isArray(value)) {
    const parts = value.map((v) => formatValue(v)).filter((v): v is string => v !== null);
    return parts.length ? parts.join(', ') : null;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value).trim();
  if (!text) return null;
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

function extractWebpExif(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 12 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIFF') return null;
  if (String.fromCharCode(...bytes.subarray(8, 12)) !== 'WEBP') return null;

  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.subarray(pos, pos + 4));
    const size =
      (bytes[pos + 4] | (bytes[pos + 5] << 8) | (bytes[pos + 6] << 16) | (bytes[pos + 7] << 24)) >>> 0;
    if (type === 'EXIF') {
      const data = bytes.subarray(pos + 8, pos + 8 + size);
      const hasHeader = String.fromCharCode(...data.subarray(0, 4)) === 'Exif';
      return hasHeader ? data.subarray(6) : data;
    }
    pos += 8 + size + (size % 2);
  }
  return null;
}

const SRGB_INTENTS = ['Perceptual', 'Relative Colorimetric', 'Saturation', 'Absolute Colorimetric'];

function readPngExtras(bytes: Uint8Array): ExifTag[] {
  const extras: ExifTag[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;

  while (pos + 12 <= bytes.length) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const data = pos + 8;
    if (data + length > bytes.length) break;

    if (type === 'sRGB' && length >= 1) {
      extras.push({ name: 'SRGB Rendering', value: SRGB_INTENTS[bytes[data]] ?? 'Unknown' });
    } else if (type === 'gAMA' && length >= 4) {
      const gamma = view.getUint32(data);
      if (gamma > 0) extras.push({ name: 'Gamma', value: String(parseFloat((100000 / gamma).toFixed(2))) });
    } else if (type === 'pHYs' && length >= 9) {
      extras.push({ name: 'Pixels Per Unit X', value: String(view.getUint32(data)) });
      extras.push({ name: 'Pixels Per Unit Y', value: String(view.getUint32(data + 4)) });
      extras.push({ name: 'Pixel Units', value: bytes[data + 8] === 1 ? 'Meters' : 'Unknown' });
    } else if (type === 'tIME' && length >= 7) {
      const pad = (n: number) => String(n).padStart(2, '0');
      extras.push({
        name: 'Modification Time',
        value: `${view.getUint16(data)}-${pad(bytes[data + 2])}-${pad(bytes[data + 3])} ${pad(bytes[data + 4])}:${pad(bytes[data + 5])}:${pad(bytes[data + 6])}`,
      });
    }
    pos += 12 + length;
  }
  return extras;
}

const isPng = (bytes: Uint8Array) => PNG_SIGNATURE.every((b, i) => bytes[i] === b);

export async function readMetadata(file: Blob): Promise<ExifTag[]> {
  let parsed: Record<string, unknown> | undefined;
  let parsedBytes: Uint8Array | null = null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    parsedBytes = bytes;
    const webpExif = extractWebpExif(bytes);
    if (webpExif === null && file.type === 'image/webp') return [];
    parsed = await exifr.parse(webpExif ?? bytes, {
      tiff: true,
      exif: true,
      gps: true,
      interop: true,
      xmp: true,
      iptc: true,
      icc: true,
      makerNote: false,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
      sanitize: true,
      mergeOutput: true,
    });
  } catch {
    return [];
  }
  const tags: ExifTag[] = [];
  if (!parsed) parsed = {};
  for (const [name, raw] of Object.entries(parsed)) {
    const value = formatValue(raw);
    if (value !== null) tags.push({ name: humanizeTagName(name), value });
  }
  if (parsedBytes && isPng(parsedBytes)) {
    const extras = readPngExtras(parsedBytes);
    const anchor = tags.findIndex((t) => t.name === 'Interlace');
    tags.splice(anchor >= 0 ? anchor + 1 : tags.length, 0, ...extras);
  }
  return tags;
}

const concat = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length));

function orientationSegment(orientation: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xe1, 0x00, 0x22,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01,
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
}

export function stripJpeg(bytes: Uint8Array, orientation = 1): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a valid JPEG file');

  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let pos = 2;
  let orientationInserted = orientation <= 1;

  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) {
      parts.push(bytes.subarray(pos));
      break;
    }
    const marker = bytes[pos + 1];

    if (marker === 0xff) {
      pos += 1;
      continue;
    }
    if (marker === 0xda) {
      if (!orientationInserted) parts.push(orientationSegment(orientation));
      parts.push(bytes.subarray(pos));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }

    const length = (bytes[pos + 2] << 8) | bytes[pos + 3];
    const end = pos + 2 + length;
    if (length < 2 || end > bytes.length) {
      parts.push(bytes.subarray(pos));
      break;
    }

    const isApp1 = marker === 0xe1;
    const isDroppedApp = marker >= 0xe3 && marker <= 0xed;
    const isComment = marker === 0xfe;

    if (isApp1 || isDroppedApp || isComment) {
      pos = end;
      continue;
    }

    parts.push(bytes.subarray(pos, end));
    if (marker === 0xe0 && !orientationInserted) {
      parts.push(orientationSegment(orientation));
      orientationInserted = true;
    }
    pos = end;
  }

  return concat(parts);
}

const PNG_DROPPED_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME', 'pHYs', 'gAMA', 'sRGB']);

export function stripPng(bytes: Uint8Array): Uint8Array {
  if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) throw new Error('Not a valid PNG file');

  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let pos = 8;

  while (pos + 12 <= bytes.length) {
    const length =
      ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0;
    const type = ascii(bytes, pos + 4, 4);
    const end = pos + 12 + length;
    if (end > bytes.length) {
      parts.push(bytes.subarray(pos));
      break;
    }
    if (!PNG_DROPPED_CHUNKS.has(type)) parts.push(bytes.subarray(pos, end));
    pos = end;
  }

  return concat(parts);
}

export function stripWebp(bytes: Uint8Array): Uint8Array {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    throw new Error('Not a valid WebP file');
  }

  const chunks: Uint8Array[] = [];
  let pos = 12;

  while (pos + 8 <= bytes.length) {
    const type = ascii(bytes, pos, 4);
    const size =
      (bytes[pos + 4] | (bytes[pos + 5] << 8) | (bytes[pos + 6] << 16) | (bytes[pos + 7] << 24)) >>> 0;
    const padded = size + (size % 2);
    const end = Math.min(pos + 8 + padded, bytes.length);

    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = bytes.slice(pos, end);
      if (type === 'VP8X') chunk[8] &= ~(0x08 | 0x04);
      chunks.push(chunk);
    }
    pos = end;
  }

  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 12));
  const riffSize = 4 + body.length;
  header[4] = riffSize & 0xff;
  header[5] = (riffSize >>> 8) & 0xff;
  header[6] = (riffSize >>> 16) & 0xff;
  header[7] = (riffSize >>> 24) & 0xff;

  return concat([header, body]);
}

export async function stripMetadata(file: File, format: ImageFormat): Promise<Blob | null> {
  if (format !== 'jpeg' && format !== 'png' && format !== 'webp') return null;

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (format === 'jpeg') {
    let orientation = 1;
    try {
      orientation = (await exifr.orientation(bytes)) ?? 1;
    } catch {
      orientation = 1;
    }
    return new Blob([stripJpeg(bytes, orientation) as BlobPart], { type: 'image/jpeg' });
  }
  if (format === 'png') return new Blob([stripPng(bytes) as BlobPart], { type: 'image/png' });
  return new Blob([stripWebp(bytes) as BlobPart], { type: 'image/webp' });
}
