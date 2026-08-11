"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChromeRivet } from "./ChromeRivet";
import { t, type Locale } from "@/lib/i18n";
import { MAX_USERNAME_LENGTH } from "@/convex/constants";

export interface UsernameControlProps {
  username: string | undefined;
  onUsernameChange: (name: string) => void;
  locale: Locale;
  iconOnly?: boolean;
}

export function UsernameControl({ username, onUsernameChange, locale, iconOnly = false }: UsernameControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState(username ?? "");
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUsernameChange(draft);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      if (window.innerWidth >= 1360) {
        const top = Math.max(48, rect.bottom + 6);
        const right = Math.max(12, window.innerWidth - rect.right);
        setCoords({ top, right });
      } else {
        setCoords({ top: 80, right: Math.max(12, window.innerWidth - rect.right) });
      }
      setDraft(username ?? "");
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`flex items-center justify-center rounded-sm border shadow-sm transition-colors ${
          iconOnly
            ? "h-7 w-7 text-sm"
            : "h-[28px] max-w-[160px] gap-1.5 px-2.5 py-1 font-mono text-xs font-semibold whitespace-nowrap"
        } ${
          isOpen
            ? "border-rust bg-rust text-on-accent font-bold"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title={t(locale, "display_name")}
        aria-label={t(locale, "display_name")}
        aria-expanded={isOpen}
      >
        <span>👤</span>
        {!iconOnly && <span className="truncate max-w-[120px]">{username ?? t(locale, "anonymous").toUpperCase()}</span>}
      </button>

      {isOpen && mounted && coords && createPortal(
        <div
          ref={popoverRef}
          role="menu"
          aria-label={t(locale, "display_name")}
          className="fixed z-[1000] flex flex-col gap-2 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.95)] backdrop-blur-md w-[260px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-4rem)] overflow-y-auto"
          style={{ top: `${coords.top}px`, right: `${coords.right}px` }}
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
        </div>,
        document.body,
      )}
    </>
  );
}
