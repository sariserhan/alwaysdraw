"use client";

import { useEffect, useRef } from "react";
import { ChromeRivet } from "./ChromeRivet";
import { HOTKEY_MAP } from "@/lib/hotkeys";

export interface HotkeysModalProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function HotkeysModal({ isOpen, onToggle }: HotkeysModalProps) {
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
        className={`flex h-7 items-center gap-1 rounded-sm border px-2 font-mono text-xs font-bold transition-colors ${
          isOpen
            ? "border-rust bg-rust text-on-accent font-bold shadow-sm"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink-dim hover:border-rust hover:text-ink"
        }`}
        title="Keyboard Shortcuts Map"
        aria-label="Keyboard Shortcuts"
        aria-expanded={isOpen}
      >
        <span>⌨️</span>
        <span className="hidden sm:inline">KEYS</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Keyboard Shortcuts Menu"
          className="absolute right-0 top-full mt-2 z-50 flex flex-col gap-3 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md w-[320px] sm:w-[380px]"
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />

          <div className="border-b border-chrome-border/60 pb-2">
            <h3 className="font-mono text-xs font-bold uppercase text-accent-yellow">
              Keyboard Shortcuts Map
            </h3>
            <p className="font-mono text-[10px] text-ink-dim">
              Quick key bindings for fast drawing &amp; navigation
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
