"use client";

import { useEffect, useRef, useState } from "react";
import type { GridConfig, GridMode } from "@/lib/grid";
import { ChromeRivet } from "./ChromeRivet";
import { t, type Locale } from "@/lib/i18n";

export interface GridToggleProps {
  config: GridConfig;
  onChange: (config: GridConfig) => void;
  locale: Locale;
}

export function GridToggle({ config, onChange, locale }: GridToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleSetMode = (mode: GridMode, cellSize: number = 50) => {
    onChange({
      ...config,
      mode,
      cellSize,
    });
  };

  const handleToggleSnap = () => {
    onChange({
      ...config,
      snapEnabled: !config.snapEnabled,
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold shadow-sm transition-colors ${
          isOpen || config.mode !== "none"
            ? "border-rust bg-rust text-on-accent font-bold"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title={t(locale, "grid_title")}
        aria-label={t(locale, "grid_title")}
        aria-expanded={isOpen}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-current">
          <path
            d="M3 3h18v18H3V3zm6 0v18M15 3v18M3 9h18M3 15h18"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span>{t(locale, "grid").toUpperCase()}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t(locale, "grid_title")}
          className="fixed max-[1359px]:right-3 max-[1359px]:top-20 min-[1360px]:absolute min-[1360px]:right-full min-[1360px]:top-0 min-[1360px]:mr-3 z-[1000] flex flex-col gap-2 w-52 rounded-sm border-2 border-rust bg-chrome-bg/95 p-2 shadow-[0_12px_36px_rgba(0,0,0,0.9)] backdrop-blur-md max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-6rem)] overflow-y-auto"
        >
          <ChromeRivet className="top-1.5 left-1.5" />
          <ChromeRivet className="top-1.5 right-1.5" />

          <div className="border-b border-chrome-border/60 pb-1">
            <h3 className="font-mono text-xs font-bold uppercase text-accent-yellow">
              {t(locale, "grid_title")}
            </h3>
            <p className="font-mono text-[10px] text-ink-dim">
              {t(locale, "grid_subtitle")}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => handleSetMode("none")}
              className={`rounded border px-2.5 py-1 text-left font-mono text-xs transition-colors ${
                config.mode === "none"
                  ? "bg-rust text-on-accent font-bold border-rust shadow-sm"
                  : "bg-chrome-bg-raised text-ink border-chrome-border hover:border-rust hover:text-accent-yellow"
              }`}
            >
              🚫 {t(locale, "grid_off")}
            </button>
            <button
              type="button"
              onClick={() => handleSetMode("square", 50)}
              className={`rounded border px-2.5 py-1 text-left font-mono text-xs transition-colors ${
                config.mode === "square" && config.cellSize === 50
                  ? "bg-rust text-on-accent font-bold border-rust shadow-sm"
                  : "bg-chrome-bg-raised text-ink border-chrome-border hover:border-rust hover:text-accent-yellow"
              }`}
            >
              🔳 {t(locale, "grid_square_50")}
            </button>
            <button
              type="button"
              onClick={() => handleSetMode("square", 100)}
              className={`rounded border px-2.5 py-1 text-left font-mono text-xs transition-colors ${
                config.mode === "square" && config.cellSize === 100
                  ? "bg-rust text-on-accent font-bold border-rust shadow-sm"
                  : "bg-chrome-bg-raised text-ink border-chrome-border hover:border-rust hover:text-accent-yellow"
              }`}
            >
              🔳 {t(locale, "grid_square_100")}
            </button>
            <button
              type="button"
              onClick={() => handleSetMode("isometric")}
              className={`rounded border px-2.5 py-1 text-left font-mono text-xs transition-colors ${
                config.mode === "isometric"
                  ? "bg-rust text-on-accent font-bold border-rust shadow-sm"
                  : "bg-chrome-bg-raised text-ink border-chrome-border hover:border-rust hover:text-accent-yellow"
              }`}
            >
              📐 {t(locale, "grid_isometric")}
            </button>
          </div>

          <div className="border-t border-chrome-border/60 pt-2">
            <button
              type="button"
              onClick={handleToggleSnap}
              disabled={config.mode === "none"}
              className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 font-mono text-xs transition-colors disabled:opacity-40 ${
                config.snapEnabled
                  ? "border-rust bg-rust text-on-accent font-bold shadow-sm"
                  : "border-chrome-border bg-chrome-bg-raised text-ink hover:border-rust hover:text-accent-yellow"
              }`}
            >
              <span>🧲 {t(locale, "grid_snapping")}</span>
              <span className="text-[10px] uppercase font-bold">
                {config.snapEnabled ? t(locale, "on").toUpperCase() : t(locale, "off").toUpperCase()}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
