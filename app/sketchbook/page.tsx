import Link from "next/link";
import type { Metadata } from "next";
import { SKETCHBOOK_PAGES, regionPathData, type SketchbookPage } from "@/lib/sketchbookPages";

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
          <Link
            key={page.id}
            href={`/sketchbook/${page.id}`}
            className="flex flex-col items-center gap-2 rounded-lg bg-white/60 p-4 transition hover:bg-white"
          >
            {page.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.imageUrl} alt="" className="h-32 w-32 object-contain" />
            ) : (
              <svg viewBox={`0 0 ${page.width} ${page.height}`} className="h-32 w-32">
                {page.regions.map((region) => (
                  <path
                    key={region.id}
                    d={regionPathData(region)}
                    fill="none"
                    stroke="#1a1a1a"
                    strokeWidth={3}
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            )}
            <span className="text-sm font-medium text-[#1a1a1a]">{page.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
