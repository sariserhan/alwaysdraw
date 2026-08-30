import { expect, test, type Page } from "@playwright/test";

test.skip(
  process.env.ALWAYSDRAW_E2E_LIVE !== "1",
  "live Board test writes disposable strokes; run with ALWAYSDRAW_E2E_LIVE=1 npx playwright test e2e/board.spec.ts against a non-production Convex deployment",
);

async function waitForBoard(page: Page) {
  await page.goto("/board");
  await expect(page.getByText("loading", { exact: false })).toBeHidden({ timeout: 30_000 });
}

async function canvasBoundingBox(page: Page) {
  const box = await page.locator("canvas").nth(1).boundingBox();
  if (!box) throw new Error("board canvas has no bounding box");
  return box;
}

/** The RGBA of one *screen* point on the strokes canvas. The canvas element
 * is `absolute inset-0 h-full w-full`, so its DOM rect is always the
 * viewport and says nothing about the camera — what's painted *at* a given
 * screen point is the only thing camera state is observable through. */
async function samplePixel(page: Page, point: { x: number; y: number }) {
  return page.locator("canvas").nth(1).evaluate((el, p) => {
    const canvas = el as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return [...ctx.getImageData(p.x * scaleX, p.y * scaleY, 1, 1).data];
  }, point);
}

async function drawThrough(page: Page, box: { x: number; y: number }, point: { x: number; y: number }) {
  await page.mouse.move(box.x + point.x - 40, box.y + point.y);
  await page.mouse.down();
  await page.mouse.move(box.x + point.x + 40, box.y + point.y, { steps: 8 });
  await page.mouse.up();
}

test("zoom and pan input have zero effect on Board's camera", async ({ page }) => {
  await waitForBoard(page);
  const box = await canvasBoundingBox(page);
  const point = { x: box.width / 2, y: box.height / 2 };

  const blank = await samplePixel(page, point);
  await drawThrough(page, box, point);

  // Establishes that there IS content at this screen point before the
  // camera input — without it, "unchanged" could just mean two identical
  // blanks, which is how the previous version of this test passed whether
  // or not the camera lock worked.
  await expect.poll(() => samplePixel(page, point), { timeout: 15_000 }).not.toEqual(blank);
  const before = await samplePixel(page, point);

  // Every camera-moving input Board exposes: wheel zoom, trackpad pinch
  // (ctrl+wheel in Chromium), the +/- shortcuts, and the reset-view
  // shortcut. If any of them moved the camera, this screen point would show
  // a different part of the board — or the blank letterbox.
  await page.mouse.move(box.x + point.x, box.y + point.y);
  await page.mouse.wheel(0, -200);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -200);
  await page.keyboard.up("Control");
  await page.keyboard.press("Equal"); // "+"
  await page.keyboard.press("Minus"); // "-"
  await page.keyboard.press("0"); // reset view

  // Redraws are rAF-driven, so a camera change would already be painted;
  // this asserts the absence of one, hence a settle wait rather than a poll.
  await page.waitForTimeout(300);
  expect(await samplePixel(page, point)).toEqual(before);
});

test("a stroke lands at the same screen position after a reload (no drift from camera state)", async ({ page }) => {
  await waitForBoard(page);
  const box = await canvasBoundingBox(page);
  const point = { x: box.width / 2, y: box.height / 2 };

  await drawThrough(page, box, point);

  const beforeReload = await samplePixel(page, point);
  await page.reload();
  await expect(page.getByText("loading", { exact: false })).toBeHidden({ timeout: 30_000 });
  await expect.poll(() => samplePixel(page, point), { timeout: 15_000 }).toEqual(beforeReload);
});
