import { expect, test } from "@playwright/test";

test("loads the wall and primary controls respond", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("AlwaysDraw");
  await expect(page.getByText("AlwaysDraw", { exact: true })).toBeVisible();
  // World layer + stroke layer + the hidden magnifier loupe canvas.
  await expect(page.locator("canvas")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "switch to light theme" })).toBeVisible();

  await page.getByRole("button", { name: "switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "switch to dark theme" })).toBeVisible();

  await page.getByTitle("Pan").click();
  await expect(page.getByTitle("Pan")).toHaveAttribute("aria-pressed", "true");
});

test("toolbar remains operable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("button", { name: "hide toolbar" })).toBeVisible();
  await page.getByRole("button", { name: "hide toolbar" }).click();
  await expect(page.getByRole("button", { name: "show toolbar" })).toBeVisible();
  await page.getByRole("button", { name: "show toolbar" }).click();
  await expect(page.getByRole("button", { name: "hide toolbar" })).toBeVisible();
});
