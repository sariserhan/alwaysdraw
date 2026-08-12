import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://alwaysdraw.com";

  const routes = [
    "",
    "/draw-with-friends",
    "/online-whiteboard",
    "/infinite-canvas",
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "always" : "weekly",
    priority: route === "" ? 1.0 : 0.8,
  }));
}
