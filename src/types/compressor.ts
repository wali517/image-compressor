export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'avif';
export type AppTab = 'converter' | 'compressor' | 'exif';

export interface CompressionSettings {
  quality: number;
  format?: ImageFormat;
  maxColors?: number;
  stripExif?: boolean;
}

export interface ExifTag {
  name: string;
  value: string;
}

export interface CompressedFileItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  originalUrl: string;
  format: ImageFormat;
  status: 'pending' | 'converting' | 'completed' | 'optimized' | 'error';
  compressedBlob: Blob | null;
  compressedUrl: string | null;
  compressedSize: number;
  compressedWidth: number;
  compressedHeight: number;
  savingsPercentage: number;
  settings: CompressionSettings;
  exifTags?: ExifTag[];
  error?: string;
}
