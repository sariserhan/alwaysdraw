import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "clear stale presence",
  { minutes: 1 },
  internal.presence.clearStale,
  {},
);

crons.interval(
  "recompute online count",
  { seconds: 15 },
  internal.presence.recomputeOnlineCount,
  {},
);

crons.interval(
  "clear stale sketchbook presence",
  { minutes: 1 },
  internal.sketchbookPresence.clearStale,
  {},
);

crons.interval(
  "clear expired write rate limits",
  { minutes: 1 },
  internal.abuse.clearExpiredRateLimits,
  {},
);

crons.interval(
  "prune deleted board strokes",
  { minutes: 10 },
  internal.boardAdmin.pruneDeletedStrokes,
  {},
);

crons.interval(
  "prune deleted wall strokes",
  { minutes: 10 },
  internal.admin.pruneDeletedStrokes,
  {},
);

export default crons;
