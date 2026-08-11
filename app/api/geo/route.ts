const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
// Cloudflare/some proxies use these as "no country resolved" sentinels.
const UNKNOWN_COUNTRY_CODES = new Set(["XX", "T1"]);

function normalizeCountryCode(raw: string | null): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!COUNTRY_CODE_PATTERN.test(code) || UNKNOWN_COUNTRY_CODES.has(code)) return null;
  return code;
}

/**
 * Resolves the visitor's country from their IP, without ever returning or
 * storing the IP itself. Tries CDN-provided geo headers first (Cloudflare's
 * cf-ipcountry, Vercel's x-vercel-ip-country) — free, zero external calls,
 * whichever the actual deployment target sets. Falls back to a server-to-
 * server lookup against a public geo-IP API for local dev / other hosts,
 * where the IP never reaches the browser or a third party directly.
 */
export async function GET(request: Request) {
  const fromHeader = normalizeCountryCode(
    request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country"),
  );
  if (fromHeader) {
    return Response.json({ countryCode: fromHeader });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip");
  if (!ip) {
    return Response.json({ countryCode: null });
  }

  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return Response.json({ countryCode: null });
    const code = normalizeCountryCode(await res.text());
    return Response.json({ countryCode: code });
  } catch {
    return Response.json({ countryCode: null });
  }
}
