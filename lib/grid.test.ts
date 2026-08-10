import { describe, expect, it, vi } from "vitest";
import { snapPointToGrid, drawGridOverlay, type GridConfig } from "./grid";
import type { Camera } from "./camera";

describe("grid lib", () => {
  it("snaps points correctly in square grid mode", () => {
    const config: GridConfig = { mode: "square", cellSize: 50, snapEnabled: true };
    expect(snapPointToGrid({ x: 23, y: 77 }, config)).toEqual({ x: 0, y: 100 });
    expect(snapPointToGrid({ x: 49, y: 51 }, config)).toEqual({ x: 50, y: 50 });
  });

  it("snaps points correctly in isometric grid mode", () => {
    const config: GridConfig = { mode: "isometric", cellSize: 50, snapEnabled: true };
    const pt = snapPointToGrid({ x: 10, y: 10 }, config);
    expect(pt.x).toBeGreaterThanOrEqual(0);
    expect(pt.y).toBeGreaterThanOrEqual(0);

    // Verify snapped point lands on isometric row height spacing (25px)
    expect(pt.y % 25).toBe(0);
  });

  it("does not snap when snapEnabled is false", () => {
    const config: GridConfig = { mode: "isometric", cellSize: 50, snapEnabled: false };
    expect(snapPointToGrid({ x: 23, y: 77 }, config)).toEqual({ x: 23, y: 77 });
  });

  it("draws isometric grid overlay without errors", () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    const camera: Camera = { x: 500, y: 500, zoom: 1 };
    const config: GridConfig = { mode: "isometric", cellSize: 50, snapEnabled: true };

    expect(() => {
      drawGridOverlay(mockCtx, camera, 800, 600, config, 20000, 20000);
    }).not.toThrow();

    expect(mockCtx.stroke).toHaveBeenCalled();
  });
});
