// Shared world-bounds and abuse-boundary constants used by schema.ts and functions.
// Named constants (not magic numbers) so the logical canvas size can change later.
// Scaled to 50,000 once, then back down: at 25x the area with no more real
// content than before, the wall read as empty, and the viewport could no
// longer show the whole thing at once (see lib/camera.ts MIN_ZOOM). Revisit
// growing this again once real traffic is actually pressing on 10,000's edges,
// not ahead of it — the spec's own V3 target (10k -> 50k) still applies, it's
// just gated on demand rather than on the tiling infra alone being ready.
export const WORLD_WIDTH = 20_000;
export const WORLD_HEIGHT = 20_000;

export const MIN_BRUSH_WIDTH = 1;
export const MAX_BRUSH_WIDTH = 100;

export const MIN_OPACITY = 0.05;
export const MAX_OPACITY = 1;

export const MIN_POINTS_PER_STROKE = 1;
export const MAX_POINTS_PER_STROKE = 100;

export const MAX_CLIENT_ID_LENGTH = 64;
export const MAX_CLIENT_STROKE_ID_LENGTH = 128;
export const MAX_COLOR_LENGTH = 64;
export const MAX_USERNAME_LENGTH = 24;
// ISO 3166-1 alpha-2, resolved server-side from the visitor's IP — never the
// raw IP itself. See app/api/geo/route.ts.
export const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

// Anonymous clients are intentionally allowed, but writes still need a
// server-enforced cost boundary. Limits are generous enough for normal fast
// drawing while making a single spoofed client or a global flood finite.
export const RATE_LIMIT_WINDOW_MS = 10_000;
export const STROKES_PER_CLIENT_WINDOW = 120;
export const STROKES_GLOBAL_WINDOW = 2_000;
export const HEARTBEATS_PER_CLIENT_WINDOW = 6;
export const HEARTBEATS_GLOBAL_WINDOW = 2_000;
// Bookmark rows are permanent (unlike presence/snapshots), so both a
// per-client and a global cap bound table growth from a spoofed clientId.
export const BOOKMARKS_PER_CLIENT_WINDOW = 10;
export const BOOKMARKS_GLOBAL_WINDOW = 100;
export const MAX_COMMENT_LENGTH = 280;
export const COMMENTS_PER_CLIENT_WINDOW = 10;
export const COMMENTS_GLOBAL_WINDOW = 200;
// Toggle (vote/un-vote), so this bounds spam-clicking rather than real usage.
export const VOTES_PER_CLIENT_WINDOW = 30;
// Snapshots carry no per-client identity (they're a server-side optimization,
// not a user action), so this is a global-only limit — legitimate submissions
// are infrequent, so this is generous headroom, not a real throughput cap.
export const SNAPSHOTS_GLOBAL_WINDOW = 5;
export const MAX_SNAPSHOT_IMAGE_BYTES = 5 * 1024 * 1024;

export const PRESENCE_ONLINE_WINDOW_MS = 30_000;
export const PRESENCE_STALE_MS = 2 * 60_000;
// A laser trail effect only ever needs a short recent tail of points.
export const MAX_LASER_TRAIL_POINTS = 50;

export const DEFAULT_LIST_LIMIT = 500;
export const MAX_LIST_LIMIT = 1000;
export const MAX_PRESENCE_LIST = 50;

// #rgb or #rrggbb, or rgb()/rgba() with numeric components.
export const COLOR_PATTERN =
  /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/;

// Draw-mode brush styles. "erase" strokes (mode: "erase") don't carry a
// brushType — Clear/Eraser isn't a texture, it's the destination-out op.
export const BRUSH_TYPES = [
  "brush",
  "pencil",
  "marker",
  "highlighter",
  "calligraphy",
  "pixel",
  "watercolor",
  "oilPaint",
  "chalk",
  "charcoal",
  "glitter",
  "neonGlow",
  "halftone",
] as const;
