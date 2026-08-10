"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChromeRivet } from "./ChromeRivet";
import { t, type Locale } from "@/lib/i18n";

export interface MoreMenuProps {
  locale: Locale;
  children: ReactNode;
}

/** Catch-all for header controls that don't need to be always visible —
 * each child is a self-contained control (its own trigger + dropdown, same
 * as everything else in the header), just laid out inside this panel
 * instead of directly in the row. Nesting a dropdown-triggering component
 * inside another dropdown works fine here: each one's click-outside/Escape
 * handling only tracks its own DOM subtree, so they don't fight each other. */
export function MoreMenu({ locale, children }: MoreMenuProps) {
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
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold shadow-sm transition-colors ${
          isOpen
            ? "border-rust bg-rust text-on-accent font-bold"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title={t(locale, "more")}
        aria-label={t(locale, "more")}
        aria-expanded={isOpen}
      >
        <span>⋯</span>
        <span>{t(locale, "more").toUpperCase()}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t(locale, "more")}
          className="absolute right-0 top-full z-50 mt-2 flex w-max max-w-[calc(100vw-1.5rem)] flex-col gap-2 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md"
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        </div>
      )}
    </div>
  );
}
