import Link from "next/link";
import type { Metadata } from "next";
import { SKETCHBOOK_PAGES, type SketchbookPage } from "@/lib/sketchbookPages";
import { SketchbookThumbnail } from "@/components/SketchbookThumbnail";

export const metadata: Metadata = {
  title: "Sketchbook — alwaysdraw",
  description: "Pick a page and color it together with everyone online, live.",
};

export default function SketchbookGalleryPage() {
  const pages = Object.values(SKETCHBOOK_PAGES).filter((p): p is SketchbookPage => p !== undefined);

  return (
    <div className="min-h-dvh bg-[#f0ebd9] px-6 py-12">
      <Link
        href="/"
        className="fixed top-4 left-4 z-10 rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-[#1a1a1a] shadow-lg"
      >
        ← Home
      </Link>
      <h1 className="mb-8 text-center text-3xl font-semibold text-[#1a1a1a]">Sketchbook</h1>
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-3">
        {pages.map((page) => (
          <SketchbookThumbnail key={page.id} page={page} />
        ))}
      </div>
    </div>
  );
}
