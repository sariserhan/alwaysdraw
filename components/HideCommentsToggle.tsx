"use client";

import { t, type Locale } from "@/lib/i18n";

export interface HideCommentsToggleProps {
  showComments: boolean;
  onToggle: () => void;
  locale: Locale;
  iconOnly?: boolean;
}

export function HideCommentsToggle({
  showComments,
  onToggle,
  locale,
  iconOnly = false,
}: HideCommentsToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center justify-center rounded-sm border shadow-sm transition-colors ${
        iconOnly
          ? "h-7 w-7 text-sm"
          : "h-[28px] w-full gap-1.5 px-2.5 py-1 font-mono text-xs font-semibold whitespace-nowrap"
      } ${
        showComments
          ? "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
          : "border-rust bg-rust text-on-accent font-bold"
      }`}
      title={showComments ? t(locale, "hide_comments") : t(locale, "show_comments")}
      aria-label={showComments ? t(locale, "hide_comments") : t(locale, "show_comments")}
      aria-pressed={!showComments}
    >
      <span>{showComments ? "💬" : "🚫"}</span>
      {!iconOnly && (
        <span>{(showComments ? t(locale, "hide_comments") : t(locale, "show_comments")).toUpperCase()}</span>
      )}
    </button>
  );
}
