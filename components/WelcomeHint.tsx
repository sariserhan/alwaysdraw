"use client";

import { t, type Locale } from "@/lib/i18n";

export interface WelcomeHintProps {
  visible: boolean;
  onDismiss: () => void;
  locale: Locale;
}

/** First-visit-only orientation, not an onboarding flow — one sentence,
 * non-blocking, dismissible, and gone forever once seen (see
 * lib/identity.ts's getHasSeenWelcomeHint). The "no ceremony" principle
 * this app is built on is about not gating the canvas behind a walkthrough,
 * not about giving a first-timer zero context for what they're looking at. */
export function WelcomeHint({ visible, onDismiss, locale }: WelcomeHintProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      className="pointer-events-auto fixed bottom-24 left-1/2 z-40 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 items-center gap-2.5 rounded-sm border-2 border-rust bg-chrome-bg/95 px-4 py-2.5 font-mono text-xs text-ink shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md animate-fade-in"
    >
      <span className="shrink-0 text-base">👋</span>
      <span className="flex-1">{t(locale, "welcome_hint")}</span>
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
