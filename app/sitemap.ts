import type { MetadataRoute } from "next";
import { absoluteUrl, indexablePaths } from "@/lib/site";

// No <lastmod>: the previous version stamped every URL with the request
// time, which is never true and teaches Google to ignore the field. No
// changefreq/priority either — Google ignores both.
export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePaths().map((path) => ({ url: absoluteUrl(path) }));
}
