"use client";

import { t, type Locale } from "@/lib/i18n";

export function HideCommentsToggle({
  showComments,
  onToggle,
  locale,
}: {
  showComments: boolean;
  onToggle: () => void;
  locale: Locale;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold shadow-sm transition-colors ${
        showComments
          ? "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
          : "border-rust bg-rust text-on-accent font-bold"
      }`}
      title={showComments ? t(locale, "hide_comments") : t(locale, "show_comments")}
      aria-label={showComments ? t(locale, "hide_comments") : t(locale, "show_comments")}
      aria-pressed={!showComments}
    >
      <span>{showComments ? "💬" : "🚫"}</span>
      <span>{(showComments ? t(locale, "hide_comments") : t(locale, "show_comments")).toUpperCase()}</span>
    </button>
  );
}
