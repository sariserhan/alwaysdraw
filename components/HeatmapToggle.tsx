"use client";

import { t, type Locale } from "@/lib/i18n";

export interface HeatmapToggleProps {
  showHeatmap: boolean;
  onToggle: () => void;
  locale?: Locale;
  iconOnly?: boolean;
}

export function HeatmapToggle({ showHeatmap, onToggle, locale, iconOnly = false }: HeatmapToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex h-[28px] w-full items-center justify-center gap-1 min-w-0 rounded-sm border py-0.5 font-mono text-xs font-semibold shadow-sm transition-colors ${
        showHeatmap
          ? "border-rust bg-rust text-on-accent font-bold"
          : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
      }`}
      title={showHeatmap ? "Hide activity heatmap" : "Show activity heatmap"}
      aria-label="Activity Heatmap"
      aria-pressed={showHeatmap}
    >
      <span className="text-sm">🔥</span>
      {!iconOnly && <span className="truncate">{t(locale ?? "en", "heatmap").toUpperCase()}</span>}
    </button>
  );
}
