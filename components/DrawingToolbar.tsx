"use client";

import { useRef, useState } from "react";
import type { BrushType, Tool } from "@/lib/types";
import { BRUSH_CATALOG } from "@/lib/brushes";
import { SHAPE_CATALOG, type ShapeType } from "@/lib/shapes";
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

// The rivet-bearing bracket tabs double as the collapse toggle — the
// hardware you'd actually unbolt to fold the rack down. A dedicated
// separate button would duplicate a control this metaphor already offers.
function MountBracket({ side, collapsed, onClick }: { side: "left" | "right"; collapsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? "expand toolbar" : "collapse toolbar"}
      title={collapsed ? "Expand" : "Collapse"}
      aria-pressed={collapsed}
      className={`absolute -top-2.5 h-3 w-6 rounded-t-sm border border-b-0 border-chrome-border bg-chrome-bg-raised ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <ChromeRivet className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
    </button>
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

function HandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 12.5V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11.2V5.5a1.5 1.5 0 0 1 3 0V13M17 8.5a1.5 1.5 0 0 1 3 0V15c0 3.5-2 6.5-6 6.5h-2c-3 0-4.2-1-5.5-3l-2.7-4.7c-.5-.9-.2-1.9.6-2.3.8-.4 1.7 0 2.2.8L8 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MagnifierIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M10.5 8v5M8 10.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ShapesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="10" width="10" height="10" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="16.5" cy="7.5" r="5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function RulerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="8" width="19" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6 8v3M9.5 8v2M13 8v3M16.5 8v2M20 8v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DropletIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2c3.5 4.5 6 8.1 6 11a6 6 0 1 1-12 0c0-2.9 2.5-6.5 6-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 15l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 9l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Chevron tab, top-center: hides the whole rack (distinct from the
// side-rivet collapse toggle, which only shrinks it to the tool row).
function HideHandle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="hide toolbar"
      title="Hide toolbar"
      className="absolute -top-3.5 left-1/2 flex h-3.5 w-10 -translate-x-1/2 items-center justify-center rounded-t-sm border border-b-0 border-chrome-border bg-chrome-bg-raised text-ink-dim hover:text-ink"
    >
      <ChevronDownIcon />
    </button>
  );
}

// What's left docked at the bottom edge when the rack is hidden — tap to
// bring it back.
function ShowTab({ onClick }: { onClick: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2">
      <button
        type="button"
        onClick={onClick}
        aria-label="show toolbar"
        title="Show toolbar"
        className="pointer-events-auto flex h-6 w-14 items-center justify-center rounded-sm border-2 border-chrome-border bg-chrome-bg-raised text-ink-dim shadow-[0_6px_16px_rgba(0,0,0,0.4)] hover:text-ink"
      >
        <ChevronUpIcon />
      </button>
    </div>
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

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 15V4M12 4 8 8M12 4l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CATEGORIES: Array<"Basic" | "Artistic" | "Effects"> = ["Basic", "Artistic", "Effects"];

function BrushPicker({
  brushType,
  onSelect,
  onClose,
}: {
  brushType: BrushType;
  onSelect: (t: BrushType) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden />
      <div className="absolute bottom-full left-0 z-20 mb-3 w-56 rounded-sm border-2 border-chrome-border bg-chrome-bg-raised p-2 shadow-[0_10px_28px_rgba(0,0,0,0.5)]">
        {CATEGORIES.map((category) => (
          <div key={category} className="mb-1.5 last:mb-0">
            <div className="px-1.5 py-1 font-mono text-[11px] font-bold tracking-wide text-ink-dim uppercase">
              {category}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {BRUSH_CATALOG.filter((b) => b.category === category).map((b) => (
                <button
                  key={b.type}
                  type="button"
                  onClick={() => {
                    onSelect(b.type);
                    onClose();
                  }}
                  aria-pressed={brushType === b.type}
                  className={`rounded-sm px-2 py-1.5 text-left text-xs font-medium transition ${
                    brushType === b.type
                      ? "bg-accent-crimson-deep text-on-accent"
                      : "text-ink-dim hover:bg-chrome-bg hover:text-ink"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ShapeIcon({ type }: { type: ShapeType }) {
  switch (type) {
    case "line":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "rect":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="4" y="6" width="16" height="12" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      );
    case "circle":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      );
    case "triangle":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 4 20 19 4 19Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      );
  }
}

