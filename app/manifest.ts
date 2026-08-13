import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AlwaysDraw — The World's Shared Canvas",
    short_name: "AlwaysDraw",
    description:
      "One world. One canvas. Always drawing. A single public drawing wall shared by everyone on the internet in real time.",
    start_url: "/",
    display: "standalone",
    background_color: "#121315",
    theme_color: "#121315",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
