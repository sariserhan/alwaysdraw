"use client";

import dynamic from "next/dynamic";

// Skip SSR for the canvas app to prevent hydration mismatches against
// browser state. Lives in its own Client Component so the /canvas and
// /board routes can stay Server Components and export metadata.
const GlobalCanvas = dynamic(
  () => import("@/components/GlobalCanvas").then((m) => m.GlobalCanvas),
  { ssr: false },
);

export function GlobalCanvasClient({ mode }: { mode?: "board" }) {
  return <GlobalCanvas mode={mode} />;
}
