import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteSummary } from "@/components/RouteSummary";
import { SKETCHBOOK_PAGES, getSketchbookPage, type SketchbookPage } from "@/lib/sketchbookPages";
import { pageMetadata } from "@/lib/site";

// Server Component wrapper so each page gets its own <title>, description
// and canonical — the page.tsx sibling is a Client Component ("use client")
// and can't export metadata itself.

function describe(title: string) {
  return `Color the ${title} page together with everyone online, live.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pageId: string }>;
}): Promise<Metadata> {
  const { pageId } = await params;
  const page = getSketchbookPage(pageId);
  if (!page) notFound();

  return pageMetadata({
    path: `/sketchbook/${page.id}`,
    title: `${page.title} — Sketchbook`,
    description: describe(page.title),
  });
}

export default async function SketchbookPageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = getSketchbookPage(pageId);
  if (!page) notFound();

  return (
    <>
      <RouteSummary
        heading={`${page.title} — Sketchbook`}
        summary={describe(page.title)}
        extraLinks={Object.values(SKETCHBOOK_PAGES)
          .filter((p): p is SketchbookPage => p !== undefined && p.id !== page.id)
          .map((p) => ({ href: `/sketchbook/${p.id}`, label: p.title }))}
      />
      {children}
    </>
  );
}
