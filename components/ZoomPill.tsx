"use client";

import { t, type Locale } from "@/lib/i18n";

export interface ZoomPillProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  locale: Locale;
}

export function ZoomPill({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetView,
  locale,
}: ZoomPillProps) {
  return (
    <div className="flex w-full h-[28px] items-center justify-between gap-0.5 rounded-sm border border-rust/70 bg-chrome-bg-raised/90 px-1 py-0.5 shadow-sm text-ink-dim min-w-0">
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="zoom out"
        title="Zoom Out"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg font-mono text-xs font-bold text-ink hover:border-rust hover:text-accent-yellow transition-colors"
      >
        -
      </button>
      <button
        type="button"
        onClick={onResetView}
        title={t(locale, "reset_view")}
        className="truncate font-mono text-[10px] font-bold text-accent-yellow hover:underline"
      >
        {zoomPercent}%
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="zoom in"
        title="Zoom In"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg font-mono text-xs font-bold text-ink hover:border-rust hover:text-accent-yellow transition-colors"
      >
        +
      </button>
    </div>
  );
}
