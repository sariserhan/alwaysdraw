import type { ReactNode } from "react";

/** Section label above a cluster of controls in the header drawer/sidebar. */
export function MobileGroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 font-mono text-[10px] font-bold tracking-wide text-ink-dim uppercase">
      {children}
    </div>
  );
}
