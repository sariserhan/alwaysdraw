import type { Metadata } from "next";
import { SKETCHBOOK_PAGES } from "@/lib/sketchbookPages";

// The one public origin for canonicals, Open Graph URLs, the sitemap and
// robots.txt. www.alwaysdraw.com 301s here, and the old
// alwaysdraw.alwaysdraw.workers.dev host sits behind Cloudflare Access, so
// neither may ever appear in a canonical. NEXT_PUBLIC_SITE_URL can override
// it (e.g. a staging build), with any trailing slash dropped.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://alwaysdraw.com").replace(/\/+$/, "");

export const SITE_NAME = "AlwaysDraw";

/** Absolute URL on the canonical host for a path such as "/canvas" ("/" is the homepage). */
export function absoluteUrl(path: string): string {
  return path === "/" || path === "" ? SITE_URL : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Every public, indexable path — the sitemap is built from this list. */
export function indexablePaths(): string[] {
  return [
    "/",
    "/canvas",
    "/board",
    "/sketchbook",
    ...Object.keys(SKETCHBOOK_PAGES).map((id) => `/sketchbook/${id}`),
  ];
}

/**
 * Per-page metadata with a self-referencing canonical and a matching
 * og:url. Pages must set these themselves: the root layout deliberately has
 * no canonical, because metadata merges shallowly and a layout-level
 * canonical would mark every page as a duplicate of the homepage.
 */
export function pageMetadata({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: SITE_NAME,
      url,
      title,
      description,
      images: [{ url: "/api/og", width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/api/og"],
    },
  };
}
