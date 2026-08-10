"use client";

import { useEffect, useRef, useState } from "react";
import { ChromeRivet } from "./ChromeRivet";
import type { GridConfig, GridMode } from "@/lib/grid";

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

  const handleSetMode = (mode: GridMode, cellSize = config.cellSize) => {
    onChange({ ...config, mode, cellSize });
  };

  const handleToggleSnap = () => {
    onChange({ ...config, snapEnabled: !config.snapEnabled });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-xs font-semibold shadow-sm transition-colors ${
          config.mode !== "none" || isOpen
            ? "border-rust bg-rust/30 text-accent-yellow"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title="Canvas Architectural Grid & Snapping"
        aria-label="Grid Settings"
        aria-expanded={isOpen}
      >
        <span>📐</span>
        <span className="hidden sm:inline">GRID</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Grid Overlay Settings"
          className="absolute right-0 top-full mt-2 z-50 flex flex-col gap-3 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md w-[260px]"
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />

          <div className="border-b border-chrome-border/60 pb-1.5">
            <h3 className="font-mono text-xs font-bold uppercase text-accent-yellow">
              Architectural Grid
            </h3>
            <p className="font-mono text-[10px] text-ink-dim">
              Precision overlay &amp; snapping
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => handleSetMode("none")}
              className={`rounded border border-chrome-border px-2.5 py-1 text-left font-mono text-xs transition-colors ${
                config.mode === "none"
                  ? "bg-rust/30 font-bold text-accent-yellow border-rust"
                  : "bg-chrome-bg-raised text-ink-dim hover:text-ink"
              }`}
            >
              🚫 Grid Off
            </button>
            <button
              type="button"
              onClick={() => handleSetMode("square", 50)}
              className={`rounded border border-chrome-border px-2.5 py-1 text-left font-mono text-xs transition-colors ${
                config.mode === "square" && config.cellSize === 50
                  ? "bg-rust/30 font-bold text-accent-yellow border-rust"
                  : "bg-chrome-bg-raised text-ink-dim hover:text-ink"
              }`}
            >
              🔳 Square Grid (50px)
            </button>
            <button
              type="button"
              onClick={() => handleSetMode("square", 100)}
              className={`rounded border border-chrome-border px-2.5 py-1 text-left font-mono text-xs transition-colors ${
                config.mode === "square" && config.cellSize === 100
                  ? "bg-rust/30 font-bold text-accent-yellow border-rust"
                  : "bg-chrome-bg-raised text-ink-dim hover:text-ink"
              }`}
            >
              🔳 Square Grid (100px)
            </button>
            <button
              type="button"
              onClick={() => handleSetMode("isometric")}
              className={`rounded border border-chrome-border px-2.5 py-1 text-left font-mono text-xs transition-colors ${
                config.mode === "isometric"
                  ? "bg-rust/30 font-bold text-accent-yellow border-rust"
                  : "bg-chrome-bg-raised text-ink-dim hover:text-ink"
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
                  ? "border-rust bg-rust/30 font-bold text-accent-yellow"
                  : "border-chrome-border bg-chrome-bg-raised text-ink-dim hover:text-ink"
              }`}
            >
              <span>🧲 Snap-to-Grid</span>
              <span>{config.snapEnabled ? "ON" : "OFF"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
