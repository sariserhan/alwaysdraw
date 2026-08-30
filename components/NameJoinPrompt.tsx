"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { MAX_USERNAME_LENGTH } from "@/convex/constants";

export interface NameJoinPromptProps {
  visible: boolean;
  onSave: (name: string) => void;
  onDismiss: () => void;
  locale: Locale;
  /** Top offset in px, measured from the live header bar (see
   * MiniMap.tsx's useHeaderBottomOffset) — sits just below the header
   * rather than near the bottom, out of the way of the zoom-gate banner
   * attached to the drawing toolbar. */
  top: number;
}

/** Optional, dismissible nudge shown each session while the visitor is still
 * anonymous — the header's UsernameControl already lets anyone set a name,
 * but it's easy to never notice, so most visitors never learn it exists.
 * Purely optional: drawing works identically either way, same "no ceremony"
 * principle as WelcomeHint.tsx. */
export function NameJoinPrompt({ visible, onSave, onDismiss, locale, top }: NameJoinPromptProps) {
  const [draft, setDraft] = useState("");

  if (!visible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSave(draft);
  };

  return (
    <div
      role="status"
      style={{ top }}
      className="pointer-events-auto fixed left-1/2 z-40 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 items-center gap-2.5 rounded-sm border-2 border-rust bg-chrome-bg/95 px-4 py-2.5 font-mono text-xs text-ink shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md animate-fade-in"
    >
      <span className="shrink-0 text-base">👤</span>
      <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t(locale, "join_name_prompt")}
          maxLength={MAX_USERNAME_LENGTH}
          autoFocus
          className="min-w-0 flex-1 rounded-sm border border-chrome-border bg-chrome-bg-raised px-2 py-1 font-mono text-xs text-ink placeholder:text-ink-dim/70 focus:border-rust focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-sm border border-rust bg-rust/30 px-3 py-1 font-mono text-xs font-bold text-ink transition-colors hover:bg-rust hover:text-white"
        >
          {t(locale, "save").toUpperCase()}
        </button>
      </form>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t(locale, "close")}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg-raised font-bold text-ink-dim transition-colors hover:border-rust hover:text-accent-crimson"
      >
        ✕
      </button>
    </div>
  );
}
