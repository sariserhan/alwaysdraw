"use client";

import { forwardRef } from "react";
import type { BrushType, Tool } from "@/lib/types";

// 4-point sparkle, authored geometry (not a unicode glyph standing in for an icon).
const SPARKLE_CLIP = "polygon(50% 0%, 61% 35%, 100% 50%, 61% 65%, 50% 100%, 39% 65%, 0% 50%, 39% 35%)";

/**
 * Live preview of the active brush at its actual on-screen size/color, so a
 * user always knows exactly how much of the shared wall their next stroke
 * will affect. Position/size are set imperatively by the parent (via the
 * forwarded ref) on every pointer move — too high-frequency for React state.
 * Shape/color only depend on tool/brushType/color, which change rarely, so
 * those stay ordinary props.
 */
export const BrushCursor = forwardRef<HTMLDivElement, { tool: Tool; brushType: BrushType; color: string }>(
  function BrushCursor({ tool, brushType, color }, ref) {
    const isEraser = tool === "eraser";
    const isPixel = !isEraser && brushType === "pixel";
    const isCalligraphy = !isEraser && brushType === "calligraphy";
    const isGrainy = !isEraser && (brushType === "chalk" || brushType === "charcoal");
    const isSoft = !isEraser && (brushType === "watercolor" || brushType === "highlighter");
    const isGlow = !isEraser && brushType === "neonGlow";
    const isSparkle = !isEraser && brushType === "glitter";
    const ringColor = isEraser ? "var(--ink)" : color;

    return (
      <div
        ref={ref}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 z-30 hidden -translate-x-1/2 -translate-y-1/2"
      >
        <div
          className={`absolute inset-0 ${isPixel ? "rounded-none" : "rounded-full"}`}
          style={{
            border: `1.5px ${isGrainy ? "dashed" : "solid"} ${ringColor}`,
            background: isEraser ? "transparent" : `color-mix(in srgb, ${color} 16%, transparent)`,
            boxShadow: isGlow ? `0 0 10px ${color}` : undefined,
            filter: isSoft ? "blur(0.75px)" : undefined,
            transform: isCalligraphy ? "rotate(45deg) scaleY(0.55)" : undefined,
          }}
        />
        {isEraser ? (
          <svg
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M5 5l14 14M19 5 5 19" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : isSparkle ? (
          <span
            className="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2"
            style={{ background: color, clipPath: SPARKLE_CLIP }}
          />
        ) : (
          <span
            className="absolute top-1/2 left-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: color }}
          />
        )}
      </div>
    );
  },
);
