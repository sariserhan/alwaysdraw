import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://alwaysdraw.com";

  const routes = [
    "",
    "/canvas",
    "/draw-with-friends",
    "/online-whiteboard",
    "/infinite-canvas",
    "/sketchbook",
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/canvas" || route === "/sketchbook" ? "always" : "weekly",
    priority: route === "" || route === "/canvas" || route === "/sketchbook" ? 1.0 : 0.8,
  }));
}
