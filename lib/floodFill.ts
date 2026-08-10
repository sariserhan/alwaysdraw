export interface FloodFillOptions {
  /** Per-channel (R/G/B/A) tolerance for "same color as the seed pixel". */
  tolerance?: number;
  /** Only every `step`th visited pixel (in both axes) is returned, so a
   * large filled region doesn't turn into hundreds of thousands of stroke
   * points — the traversal itself still visits every pixel for correctness
   * (a 1px-wide boundary must still stop the fill). */
  step?: number;
  /** Hard cap on pixels visited, so a click on a huge unbounded area (e.g.
   * bare background) can't run away. */
  maxPixels?: number;
}

const DEFAULT_TOLERANCE = 32;
const DEFAULT_STEP = 4;
const DEFAULT_MAX_PIXELS = 250_000;

/**
 * Real seed-fill (stack-based flood fill, 4-connected) over a rendered
 * canvas's pixel data, starting at (startX, startY) in that canvas's own
 * pixel coordinate space. Matches pixels within `tolerance` of the seed
 * color and stops at anything else — i.e. it respects whatever's actually
 * drawn as a boundary, unlike a fixed-radius pattern. Returns filled cell
 * centers on a `step`-pixel grid in the SAME pixel space as `imageData`
 * (caller converts to world coordinates).
 */
export function floodFillMask(
  imageData: ImageData,
  startX: number,
  startY: number,
  { tolerance = DEFAULT_TOLERANCE, step = DEFAULT_STEP, maxPixels = DEFAULT_MAX_PIXELS }: FloodFillOptions = {},
): { x: number; y: number }[] {
  const { width, height, data } = imageData;
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return [];

  const seedIdx = (sy * width + sx) * 4;
  const seedR = data[seedIdx];
  const seedG = data[seedIdx + 1];
  const seedB = data[seedIdx + 2];
  const seedA = data[seedIdx + 3];

  const matches = (idx: number) =>
    Math.abs(data[idx] - seedR) <= tolerance &&
    Math.abs(data[idx + 1] - seedG) <= tolerance &&
    Math.abs(data[idx + 2] - seedB) <= tolerance &&
    Math.abs(data[idx + 3] - seedA) <= tolerance;

  const visited = new Uint8Array(width * height);
  const startPos = sy * width + sx;
  visited[startPos] = 1;
  const stack: number[] = [startPos];

  const filled: { x: number; y: number }[] = [];
  let visitedCount = 0;

  while (stack.length > 0 && visitedCount < maxPixels) {
    const pos = stack.pop()!;
    const x = pos % width;
    const y = (pos - x) / width;
    visitedCount++;

    if (x % step === 0 && y % step === 0) {
      filled.push({ x, y });
    }

    if (x > 0) tryVisit(pos - 1);
    if (x < width - 1) tryVisit(pos + 1);
    if (y > 0) tryVisit(pos - width);
    if (y < height - 1) tryVisit(pos + width);
  }

  function tryVisit(pos: number) {
    if (visited[pos]) return;
    visited[pos] = 1;
    if (!matches(pos * 4)) return;
    stack.push(pos);
  }

  return filled;
}
