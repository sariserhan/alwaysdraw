"use client";

import type { Tool } from "@/lib/types";
import { ChromeRivet } from "./ChromeRivet";

const SWATCHES = [
  "#f5f1e6", // stencil white
  "#e0432b", // crimson
  "#e0b13a", // warning yellow
  "#39c07a", // acid green
  "#2f9fe0", // electric blue
  "#c14fd6", // magenta
  "#17181a", // ink black
];

// Fixed, deterministic drip positions/lengths along the rack's bottom edge —
// authored geometry, not a repeated/randomized pattern.
const DRIPS = [
  { left: "8%", width: 5, height: 11 },
  { left: "19%", width: 4, height: 7 },
  { left: "34%", width: 6, height: 15 },
  { left: "52%", width: 4, height: 8 },
  { left: "67%", width: 5, height: 12 },
  { left: "81%", width: 4, height: 6 },
  { left: "91%", width: 5, height: 10 },
];

function DripEdge() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-full h-4 overflow-visible">
      {DRIPS.map((d, i) => (
        <span
          key={i}
          className="absolute top-0 bg-chrome-bg-raised"
          style={{
            left: d.left,
            width: d.width,
            height: d.height,
            borderRadius: "0 0 45% 45% / 0 0 60% 60%",
            backgroundImage: "linear-gradient(180deg, var(--chrome-bg-raised), var(--chrome-border))",
          }}
        />
      ))}
    </div>
  );
}

function MountBracket({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden
      className={`absolute -top-2.5 h-3 w-6 rounded-t-sm border border-b-0 border-chrome-border bg-chrome-bg-raised ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <ChromeRivet className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
    </div>
  );
}

function BrushIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15.5 3.5 20.5 8.5 10 19 4 20 5 14Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M13 6 18 11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17.5 4.5 20 7l-9.5 9.5H6L3.5 14Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M6 16.5H20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12a8 8 0 1 1 2.6 5.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M4 17v-5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DrawingToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  width,
  onWidthChange,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetView,
}: {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  color: string;
  onColorChange: (c: string) => void;
  width: number;
  onWidthChange: (w: number) => void;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-2 sm:px-4">
      <div
        className="pointer-events-auto relative flex flex-wrap items-center justify-center gap-3 rounded-sm border-2 border-chrome-border px-3 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.5)] ring-1 ring-rust/25"
        style={{
          backgroundImage:
            "linear-gradient(180deg, var(--chrome-bg-raised), color-mix(in srgb, var(--chrome-bg) 70%, black))",
        }}
      >
        <MountBracket side="left" />
        <MountBracket side="right" />
        <DripEdge />

        <div className="flex items-center gap-1 rounded-sm border border-chrome-border bg-chrome-bg p-1">
          <button
            type="button"
            onClick={() => onToolChange("brush")}
            aria-pressed={tool === "brush"}
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
              tool === "brush" ? "bg-accent-crimson-deep text-ink" : "text-ink-dim hover:text-ink"
            }`}
          >
            <BrushIcon />
            Brush
          </button>
          <button
            type="button"
            onClick={() => onToolChange("eraser")}
            aria-pressed={tool === "eraser"}
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
              tool === "eraser" ? "bg-accent-crimson-deep text-ink" : "text-ink-dim hover:text-ink"
            }`}
          >
            <EraserIcon />
            Erase
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {SWATCHES.map((sw) => (
            <button
              key={sw}
              type="button"
              onClick={() => onColorChange(sw)}
              aria-label={`color ${sw}`}
              aria-pressed={color === sw}
              className={`relative h-6 w-6 rounded-full ring-1 ring-black/40 transition ${
                color === sw ? "ring-2 ring-accent-yellow ring-offset-2 ring-offset-chrome-bg-raised" : ""
              }`}
              style={{
                background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${sw} 100%, white 35%), ${sw} 60%)`,
              }}
            />
          ))}
          <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/40">
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="custom color"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ background: color }}
            />
          </label>
        </div>

        <div className="flex items-center gap-2 border-l border-chrome-border pl-3">
          <span className="stencil-cut-sm font-mono text-[10px] tracking-widest text-ink-dim uppercase">
            Size
          </span>
          <input
            type="range"
            min={1}
            max={60}
            value={width}
            onChange={(e) => onWidthChange(Number(e.target.value))}
            className="w-20 accent-accent-crimson sm:w-24"
            aria-label="brush size"
          />
          <span className="stencil-cut-sm w-6 text-right font-mono text-xs tabular-nums text-ink">
            {width}
          </span>
        </div>

        <div className="flex items-center gap-0.5 rounded-sm border border-chrome-border bg-chrome-bg p-1 text-ink-dim">
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="zoom out"
            className="rounded-sm px-2 py-1.5 hover:bg-chrome-bg-raised hover:text-ink"
          >
            <MinusIcon />
          </button>
          <span className="stencil-cut-sm w-11 text-center font-mono text-xs tabular-nums text-ink">
            {zoomPercent}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="zoom in"
            className="rounded-sm px-2 py-1.5 hover:bg-chrome-bg-raised hover:text-ink"
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            onClick={onResetView}
            aria-label="reset view"
            title="Reset view"
            className="ml-0.5 rounded-sm px-2 py-1.5 hover:bg-chrome-bg-raised hover:text-ink"
          >
            <ResetIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
