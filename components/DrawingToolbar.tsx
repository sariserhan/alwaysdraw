"use client";

import { useState, useRef, useEffect } from "react";
import { t, type Locale } from "@/lib/i18n";
import type { BrushType, Tool } from "@/lib/types";
import { BRUSH_CATALOG, getBrushTypeTranslationKey, getBrushCategoryTranslationKey } from "@/lib/brushes";
import { SHAPE_CATALOG, type ShapeType } from "@/lib/shapes";
import { STENCIL_TYPES, type StencilType } from "@/lib/stencils";
import { PALETTE_PRESETS, type Palette } from "@/lib/palettes";
import { ChromeRivet } from "./ChromeRivet";



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

function MountBracket({
  side,
  collapsed,
  onClick,
  title,
}: {
  side: "left" | "right";
  collapsed: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? "expand section" : "collapse section"}
      title={title ?? (collapsed ? "Expand" : "Collapse")}
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

function LaserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function StencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2v20M2 12h20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" />
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

function CoordFinderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" strokeDasharray="3 2" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
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

function TextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7V4h16v3M12 4v16m-3 0h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyedropperIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 11l-8-8-8.5 8.5a3 3 0 0 0 0 4.24l2.83 2.83a3 3 0 0 0 4.24 0L18 10zM14 6l4 4M2 22l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
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

function FlameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c1.5 1 2 2.8 2 4.2A5.2 5.2 0 0 1 6.8 14.2C6.8 9 12 7 12 2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CATEGORIES: Array<"Basic" | "Artistic" | "Effects"> = ["Basic", "Artistic", "Effects"];

function BrushPicker({
  brushType,
  onSelect,
  onClose,
  locale = "en",
}: {
  brushType: BrushType;
  onSelect: (t: BrushType) => void;
  onClose: () => void;
  locale?: Locale;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[1000]" onClick={onClose} aria-hidden />
      <div className="absolute bottom-full left-0 z-[1001] mb-3 w-56 rounded-sm border-2 border-chrome-border bg-chrome-bg-raised p-2 shadow-[0_12px_36px_rgba(0,0,0,0.9)]">
        {CATEGORIES.map((category) => (
          <div key={category} className="mb-1.5 last:mb-0">
            <div className="px-1.5 py-1 font-mono text-[11px] font-bold tracking-wide text-ink-dim uppercase">
              {t(locale, getBrushCategoryTranslationKey(category))}
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
                  {t(locale, getBrushTypeTranslationKey(b.type))}
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
    case "arrow":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
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
    case "star":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <polygon points="12,2 15,8 22,9 17,14 18,21 12,17 6,21 7,14 2,9 9,8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "hexagon":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "heart":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.72-8.72 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
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
    <div
      className="absolute bottom-full left-0 mb-2 rounded-sm border-2 border-chrome-border bg-chrome-bg-raised p-2 shadow-xl z-50 flex gap-1"
      style={{
        backgroundImage: "linear-gradient(180deg, var(--chrome-bg-raised), var(--chrome-bg-recessed))",
      }}
    >
      {SHAPE_CATALOG.map((s) => (
        <button
          key={s.type}
          type="button"
          onClick={() => {
            onSelect(s.type);
            onClose();
          }}
          title={s.label}
          className={`flex h-7 w-7 items-center justify-center rounded-sm text-xs transition ${
            shapeType === s.type
              ? "bg-accent-crimson-deep text-on-accent"
              : "bg-chrome-bg text-ink-dim hover:bg-chrome-border hover:text-ink"
          }`}
        >
          <ShapeIcon type={s.type} />
        </button>
      ))}
    </div>
  );
}

function StencilPicker({
  selectedStencil,
  onSelect,
  onClose,
}: {
  selectedStencil: StencilType;
  onSelect: (st: StencilType) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute bottom-full left-0 mb-2 rounded-sm border-2 border-chrome-border bg-chrome-bg-raised p-2 shadow-xl z-50 flex gap-1"
      style={{
        backgroundImage: "linear-gradient(180deg, var(--chrome-bg-raised), var(--chrome-bg-recessed))",
      }}
    >
      {STENCIL_TYPES.map((st) => (
        <button
          key={st.id}
          type="button"
          onClick={() => {
            onSelect(st.id);
            onClose();
          }}
          title={st.label}
          className={`flex h-7 w-7 items-center justify-center rounded-sm text-xs transition ${
            selectedStencil === st.id
              ? "bg-accent-crimson-deep text-on-accent"
              : "bg-chrome-bg text-ink-dim hover:bg-chrome-border hover:text-ink"
          }`}
        >
          {st.icon}
        </button>
      ))}
    </div>
  );
}

function PalettePicker({
  activePaletteId,
  onSelectPalette,
  locale = "en",
}: {
  activePaletteId: string;
  onSelectPalette: (p: Palette) => void;
  locale?: Locale;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t(locale, "palette_picker_title")}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-chrome-border bg-chrome-bg text-ink-dim hover:text-ink"
      >
        🎨
      </button>
      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 w-48 rounded-sm border-2 border-chrome-border bg-chrome-bg-raised p-2 shadow-xl z-50 space-y-1"
          style={{
            backgroundImage: "linear-gradient(180deg, var(--chrome-bg-raised), var(--chrome-bg-recessed))",
          }}
        >
          {PALETTE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelectPalette(p);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-sm px-2 py-1 text-xs transition ${
                activePaletteId === p.id ? "bg-chrome-border text-ink" : "text-ink-dim hover:text-ink"
              }`}
            >
              <span>{p.name}</span>
              <div className="flex gap-0.5">
                {p.colors.slice(0, 4).map((c) => (
                  <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Palette swatches, custom color picker, and palette switcher — kept next
 * to the brush picker so color and brush selection happen in one place. */
function ColorSwatches({
  activePalette,
  color,
  onColorChange,
  onPickColor,
  onSelectPalette,
  locale = "en",
}: {
  activePalette: Palette;
  color: string;
  onColorChange: (c: string) => void;
  onPickColor: () => void;
  onSelectPalette: (p: Palette) => void;
  locale?: Locale;
}) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-1.5 sm:gap-2 border-l border-chrome-border pl-1.5 sm:pl-2">
      {activePalette.colors.map((sw) => (
        <button
          key={sw}
          type="button"
          onClick={() => {
            onColorChange(sw);
            onPickColor();
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
      {(() => {
        const safeColor = /^#[0-9A-Fa-f]{6}$/.test(color || "") ? color : "#17181a";
        const isCustom = !activePalette.colors.includes(color);
        return (
          <label
            className={`relative shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/40 transition-all ${
              isCustom
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
              value={safeColor}
              onChange={(e) => {
                onColorChange(e.target.value);
                onPickColor();
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="custom color"
            />
            {isCustom && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-[3px] rounded-full"
                style={{ background: safeColor }}
              />
            )}
          </label>
        );
      })()}
      <PalettePicker activePaletteId={activePalette.id} locale={locale} onSelectPalette={onSelectPalette} />
    </div>
  );
}

export function DrawingToolbar({
  tool,
  onToolChange,
  brushType,
  onBrushTypeChange,
  shapeType,
  onShapeTypeChange,
  selectedStencil = "biohazard",
  onStencilSelect = () => {},
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
  showHeatmap,
  onToggleHeatmap,
  locale = "en",
  zoomGateActive,
}: {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  brushType: BrushType;
  onBrushTypeChange: (b: BrushType) => void;
  shapeType: ShapeType;
  onShapeTypeChange: (s: ShapeType) => void;
  selectedStencil?: StencilType;
  onStencilSelect?: (st: StencilType) => void;
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
  onShare: () => void | Promise<void>;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  locale?: Locale;
  /** True when the current zoom is below the mark-making tools' minimum —
   * disables their buttons and shows the attached "zoom in to draw" banner.
   * Always false on canvases that don't support zoom/pan (Board). */
  zoomGateActive: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [stencilPickerOpen, setStencilPickerOpen] = useState(false);
  const [activePalette, setActivePalette] = useState<Palette>(PALETTE_PRESETS[0]);
  const [toolsSectionOpen, setToolsSectionOpen] = useState(true);
  const [stylesSectionOpen, setStylesSectionOpen] = useState(true);

  const activeBrushLabel = t(locale ?? "en", getBrushTypeTranslationKey(brushType));
  const activeShapeLabel = SHAPE_CATALOG.find((s) => s.type === shapeType)?.label ?? "Line";

  // L-shaped connector from the zoom-gate banner down to the zoom control —
  // measured live off the real DOM rather than assumed, since the banner is
  // centered over the whole toolbar while the zoom control sits inside the
  // left panel, and their horizontal gap shifts with viewport width and
  // with which sections are expanded/collapsed. Same live-measurement
  // pattern as MiniMap.tsx's useHeaderBottomOffset.
  const connectorRootRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const zoomControlRef = useRef<HTMLDivElement>(null);
  const [connector, setConnector] = useState<{ x1: number; y1: number; midY: number; x2: number; y2: number } | null>(null);

  useEffect(() => {
    if (!zoomGateActive) {
      queueMicrotask(() => setConnector(null));
      return;
    }
    const update = () => {
      const root = connectorRootRef.current;
      const banner = bannerRef.current;
      const zoomEl = zoomControlRef.current;
      if (!root || !banner || !zoomEl) return;
      const rootRect = root.getBoundingClientRect();
      const bannerRect = banner.getBoundingClientRect();
      const zoomRect = zoomEl.getBoundingClientRect();
      const x1 = bannerRect.left + bannerRect.width / 2 - rootRect.left;
      const y1 = bannerRect.bottom - rootRect.top;
      const x2 = zoomRect.left + zoomRect.width / 2 - rootRect.left;
      const y2 = zoomRect.top - rootRect.top;
      setConnector({ x1, y1, midY: y1 + (y2 - y1) / 2, x2, y2 });
    };
    update();
    const rafId = requestAnimationFrame(update);
    const timeoutId = setTimeout(update, 100);
    const ro = new ResizeObserver(update);
    if (connectorRootRef.current) ro.observe(connectorRootRef.current);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [zoomGateActive]);

  return (
    <div ref={connectorRootRef} className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-2 pb-2 sm:px-4 max-w-full z-20">
      {connector && (
        <svg aria-hidden className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible text-accent-yellow">
          <path
            d={`M ${connector.x1} ${connector.y1} L ${connector.x1} ${connector.midY} L ${connector.x2} ${connector.midY} L ${connector.x2} ${connector.y2}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
        </svg>
      )}
      {zoomGateActive && (
        <div
          ref={bannerRef}
          role="status"
          className="pointer-events-auto flex items-center gap-1.5 rounded-sm border-2 border-rust bg-chrome-bg/95 px-3 py-1.5 font-mono text-[11px] font-bold text-accent-yellow shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur-sm"
        >
          <span>🔍</span>
          <span>{t(locale, "zoom_gate_banner")}</span>
        </div>
      )}
      <div className="relative flex flex-wrap items-stretch justify-center gap-2 sm:gap-3 max-w-[98vw]">
        {/* SECTION 1: TOOLS & CONTROLS (LEFT PANEL) */}
        <div
          className="pointer-events-auto relative flex self-stretch items-center justify-center gap-1.5 sm:gap-2 rounded-sm border-2 border-chrome-border px-2 sm:px-3 py-1.5 sm:py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.5)] ring-1 ring-rust/25 max-w-[98vw] overflow-visible"
          style={{
            backgroundImage: "linear-gradient(180deg, var(--chrome-bg-raised), var(--chrome-bg-recessed))",
          }}
        >
        <MountBracket
          side="left"
          collapsed={!toolsSectionOpen}
          onClick={() => setToolsSectionOpen((v) => !v)}
          title={toolsSectionOpen ? "Hide Tools section" : "Show Tools section"}
        />
        {toolsSectionOpen && <DripEdge />}

        {toolsSectionOpen ? (
          <div className="relative flex max-w-full flex-wrap items-center gap-0.5 sm:gap-1 rounded-sm border border-chrome-border bg-chrome-bg p-1">
            <button
              type="button"
              disabled={zoomGateActive}
              onClick={() => {
                onToolChange("brush");
                setPickerOpen((v) => (tool !== "brush" ? true : !v));
              }}
              aria-pressed={tool === "brush"}
              aria-haspopup="true"
              aria-expanded={pickerOpen}
              title={activeBrushLabel}
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-dim ${
                tool === "brush" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              <BrushIcon />
              <span className="whitespace-nowrap">{activeBrushLabel}</span>
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
                locale={locale}
              />
            )}
            {/* Color picker sits right next to the brush picker — quick
                access to both without hunting across the toolbar. */}
            <ColorSwatches
              activePalette={activePalette}
              color={color}
              onColorChange={onColorChange}
              onPickColor={() => onToolChange("brush")}
              onSelectPalette={(p) => {
                setActivePalette(p);
                onColorChange(p.colors[0]);
              }}
              locale={locale}
            />
            {/* Zoom sits right next to brush/color too — the quickest way
                out of the zoom gate is right where it's blocking you, never
                itself disabled by the gate. A bouncing arrow points straight
                down at it while the gate is active, so the banner's message
                has an obvious, always-correctly-aligned target — anchored to
                this control itself rather than measured across the banner,
                which would drift on reflow/resize. */}
            <div ref={zoomControlRef} className="relative flex items-center gap-0.5 rounded-sm border border-chrome-border bg-chrome-bg px-1">
              {zoomGateActive && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 animate-bounce text-base text-accent-yellow"
                >
                  ↓
                </span>
              )}
              <button
                type="button"
                onClick={onZoomOut}
                aria-label="zoom out"
                title="Zoom Out"
                className="flex h-6 w-6 items-center justify-center rounded-sm text-sm font-bold text-ink-dim transition-colors hover:text-ink"
              >
                −
              </button>
              <span
                className="min-w-[2.75rem] text-center font-mono text-[11px] font-bold tabular-nums text-accent-yellow"
                title="Current Zoom Level"
              >
                {zoomPercent}%
              </span>
              <button
                type="button"
                onClick={onZoomIn}
                aria-label="zoom in"
                title="Zoom In"
                className="flex h-6 w-6 items-center justify-center rounded-sm text-sm font-bold text-ink-dim transition-colors hover:text-ink"
              >
                +
              </button>
            </div>
            <button
              type="button"
              disabled={zoomGateActive}
              onClick={() => onToolChange(tool === "eraser" ? "laser" : "eraser")}
              aria-pressed={tool === "eraser"}
              title={t(locale ?? "en", "erase")}
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-dim ${
                tool === "eraser" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              <EraserIcon />
              <span className="whitespace-nowrap">{t(locale, "erase")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && "EyeDropper" in window) {
                  const EyeDropperClass = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
                  const eyeDropper = new EyeDropperClass();
                  eyeDropper
                    .open()
                    .then((res: { sRGBHex: string }) => {
                      if (res.sRGBHex) onColorChange(res.sRGBHex);
                    })
                    .catch(() => {});
                } else {
                  onToolChange(tool === "eyedropper" ? "laser" : "eyedropper");
                }
              }}
              aria-pressed={tool === "eyedropper"}
              title="Eyedropper Color Picker (I)"
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
                tool === "eyedropper" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              <EyedropperIcon />
            </button>
            <button
              type="button"
              onClick={() => onToolChange(tool === "pan" ? "laser" : "pan")}
              aria-pressed={tool === "pan"}
              title={t(locale, "pan")}
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
                tool === "pan" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              <HandIcon />
            </button>
            <button
              type="button"
              onClick={() => onToolChange(tool === "magnifier" ? "laser" : "magnifier")}
              aria-pressed={tool === "magnifier"}
              title={t(locale, "magnifier")}
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
                tool === "magnifier" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              <MagnifierIcon />
            </button>
            <button
              type="button"
              disabled={zoomGateActive}
              onClick={() => {
                if (tool === "shape") {
                  onToolChange("laser");
                  setShapePickerOpen(false);
                } else {
                  onToolChange("shape");
                  setShapePickerOpen(true);
                }
              }}
              aria-pressed={tool === "shape"}
              aria-haspopup="true"
              aria-expanded={shapePickerOpen}
              title={activeShapeLabel}
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-dim ${
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
              disabled={zoomGateActive}
              onClick={() => onToolChange(tool === "text" ? "laser" : "text")}
              aria-pressed={tool === "text"}
              title="Text Tool (X)"
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-dim ${
                tool === "text" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              <TextIcon />
            </button>
            <button
              type="button"
              onClick={() => onToolChange(tool === "comment" ? "laser" : "comment")}
              aria-pressed={tool === "comment"}
              title="Post Sticky Note (C)"
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
                tool === "comment" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              <CommentIcon />
            </button>
            <button
              type="button"
              disabled={zoomGateActive}
              onClick={() => {
                if (tool === "stencil") {
                  onToolChange("laser");
                  setStencilPickerOpen(false);
                } else {
                  onToolChange("stencil");
                  setStencilPickerOpen(true);
                }
              }}
              aria-pressed={tool === "stencil"}
              aria-haspopup="true"
              aria-expanded={stencilPickerOpen}
              title={t(locale, "stencil")}
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-dim ${
                tool === "stencil" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              <StencilIcon />
            </button>
            {stencilPickerOpen && (
              <StencilPicker
                selectedStencil={selectedStencil}
                onSelect={(st) => {
                  onStencilSelect(st);
                  onToolChange("stencil");
                }}
                onClose={() => setStencilPickerOpen(false)}
              />
            )}
            <button
              type="button"
              onClick={() => onToolChange(tool === "laser" ? "laser" : "laser")}
              aria-pressed={tool === "laser"}
              title={t(locale, "laser")}
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
                tool === "laser" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              <LaserIcon />
            </button>
            <button
              type="button"
              disabled={zoomGateActive}
              onClick={() => onToolChange(tool === "ruler" ? "laser" : "ruler")}
              aria-pressed={tool === "ruler"}
              title={t(locale, "ruler")}
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-dim ${
                tool === "ruler" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              <RulerIcon />
            </button>
            <button
              type="button"
              onClick={() => onToolChange(tool === "coordFinder" ? "laser" : "coordFinder")}
              aria-pressed={tool === "coordFinder"}
              title={t(locale ?? "en", "coord_finder")}
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
                tool === "coordFinder" ? "bg-accent-crimson-deep text-on-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              <CoordFinderIcon />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setToolsSectionOpen(true)}
            className="flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold tracking-wide uppercase text-ink-dim hover:text-ink transition"
            title="Expand Tools"
          >
            <BrushIcon />
            <span className="font-mono text-xs">TOOLS</span>
            <ChevronUpIcon />
          </button>
        )}
      </div>



      {/* SECTION 2: COLORS, SIZE & OPACITY (RIGHT PANEL) */}
      <div
        className="pointer-events-auto relative flex self-stretch flex-wrap items-center justify-center gap-1.5 sm:gap-3 rounded-sm border-2 border-chrome-border px-2 sm:px-3 py-1.5 sm:py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.5)] ring-1 ring-rust/25 max-w-[98vw] overflow-visible"
        style={{
          backgroundImage: "linear-gradient(180deg, var(--chrome-bg-raised), var(--chrome-bg-recessed))",
        }}
      >
        <MountBracket
          side="right"
          collapsed={!stylesSectionOpen}
          onClick={() => setStylesSectionOpen((v) => !v)}
          title={stylesSectionOpen ? "Hide Colors & Style section" : "Show Colors & Style section"}
        />
        {stylesSectionOpen && <DripEdge />}

        {stylesSectionOpen ? (
          <>
            <div className="flex max-w-full flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="flex items-center gap-1 text-ink-dim">
                <RulerIcon />
                <span className="font-mono text-[11px] font-bold tracking-wide uppercase">{t(locale, "size")}</span>
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

            <div className="flex max-w-full flex-wrap items-center gap-1.5 sm:gap-2 border-l border-chrome-border pl-2 sm:pl-3">
              <span className="flex items-center gap-1 text-ink-dim">
                <DropletIcon />
                <span className="font-mono text-[11px] font-bold tracking-wide uppercase">{t(locale, "opacity")}</span>
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
          </>
        ) : (
          <button
            type="button"
            onClick={() => setStylesSectionOpen(true)}
            className="flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold tracking-wide uppercase text-ink-dim hover:text-ink transition"
            title="Expand Colors & Style"
          >
            <DropletIcon />
            <span className="font-mono text-xs">COLORS & STYLE</span>
            <ChevronUpIcon />
          </button>
        )}
      </div>
    </div>
    </div>
  );
}
