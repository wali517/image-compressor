import React from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  return (
    <div className="w-full max-w-[970px] mx-auto mt-12 space-y-8 text-[#38404B] font-sans">
      <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#38404B] mb-3">How It Works</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          This tool runs entirely in your browser – no server uploads required. Add your images and click COMPRESS. The tool automatically analyzes each file and selects optimal compression settings. Once processing is complete, you can save the result immediately or use the comparison view to fine-tune quality with the slider. Each image can be adjusted individually before saving.
        </p>
      </div>

      <div className="bg-gradient-to-r from-[#2a73d9]/10 via-[#2a73d9]/5 to-transparent border border-[#2a73d9]/20 rounded-xl p-6 transition-all hover:border-[#2a73d9]/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#38404B] mb-1">
              How to compress images — step by step
            </h2>
            <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
              A walk-through guide with screenshots: upload your files, choose JPEG / PNG / WebP quality, compare against the original, save the result.
            </p>
          </div>
          <button className="inline-flex items-center space-x-1.5 bg-[#2a73d9] hover:bg-[#205db3] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm whitespace-nowrap self-start sm:self-center">
            <span>Read the guide</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 space-y-6 shadow-sm text-sm">
        <div>
          <h2 className="text-base font-bold text-[#38404B] mb-2">JPEG Compression</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            For JPEG files, the tool detects the original quality level from the file's quantization tables. The default target quality is 80, which provides an excellent balance between file size and visual quality for most images. You can use the slider to adjust this – higher values preserve more detail but result in larger files, while lower values create smaller files with more visible compression artifacts. For even smaller files, consider converting to WebP or AVIF.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-base font-bold text-[#38404B] mb-2">PNG Optimization</h2>
          <p className="text-xs text-slate-600 leading-relaxed mb-2">
            PNG images are converted to PNG8 format with up to 256 colors. This format is ideal for web graphics, icons, logos, screenshots, and illustrations where color count is limited. Transparency is fully preserved. The Colors slider lets you reduce the palette further for additional compression.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            If your PNG is a photograph or contains smooth gradients with many colors, PNG8 may not be suitable. In this case, convert your image to JPG or WebP for better results.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-base font-bold text-[#38404B] mb-2">WebP Compression</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            WebP images are compressed using lossy compression similar to JPEG. WebP typically achieves 25-35% smaller file sizes than JPEG at equivalent visual quality. The quality slider works the same way as for JPEG – adjust it to find the right balance for your needs.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-base font-bold text-[#38404B] mb-2">GIF Optimization</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Animated GIFs are optimized by analyzing and reducing the color palette while preserving animation frames. The Colors slider controls the maximum palette size from 2 to 256 colors. Reducing colors can dramatically decrease file size, especially for animations with simple graphics. For even better compression, consider converting GIF to WebP animation.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-base font-bold text-[#38404B] mb-2">Privacy & Security</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            All image processing happens entirely in your browser using WebAssembly technology. There are no uploads to any server, no data collection, and no privacy concerns. All metadata (EXIF, GPS, camera info) is automatically removed from compressed images.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-base font-bold text-[#38404B] mb-2">Free & Unlimited</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            No registration required, no daily limits, no watermarks. Compress as many images as you need, completely free. The tool is designed for both casual users and professionals who need reliable, high-quality compression.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#38404B] flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-[#2a73d9]" />
          <span>From the blog</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Image Compression for People Who Just Want Smaller Photos',
              desc: 'Why phone photos are so large, what compression actually does, and the right settings for email, web, and social.',
            },
            {
              title: 'Those Weird Blotches Around Text',
              desc: 'A field guide to compression artifacts: blocking, mosquito noise, color bleeding, banding — what causes each and how to avoid them.',
            },
            {
              title: 'How to Compress an Image to an Exact File Size',
              desc: 'Why hitting an exact size like 200 KB is harder than it sounds, and the workflow that consistently lands close to the target.',
            },
          ].map((art, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200/80 rounded-xl p-4 transition-all hover:border-[#2a73d9]/40 hover:shadow-md cursor-pointer flex flex-col justify-between"
            >
              <div>
                <h4 className="font-bold text-xs text-[#38404B] mb-2 leading-snug hover:text-[#2a73d9] transition-colors">
                  {art.title}
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {art.desc}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#2a73d9] mt-3 inline-block">
                Read article &rarr;
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
