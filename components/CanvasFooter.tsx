"use client";

import Link from "next/link";
import { useState } from "react";
import { ChromeRivet } from "./ChromeRivet";

export interface CanvasFooterProps {
  onOpenHotkeys?: () => void;
  onOpenHelp?: () => void;
  onOpenGallery?: () => void;
}

export function CanvasFooter({
  onOpenHotkeys,
  onOpenHelp,
  onOpenGallery,
}: CanvasFooterProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <footer
      className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex flex-col items-center justify-end"
      aria-label="AlwaysDraw Footer and Site Navigation"
    >
      {/* COLLAPSED EXPANDER BAR BUTTON */}
      <div className="pointer-events-auto flex items-center justify-center">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          title={expanded ? "Collapse site footer" : "Expand site footer & navigation"}
          className="flex items-center gap-2 rounded-t-sm border border-b-0 border-chrome-border bg-chrome-bg-raised/95 px-3 py-1 font-mono text-[10px] font-bold tracking-wider uppercase text-ink-dim shadow-md backdrop-blur-md hover:border-rust hover:text-ink transition-colors"
        >
          <ChromeRivet className="relative top-[1px]" />
          <span>{expanded ? "HIDE FOOTER" : "ALWAYS DRAW © 2026"}</span>
          <span className="text-accent-crimson text-xs">{expanded ? "▼" : "▲"}</span>
        </button>
      </div>

      {/* EXPANDABLE FOOTER PANEL */}
      {expanded && (
        <div className="pointer-events-auto w-full border-t-2 border-chrome-border bg-chrome-bg-raised/95 px-4 sm:px-8 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.6)] backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs font-mono">
            {/* BRAND & TAGLINE */}
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent-crimson font-bold text-white text-xs">
                AD
              </div>
              <div>
                <span className="font-bold text-ink">AlwaysDraw</span>
                <span className="ml-2 text-ink-dim text-[11px]">
                  One World. One Canvas. Always Drawing.
                </span>
              </div>
            </div>

            {/* QUICK SEO & FEATURE NAV LINKS */}
            <nav className="flex flex-wrap items-center gap-4 text-ink-dim uppercase font-bold tracking-wide">
              <Link href="/draw-with-friends" className="hover:text-accent-yellow transition-colors">
                👥 Draw With Friends
              </Link>
              <Link href="/online-whiteboard" className="hover:text-accent-yellow transition-colors">
                📐 Whiteboard
              </Link>
              <Link href="/infinite-canvas" className="hover:text-accent-yellow transition-colors">
                🌌 Infinite Canvas
              </Link>
            </nav>

            {/* UTILITY MODAL TRIGGERS */}
            <div className="flex items-center gap-3 text-ink-dim">
              {onOpenHotkeys && (
                <button
                  type="button"
                  onClick={onOpenHotkeys}
                  className="hover:text-ink transition-colors uppercase font-bold"
                >
                  ⌨️ Hotkeys (?)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
