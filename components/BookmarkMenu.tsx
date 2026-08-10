"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChromeRivet } from "./ChromeRivet";
import type { Camera } from "@/lib/camera";
import type { Point } from "@/lib/types";
import { t, type Locale } from "@/lib/i18n";

export interface BookmarkMenuProps {
  currentCamera: Camera;
  clientId: string;
  onTeleport: (pt: Point, zoom: number, label: string) => void;
  locale: Locale;
}

export function BookmarkMenu({ currentCamera, clientId, onTeleport, locale }: BookmarkMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  const bookmarks = useQuery(api.bookmarks.list, { limit: 20 }) ?? [];
  const createBookmark = useMutation(api.bookmarks.create);

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

  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      if (window.innerWidth >= 1360) {
        const top = Math.max(12, Math.min(rect.top, window.innerHeight - 380));
        const right = window.innerWidth - rect.left + 12;
        setCoords({ top, right });
      } else {
        setCoords({ top: 80, right: Math.max(12, window.innerWidth - rect.right) });
      }
    }
    setIsOpen((prev) => !prev);
  };

  const handleSaveCurrentSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = titleInput.trim();
    if (!trimmed || isSaving) return;

    try {
      setIsSaving(true);
      await createBookmark({
        title: trimmed,
        x: currentCamera.x,
        y: currentCamera.y,
        zoom: currentCamera.zoom,
        clientId,
      });
      setTitleInput("");
    } catch (err) {
      console.error("Failed to save bookmark:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = (e: React.MouseEvent, bm: (typeof bookmarks)[number]) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?x=${Math.round(bm.x)}&y=${Math.round(bm.y)}&z=${bm.zoom}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(bm._id);
      setTimeout(() => setCopiedId(null), 2000);
    });
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
        title={t(locale, "bookmark_current_view")}
        aria-label={t(locale, "bookmarks")}
        aria-expanded={isOpen}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-yellow">
          <path
            d="M5 3v18l7-5 7 5V3H5z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        <span>{t(locale, "bookmarks").toUpperCase()}</span>
      </button>

      {isOpen && mounted && coords && createPortal(
        <div
          ref={popoverRef}
          role="menu"
          aria-label={t(locale, "saved_locations")}
          className="fixed z-[1000] flex flex-col gap-3 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.95)] backdrop-blur-md w-[320px] sm:w-[360px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-4rem)] overflow-y-auto"
          style={{ top: `${coords.top}px`, right: `${coords.right}px` }}
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />

          {/* Form to bookmark current location */}
          <form onSubmit={handleSaveCurrentSpot} className="flex flex-col gap-1.5 border-b border-chrome-border/60 pb-3">
            <span className="font-mono text-xs font-bold uppercase text-accent-yellow">
              {t(locale, "bookmark_current_view")}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder={t(locale, "bookmark_placeholder")}
                maxLength={40}
                className="flex-1 rounded-sm border border-chrome-border bg-chrome-bg-raised px-2 py-1 font-mono text-xs text-ink placeholder:text-ink-dim/50 focus:border-rust focus:outline-none"
              />
              <button
                type="submit"
                disabled={!titleInput.trim() || isSaving}
                className="rounded-sm border border-rust bg-rust/30 px-3 py-1 font-mono text-xs font-bold text-ink transition-colors hover:bg-rust hover:text-white disabled:opacity-40"
              >
                {t(locale, "save").toUpperCase()}
              </button>
            </div>
          </form>

          {/* List of saved spots */}
          <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto pr-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-dim">
              {t(locale, "saved_locations")} ({bookmarks.length})
            </span>

            {bookmarks.length === 0 ? (
              <p className="py-3 text-center font-mono text-xs italic text-ink-dim">
                {t(locale, "no_bookmarks_yet")}
              </p>
            ) : (
              bookmarks.map((bm) => (
                <div
                  key={bm._id}
                  onClick={() => {
                    onTeleport({ x: bm.x, y: bm.y }, bm.zoom, bm.title);
                    setIsOpen(false);
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded border border-chrome-border bg-chrome-bg-raised/80 px-2.5 py-1.5 transition-colors hover:border-rust hover:bg-rust/20"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-mono text-xs font-bold text-ink">
                      {bm.title}
                    </span>
                    <span className="font-mono text-[10px] text-ink-dim">
                      ({Math.round(bm.x)}, {Math.round(bm.y)}) • {Math.round(bm.zoom * 100)}%
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleCopyLink(e, bm)}
                    className="shrink-0 rounded border border-chrome-border bg-chrome-bg px-2 py-0.5 font-mono text-[10px] font-bold text-ink-dim transition-colors hover:border-rust hover:text-accent-yellow"
                    title={t(locale, "share")}
                  >
                    {copiedId === bm._id ? t(locale, "copied").toUpperCase() : t(locale, "share").toUpperCase()}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
