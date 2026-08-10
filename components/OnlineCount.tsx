import { t, type Locale } from "@/lib/i18n";

export function OnlineCount({ count, locale }: { count: number; locale: Locale }) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-rust/70 px-2.5 py-1 text-xs"
      style={{
        backgroundImage:
          "linear-gradient(180deg, color-mix(in srgb, var(--rust) 22%, var(--chrome-bg-raised)), var(--chrome-bg-raised))",
      }}
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green shadow-[0_0_6px_var(--accent-green)]" />
      <span className="font-mono tabular-nums text-ink">{count}</span>
      <span className="tracking-wide text-ink-dim uppercase">{t(locale, "online")}</span>
    </div>
  );
}
