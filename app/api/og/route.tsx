export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const rawTitle = searchParams.get("title") || "The World's Shared Real-Time Canvas";
  const x = searchParams.get("x") || "0";
  const y = searchParams.get("y") || "0";
  const mode = searchParams.get("mode") || "Live Canvas";

  // Safe XML escaping to avoid breaking SVG markup
  const title = rawTitle
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="0%" r="80%">
      <stop offset="0%" stop-color="#d94626" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#121315" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d94626"/>
      <stop offset="100%" stop-color="#b83218"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#121315"/>
  <rect width="1200" height="630" fill="url(#bgGlow)"/>
  
  <!-- Outer Rust Frame -->
  <rect x="8" y="8" width="1184" height="614" fill="none" stroke="#d94626" stroke-width="8" rx="8"/>
  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="#34383e" stroke-width="2" rx="4"/>

  <!-- Top Bar -->
  <g transform="translate(64, 64)">
    <!-- AD Logo Badge -->
    <rect width="52" height="52" rx="8" fill="url(#brandGrad)"/>
    <text x="26" y="34" font-family="monospace, sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">AD</text>
    
    <!-- AlwaysDraw Brand -->
    <text x="72" y="36" font-family="monospace, sans-serif" font-size="34" font-weight="bold" fill="#f5f1e6">AlwaysDraw<tspan fill="#d94626">.com</tspan></text>
    
    <!-- Mode Badge -->
    <g transform="translate(900, 4)">
      <rect width="170" height="40" rx="20" fill="#1b1d21" stroke="#34383e" stroke-width="2"/>
      <circle cx="24" cy="20" r="6" fill="#10b981"/>
      <text x="96" y="25" font-family="monospace, sans-serif" font-size="16" font-weight="bold" fill="#ffcc00" text-anchor="middle">${mode.toUpperCase()}</text>
    </g>
  </g>

  <!-- Main Headline & Subtitle -->
  <g transform="translate(600, 270)" text-anchor="middle">
    <text y="0" font-family="sans-serif" font-size="48" font-weight="900" fill="#ffffff">${title}</text>
    <text y="64" font-family="sans-serif" font-size="24" fill="#a0a5ad">One world. One canvas. Always drawing.</text>
    <text y="100" font-family="sans-serif" font-size="20" fill="#717782">Sketch, doodle, and paint in real time with 13 artistic brush textures.</text>
  </g>

  <!-- Bottom Info Footer Bar -->
  <line x1="64" y1="520" x2="1136" y2="520" stroke="#26292e" stroke-width="2"/>
  <g transform="translate(64, 565)" font-family="monospace, sans-serif" font-size="18" fill="#a0a5ad">
    <text x="0" y="0">📍 Viewport Coordinates: X=${x}, Y=${y}</text>
    <text x="1072" y="0" text-anchor="end" font-weight="bold" fill="#d94626">alwaysdraw.com/canvas</text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
