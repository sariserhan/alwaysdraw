import type { Metadata } from "next";
import { getSketchbookPage } from "@/lib/sketchbookPages";

// Server Component wrapper so a per-page <title>/description can be set —
// the page.tsx sibling is a Client Component ("use client") and can't
// export metadata itself. notFound() for an invalid pageId stays in
// page.tsx; this layout only falls back to a generic title/description.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ pageId: string }>;
}): Promise<Metadata> {
  const { pageId } = await params;
  const page = getSketchbookPage(pageId);

  if (!page) {
    return {
      title: "Sketchbook — alwaysdraw",
      description: "Pick a page and color it together with everyone online, live.",
    };
  }

  return {
    title: `${page.title} — Sketchbook — alwaysdraw`,
    description: `Color the ${page.title} page together with everyone online, live.`,
  };
}

export default function SketchbookPageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
