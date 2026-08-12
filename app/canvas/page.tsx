"use client";

import dynamic from "next/dynamic";

// Skip SSR for the canvas app to prevent hydration mismatches against browser state
const GlobalCanvas = dynamic(
  () => import("@/components/GlobalCanvas").then((m) => m.GlobalCanvas),
  { ssr: false },
);

export default function CanvasPage() {
  return <GlobalCanvas />;
}
