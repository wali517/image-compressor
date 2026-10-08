export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'svg' | 'avif';
export type AppTab = 'converter' | 'compressor' | 'exif';

export interface CompressionSettings {
  quality: number; // 10 to 100
  format?: ImageFormat; // Target format
  maxColors?: number; // For PNG palette reduction
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
  
  // Status matching imagecompressor.com
  status: 'pending' | 'converting' | 'completed' | 'optimized' | 'error';
  compressedBlob: Blob | null;
  compressedUrl: string | null;
  compressedSize: number;
  compressedWidth: number;
  compressedHeight: number;
  savingsPercentage: number;
  
  // Custom settings per file
  settings: CompressionSettings;
  exifTags?: ExifTag[];
  error?: string;
}
