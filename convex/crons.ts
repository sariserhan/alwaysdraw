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
  "clear expired write rate limits",
  { minutes: 1 },
  internal.abuse.clearExpiredRateLimits,
  {},
);

export default crons;
