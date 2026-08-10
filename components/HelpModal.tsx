"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChromeRivet } from "./ChromeRivet";
import type { Locale } from "@/lib/i18n";
import { HELP_TRANSLATIONS } from "@/lib/helpTranslations";

export interface HelpModalProps {
  locale?: Locale;
}

export function HelpModal({ locale = "en" }: HelpModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tHelp = HELP_TRANSLATIONS[locale] ?? HELP_TRANSLATIONS.en;

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
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-start overflow-y-auto bg-black/85 p-3 sm:p-4 pt-12 sm:pt-16 backdrop-blur-md animate-fade-in pointer-events-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsOpen(false);
        }}
      >
        <div className="relative my-auto w-full max-w-2xl rounded-sm border-2 border-rust bg-chrome-bg p-4 sm:p-6 text-ink shadow-[0_16px_48px_rgba(0,0,0,0.95)]">
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />
          <ChromeRivet className="bottom-2 left-2" />
          <ChromeRivet className="bottom-2 right-2" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-rust/60 pb-3">
            <div>
              <h2
                id="help-modal-title"
                className="stencil-cut font-display text-base sm:text-lg font-bold tracking-widest text-ink uppercase"
              >
                {tHelp.modalTitle}
              </h2>
              <p className="font-mono text-xs text-accent-yellow">
                {tHelp.modalSubtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close help modal"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-chrome-border bg-chrome-bg-raised font-mono text-sm font-bold text-ink transition-colors hover:border-rust hover:text-accent-crimson"
            >
              ✕
            </button>
          </div>

          {/* Feature Showcase Body */}
          <div className="mt-4 space-y-3 font-mono text-xs text-ink-dim leading-relaxed max-h-[62vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="rounded border border-chrome-border/70 bg-chrome-bg-raised/80 p-2.5">
                <h3 className="font-display text-xs font-bold text-accent-yellow uppercase tracking-wide mb-1">
                  {tHelp.categories.brushesTitle}
                </h3>
                <p className="text-[11px] text-ink-dim leading-normal">
                  {tHelp.categories.brushesDesc}
                </p>
              </div>

              <div className="rounded border border-chrome-border/70 bg-chrome-bg-raised/80 p-2.5">
                <h3 className="font-display text-xs font-bold text-accent-yellow uppercase tracking-wide mb-1">
                  {tHelp.categories.textShapesTitle}
                </h3>
                <p className="text-[11px] text-ink-dim leading-normal">
                  {tHelp.categories.textShapesDesc}
                </p>
              </div>

              <div className="rounded border border-chrome-border/70 bg-chrome-bg-raised/80 p-2.5">
                <h3 className="font-display text-xs font-bold text-accent-yellow uppercase tracking-wide mb-1">
                  {tHelp.categories.creativeToolsTitle}
                </h3>
                <p className="text-[11px] text-ink-dim leading-normal">
                  {tHelp.categories.creativeToolsDesc}
                </p>
              </div>

              <div className="rounded border border-chrome-border/70 bg-chrome-bg-raised/80 p-2.5">
                <h3 className="font-display text-xs font-bold text-accent-yellow uppercase tracking-wide mb-1">
                  {tHelp.categories.collabTitle}
                </h3>
                <p className="text-[11px] text-ink-dim leading-normal">
                  {tHelp.categories.collabDesc}
                </p>
              </div>

              <div className="rounded border border-chrome-border/70 bg-chrome-bg-raised/80 p-2.5">
                <h3 className="font-display text-xs font-bold text-accent-yellow uppercase tracking-wide mb-1">
                  {tHelp.categories.navTimeTitle}
                </h3>
                <p className="text-[11px] text-ink-dim leading-normal">
                  {tHelp.categories.navTimeDesc}
                </p>
              </div>

              <div className="rounded border border-chrome-border/70 bg-chrome-bg-raised/80 p-2.5">
                <h3 className="font-display text-xs font-bold text-accent-yellow uppercase tracking-wide mb-1">
                  {tHelp.categories.shieldTitle}
                </h3>
                <p className="text-[11px] text-ink-dim leading-normal">
                  {tHelp.categories.shieldDesc}
                </p>
              </div>
            </div>

            {/* Shortcuts Section */}
            <div className="border-t border-chrome-border/60 pt-3">
              <h3 className="font-display text-xs font-bold text-ink uppercase tracking-wide mb-2">
                {tHelp.shortcutsTitle}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="rounded border border-chrome-border/60 bg-chrome-bg-raised/90 p-2">
                  <span className="text-accent-yellow font-bold block mb-0.5">{tHelp.panLabel}</span>
                  <span>{tHelp.panDesc}</span>
                </div>
                <div className="rounded border border-chrome-border/60 bg-chrome-bg-raised/90 p-2">
                  <span className="text-accent-yellow font-bold block mb-0.5">{tHelp.zoomLabel}</span>
                  <span>{tHelp.zoomDesc}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 flex justify-end border-t border-chrome-border/60 pt-3">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded border border-rust bg-rust/30 px-5 py-1.5 font-mono text-xs font-bold text-ink transition-colors hover:bg-rust hover:text-white shadow-md"
            >
              {tHelp.gotItBtn}
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
