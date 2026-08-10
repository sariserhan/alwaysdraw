import { describe, it, expect } from "vitest";
import { parseCameraFromSearch, cameraToSearchString } from "./viewportUrl";
import { MIN_ZOOM, MAX_ZOOM } from "./camera";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/convex/constants";

describe("parseCameraFromSearch", () => {
  it("returns null when any of x/y/z is missing", () => {
    expect(parseCameraFromSearch("")).toBeNull();
    expect(parseCameraFromSearch("?x=1&y=2")).toBeNull();
    expect(parseCameraFromSearch("?x=1&z=2")).toBeNull();
  });

  it("returns null when a value is non-numeric", () => {
    expect(parseCameraFromSearch("?x=abc&y=2&z=1")).toBeNull();
  });

  it("parses valid x/y/z into a Camera", () => {
    expect(parseCameraFromSearch("?x=100&y=200&z=2")).toEqual({ x: 100, y: 200, zoom: 2 });
  });

  it("clamps x/y to world bounds", () => {
    expect(parseCameraFromSearch(`?x=-50&y=${WORLD_HEIGHT + 50}&z=1`)).toEqual({
      x: 0,
      y: WORLD_HEIGHT,
      zoom: 1,
    });
    expect(parseCameraFromSearch(`?x=${WORLD_WIDTH + 50}&y=-50&z=1`)).toEqual({
      x: WORLD_WIDTH,
      y: 0,
      zoom: 1,
    });
  });

  it("clamps zoom to [MIN_ZOOM, MAX_ZOOM]", () => {
    expect(parseCameraFromSearch("?x=0&y=0&z=0")).toEqual({ x: 0, y: 0, zoom: MIN_ZOOM });
    expect(parseCameraFromSearch("?x=0&y=0&z=999")).toEqual({ x: 0, y: 0, zoom: MAX_ZOOM });
  });
});

describe("cameraToSearchString", () => {
  it("round-trips through parseCameraFromSearch (within rounding)", () => {
    const camera = { x: 4321, y: 1234, zoom: 2.5 };
    const qs = cameraToSearchString(camera);
    expect(parseCameraFromSearch(`?${qs}`)).toEqual(camera);
  });

  it("rounds x/y to whole numbers and zoom to 3 decimals", () => {
    const qs = cameraToSearchString({ x: 100.6, y: 99.4, zoom: 1.23456 });
    const params = new URLSearchParams(qs);
    expect(params.get("x")).toBe("101");
    expect(params.get("y")).toBe("99");
    expect(params.get("z")).toBe("1.235");
  });
});
