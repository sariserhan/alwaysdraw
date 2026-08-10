"use client";

import { useEffect, useRef, useState } from "react";
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
  const [titleInput, setTitleInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const bookmarks = useQuery(api.bookmarks.list, { limit: 20 }) ?? [];
  const createBookmark = useMutation(api.bookmarks.create);

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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
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

      {isOpen && (
        <div
          role="menu"
          aria-label={t(locale, "saved_locations")}
          className="absolute right-0 top-full mt-2 z-50 flex flex-col gap-3 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md w-[320px] sm:w-[360px] fixed! right-3! sm:right-4! top-20! max-w-[calc(100vw-1.5rem)]! max-h-[calc(100vh-6rem)]! overflow-y-auto!"
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
            <span className="font-mono text-[10px] text-ink-dim">
              At ({Math.round(currentCamera.x)}, {Math.round(currentCamera.y)}) @ {currentCamera.zoom.toFixed(1)}x
            </span>
          </form>

          {/* List of Bookmarks */}
          <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
            <span className="font-mono text-[11px] font-bold uppercase text-ink-dim">
              {t(locale, "saved_locations")} ({bookmarks.length})
            </span>
            {bookmarks.length === 0 ? (
              <p className="font-mono text-xs text-ink-dim/70 py-2 text-center italic">
                {t(locale, "no_bookmarks")}
              </p>
            ) : (
              bookmarks.map((bm) => (
                <div
                  key={bm._id}
                  onClick={() => {
                    onTeleport({ x: bm.x, y: bm.y }, bm.zoom, bm.title);
                    setIsOpen(false);
                  }}
                  className="group flex items-center justify-between rounded border border-chrome-border/70 bg-chrome-bg-raised/80 p-2 cursor-pointer transition-colors hover:border-rust hover:bg-rust/20"
                >
                  <div className="flex flex-col overflow-hidden pr-2">
                    <span className="font-mono text-xs font-bold text-ink truncate group-hover:text-accent-yellow">
                      {bm.title}
                    </span>
                    <span className="font-mono text-[10px] text-ink-dim">
                      ({bm.x}, {bm.y}) · {bm.zoom}x
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleCopyLink(e, bm)}
                    className="rounded border border-chrome-border bg-chrome-bg px-2 py-0.5 font-mono text-[10px] font-bold text-ink-dim transition-colors hover:border-rust hover:text-accent-blue"
                    title={t(locale, "share")}
                  >
                    {copiedId === bm._id ? t(locale, "copied").toUpperCase() : t(locale, "share").toUpperCase()}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
