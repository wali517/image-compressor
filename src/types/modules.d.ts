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
