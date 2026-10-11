import { spawnSync } from "node:child_process";

// Next.js embeds NEXT_PUBLIC_* during the build. Never let the local Convex
// dev deployment in .env.local become the backend of the public website.
const env = {
  ...process.env,
  NEXT_PUBLIC_CONVEX_URL: "https://intent-dove-612.convex.cloud",
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://intent-dove-612.convex.site",
};

for (const command of ["build", process.argv.includes("--upload") ? "upload" : "deploy"]) {
  const result = spawnSync("npx", ["opennextjs-cloudflare", command], { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
