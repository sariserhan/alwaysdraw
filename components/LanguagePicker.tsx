"use client";

import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LOCALES, t, type Locale, type LocaleInfo } from "@/lib/i18n";
import { ChromeRivet } from "./ChromeRivet";

export interface LanguagePickerProps {
  currentLocale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

export function LanguagePicker({ currentLocale, onLocaleChange }: LanguagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeLocaleInfo =
    SUPPORTED_LOCALES.find((l) => l.code === currentLocale) ?? SUPPORTED_LOCALES[0];

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (locale: LocaleInfo) => {
    onLocaleChange(locale.code);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold shadow-sm transition-colors ${
          isOpen
            ? "border-rust bg-rust text-on-accent font-bold"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title="Change Application Language"
        aria-label="Language Selector"
        aria-expanded={isOpen}
      >
        <span className="text-sm">{activeLocaleInfo.flag}</span>
        <span className="uppercase">{activeLocaleInfo.code}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Supported Languages"
          className="absolute right-0 top-full mt-2 z-50 flex flex-col gap-1 w-48 rounded-sm border-2 border-rust bg-chrome-bg/95 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md max-[1359px]:fixed! max-[1359px]:inset-x-3! max-[1359px]:top-20! max-[1359px]:w-auto! max-[1359px]:max-h-[calc(100vh-6rem)]! max-[1359px]:overflow-y-auto!"
        >
          <ChromeRivet className="top-1.5 left-1.5" />
          <ChromeRivet className="top-1.5 right-1.5" />

          <div className="border-b border-chrome-border/60 pb-1 px-1">
            <span className="font-mono text-[10px] font-bold text-ink-dim uppercase">
              🌐 {t(currentLocale, "select_language")}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            {SUPPORTED_LOCALES.map((loc) => (
              <button
                key={loc.code}
                type="button"
                onClick={() => handleSelect(loc)}
                className={`flex items-center justify-between rounded px-2 py-1.5 font-mono text-xs transition-colors text-left ${
                  loc.code === currentLocale
                    ? "bg-rust text-on-accent font-bold shadow-sm"
                    : "text-ink hover:bg-chrome-bg-raised hover:text-accent-yellow"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{loc.flag}</span>
                  <span>{loc.name}</span>
                </div>
                <span className="text-[10px] opacity-80 uppercase">{loc.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
