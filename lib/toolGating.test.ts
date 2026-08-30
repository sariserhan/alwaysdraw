import { describe, it, expect } from "vitest";
import { isToolAllowedAtZoom, TOOL_ZOOM_GATE_THRESHOLD, ZOOM_GATED_TOOLS } from "./toolGating";

describe("isToolAllowedAtZoom", () => {
  it("blocks a zoom-gated tool below the threshold on a zoomable canvas", () => {
    expect(isToolAllowedAtZoom("brush", TOOL_ZOOM_GATE_THRESHOLD - 0.01, true)).toBe(false);
  });

  it("allows a zoom-gated tool at or above the threshold", () => {
    expect(isToolAllowedAtZoom("brush", TOOL_ZOOM_GATE_THRESHOLD, true)).toBe(true);
    expect(isToolAllowedAtZoom("brush", TOOL_ZOOM_GATE_THRESHOLD + 1, true)).toBe(true);
  });

  it("never gates a navigation/utility tool, regardless of zoom", () => {
    for (const tool of ["pan", "magnifier", "eyedropper", "laser", "comment", "coordFinder"] as const) {
      expect(isToolAllowedAtZoom(tool, 0, true)).toBe(true);
    }
  });

  it("never gates anything on a canvas that doesn't support zoom/pan (Board)", () => {
    expect(isToolAllowedAtZoom("brush", 0, false)).toBe(true);
  });

  it("every zoom-gated tool is actually a mark-making tool, not a navigation one", () => {
    for (const tool of ZOOM_GATED_TOOLS) {
      expect(isToolAllowedAtZoom(tool, 0, true)).toBe(false);
    }
  });
});
