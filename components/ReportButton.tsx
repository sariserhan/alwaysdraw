"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChromeRivet } from "./ChromeRivet";
import type { Camera } from "@/lib/camera";
import type { WorldRect } from "@/lib/types";
import { t, type Locale } from "@/lib/i18n";

export interface ReportButtonProps {
  currentCamera: Camera;
  clientId: string;
  locale: Locale;
  iconOnly?: boolean;
  /** Set once the user finishes dragging a rectangle via onStartRegionSelect
   * — a report submitted while this is set uses the marked rectangle
   * instead of the current camera view. */
  pendingRegion: WorldRect | null;
  /** Switches the canvas into "drag to mark an area" mode; this component
   * closes its own popup so the drag isn't blocked by it. */
  onStartRegionSelect: () => void;
  /** Called once pendingRegion has been submitted or explicitly cleared, so
   * the parent can null it back out. */
  onRegionConsumed: () => void;
}

/** Lets any user flag drawn content — either their current view or a
 * precisely drag-marked rectangle — for an admin to review. The only
 * user-facing moderation signal in the app; everything else routes through
 * an admin acting directly on strokes/comments. */
export function ReportButton({
  currentCamera,
  clientId,
  locale,
  iconOnly = false,
  pendingRegion,
  onStartRegionSelect,
  onRegionConsumed,
}: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  const createReport = useMutation(api.reports.create);

  useEffect(() => {
    setMounted(true);
  }, []);

  const positionPopover = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    if (window.innerWidth >= 1360) {
      const top = Math.max(12, Math.min(rect.top, window.innerHeight - 320));
      const right = window.innerWidth - rect.left + 12;
      setCoords({ top, right });
    } else {
      setCoords({ top: 80, right: Math.max(12, window.innerWidth - rect.right) });
    }
  };

  // A region drag just finished — reopen (or stay open) showing it, even
  // though this component itself closed its popup to start the drag.
  useEffect(() => {
    if (!pendingRegion) return;
    positionPopover();
    setSubmitted(false);
    setIsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRegion]);

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
    if (!isOpen) {
      positionPopover();
      setSubmitted(false);
      setSubmitError(false);
      setReason("");
    }
    setIsOpen((prev) => !prev);
  };

  const handleMarkArea = () => {
    setIsOpen(false);
    onStartRegionSelect();
  };

  const handleClearRegion = () => {
    onRegionConsumed();
    setReason("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      setSubmitError(false);
      await createReport({
        reporterId: clientId,
        targetType: "area",
        ...(pendingRegion
          ? { minX: pendingRegion.minX, minY: pendingRegion.minY, maxX: pendingRegion.maxX, maxY: pendingRegion.maxY }
          : { x: currentCamera.x, y: currentCamera.y, zoom: currentCamera.zoom }),
        reason: reason.trim() || undefined,
      });
      setSubmitted(true);
      setReason("");
      if (pendingRegion) onRegionConsumed();
    } catch (err) {
      console.error("Failed to submit report:", err);
      setSubmitError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className={`flex items-center justify-center rounded-sm border shadow-sm transition-colors ${
          iconOnly
            ? "h-7 w-7 text-sm"
            : "h-[28px] w-full gap-1.5 px-2.5 py-1 font-mono text-xs font-semibold whitespace-nowrap"
        } ${
          isOpen
            ? "border-rust bg-rust text-on-accent font-bold"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title={t(locale, "report_area_title")}
        aria-label={t(locale, "report")}
        aria-expanded={isOpen}
      >
        <span className="text-accent-crimson shrink-0">🚩</span>
        {!iconOnly && <span>{t(locale, "report").toUpperCase()}</span>}
      </button>

      {isOpen && mounted && coords && createPortal(
        <div
          ref={popoverRef}
          role="menu"
          aria-label={t(locale, "report_area_title")}
          className="fixed z-[1000] flex flex-col gap-2 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.95)] backdrop-blur-md w-[280px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-4rem)] overflow-y-auto"
          style={{ top: `${coords.top}px`, right: `${coords.right}px` }}
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />

          <span className="font-mono text-xs font-bold uppercase text-accent-yellow border-b border-chrome-border/60 pb-1.5">
            🚩 {t(locale, "report_area_title")}
          </span>

          {submitted ? (
            <p className="py-2 text-center font-mono text-xs text-accent-green">
              {t(locale, "report_submitted")}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              {submitError && (
                <p className="rounded-sm border border-accent-crimson/60 bg-accent-crimson/10 px-2 py-1.5 font-mono text-[10px] text-accent-crimson">
                  report didn&apos;t send — try again
                </p>
              )}
              {pendingRegion ? (
                <div className="flex items-center justify-between rounded-sm border border-accent-crimson/60 bg-accent-crimson/10 px-2 py-1.5">
                  <span className="font-mono text-[10px] text-ink">
                    🚩 {t(locale, "report_region_selected")}: ({Math.round(pendingRegion.minX)}, {Math.round(pendingRegion.minY)}) → ({Math.round(pendingRegion.maxX)}, {Math.round(pendingRegion.maxY)})
                  </span>
                  <button
                    type="button"
                    onClick={handleClearRegion}
                    className="shrink-0 font-mono text-[10px] text-ink-dim underline hover:text-ink"
                  >
                    {t(locale, "report_region_clear")}
                  </button>
                </div>
              ) : (
                <>
                  <p className="font-mono text-[10px] text-ink-dim">{t(locale, "report_area_desc")}</p>
                  <button
                    type="button"
                    onClick={handleMarkArea}
                    className="rounded-sm border border-chrome-border bg-chrome-bg-raised px-2.5 py-1.5 font-mono text-[10px] font-bold text-ink transition-colors hover:border-rust hover:text-accent-yellow"
                  >
                    ⬚ {t(locale, "report_mark_area").toUpperCase()}
                  </button>
                </>
              )}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t(locale, "report_reason_placeholder")}
                maxLength={280}
                rows={3}
                className="resize-none rounded-sm border border-chrome-border bg-chrome-bg-raised px-2 py-1.5 font-mono text-xs text-ink placeholder:text-ink-dim/50 focus:border-rust focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-sm border border-rust bg-rust/30 px-3 py-1.5 font-mono text-xs font-bold text-ink transition-colors hover:bg-rust hover:text-white disabled:opacity-40"
              >
                {(pendingRegion ? t(locale, "report_submit") : t(locale, "report_current_view")).toUpperCase()}
              </button>
            </form>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
