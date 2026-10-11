import { expect, test } from "@playwright/test";

test("loads the wall and primary controls respond", async ({ page }) => {
  const thirdPartyTelemetryRequests: string[] = [];
  page.on("request", (request) => {
    if (/posthog\.com|sentry\.io/.test(request.url())) {
      thirdPartyTelemetryRequests.push(request.url());
    }
  });
  await page.goto("/canvas");

  await expect(page).toHaveTitle(/AlwaysDraw/);
  await expect(page.getByText("AlwaysDraw", { exact: true })).toBeVisible();
  // World layer + stroke layer + heatmap layer + magnifier loupe + minimap canvas.
  await expect(page.locator("canvas")).toHaveCount(5);
  await expect(page.getByText("loading the wall", { exact: false })).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText("the wall couldn't load", { exact: false })).toBeHidden();
  await page.getByRole("button", { name: "collapse section" }).first().click();
  await expect(page.getByRole("button", { name: "expand section" }).first()).toBeVisible();
  await page.getByRole("button", { name: "expand section" }).first().click();

  await expect(page.getByRole("button", { name: "Pan", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(thirdPartyTelemetryRequests).toEqual([]);
});

test("toolbar remains operable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/canvas");

  await expect(page.getByRole("button", { name: "collapse section" }).first()).toBeVisible();
  await page.getByRole("button", { name: "collapse section" }).first().click();
  await expect(page.getByRole("button", { name: "expand section" }).first()).toBeVisible();
  await page.getByRole("button", { name: "expand section" }).first().click();
  await expect(page.getByRole("button", { name: "collapse section" }).first()).toBeVisible();
});
