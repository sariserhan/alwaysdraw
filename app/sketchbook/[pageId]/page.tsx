"use client";

import dynamic from "next/dynamic";
import { notFound, useParams } from "next/navigation";
import { getSketchbookPage } from "@/lib/sketchbookPages";

// Skip SSR, same reason as app/canvas/page.tsx: avoid hydrating against
// browser-only state (canvas/localStorage-backed identity).
const SketchbookCanvas = dynamic(
  () => import("@/components/SketchbookCanvas").then((m) => m.SketchbookCanvas),
  { ssr: false },
);

export default function SketchbookPageRoute() {
  const params = useParams<{ pageId: string }>();
  const pageId = params.pageId;

  if (!getSketchbookPage(pageId)) {
    notFound();
  }

  // key={pageId} forces React to unmount/remount SketchbookCanvas on every
  // client-side navigation between pages. Without it, App Router reuses the
  // same component instance across route param changes, and the canvas's
  // in-memory state (afterSequence, allStrokesRef, renderedIdsRef, the
  // bitmap) would carry over from the previous page — silently skipping the
  // new page's own strokes and/or replaying the old page's strokes onto it.
  return <SketchbookCanvas key={pageId} pageId={pageId} />;
}
