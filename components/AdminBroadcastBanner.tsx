"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function AdminBroadcastBanner() {
  const broadcast = useQuery(api.admin.getActiveBroadcast);

  if (!broadcast || !broadcast.active) return null;

  return (
    <div className="pointer-events-auto fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-sm border-2 border-rust bg-chrome-bg/95 px-4 py-2 text-xs font-mono shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md max-w-lg w-[90vw]">
      <span className="flex h-2 w-2 rounded-full bg-accent-crimson animate-ping shrink-0" />
      <div className="flex flex-col overflow-hidden text-left">
        <div className="flex items-center gap-1.5 font-bold text-accent-yellow text-[10px] uppercase tracking-wider">
          <span>📢 OFFICIAL ANNOUNCEMENT</span>
          <span className="text-ink-dim">• {broadcast.author}</span>
        </div>
        <span className="font-semibold text-ink truncate sm:whitespace-normal">
          {broadcast.message}
        </span>
      </div>
    </div>
  );
}
