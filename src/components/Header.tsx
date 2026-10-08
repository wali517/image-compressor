import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-slate-200 bg-white">
      <div className="max-w-[970px] mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-[#2a73d9] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            IC
          </div>
          <span className="font-bold text-lg tracking-tight text-[#38404B]">
            Image Compressor
          </span>
        </a>

        <nav className="flex items-center space-x-6 text-sm font-semibold text-[#38404B]">
          <a href="#" className="text-[#2a73d9] hover:underline">Home</a>
          <a href="#" className="hover:text-[#2a73d9]">How-to</a>
          <a href="#" className="hover:text-[#2a73d9]">Blog</a>
        </nav>
      </div>
    </header>
  );
};
