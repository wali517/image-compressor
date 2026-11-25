declare module 'upng-js' {
  interface DecodedPng {
    width: number;
    height: number;
    frames: { delay: number }[];
  }
  const UPNG: {
    decode(buffer: ArrayBuffer): DecodedPng;
    toRGBA8(png: DecodedPng): ArrayBuffer[];
    encode(
      frames: ArrayBuffer[],
      width: number,
      height: number,
      colors: number,
      delays?: number[]
    ): ArrayBuffer;
  };
  export default UPNG;
}

declare module 'gifenc' {
  type Palette = number[][];
  interface FrameOptions {
    palette?: Palette;
    delay?: number;
    transparent?: boolean;
    transparentIndex?: number;
    repeat?: number;
    dispose?: number;
  }
  interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: FrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(): Encoder;
  export function quantize(
    data: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: string; oneBitAlpha?: boolean | number }
  ): Palette;
  export function applyPalette(
    data: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: string
  ): Uint8Array;
}

declare module 'pako' {
  export const Z_NO_COMPRESSION: number;
  export const Z_BEST_SPEED: number;
  export const Z_BEST_COMPRESSION: number;
  export const Z_DEFAULT_COMPRESSION: number;
  export const Z_FILTERED: number;
  export const Z_HUFFMAN_ONLY: number;
  export const Z_RLE: number;
  export const Z_FIXED: number;
  export const Z_DEFAULT_STRATEGY: number;

  export interface DeflateOptions {
    level?: number;
    windowBits?: number;
    memLevel?: number;
    strategy?: number;
    dictionary?: any;
    raw?: boolean;
    to?: 'string';
  }

  export function deflate(input: Uint8Array | ArrayBuffer | string, options?: DeflateOptions): Uint8Array;
  export function inflate(input: Uint8Array | ArrayBuffer | string): Uint8Array;
}

declare module 'exifr/dist/lite.esm.mjs' {
  const exifr: {
    parse(input: any, options?: any): Promise<any>;
    orientation(input: any): Promise<number | undefined>;
    thumbnail(input: any): Promise<Uint8Array | undefined>;
  };
  export default exifr;
}
