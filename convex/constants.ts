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
// A single continuous drag flushes a new stroke chunk every ~60ms (see
// lib/strokeBuffer.ts's FLUSH_INTERVAL_MS) — up to ~16-17/sec. The old 120
// (12/sec average) meant just drawing one long, fast stroke for a few
// seconds — completely normal use, no abuse involved — could trip the
// limit. This covers a full window of continuous drawing at that real
// worst-case flush rate with headroom to spare.
export const STROKES_PER_CLIENT_WINDOW = 300;
export const STROKES_GLOBAL_WINDOW = 2_000;
// Separate budget from the main canvas's strokes:* buckets, so heavy
// sketchbook use can't starve main-canvas writes or vice versa. Same
// values as STROKES_PER_CLIENT_WINDOW/STROKES_GLOBAL_WINDOW — sketchbook
// drawing uses the same StrokeBuffer flush cadence (~16-17 chunks/sec
// worst case), so the same headroom reasoning applies.
export const SKETCHBOOK_STROKES_PER_CLIENT_WINDOW = 300;
export const SKETCHBOOK_STROKES_GLOBAL_WINDOW = 2_000;
// Every open tab heartbeats forever regardless of activity, and each one is
// a full presence-table write that reactively re-pushes to every other
// connected client's cursor subscription — a cost floor that scales with
// how many tabs are merely open, not how many people are actually doing
// anything. Backing off once idle cuts that floor for the common case
// (someone glancing at the wall, or a background tab) without touching
// online-status accuracy: HEARTBEAT_IDLE_INTERVAL_MS still stays well under
// PRESENCE_ONLINE_WINDOW_MS (30s), so nobody flips to "offline" just because
// their mouse stopped moving.
//
// HEARTBEAT_ACTIVE_INTERVAL_MS also sets how fresh a remote cursor's
// position can ever be — RemoteCursors.tsx glides toward each new position
// over exactly this long, so this is the actual perceived lag. Shared here
// (not just a GlobalCanvas.tsx local) because it and
// HEARTBEATS_PER_CLIENT_WINDOW/HEARTBEATS_GLOBAL_WINDOW below must stay
// mutually consistent — the active interval sets the sustained per-client
// call rate the windows need to allow.
export const HEARTBEAT_ACTIVE_INTERVAL_MS = 150;
export const HEARTBEAT_IDLE_INTERVAL_MS = 15_000;
export const HEARTBEAT_IDLE_THRESHOLD_MS = 10_000;
// 150ms sustained active broadcasting is ~67 calls per RATE_LIMIT_WINDOW_MS
// (10s); 80 leaves headroom for an idle-to-active burst without throttling
// a real user's own cursor.
export const HEARTBEATS_PER_CLIENT_WINDOW = 80;
// Covers roughly 50 concurrently-active (cursor-moving) clients at the
// active interval's sustained rate before the shared bucket throttles
// everyone — well above this app's current real concurrency, with room to
// grow before this needs revisiting.
export const HEARTBEATS_GLOBAL_WINDOW = 4_000;
// Separate budget from the main canvas's presence:* buckets, same
// reasoning as SKETCHBOOK_STROKES_*.
export const SKETCHBOOK_HEARTBEATS_PER_CLIENT_WINDOW = 6;
export const SKETCHBOOK_HEARTBEATS_GLOBAL_WINDOW = 2_000;
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
// Only snapshots.getLatest ever reads this table — older rows exist purely
// for a manual rollback safety margin, not because anything queries them.
// Shared with admin.ts's getTelemetry, which uses it to bound a cheap
// row-count read instead of pulling every (up to MAX_SNAPSHOT_IMAGE_BYTES)
// row's full image payload just to count them.
export const SNAPSHOTS_TO_KEEP = 3;
// Bounds each snapshots.submit's pruning pass — never reads/deletes more
// than this many old rows in one call. A backlog larger than this
// converges over several submits instead. See snapshots.ts's PRUNE_BATCH_SIZE
// usage for why an unbounded pass is unsafe (each row up to
// MAX_SNAPSHOT_IMAGE_BYTES, against Convex's 16MB per-transaction read cap).
export const SNAPSHOTS_PRUNE_BATCH_SIZE = 5;
// Admin passcode attempts have no reliable per-attacker identity to key on
// (clientId is self-reported), so this is a tight global-only cap — it
// won't stop a determined attacker, but it makes casual brute-forcing slow.
export const ADMIN_VERIFY_GLOBAL_WINDOW = 20;
// A second, much stricter budget consumed only on an INVALID passcode (see
// admin.ts's verifyAdminPasscode) — legitimate admin usage never fails this
// check, so it only ever throttles someone actually guessing, independent of
// how much a real admin is otherwise clicking around. 5/min instead of
// 20/10s cuts the maximum guess rate from ~172,800/day to ~7,200/day.
export const ADMIN_FAILED_VERIFY_WINDOW = 5;
export const ADMIN_FAILED_VERIFY_WINDOW_MS = 60_000;
// These two are admin-gated (need the passcode), so exploitation requires a
// compromised secret — still worth a cap so a compromised passcode doesn't
// also get an unbounded blast radius the way every other user-facing text
// field in this app already avoids.
export const MAX_BROADCAST_MESSAGE_LENGTH = 500;
export const MAX_ZONE_NAME_LENGTH = 100;

export const MAX_REPORT_REASON_LENGTH = 280;
export const REPORTS_PER_CLIENT_WINDOW = 5;
export const REPORTS_GLOBAL_WINDOW = 50;

// strokes.submit does an unindexed collect() over every zone on every single
// stroke chunk (there's no spatial index to check "does this point fall in
// any zone" against) — correct requires checking ALL of them, so the only
// safe way to bound that cost is capping how many can ever exist, checked
// once at creation (rare, admin-only) rather than truncating the hot-path
// read (which would silently stop enforcing protection past the cap).
export const MAX_PROTECTED_ZONES = 200;

export const PRESENCE_ONLINE_WINDOW_MS = 30_000;
export const PRESENCE_STALE_MS = 2 * 60_000;
// A laser trail effect only ever needs a short recent tail of points.
export const MAX_LASER_TRAIL_POINTS = 50;

// presence.listByTiles reads each requested tile via its own indexed lookup
// (not one broad range read filtered afterward) so a subscriber's reactive
// dependency is genuinely just the tiles they asked for — a cursor update in
// some other tile never recomputes/re-pushes to them. That only pays off
// when the tile count is small (someone actually zoomed into a
// neighborhood); past this cap the client shows nothing rather than either
// falling back to a global read or firing hundreds of per-tile lookups —
// see GlobalCanvas.tsx's subscribedTileKeys effect. This is the server-side
// mirror of that same cap, independent of whatever the client sends.
export const MAX_TILES_PER_PRESENCE_QUERY = 150;
// A single 500-unit tile realistically never has more than a handful of
// concurrent cursors — this just bounds the pathological case.
export const MAX_PRESENCE_PER_TILE = 50;

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
