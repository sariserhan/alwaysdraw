"use client";

import { useEffect, useRef } from "react";
import { ChromeRivet } from "./ChromeRivet";
import { HOTKEY_MAP } from "@/lib/hotkeys";
import { t, type Locale } from "@/lib/i18n";

export interface HotkeysModalProps {
  isOpen: boolean;
  onToggle: () => void;
  locale: Locale;
}

export function HotkeysModal({ isOpen, onToggle, locale }: HotkeysModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onToggle();
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onToggle]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-2 font-mono text-xs font-bold transition-colors ${
          isOpen
            ? "border-rust bg-rust text-on-accent font-bold shadow-sm"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink-dim hover:border-rust hover:text-ink"
        }`}
        title={t(locale, "hotkeys_title")}
        aria-label={t(locale, "hotkeys_title")}
        aria-expanded={isOpen}
      >
        <span>⌨️</span>
        <span className="hidden sm:inline">{t(locale, "hotkeys").toUpperCase()}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t(locale, "hotkeys_title")}
          className="fixed max-[1359px]:right-3 max-[1359px]:top-20 min-[1360px]:absolute min-[1360px]:right-full min-[1360px]:top-0 min-[1360px]:mr-3 z-[1000] flex flex-col gap-3 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.9)] backdrop-blur-md w-[320px] sm:w-[380px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-6rem)] overflow-y-auto"
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />

          <div className="border-b border-chrome-border/60 pb-2">
            <h3 className="font-mono text-xs font-bold uppercase text-accent-yellow">
              {t(locale, "hotkeys_title")}
            </h3>
            <p className="font-mono text-[10px] text-ink-dim">
              {t(locale, "hotkeys_subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
            {HOTKEY_MAP.map((hk) => (
              <div
                key={hk.key}
                className="flex items-center gap-2 rounded border border-chrome-border/70 bg-chrome-bg-raised/80 p-1.5"
              >
                <kbd className="flex h-6 min-w-[24px] items-center justify-center rounded border border-rust bg-rust/20 px-1 font-mono text-xs font-bold text-accent-yellow shadow-sm">
                  {hk.key}
                </kbd>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-mono text-xs font-bold text-ink truncate">
                    {hk.label}
                  </span>
                  <span className="font-mono text-[9px] text-ink-dim truncate">
                    {hk.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
