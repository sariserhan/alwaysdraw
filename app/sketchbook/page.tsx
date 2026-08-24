"use client";

import dynamic from "next/dynamic";

// Skip SSR, same reason as app/canvas/page.tsx: avoid hydrating against
// browser-only state (canvas/localStorage-backed identity).
const SketchbookCanvas = dynamic(
  () => import("@/components/SketchbookCanvas").then((m) => m.SketchbookCanvas),
  { ssr: false },
);

export default function SketchbookPage() {
  return <SketchbookCanvas />;
}
