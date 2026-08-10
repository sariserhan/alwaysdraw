"use client";

import { t, type Locale } from "@/lib/i18n";

export interface ZoomPillProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView?: () => void;
  locale?: Locale;
}

export function ZoomPill({
  zoomPercent,
  onZoomIn,
  onZoomOut,
}: ZoomPillProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5 w-full">
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="zoom out"
        title="Zoom Out"
        className="flex h-[28px] w-full items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg-raised/90 font-mono text-xs font-bold text-ink shadow-sm transition-colors hover:border-rust hover:text-accent-yellow"
      >
        -
      </button>
      <div
        className="flex h-[28px] w-full items-center justify-center rounded-sm border border-rust/70 bg-chrome-bg-raised/90 font-mono text-xs font-bold tabular-nums text-accent-yellow shadow-sm"
        title="Current Zoom Level"
      >
        {zoomPercent}%
      </div>
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="zoom in"
        title="Zoom In"
        className="flex h-[28px] w-full items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg-raised/90 font-mono text-xs font-bold text-ink shadow-sm transition-colors hover:border-rust hover:text-accent-yellow"
      >
        +
      </button>
    </div>
  );
}
