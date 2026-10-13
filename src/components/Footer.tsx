import React, { useState } from 'react';
import { Globe, ChevronDown } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'id', name: 'Indonesia' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'uk', name: 'Українська' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'zh', name: '中文' },
];

export const Footer: React.FC = () => {
  const [currentLang, setCurrentLang] = useState('English');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <footer className="w-full bg-white border-t border-slate-200 mt-16 font-sans text-xs text-slate-600">
      <div className="max-w-242.5 mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-slate-600">
          &copy; imagecompressor.com <span className="mx-2 text-slate-300">|</span>{' '}
          <a href="#" className="text-[#2a73d9] hover:underline">
            Terms and Privacy
          </a>
        </p>

        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-2 border border-[#2a73d9] text-[#2a73d9] hover:bg-[#2a73d9] hover:text-white px-3 py-1.5 rounded-md font-semibold transition-colors shadow-sm"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{currentLang}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-40 bg-white border border-slate-200 rounded-md shadow-xl max-h-56 overflow-y-auto py-1 z-30">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setCurrentLang(lang.name);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-[#eaf1fb] text-xs ${
                    currentLang === lang.name ? 'font-bold text-[#2a73d9]' : 'text-slate-700'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};
