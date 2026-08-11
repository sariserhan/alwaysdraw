"use client";

import { forwardRef } from "react";

/**
 * Coordinate Finder overlay:
 * 1. Continuous live (X, Y) canvas coordinates badge following pointer.
 * 2. Interactive drag rectangle showing exact marked area on the canvas.
 * 3. Area in square feet (sq ft) and rectangle dimensions (width × height ft).
 * 4. Corner coordinate badges for all 4 corners: NW, NE, SW, SE.
 * 5. Everything disappears automatically when Coordinate Finder mode is disabled.
 */
export const CoordFinderOverlay = forwardRef<HTMLDivElement>(function CoordFinderOverlay(_props, ref) {
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-30 hidden">
      {/* Dynamic Drag Rectangle SVG */}
      <svg className="absolute inset-0 h-full w-full">
        <rect
          data-coord-rect
          fill="rgba(217, 119, 6, 0.15)"
          stroke="var(--rust)"
          strokeWidth="2"
          strokeDasharray="6 4"
          rx="2"
        />
        {/* 4 Corner circles */}
        <circle data-coord-nw-node r="5" fill="var(--accent-yellow)" stroke="var(--rust)" strokeWidth="1.5" />
        <circle data-coord-ne-node r="5" fill="var(--accent-yellow)" stroke="var(--rust)" strokeWidth="1.5" />
        <circle data-coord-sw-node r="5" fill="var(--accent-yellow)" stroke="var(--rust)" strokeWidth="1.5" />
        <circle data-coord-se-node r="5" fill="var(--accent-yellow)" stroke="var(--rust)" strokeWidth="1.5" />
      </svg>

      {/* 4 Corner Coordinate Badges */}
      <div data-coord-nw-badge className="absolute z-10 -translate-x-1/2 -translate-y-full mb-1.5 rounded bg-chrome-bg/95 border border-rust px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent-yellow shadow-md backdrop-blur-sm whitespace-nowrap hidden" />
      <div data-coord-ne-badge className="absolute z-10 -translate-x-1/2 -translate-y-full mb-1.5 rounded bg-chrome-bg/95 border border-rust px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent-yellow shadow-md backdrop-blur-sm whitespace-nowrap hidden" />
      <div data-coord-sw-badge className="absolute z-10 -translate-x-1/2 mt-1.5 rounded bg-chrome-bg/95 border border-rust px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent-yellow shadow-md backdrop-blur-sm whitespace-nowrap hidden" />
      <div data-coord-se-badge className="absolute z-10 -translate-x-1/2 mt-1.5 rounded bg-chrome-bg/95 border border-rust px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent-yellow shadow-md backdrop-blur-sm whitespace-nowrap hidden" />

      {/* Center Rectangle Info Card (Area in Sq Ft + Dimensions + Corner Bounds) */}
      <div
        data-coord-center-card
        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 rounded-sm border-2 border-rust bg-chrome-bg/95 p-2 font-mono text-xs shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md whitespace-nowrap text-ink min-w-[190px] hidden"
      />

      {/* Live Pointer Cursor Coordinate Badge */}
      <div
        data-coord-cursor-badge
        className="absolute z-30 translate-x-3 translate-y-3 rounded-sm border border-rust bg-chrome-bg/95 px-2 py-1 font-mono text-xs font-bold text-accent-yellow shadow-[0_4px_12px_rgba(0,0,0,0.75)] backdrop-blur-sm whitespace-nowrap pointer-events-none hidden"
      />
    </div>
  );
});