function ShapePicker({
  shapeType,
  onSelect,
  onClose,
}: {
  shapeType: ShapeType;
  onSelect: (t: ShapeType) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden />
      <div className="absolute bottom-full left-0 z-20 mb-3 rounded-sm border-2 border-chrome-border bg-chrome-bg-raised p-2 shadow-[0_10px_28px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-1">
          {SHAPE_CATALOG.map((s) => (
            <button
              key={s.type}
              type="button"
              onClick={() => {
                onSelect(s.type);
                onClose();
              }}
              aria-pressed={shapeType === s.type}
              aria-label={s.label}
              title={s.label}
              className={`flex items-center justify-center rounded-sm p-2 transition ${
                shapeType === s.type
                  ? "bg-accent-crimson-deep text-on-accent"
                  : "text-ink-dim hover:bg-chrome-bg hover:text-ink"
              }`}
            >
              <ShapeIcon type={s.type} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function DrawingToolbar({
  tool,
  onToolChange,
  brushType,
  onBrushTypeChange,
  shapeType,
  onShapeTypeChange,
  color,
  onColorChange,
  width,
  onWidthChange,
  opacity,
  onOpacityChange,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetView,
  onShare,
}: {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  brushType: BrushType;
  onBrushTypeChange: (b: BrushType) => void;
  shapeType: ShapeType;
  onShapeTypeChange: (s: ShapeType) => void;
  color: string;
  onColorChange: (c: string) => void;
  width: number;
  onWidthChange: (w: number) => void;
  opacity: number;
  onOpacityChange: (o: number) => void;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onShare: () => Promise<void>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeBrushLabel = BRUSH_CATALOG.find((b) => b.type === brushType)?.label ?? "Brush";
  const activeShapeLabel = SHAPE_CATALOG.find((s) => s.type === shapeType)?.label ?? "Line";

  if (hidden) {
    return <ShowTab onClick={() => setHidden(false)} />;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-2 sm:px-4">
      <div
        className="pointer-events-auto relative flex flex-wrap items-center justify-center gap-3 rounded-sm border-2 border-chrome-border px-3 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.5)] ring-1 ring-rust/25"
        style={{
          backgroundImage: "linear-gradient(180deg, var(--chrome-bg-raised), var(--chrome-bg-recessed))",
        }}
      >
        <MountBracket side="left" collapsed={collapsed} onClick={() => setCollapsed((v) => !v)} />
        <MountBracket side="right" collapsed={collapsed} onClick={() => setCollapsed((v) => !v)} />
        <HideHandle onClick={() => setHidden(true)} />
        {!collapsed && <DripEdge />}

        <div className="relative flex items-center gap-1 rounded-sm border border-chrome-border bg-chrome-bg p-1">
          <button
            type="button"
            onClick={() => {
              if (tool === "brush") {
                setPickerOpen((v) => !v);
              } else {
                onToolChange("brush");
              }
            }}
            aria-pressed={tool === "brush"}
            aria-haspopup="true"
            aria-expanded={pickerOpen}
            title={activeBrushLabel}
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
              tool === "brush" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
            }`}
          >
            <BrushIcon />
            <span className="hidden sm:inline">{activeBrushLabel}</span>
            <ChevronUpIcon />
          </button>
          {pickerOpen && (
            <BrushPicker
              brushType={brushType}
              onSelect={(t) => {
                onBrushTypeChange(t);
                onToolChange("brush");
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}
          <button
            type="button"
            onClick={() => onToolChange("eraser")}
            aria-pressed={tool === "eraser"}
            title="Eraser"
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
              tool === "eraser" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
            }`}
          >
            <EraserIcon />
            <span className="hidden sm:inline">Erase</span>
          </button>
          <button
            type="button"
            onClick={() => onToolChange("pan")}
            aria-pressed={tool === "pan"}
            title="Pan"
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
              tool === "pan" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
            }`}
          >
            <HandIcon />
          </button>
          <button
            type="button"
            onClick={() => onToolChange("magnifier")}
            aria-pressed={tool === "magnifier"}
            title="Magnifier"
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
              tool === "magnifier" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
            }`}
          >
            <MagnifierIcon />
          </button>
          <button
            type="button"
            onClick={() => {
              if (tool === "shape") {
                setShapePickerOpen((v) => !v);
              } else {
                onToolChange("shape");
              }
            }}
            aria-pressed={tool === "shape"}
            aria-haspopup="true"
            aria-expanded={shapePickerOpen}
            title={activeShapeLabel}
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
              tool === "shape" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
            }`}
          >
            <ShapesIcon />
          </button>
          {shapePickerOpen && (
            <ShapePicker
              shapeType={shapeType}
              onSelect={(s) => {
                onShapeTypeChange(s);
                onToolChange("shape");
              }}
              onClose={() => setShapePickerOpen(false)}
            />
          )}
          <button
            type="button"
            onClick={() => onToolChange("ruler")}
            aria-pressed={tool === "ruler"}
            title="Ruler"
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
              tool === "ruler" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
            }`}
          >
            <RulerIcon />
          </button>
        </div>

        {!collapsed && (
        <>
        <div className="flex items-center gap-2">
          {SWATCHES.map((sw) => (
            <button
              key={sw}
              type="button"
              onClick={() => {
                onColorChange(sw);
                onToolChange("brush");
              }}
              aria-label={`color ${sw}`}
              aria-pressed={color === sw}
              className={`relative shrink-0 rounded-full ring-1 ring-black/40 transition-all ${
                color === sw
                  ? "h-8 w-8 ring-2 ring-accent-yellow ring-offset-2 ring-offset-chrome-bg-raised"
                  : "h-6 w-6"
              }`}
              style={{
                background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${sw} 100%, white 35%), ${sw} 60%)`,
              }}
            />
          ))}
          <label
            className={`relative shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/40 transition-all ${
              !SWATCHES.includes(color)
                ? "h-8 w-8 ring-2 ring-accent-yellow ring-offset-2 ring-offset-chrome-bg-raised"
                : "h-6 w-6"
            }`}
            title="Custom color"
            style={{
              background: "conic-gradient(from 0deg, #ff3b30, #ffcc00, #34c759, #30b0c7, #007aff, #af52de, #ff3b30)",
            }}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => {
                onColorChange(e.target.value);
                onToolChange("brush");
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="custom color"
            />
            {!SWATCHES.includes(color) && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-[3px] rounded-full"
                style={{ background: color }}
              />
            )}
          </label>
        </div>

        <div className="flex items-center gap-2 border-l border-chrome-border pl-3">
          <span className="flex items-center gap-1 text-ink-dim">
            <RulerIcon />
            <span className="font-mono text-[11px] font-bold tracking-wide uppercase">Size</span>
          </span>
          <input
            type="range"
            min={1}
            max={60}
            value={width}
            onChange={(e) => onWidthChange(Number(e.target.value))}
            className="w-16 accent-accent-crimson sm:w-20"
            aria-label="brush size"
          />
          <span className="w-6 text-right font-mono text-xs tabular-nums text-ink">{width}</span>
        </div>

        <div className="flex items-center gap-2 border-l border-chrome-border pl-3">
          <span className="flex items-center gap-1 text-ink-dim">
            <DropletIcon />
            <span className="font-mono text-[11px] font-bold tracking-wide uppercase">Opacity</span>
          </span>
          <input
            type="range"
            min={5}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
            className="w-16 accent-accent-crimson sm:w-20"
            aria-label="brush opacity"
          />
          <span className="w-9 text-right font-mono text-xs tabular-nums text-ink">
            {Math.round(opacity * 100)}%
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
          <span className="w-11 text-center font-mono text-xs tabular-nums text-ink">{zoomPercent}%</span>
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
          <button
            type="button"
            onClick={async () => {
              try {
                await onShare();
                setCopied(true);
                if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
                copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
              } catch {
                // clipboard write failed (permissions/unsupported) — no feedback, button stays idle
              }
            }}
            aria-label={copied ? "link copied" : "copy shareable link"}
            title={copied ? "Copied!" : "Copy shareable link"}
            className="ml-0.5 rounded-sm px-2 py-1.5 hover:bg-chrome-bg-raised hover:text-ink"
          >
            {copied ? <CheckIcon /> : <ShareIcon />}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
