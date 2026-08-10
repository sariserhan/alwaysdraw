import type { ReactNode } from "react";

/** A panel seam between header control clusters — a riveted rack is bolted
 * together from separate plates, not one flat strip; this reads the same way. */
export function HeaderSeam() {
  return (
    <span
      aria-hidden
      className="h-5 w-px shrink-0 bg-chrome-border"
      style={{ boxShadow: "1px 0 0 rgba(0,0,0,0.35)" }}
    />
  );
}

/** Section label above a cluster of controls in the mobile header drawer. */
export function MobileGroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 font-mono text-[10px] font-bold tracking-wide text-ink-dim uppercase">
      {children}
    </div>
  );
}
