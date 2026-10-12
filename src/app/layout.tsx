import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Image Compressor – Compress JPEG, PNG, WebP, GIF Online',
  description:
    'Compress JPEG, PNG, WebP and GIF images online with adjustable quality. All processing happens in your browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#fdfdfd] text-[#333] font-sans min-h-screen">{children}</body>
    </html>
  );
}
