"use client";

import { useEffect, useRef, useState } from "react";
import { ChromeRivet } from "./ChromeRivet";
import { t, type Locale } from "@/lib/i18n";
import { MAX_USERNAME_LENGTH } from "@/convex/constants";

export interface UsernameControlProps {
  username: string | undefined;
  onUsernameChange: (name: string) => void;
  locale: Locale;
}

export function UsernameControl({ username, onUsernameChange, locale }: UsernameControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(username ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUsernameChange(draft);
    setIsOpen(false);
  };

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) setDraft(username ?? "");
      return next;
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold shadow-sm transition-colors ${
          isOpen
            ? "border-rust bg-rust text-on-accent font-bold"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title={t(locale, "display_name")}
        aria-label={t(locale, "display_name")}
        aria-expanded={isOpen}
      >
        <span>👤</span>
        <span>{username ?? t(locale, "anonymous").toUpperCase()}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t(locale, "display_name")}
          className="fixed right-3 sm:right-4 min-[1360px]:right-[228px] top-20 z-[1000] flex flex-col gap-2 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.9)] backdrop-blur-md w-[260px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-6rem)] overflow-y-auto"
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />

          <div className="border-b border-chrome-border/60 pb-1.5">
            <h3 className="font-mono text-xs font-bold uppercase text-accent-yellow">
              {t(locale, "display_name")}
            </h3>
            <p className="font-mono text-[10px] text-ink-dim">{t(locale, "display_name_subtitle")}</p>
          </div>

          <form onSubmit={handleSave} className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t(locale, "anonymous")}
              maxLength={MAX_USERNAME_LENGTH}
              autoFocus
              className="flex-1 rounded-sm border border-chrome-border bg-chrome-bg-raised px-2 py-1 font-mono text-xs text-ink placeholder:text-ink-dim/50 focus:border-rust focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-sm border border-rust bg-rust/30 px-3 py-1 font-mono text-xs font-bold text-ink transition-colors hover:bg-rust hover:text-white"
            >
              {t(locale, "save").toUpperCase()}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
