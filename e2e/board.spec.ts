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

test("zoom and pan input have zero effect on Board's camera", async ({ page }) => {
  await waitForBoard(page);
  const before = await canvasBoundingBox(page);

  // Wheel-zoom attempt (ctrl+wheel simulates a trackpad pinch in Chromium).
  await page.mouse.wheel(0, -200);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -200);
  await page.keyboard.up("Control");

  // Keyboard zoom shortcut attempt.
  await page.keyboard.press("Equal"); // "+"
  await page.keyboard.press("Minus"); // "-"

  const after = await canvasBoundingBox(page);
  expect(after).toEqual(before);
});

test("a stroke lands at the same screen position after a reload (no drift from camera state)", async ({ page }) => {
  await waitForBoard(page);
  const box = await canvasBoundingBox(page);
  const point = { x: box.width / 2, y: box.height / 2 };

  await page.mouse.move(box.x + point.x - 20, box.y + point.y);
  await page.mouse.down();
  await page.mouse.move(box.x + point.x + 20, box.y + point.y, { steps: 8 });
  await page.mouse.up();

  const sample = async () =>
    page.locator("canvas").nth(1).evaluate((el, p) => {
      const canvas = el as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2D canvas context unavailable");
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return [...ctx.getImageData(p.x * scaleX, p.y * scaleY, 1, 1).data];
    }, point);

  const beforeReload = await sample();
  await page.reload();
  await expect(page.getByText("loading", { exact: false })).toBeHidden({ timeout: 30_000 });
  await expect.poll(sample, { timeout: 15_000 }).toEqual(beforeReload);
});
