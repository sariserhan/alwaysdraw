// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

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
