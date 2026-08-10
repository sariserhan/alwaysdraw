"use client";

import { forwardRef } from "react";

/**
 * Floating loupe: a circular zoomed-in preview of the wall under the cursor,
 * for inspecting brush texture up close without moving the camera. Content is
 * drawn imperatively by the parent (drawImage from the world/strokes canvases
 * on every pointer move) — too high-frequency for React state.
 */
export const MagnifierLoupe = forwardRef<HTMLCanvasElement>(function MagnifierLoupe(_props, ref) {
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-30 hidden rounded-full border-2 border-chrome-border shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
    />
  );
});
