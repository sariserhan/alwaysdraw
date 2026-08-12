import { expect, test, type Page } from "@playwright/test";

test.skip(
  process.env.ALWAYSDRAW_E2E_LIVE !== "1",
  "live multiplayer test writes disposable strokes; run with npm run test:e2e:live against a non-production Convex deployment",
);

async function waitForWall(page: Page) {
  await page.goto("/canvas");
  await expect(page.getByText("loading the wall")).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText("live", { exact: true })).toBeVisible({ timeout: 30_000 });
}

async function canvasSample(page: Page, x: number, y: number) {
  return page.locator("canvas").nth(1).evaluate(
    (element, point) => {
      const canvas = element as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2D canvas context unavailable");
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return [...ctx.getImageData(point.x * scaleX, point.y * scaleY, 1, 1).data];
    },
    { x, y },
  );
}

test("a stroke appears in a second browser and survives reload", async ({ browser }) => {
  const firstContext = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const secondContext = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();

  await Promise.all([waitForWall(first), waitForWall(second)]);

  const point = { x: 450, y: 350 };
  const before = await canvasSample(second, point.x, point.y);
  const canvas = first.locator("canvas").nth(1);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("drawing canvas has no bounding box");

  await first.mouse.move(box.x + point.x - 20, box.y + point.y);
  await first.mouse.down();
  await first.mouse.move(box.x + point.x + 20, box.y + point.y, { steps: 8 });
  await first.mouse.up();

  await expect.poll(() => canvasSample(second, point.x, point.y), { timeout: 15_000 })
    .not.toEqual(before);

  const afterSync = await canvasSample(second, point.x, point.y);
  await second.reload();
  await expect(second.getByText("loading the wall")).toBeHidden({ timeout: 30_000 });
  await expect.poll(() => canvasSample(second, point.x, point.y), { timeout: 15_000 })
    .toEqual(afterSync);

  await Promise.all([firstContext.close(), secondContext.close()]);
});
