import { expect, test } from "@playwright/test";

test("gallery lists pages and links into one", async ({ page }) => {
  await page.goto("/sketchbook");

  await expect(page).toHaveTitle(/Sketchbook/);
  await expect(page.getByRole("heading", { name: "Sketchbook" })).toBeVisible();
  await expect(page.getByRole("link", { name: "← Home" })).toBeVisible();

  const firstPageLink = page.locator('a[href^="/sketchbook/"]').first();
  await expect(firstPageLink).toBeVisible();
  await firstPageLink.click();
  await expect(page).toHaveURL(/\/sketchbook\/[a-z0-9-]+$/);
});

test("a sketchbook page loads its toolbar, breadcrumb, and canvas", async ({ page }) => {
  await page.goto("/sketchbook/geisha");

  await expect(page).toHaveTitle(/Geisha/);
  await expect(page.getByRole("link", { name: /Home/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sketchbook" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();

  // Bottom toolbar: color/brush controls.
  await expect(page.getByRole("button", { name: "Eraser" })).toBeVisible();
  await expect(page.getByLabel("brush width")).toBeVisible();
  await expect(page.getByLabel("custom color")).toBeAttached();

  // Right-side vertical control bar: pan/recenter/zoom.
  await expect(page.getByTitle("Drag to move around the page")).toBeVisible();
  await expect(page.getByLabel("recenter on the page")).toBeVisible();
  await expect(page.getByLabel("zoom in")).toBeVisible();
  await expect(page.getByLabel("zoom out")).toBeVisible();
});

test("drawing a stroke paints on the canvas", async ({ page }) => {
  await page.goto("/sketchbook/geisha");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas has no bounding box");

  // Compare pixel data before/after a stroke drawn well inside the page's
  // world bounds (not the empty margin, which silently no-ops — see
  // SketchbookCanvas.tsx's pointer-down region check).
  const before = await canvas.screenshot();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y + 20, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await canvas.screenshot();

  expect(Buffer.compare(before, after)).not.toBe(0);
});

test("recenter button brings a panned-away page back into view", async ({ page }) => {
  await page.goto("/sketchbook/geisha");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  await page.getByTitle("Drag to move around the page").click();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas has no bounding box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Pan far enough that the artwork (centered, a narrow vertical strip)
  // moves entirely out from under the viewport's center point.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 2000, cy + 2000, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  // Panned that far, the pixel directly under the viewport center is now
  // empty page background — no canvas rendering is exact-byte-stable
  // across two separate draws (anti-aliasing can vary slightly), so check
  // color at a specific point rather than a whole-image diff.
  const pannedColor = await page.evaluate(
    ([px, py]) => {
      const c = document.querySelector("canvas")!;
      const ctx = c.getContext("2d")!;
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const data = ctx.getImageData((px - rect.left) * dpr, (py - rect.top) * dpr, 1, 1).data;
      return [data[0], data[1], data[2], data[3]];
    },
    [cx, cy] as const,
  );
  // Page background is #f0ebd9 — fully-transparent-canvas-over-that-div
  // reads as alpha 0 on the canvas's own backing store at an empty point.
  expect(pannedColor[3]).toBe(0);

  await page.getByLabel("recenter on the page").click();
  await page.waitForTimeout(300);

  const recenteredColor = await page.evaluate(
    ([px, py]) => {
      const c = document.querySelector("canvas")!;
      const ctx = c.getContext("2d")!;
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const data = ctx.getImageData((px - rect.left) * dpr, (py - rect.top) * dpr, 1, 1).data;
      return [data[0], data[1], data[2], data[3]];
    },
    [cx, cy] as const,
  );
  // Recentered, the viewport's center point is back over the (painted-on)
  // artwork — no longer the empty, fully-transparent backing store.
  expect(recenteredColor[3]).toBeGreaterThan(0);
});
