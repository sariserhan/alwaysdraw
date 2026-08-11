// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { MAX_PROTECTED_ZONES, ADMIN_VERIFY_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS } from "./constants";

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

      expect(res.success).toBe(true);

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
});
