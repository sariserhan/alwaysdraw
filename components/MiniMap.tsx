"use client";

import type { RefObject } from "react";

export const MINI_MAP_SIZE_PX = 128;

/**
 * A fixed-size overview of the whole wall in the corner, with a rectangle
 * marking the current viewport — for a 10,000x10,000 canvas where it's easy
 * to lose track of where you are after panning. Canvas content and the
 * viewport rectangle are both updated imperatively by the parent (redrawn
 * strokes, camera-driven rect position) — same reasoning as BrushCursor/
 * MagnifierLoupe/RulerOverlay: too high-frequency for React state.
 */
export function MiniMap({
  canvasRef,
  viewportRectRef,
  onJump,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewportRectRef: RefObject<HTMLDivElement | null>;
  onJump: (screenFractionX: number, screenFractionY: number) => void;
}) {
  const jumpFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onJump((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
  };

  return (
    <div
      aria-label="wall overview — click to jump"
      role="button"
      className="pointer-events-auto absolute top-16 right-3 z-20 overflow-hidden rounded-sm border-2 border-chrome-border shadow-[0_8px_20px_rgba(0,0,0,0.5)] sm:top-20 sm:right-4"
      style={{ width: MINI_MAP_SIZE_PX, height: MINI_MAP_SIZE_PX }}
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        jumpFromPointer(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        jumpFromPointer(e);
      }}
    >
      <canvas ref={canvasRef} className="block h-full w-full cursor-pointer" />
      <div
        ref={viewportRectRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 border border-accent-yellow"
        style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.4)" }}
      />
    </div>
  );
}
