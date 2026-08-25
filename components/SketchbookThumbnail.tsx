import Link from "next/link";
import { regionPathData, type SketchbookPage } from "@/lib/sketchbookPages";

export function SketchbookThumbnail({ page, className = "h-32 w-32" }: { page: SketchbookPage; className?: string }) {
  return (
    <Link
      href={`/sketchbook/${page.id}`}
      className="flex flex-col items-center gap-2 rounded-lg bg-white/60 p-4 transition hover:bg-white"
    >
      {page.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.imageUrl} alt="" className={`${className} object-contain`} />
      ) : (
        <svg viewBox={`0 0 ${page.width} ${page.height}`} className={className}>
          {page.regions.map((region) => (
            <path key={region.id} d={regionPathData(region)} fill="none" stroke="#1a1a1a" strokeWidth={3} strokeLinejoin="round" />
          ))}
        </svg>
      )}
      <span className="text-sm font-medium text-[#1a1a1a]">{page.title}</span>
    </Link>
  );
}
