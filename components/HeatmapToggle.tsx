"use client";

import { t, type Locale } from "@/lib/i18n";

export interface HeatmapToggleProps {
  showHeatmap: boolean;
  onToggle: () => void;
  locale: Locale;
}

export function HeatmapToggle({ showHeatmap, onToggle, locale }: HeatmapToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex h-[28px] w-full items-center justify-center gap-1 min-w-0 truncate rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-semibold shadow-sm transition-colors ${
        showHeatmap
          ? "border-rust bg-rust text-on-accent font-bold"
          : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
      }`}
      title={showHeatmap ? "Hide activity heatmap" : "Show activity heatmap"}
      aria-label="Activity Heatmap"
      aria-pressed={showHeatmap}
    >
      <span>🔥</span>
      <span className="truncate">{t(locale, "heatmap").toUpperCase()}</span>
    </button>
  );
}
