import { describe, it, expect } from "vitest";
import { BrushCursor } from "./BrushCursor";

describe("BrushCursor component", () => {
  it("exports a valid forwardRef component", () => {
    expect(BrushCursor).toBeDefined();
    expect(typeof BrushCursor).toBe("object");
  });
});
