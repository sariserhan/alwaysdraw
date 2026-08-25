import type { MetadataRoute } from "next";
import { SKETCHBOOK_PAGES } from "@/lib/sketchbookPages";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://alwaysdraw.com";

  const routes = [
    "",
    "/canvas",
    "/sketchbook",
    ...Object.keys(SKETCHBOOK_PAGES).map((id) => `/sketchbook/${id}`),
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/canvas" || route.startsWith("/sketchbook") ? "always" : "weekly",
    priority: route === "" || route === "/canvas" || route.startsWith("/sketchbook") ? 1.0 : 0.8,
  }));
}
