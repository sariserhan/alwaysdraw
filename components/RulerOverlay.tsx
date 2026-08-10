"use client";

import { forwardRef } from "react";

/**
 * Distance-measurement overlay: a dashed line between drag start/end plus a
 * label showing the distance in world px. Purely an inspection aid — never
 * submitted as a stroke. Line endpoints and label are set imperatively by the
 * parent on every pointer move (data-ruler-* attributes), same reasoning as
 * BrushCursor/MagnifierLoupe: too high-frequency for React state.
 */
export const RulerOverlay = forwardRef<HTMLDivElement>(function RulerOverlay(_props, ref) {
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-30 hidden">
      <svg className="absolute inset-0 h-full w-full">
        <line data-ruler-line stroke="var(--accent-yellow)" strokeWidth="1.5" strokeDasharray="5 4" />
      </svg>
      <span
        data-ruler-label
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-chrome-border bg-chrome-bg-raised px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-ink shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
      />
    </div>
  );
});
