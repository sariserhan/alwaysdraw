// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import {
  MAX_PROTECTED_ZONES,
  ADMIN_VERIFY_GLOBAL_WINDOW,
  ADMIN_FAILED_VERIFY_WINDOW,
  RATE_LIMIT_WINDOW_MS,
  SNAPSHOTS_TO_KEEP,
} from "./constants";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

// There's no hardcoded fallback passcode anymore (an unconfigured deployment
// must have no working admin passcode) — tests set the env var explicitly,
// same as a real deployment would.
const PASSCODE = "test-admin-passcode";

describe("convex/admin — protected zones & moderation", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET_KEY", PASSCODE);
    t = convexTest(schema, modules);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("passcode verification", () => {
    it("returns true for correct passcode and false for invalid passcode", async () => {
      const valid = await t.mutation(api.admin.verifyPasscode, { passcode: PASSCODE });
      expect(valid).toBe(true);

      const invalid = await t.mutation(api.admin.verifyPasscode, { passcode: "wrong-passcode" });
      expect(invalid).toBe(false);
    });

    it("throttles repeated wrong guesses through verifyAdminPasscode (used by every moderation mutation) via a stricter budget than the general one", async () => {
      // Every admin mutation gated by verifyAdminPasscode reports rejection
      // through its return value (`{ success: false, error }`), not a thrown
      // exception — see verifyAdminPasscode's doc comment in admin.ts. A
      // Convex mutation's writes are ALL discarded if it ultimately throws,
      // no matter how deep the write happened (confirmed against
      // convex/src/server/database.ts / registration.ts and empirically via
      // convex-test), so "consume the failed-guess bucket, then throw" could
      // never make that consumption durable — the throw meant to reject the
      // request always undid the very write meant to remember it happened.
      // Returning a value instead lets the mutation commit normally while
      // still reporting failure to the caller.

      // ADMIN_FAILED_VERIFY_WINDOW (5) is well under ADMIN_VERIFY_GLOBAL_WINDOW
      // (20), so this exhausts the failed-guess-only bucket first — proving
      // it throttles wrong guesses independently, not just riding on the
      // general per-call limit every admin action (right or wrong) shares.
      for (let i = 0; i < ADMIN_FAILED_VERIFY_WINDOW; i++) {
        const res = await t.mutation(api.admin.wipeArea, {
          passcode: "wrong-guess",
          minX: 0,
          minY: 0,
          maxX: 1,
          maxY: 1,
        });
        expect(res.success).toBe(false);
        expect(!res.success && res.error).toMatch(/INVALID_ADMIN_PASSCODE/);
      }

      const limited = await t.mutation(api.admin.wipeArea, {
        passcode: "wrong-guess",
        minX: 0,
        minY: 0,
        maxX: 1,
        maxY: 1,
      });
      expect(limited.success).toBe(false);
      expect(!limited.success && limited.error).toMatch(/rate.?limit/i);

      // The correct passcode is completely unaffected — a real admin who
      // already has it never fails this check, so it never touches the
      // failed-guess budget at all.
      const ok = await t.mutation(api.admin.wipeArea, {
        passcode: PASSCODE,
        minX: 0,
        minY: 0,
        maxX: 1,
        maxY: 1,
      });
      expect(ok.success).toBe(true);
    });

    it("never rate-limits a real admin's own bulk operations, no matter how many calls they need", async () => {
      // wipeArea re-verifies the passcode on every paginated batch — a
      // large-enough area clear can need far more calls than
      // ADMIN_VERIFY_GLOBAL_WINDOW allows in one window. With the correct
      // passcode, none of that should matter: verifyAdminPasscode checks
      // validity before touching either rate limit, so a real admin is
      // never throttled by their own bulk work.
      const callCount = ADMIN_VERIFY_GLOBAL_WINDOW * 3;
      for (let i = 0; i < callCount; i++) {
        const res = await t.mutation(api.admin.wipeArea, {
          passcode: PASSCODE,
          minX: 0,
          minY: 0,
          maxX: 1,
          maxY: 1,
        });
        expect(res.success).toBe(true);
      }
    });
  });

  describe("protected zones (mural shield)", () => {
    it("creates, retrieves, and deletes protected zones", async () => {
      const res = await t.mutation(api.admin.createProtectedZone, {
        passcode: PASSCODE,
        name: "Center Square",
        minX: 100,
        minY: 100,
        maxX: 300,
        maxY: 300,
      });

      if (!res.success) throw new Error(res.error);

      const zones = await t.query(api.admin.getProtectedZones, {});
      expect(zones).toHaveLength(1);
      expect(zones[0].name).toBe("Center Square");
      expect(zones[0].minX).toBe(100);
      expect(zones[0].maxX).toBe(300);

      const delRes = await t.mutation(api.admin.deleteProtectedZone, {
        passcode: PASSCODE,
        zoneId: res.zoneId,
      });
      expect(delRes.success).toBe(true);

      const remainingZones = await t.query(api.admin.getProtectedZones, {});
      expect(remainingZones).toHaveLength(0);
    });

    it("rejects stroke submission inside protected zone for regular user, permits for admin", async () => {
      await t.mutation(api.admin.createProtectedZone, {
        passcode: PASSCODE,
        name: "Mural Zone",
        minX: 500,
        minY: 500,
        maxX: 600,
        maxY: 600,
      });

      // Regular user trying to draw inside protected zone
      await expect(
        t.mutation(api.strokes.submit, {
          clientStrokeId: "user-stroke-blocked",
          clientId: "regular-user-123",
          mode: "draw",
          brushType: "brush",
          color: "#000000",
          width: 5,
          points: [{ x: 550, y: 550 }],
          clientTimestamp: Date.now(),
        }),
      ).rejects.toThrow(/PROTECTED_ZONE/);

      // Regular user drawing outside protected zone
      await expect(
        t.mutation(api.strokes.submit, {
          clientStrokeId: "user-stroke-ok",
          clientId: "regular-user-123",
          mode: "draw",
          brushType: "brush",
          color: "#000000",
          width: 5,
          points: [{ x: 100, y: 100 }],
          clientTimestamp: Date.now(),
        }),
      ).resolves.toBeDefined();

      // Spoofing an "ADMIN_"-prefixed clientId must NOT bypass protection —
      // clientId is client-supplied and unauthenticated, so only a real,
      // server-verified passcode should ever grant the bypass.
      await expect(
        t.mutation(api.strokes.submit, {
          clientStrokeId: "spoofed-admin-stroke-blocked",
          clientId: "ADMIN_super_user",
          mode: "draw",
          brushType: "brush",
          color: "#ff0000",
          width: 10,
          points: [{ x: 550, y: 550 }],
          clientTimestamp: Date.now(),
        }),
      ).rejects.toThrow(/PROTECTED_ZONE/);

      // A real admin (verified passcode) can draw inside the protected zone.
      await expect(
        t.mutation(api.strokes.submit, {
          clientStrokeId: "admin-stroke-ok",
          clientId: "ADMIN_IMAGE_STAMPER",
          mode: "draw",
          brushType: "brush",
          color: "#ff0000",
          width: 10,
          points: [{ x: 550, y: 550 }],
          clientTimestamp: Date.now(),
          adminPasscode: PASSCODE,
        }),
      ).resolves.toBeDefined();
    });

    it("exempts a zone's assigned owner from that zone's draw block, but not other clients", async () => {
      await t.mutation(api.admin.createProtectedZone, {
        passcode: PASSCODE,
        name: "Owned Mural",
        minX: 700,
        minY: 700,
        maxX: 800,
        maxY: 800,
        ownerClientId: "artist-owner-1",
      });

      // The assigned owner can draw inside their own zone with no passcode.
      await expect(
        t.mutation(api.strokes.submit, {
          clientStrokeId: "owner-stroke-ok",
          clientId: "artist-owner-1",
          mode: "draw",
          color: "#000000",
          width: 5,
          points: [{ x: 750, y: 750 }],
          clientTimestamp: Date.now(),
        }),
      ).resolves.toBeDefined();

      // A different client is still blocked.
      await expect(
        t.mutation(api.strokes.submit, {
          clientStrokeId: "non-owner-stroke-blocked",
          clientId: "someone-else",
          mode: "draw",
          color: "#000000",
          width: 5,
          points: [{ x: 750, y: 750 }],
          clientTimestamp: Date.now(),
        }),
      ).rejects.toThrow(/PROTECTED_ZONE/);
    });

    it("hides ownerClientId from non-admin callers but returns it for a verified admin", async () => {
      await t.mutation(api.admin.createProtectedZone, {
        passcode: PASSCODE,
        name: "Owned Mural",
        minX: 700,
        minY: 700,
        maxX: 800,
        maxY: 800,
        ownerClientId: "artist-owner-1",
        ownerName: "PixelArtist",
      });

      const anonymousView = await t.query(api.admin.getProtectedZones, {});
      expect(anonymousView).toHaveLength(1);
      expect(anonymousView[0].ownerClientId).toBeUndefined();
      expect(anonymousView[0].ownerName).toBe("PixelArtist");

      const invalidPasscodeView = await t.query(api.admin.getProtectedZones, { passcode: "wrong" });
      expect(invalidPasscodeView[0].ownerClientId).toBeUndefined();

      const adminView = await t.query(api.admin.getProtectedZones, { passcode: PASSCODE });
      expect(adminView[0].ownerClientId).toBe("artist-owner-1");
    });

    it("caps the number of protected zones at MAX_PROTECTED_ZONES", async () => {
      // Each creation also spends the admin:verify:global rate-limit
      // bucket (ADMIN_VERIFY_GLOBAL_WINDOW=20 per RATE_LIMIT_WINDOW_MS) —
      // advance fake time past that window between calls so this test
      // exercises the zone cap, not the passcode-verify rate limit.
      vi.useFakeTimers();
      try {
        for (let i = 0; i < MAX_PROTECTED_ZONES; i++) {
          await t.mutation(api.admin.createProtectedZone, {
            passcode: PASSCODE,
            name: `Zone ${i}`,
            minX: i,
            minY: i,
            maxX: i + 1,
            maxY: i + 1,
          });
          vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1000);
        }

        await expect(
          t.mutation(api.admin.createProtectedZone, {
            passcode: PASSCODE,
            name: "One Too Many",
            minX: 9000,
            minY: 9000,
            maxX: 9001,
            maxY: 9001,
          }),
        ).rejects.toThrow(/MAX_PROTECTED_ZONES|cannot create more/i);
      } finally {
        vi.useRealTimers();
      }
    });

    it("charges wrong admin-passcode guesses via strokes.submit against the same shared rate-limit bucket verifyPasscode uses", async () => {
      // Exhaust the shared admin:verify:global bucket entirely through the
      // dedicated endpoint...
      for (let i = 0; i < ADMIN_VERIFY_GLOBAL_WINDOW; i++) {
        await t.mutation(api.admin.verifyPasscode, { passcode: "wrong-guess" });
      }

      // ...then a passcode attempt through strokes.submit — a completely
      // different mutation — must be rejected by that same exhausted
      // bucket, proving the two paths aren't independently guessable.
      await expect(
        t.mutation(api.strokes.submit, {
          clientStrokeId: "rate-limited-admin-guess",
          clientId: "attacker",
          mode: "draw",
          color: "#000000",
          width: 5,
          points: [{ x: 1, y: 1 }],
          clientTimestamp: Date.now(),
          adminPasscode: "another-wrong-guess",
        }),
      ).rejects.toThrow(/rate limit/i);
    });
  });

  describe("moderation actions", () => {
    it("wipes strokes inside a specified area", async () => {
      await t.mutation(api.strokes.submit, {
        clientStrokeId: "stroke-in-box",
        clientId: "client-a",
        mode: "draw",
        color: "#000000",
        width: 4,
        points: [{ x: 50, y: 50 }],
        clientTimestamp: Date.now(),
      });

      await t.mutation(api.strokes.submit, {
        clientStrokeId: "stroke-outside-box",
        clientId: "client-b",
        mode: "draw",
        color: "#000000",
        width: 4,
        points: [{ x: 500, y: 500 }],
        clientTimestamp: Date.now(),
      });

      const wipeRes = await t.mutation(api.admin.wipeArea, {
        passcode: PASSCODE,
        minX: 0,
        minY: 0,
        maxX: 100,
        maxY: 100,
      });

      if (!wipeRes.success) throw new Error(wipeRes.error);
      expect(wipeRes.deletedCount).toBe(1);
    });

    it("rolls back all strokes for a targeted client ID", async () => {
      await t.mutation(api.strokes.submit, {
        clientStrokeId: "bad-user-stroke-1",
        clientId: "vandal-999",
        mode: "draw",
        color: "#000000",
        width: 4,
        points: [{ x: 10, y: 10 }],
        clientTimestamp: Date.now(),
      });

      await t.mutation(api.strokes.submit, {
        clientStrokeId: "bad-user-stroke-2",
        clientId: "vandal-999",
        mode: "draw",
        color: "#000000",
        width: 4,
        points: [{ x: 20, y: 20 }],
        clientTimestamp: Date.now(),
      });

      const rbRes = await t.mutation(api.admin.rollbackClient, {
        passcode: PASSCODE,
        targetClientId: "vandal-999",
      });

      if (!rbRes.success) throw new Error(rbRes.error);
      expect(rbRes.deletedCount).toBe(2);
    });

    it("publishes and clears broadcast messages", async () => {
      await t.mutation(api.admin.publishBroadcast, {
        passcode: PASSCODE,
        message: "Maintenance scheduled in 10 minutes",
      });

      const activeBroadcast = await t.query(api.admin.getActiveBroadcast, {});
      expect(activeBroadcast).not.toBeNull();
      expect(activeBroadcast?.message).toBe("Maintenance scheduled in 10 minutes");

      await t.mutation(api.admin.clearBroadcast, {
        passcode: PASSCODE,
      });

      const cleared = await t.query(api.admin.getActiveBroadcast, {});
      expect(cleared).toBeNull();
    });
  });

  describe("getTelemetry", () => {
    it("returns null for an invalid passcode", async () => {
      const result = await t.query(api.admin.getTelemetry, { passcode: "wrong" });
      expect(result).toBeNull();
    });

    it("reports a bounded snapshotCount even with more snapshots than SNAPSHOTS_TO_KEEP", async () => {
      // Regression test: snapshotCount used to read up to 1000 full
      // snapshot rows (each up to MAX_SNAPSHOT_IMAGE_BYTES) just to count
      // them. Bounded to SNAPSHOTS_TO_KEEP + 1 now, matching what
      // snapshots.submit's own pruning keeps the table at in steady state.
      vi.useFakeTimers();
      try {
        for (let i = 0; i < SNAPSHOTS_TO_KEEP + 3; i++) {
          await t.mutation(api.strokes.submit, {
            clientStrokeId: `telemetry-seq-${i}`,
            clientId: "telemetry-tester",
            mode: "draw",
            color: "#000000",
            width: 4,
            points: [{ x: i, y: i }],
            clientTimestamp: Date.now(),
          });
          const meta = await t.run(async (ctx) => ctx.db.query("canvasMetadata").first());
          await t.mutation(api.snapshots.submit, {
            sequence: meta?.currentSequence ?? 0,
            imageData: `data:image/webp;base64,sample${i}`,
            strokeCount: i,
          });
          vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1000);
        }
      } finally {
        vi.useRealTimers();
      }

      const result = await t.query(api.admin.getTelemetry, { passcode: PASSCODE });
      expect(result?.snapshotCount).toBe(SNAPSHOTS_TO_KEEP);
    });
  });

  describe("auto-prune (opt-in hard-delete of old soft-deleted strokes)", () => {
    // `id` must be unique per call (used as both clientStrokeId and
    // clientId) — submit() is idempotent on clientStrokeId, so a repeated
    // id would silently return the already-existing row instead of
    // inserting a new one, breaking any loop that seeds more than one row.
    async function seedOldDeletedStroke(id: string, ageMs: number) {
      const submitted = await t.mutation(api.strokes.submit, {
        clientStrokeId: id,
        clientId: id,
        mode: "draw",
        color: "#000000",
        width: 4,
        points: [{ x: 1, y: 1 }],
        clientTimestamp: 0,
      });
      await t.run(async (ctx: MutationCtx) => {
        const row = await ctx.db
          .query("strokes")
          .withIndex("by_sequence", (q) => q.eq("sequence", submitted.sequence))
          .unique();
        if (!row) throw new Error("seed row not found");
        // deletedAt (when it was deleted), not serverTimestamp (when it was
        // originally drawn) — pruning eligibility is based on the former.
        await ctx.db.patch(row._id, { deleted: true, deletedAt: Date.now() - ageMs });
      });
    }

    it("getAutoPruneEnabled defaults to false", async () => {
      expect(await t.query(api.admin.getAutoPruneEnabled, {})).toBe(false);
    });

    it("does nothing when autoPruneEnabled is off (the default)", async () => {
      await seedOldDeletedStroke("old-one", 30 * 24 * 60 * 60 * 1000); // 30 days old
      await t.mutation(internal.admin.pruneDeletedStrokes, {});
      const rows = await t.run((ctx) => ctx.db.query("strokes").collect());
      expect(rows).toHaveLength(1);
    });

    it("setAutoPruneEnabled requires a valid passcode", async () => {
      const wrong = await t.mutation(api.admin.setAutoPruneEnabled, { passcode: "wrong", enabled: true });
      expect(wrong.success).toBe(false);
      expect(await t.query(api.admin.getAutoPruneEnabled, {})).toBe(false);
    });

    it("once enabled, hard-deletes old soft-deleted rows but leaves recent or non-deleted ones", async () => {
      await t.mutation(api.admin.setAutoPruneEnabled, { passcode: PASSCODE, enabled: true });
      expect(await t.query(api.admin.getAutoPruneEnabled, {})).toBe(true);

      await seedOldDeletedStroke("old-one", 30 * 24 * 60 * 60 * 1000); // old + deleted -> pruned
      const recent = await t.mutation(api.strokes.submit, {
        clientStrokeId: "recent-deleted",
        clientId: "recent-deleted",
        mode: "draw",
        color: "#000000",
        width: 4,
        points: [{ x: 1, y: 1 }],
        clientTimestamp: 0,
      });
      await t.run(async (ctx: MutationCtx) => {
        const row = await ctx.db
          .query("strokes")
          .withIndex("by_sequence", (q) => q.eq("sequence", recent.sequence))
          .unique();
        if (!row) throw new Error("seed row not found");
        await ctx.db.patch(row._id, { deleted: true, deletedAt: Date.now() }); // deleted just now -> not pruned yet
      });
      await t.mutation(api.strokes.submit, {
        clientStrokeId: "still-live",
        clientId: "still-live",
        mode: "draw",
        color: "#000000",
        width: 4,
        points: [{ x: 1, y: 1 }],
        clientTimestamp: 0,
      }); // never deleted -> never pruned

      await t.mutation(internal.admin.pruneDeletedStrokes, {});

      const rows = await t.run((ctx) => ctx.db.query("strokes").collect());
      expect(rows).toHaveLength(2);
      expect(rows.some((r) => r.clientStrokeId === "old-one")).toBe(false);
      expect(rows.some((r) => r.clientStrokeId === "recent-deleted")).toBe(true);
      expect(rows.some((r) => r.clientStrokeId === "still-live")).toBe(true);
    });

    it("converges a prune backlog larger than PRUNE_BATCH_SIZE in one call by seeding rows directly (no real-time loop)", async () => {
      // Seeding via 500+ real submit() calls (as boardAdmin.test.ts's
      // equivalent backlog test does) is real, but this file's rate-limit
      // test just proved that even far short of the vitest default 5s
      // timeout, a real per-call loop is variable enough to be worth
      // avoiding when a direct seed proves the same thing deterministically
      // and faster: insert rows straight into the table, already old and
      // deleted, then confirm one prune call converges the whole backlog
      // (batch size dominates the count, not multiple calls).
      const backlogSize = 30; // several times PRUNE_BATCH_SIZE would just repeat this same assertion slower
      await t.mutation(api.admin.setAutoPruneEnabled, { passcode: PASSCODE, enabled: true });
      await t.run(async (ctx: MutationCtx) => {
        for (let i = 0; i < backlogSize; i++) {
          await ctx.db.insert("strokes", {
            clientStrokeId: `backlog-${i}`,
            clientId: `backlog-${i}`,
            mode: "draw",
            color: "#000000",
            width: 4,
            points: [{ x: 1, y: 1 }],
            clientTimestamp: 0,
            sequence: i + 1,
            serverTimestamp: Date.now(),
            deleted: true,
            deletedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          });
        }
      });

      await t.mutation(internal.admin.pruneDeletedStrokes, {});

      const rows = await t.run((ctx) => ctx.db.query("strokes").collect());
      expect(rows).toHaveLength(0);
    });
  });
});
