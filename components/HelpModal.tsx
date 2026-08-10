"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChromeRivet } from "./ChromeRivet";

export function HelpModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const modalMarkup =
    isOpen && typeof document !== "undefined" ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-start overflow-y-auto bg-black/80 p-4 pt-16 sm:pt-20 backdrop-blur-md animate-fade-in pointer-events-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsOpen(false);
        }}
      >
        <div className="relative my-auto w-full max-w-xl rounded-sm border-2 border-rust bg-chrome-bg p-5 sm:p-6 text-ink shadow-[0_16px_48px_rgba(0,0,0,0.95)]">
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />
          <ChromeRivet className="bottom-2 left-2" />
          <ChromeRivet className="bottom-2 right-2" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-rust/60 pb-3">
            <div>
              <h2
                id="help-modal-title"
                className="stencil-cut font-display text-lg font-bold tracking-widest text-ink uppercase"
              >
                AlwaysDraw
              </h2>
              <p className="font-mono text-xs text-accent-yellow">
                One world. One canvas. Always drawing.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close help modal"
              className="flex h-7 w-7 items-center justify-center rounded border border-chrome-border bg-chrome-bg-raised font-mono text-sm font-bold text-ink transition-colors hover:border-rust hover:text-accent-crimson"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="mt-4 space-y-4 font-mono text-xs text-ink-dim leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <h3 className="font-display text-sm font-bold text-ink uppercase tracking-wide mb-1">
                What is AlwaysDraw?
              </h3>
              <p>
                AlwaysDraw is a single public 10,000×10,000 drawing wall shared live by everyone on the internet. There are no private rooms, no accounts, no protected regions, and no undo. Everyone draws on the exact same surface at the exact same time.
              </p>
            </div>

            <div>
              <h3 className="font-display text-sm font-bold text-ink uppercase tracking-wide mb-1">
                How It Works
              </h3>
              <ul className="list-disc pl-4 space-y-2 text-ink-dim">
                <li>
                  <strong className="text-ink">Consequence Over Control:</strong> Anyone can draw, erase, or spray paint over anyone else&apos;s artwork. Erasing clears your strokes to reveal the raw concrete wall underneath.
                </li>
                <li>
                  <strong className="text-ink">13 Expressive Brushes:</strong> Choose Basic textures (Pencil, Marker, Calligraphy, Pixel Art), Artistic media (Watercolor, Oil Paint, Chalk, Charcoal), or Special Effects (Neon Glow, Glitter).
                </li>
                <li>
                  <strong className="text-ink">Time Travel (Top Navbar):</strong> Click <span className="text-accent-yellow font-bold">TIME TRAVEL</span> in the top header to scrub back through time and watch artwork evolve stroke-by-stroke from the canvas&apos;s creation.
                </li>
                <li>
                  <strong className="text-ink">Spatial Discovery (Top Navbar):</strong> Click <span className="text-accent-blue font-bold">EXPLORE</span> in the top header to instantly teleport your camera to active hotspots, latest activity, or random art across the 100M-pixel wall.
                </li>
              </ul>
            </div>

            <div className="border-t border-chrome-border/60 pt-3">
              <h3 className="font-display text-sm font-bold text-ink uppercase tracking-wide mb-1">
                Camera Controls &amp; Shortcuts
              </h3>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded bg-chrome-bg-raised p-2">
                  <span className="text-ink font-bold block mb-0.5">Pan Camera</span>
                  <span>Space + Drag, Pan Tool, or 2-finger touch drag</span>
                </div>
                <div className="rounded bg-chrome-bg-raised p-2">
                  <span className="text-ink font-bold block mb-0.5">Zoom Camera</span>
                  <span>Mouse wheel, Pinch-to-zoom, or Toolbar +/-</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-5 flex justify-end border-t border-chrome-border/60 pt-3">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded border border-rust bg-rust/30 px-4 py-1.5 font-mono text-xs font-bold text-ink transition-colors hover:bg-rust hover:text-white"
            >
              GOT IT, LET&apos;S DRAW
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="How AlwaysDraw works - Help & Information"
        title="What is this & how it works"
        className="flex h-7 w-7 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg-raised/90 font-mono text-xs font-bold text-ink shadow-sm transition-colors hover:border-rust hover:text-accent-yellow"
      >
        ?
      </button>

      {modalMarkup && createPortal(modalMarkup, document.body)}
    </>
  );
}
