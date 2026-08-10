"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChromeRivet } from "./ChromeRivet";
import { downloadCanvasPNG, generateTimelapseVideo } from "@/lib/exportMedia";
import { strokeIntersectsRegion, fitCameraToRegion } from "@/lib/regionFilter";
import type { ServerStroke, WorldRect } from "@/lib/types";
import type { Camera } from "@/lib/camera";
import { t, type Locale } from "@/lib/i18n";

export interface ExportModalProps {
  getCanvasLayers: () => (HTMLCanvasElement | null)[];
  getCommittedStrokes: () => ServerStroke[];
  currentCamera: Camera;
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  /** Drag-selected world-space rectangle — when set, the timelapse export is
   * cropped to strokes in this region with a camera fit to match. */
  region: WorldRect | null;
  locale: Locale;
}

export function ExportModal({
  getCanvasLayers,
  getCommittedStrokes,
  currentCamera,
  viewportWidth,
  viewportHeight,
  worldWidth,
  worldHeight,
  region,
  locale,
}: ExportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: Event) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      if (window.innerWidth >= 1360) {
        const top = Math.max(12, Math.min(rect.top, window.innerHeight - 300));
        const right = window.innerWidth - rect.left + 12;
        setCoords({ top, right });
      } else {
        setCoords({ top: 80, right: Math.max(12, window.innerWidth - rect.right) });
      }
    }
    setIsOpen((prev) => !prev);
  };

  const handleDownloadSnapshot = () => {
    const layers = getCanvasLayers();
    downloadCanvasPNG(layers, `alwaysdraw-snapshot-${Date.now()}.png`);
    setIsOpen(false);
  };

  const handleExportWebM = async () => {
    let strokes = getCommittedStrokes();
    let cam = currentCamera;
    if (region) {
      strokes = strokes.filter((s) => strokeIntersectsRegion(s.points, region));
      cam = fitCameraToRegion(region, viewportWidth, viewportHeight);
    }
    if (strokes.length === 0) return;

    try {
      setIsExporting(true);
      setProgress(0);

      await generateTimelapseVideo({
        strokes,
        camera: cam,
        viewportWidth,
        viewportHeight,
        worldWidth,
        worldHeight,
        onProgress: (p) => setProgress(p),
      });

      setIsOpen(false);
    } catch (err) {
      console.error("Failed to export WebM timelapse:", err);
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold shadow-sm transition-colors ${
          isOpen
            ? "border-rust bg-rust text-on-accent font-bold"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title={t(locale, "export_canvas_media")}
        aria-label={t(locale, "export_canvas_media")}
        aria-expanded={isOpen}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-green">
          <path
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>{t(locale, "export").toUpperCase()}</span>
      </button>

      {isOpen && mounted && coords && createPortal(
        <div
          ref={popoverRef}
          role="menu"
          aria-label={t(locale, "export_canvas_media")}
          className="fixed z-[1000] flex flex-col gap-2 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.95)] backdrop-blur-md w-[280px] sm:w-[320px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-4rem)] overflow-y-auto"
          style={{ top: `${coords.top}px`, right: `${coords.right}px` }}
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />

          <span className="font-mono text-xs font-bold uppercase text-accent-yellow border-b border-chrome-border/60 pb-1.5">
            {t(locale, "export_canvas_media")}
          </span>

          {/* Option 1: Download PNG Snapshot */}
          <button
            type="button"
            onClick={handleDownloadSnapshot}
            disabled={isExporting}
            className="flex items-center gap-3 rounded border border-chrome-border bg-chrome-bg-raised p-2 text-left transition-colors hover:border-rust hover:bg-rust/20 disabled:opacity-40"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-chrome-bg text-accent-blue text-base font-bold">
              📷
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-xs font-bold text-ink">{t(locale, "snapshot_png")}</span>
              <span className="font-mono text-[10px] text-ink-dim">{t(locale, "snapshot_desc")}</span>
            </div>
          </button>

          {/* Option 2: Render WebM Timelapse */}
          <button
            type="button"
            onClick={handleExportWebM}
            disabled={isExporting}
            className="flex items-center gap-3 rounded border border-chrome-border bg-chrome-bg-raised p-2 text-left transition-colors hover:border-rust hover:bg-rust/20 disabled:opacity-40"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-chrome-bg text-accent-yellow text-base font-bold">
              🎬
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-xs font-bold text-ink">{t(locale, "timelapse_webm")}</span>
              <span className="font-mono text-[10px] text-ink-dim">
                {region ? `${t(locale, "region")}: ${Math.round(region.maxX - region.minX)}×${Math.round(region.maxY - region.minY)}px` : t(locale, "timelapse_desc")}
              </span>
            </div>
          </button>

          {isExporting && (
            <div className="mt-1 flex flex-col gap-1.5 rounded bg-chrome-bg-raised p-2 border border-rust/40">
              <div className="flex items-center justify-between font-mono text-[10px] text-ink-dim">
                <span>Rendering video...</span>
                <span className="font-bold text-accent-yellow">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-chrome-bg">
                <div
                  className="h-full bg-rust transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
