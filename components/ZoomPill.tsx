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
    <div className="flex shrink-0 items-center gap-1 rounded-sm border border-rust/70 bg-chrome-bg-raised/90 p-1 shadow-sm text-ink-dim">
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="zoom out"
        title="Zoom Out"
        className="flex h-7 w-7 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg font-mono text-xs font-bold text-ink hover:border-rust hover:text-accent-yellow transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <span className="w-11 text-center font-mono text-xs font-bold tabular-nums text-accent-yellow">
        {zoomPercent}%
      </span>
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="zoom in"
        title="Zoom In"
        className="flex h-7 w-7 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg font-mono text-xs font-bold text-ink hover:border-rust hover:text-accent-yellow transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onResetView}
        aria-label="reset view"
        title={t(locale, "reset_view")}
        className="flex h-7 w-7 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg font-mono text-xs font-bold text-ink hover:border-rust hover:text-accent-yellow transition-colors ml-0.5"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 12a9 9 0 109-9 9.01 9.01 0 00-9 9zm0 0v-4m0 4h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
