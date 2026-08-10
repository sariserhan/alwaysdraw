import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://alwaysdraw.alwaysdraw.workers.dev";

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "always",
      priority: 1.0,
    },
  ];
}
