import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-slate-200 bg-white font-sans">
      <div className="max-w-[970px] mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#2a73d9] flex items-center justify-center text-white font-bold text-base shadow-sm">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <span className="font-extrabold text-xl tracking-tight text-[#38404B]">
            Image Compressor
          </span>
        </a>

        <nav className="flex items-center space-x-6 text-sm font-semibold text-[#38404B]">
          <a href="#" className="text-[#2a73d9] hover:underline font-bold">Home</a>
          <a href="#how-it-works" className="hover:text-[#2a73d9] transition-colors">How-to</a>
          <a href="#blog" className="hover:text-[#2a73d9] transition-colors">Blog</a>
        </nav>
      </div>
    </header>
  );
};
