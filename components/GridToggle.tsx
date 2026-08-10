"use client";

import { useEffect, useRef, useState } from "react";
import type { GridConfig, GridMode } from "@/lib/grid";
import { ChromeRivet } from "./ChromeRivet";

export interface GridToggleProps {
  config: GridConfig;
  onChange: (config: GridConfig) => void;
}

export function GridToggle({ config, onChange }: GridToggleProps) {
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
        className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold shadow-sm transition-colors ${
          isOpen || config.mode !== "none"
            ? "border-rust bg-rust text-on-accent font-bold"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title="Canvas Alignment Grid & Snapping"
        aria-label="Grid Settings Menu"
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
        <span>GRID</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Grid Options"
          className="absolute right-0 top-full mt-2 z-50 flex flex-col gap-2 w-52 rounded-sm border-2 border-rust bg-chrome-bg/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md"
        >
          <ChromeRivet className="top-1.5 left-1.5" />
          <ChromeRivet className="top-1.5 right-1.5" />

          <div className="border-b border-chrome-border/60 pb-1">
            <h3 className="font-mono text-xs font-bold uppercase text-accent-yellow">
              Architectural Grid
            </h3>
            <p className="font-mono text-[10px] text-ink-dim">
              Precision drawing overlays &amp; snapping
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
              🚫 Grid Off
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
              🔳 Square Grid (50px)
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
              🔳 Square Grid (100px)
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
              📐 Isometric Blueprint Grid
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
              <span>🧲 Grid Snapping</span>
              <span className="text-[10px] uppercase font-bold">
                {config.snapEnabled ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
