import { describe, it, expect } from "vitest";
import { convertTextToPoints, FONT_STYLES } from "./textToPoints";

describe("lib/textToPoints", () => {
  it("exports font styles with valid metadata", () => {
    expect(FONT_STYLES.length).toBeGreaterThan(0);
    expect(FONT_STYLES[0].id).toBe("sans");
  });

  it("returns empty array for empty or whitespace text", () => {
    expect(convertTextToPoints("", { x: 100, y: 100 })).toEqual([]);
    expect(convertTextToPoints("   ", { x: 100, y: 100 })).toEqual([]);
  });

  it("converts text into points starting at origin", () => {
    const origin = { x: 200, y: 300 };
    const points = convertTextToPoints("HELLO", origin, 32, "sans");

    expect(points.length).toBeGreaterThan(0);
    expect(points[0].x).toBeGreaterThanOrEqual(origin.x - 10);
    expect(points[0].y).toBeGreaterThanOrEqual(origin.y - 10);
  });
});
