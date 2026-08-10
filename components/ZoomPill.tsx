"use client";

export interface ZoomPillProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomPill({
  zoomPercent,
  onZoomIn,
  onZoomOut,
}: ZoomPillProps) {
  return (
    <div className="flex h-[28px] w-full items-center justify-between gap-1 rounded-sm border border-rust/70 bg-chrome-bg-raised/90 px-1.5 py-0.5 font-mono text-xs shadow-sm">
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="zoom out"
        title="Zoom Out"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg font-bold text-ink hover:border-rust hover:text-accent-yellow transition-colors"
      >
        -
      </button>
      <span className="truncate font-bold tabular-nums text-accent-yellow" title="Current Zoom Level">
        {zoomPercent}%
      </span>
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="zoom in"
        title="Zoom In"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg font-bold text-ink hover:border-rust hover:text-accent-yellow transition-colors"
      >
        +
      </button>
    </div>
  );
}
