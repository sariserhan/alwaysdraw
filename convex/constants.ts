// Shared world-bounds and abuse-boundary constants used by schema.ts and functions.
// Named constants (not magic numbers) so the logical canvas size can change later.
export const WORLD_WIDTH = 10_000;
export const WORLD_HEIGHT = 10_000;

export const MIN_BRUSH_WIDTH = 1;
export const MAX_BRUSH_WIDTH = 100;

export const MIN_OPACITY = 0.05;
export const MAX_OPACITY = 1;

export const MIN_POINTS_PER_STROKE = 1;
export const MAX_POINTS_PER_STROKE = 100;

export const MAX_CLIENT_ID_LENGTH = 64;
export const MAX_CLIENT_STROKE_ID_LENGTH = 128;
export const MAX_COLOR_LENGTH = 64;

// Anonymous clients are intentionally allowed, but writes still need a
// server-enforced cost boundary. Limits are generous enough for normal fast
// drawing while making a single spoofed client or a global flood finite.
export const RATE_LIMIT_WINDOW_MS = 10_000;
export const STROKES_PER_CLIENT_WINDOW = 120;
export const STROKES_GLOBAL_WINDOW = 2_000;
export const HEARTBEATS_PER_CLIENT_WINDOW = 6;
export const HEARTBEATS_GLOBAL_WINDOW = 2_000;

export const PRESENCE_ONLINE_WINDOW_MS = 30_000;
export const PRESENCE_STALE_MS = 2 * 60_000;

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
] as const;
