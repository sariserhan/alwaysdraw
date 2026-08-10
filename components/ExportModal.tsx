"use client";

import { useEffect, useRef, useState } from "react";
import { ChromeRivet } from "./ChromeRivet";
import { downloadCanvasPNG, generateTimelapseVideo } from "@/lib/exportMedia";
import type { ServerStroke } from "@/lib/types";
import type { Camera } from "@/lib/camera";

export interface ExportModalProps {
  getCanvasLayers: () => (HTMLCanvasElement | null)[];
  getCommittedStrokes: () => ServerStroke[];
  currentCamera: Camera;
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
}

export function ExportModal({
  getCanvasLayers,
  getCommittedStrokes,
  currentCamera,
  viewportWidth,
  viewportHeight,
  worldWidth,
  worldHeight,
}: ExportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleDownloadSnapshot = () => {
    const layers = getCanvasLayers();
    if (layers.every((c) => !c)) return;
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadCanvasPNG(layers, `alwaysdraw-${timestamp}.png`);
    setIsOpen(false);
  };

  const handleGenerateTimelapse = async () => {
    const strokes = getCommittedStrokes();
    if (strokes.length === 0 || isExporting) return;

    try {
      setIsExporting(true);
      setProgress(0);

      const blob = await generateTimelapseVideo({
        strokes,
        camera: currentCamera,
        viewportWidth: viewportWidth || 1200,
        viewportHeight: viewportHeight || 800,
        worldWidth,
        worldHeight,
        onProgress: setProgress,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `alwaysdraw-timelapse-${Date.now()}.webm`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Timelapse export failed:", err);
    } finally {
      setIsExporting(false);
      setProgress(0);
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold shadow-sm transition-colors ${
          isOpen
            ? "border-rust bg-rust text-on-accent font-bold"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title="Export Snapshot Image or Timelapse Video"
        aria-label="Export Menu"
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
        <span>EXPORT</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Export Media Options"
          className="absolute right-0 top-full mt-2 z-50 flex flex-col gap-2 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md w-[280px] sm:w-[320px]"
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />

          <span className="font-mono text-xs font-bold uppercase text-accent-yellow border-b border-chrome-border/60 pb-1.5">
            Export Canvas Media
          </span>

          {/* Option 1: Download PNG Snapshot */}
          <button
            type="button"
            onClick={handleDownloadSnapshot}
            disabled={isExporting}
            className="flex items-center gap-2.5 rounded border border-chrome-border bg-chrome-bg-raised p-2 text-left transition-colors hover:border-rust hover:bg-rust/20 disabled:opacity-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-chrome-bg text-accent-yellow">
              📷
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-xs font-bold text-ink">Snapshot (PNG)</span>
              <span className="font-mono text-[10px] text-ink-dim">High-res 4K image download</span>
            </div>
          </button>

          {/* Option 2: Export Timelapse Video */}
          <button
            type="button"
            onClick={handleGenerateTimelapse}
            disabled={isExporting}
            className="flex items-center gap-2.5 rounded border border-chrome-border bg-chrome-bg-raised p-2 text-left transition-colors hover:border-rust hover:bg-rust/20 disabled:opacity-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-chrome-bg text-accent-green">
              🎬
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-xs font-bold text-ink">Timelapse (WebM)</span>
              <span className="font-mono text-[10px] text-ink-dim">Animated history video</span>
            </div>
          </button>

          {/* Progress Indicator */}
          {isExporting && (
            <div className="flex flex-col gap-1 rounded bg-chrome-bg-raised p-2">
              <div className="flex justify-between font-mono text-[10px] font-bold text-ink">
                <span>Encoding Timelapse...</span>
                <span className="text-accent-yellow">{progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-chrome-bg">
                <div
                  className="h-full bg-rust transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
