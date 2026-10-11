import { chromium, expect } from "@playwright/test";

const target = process.env.ALWAYSDRAW_SMOKE_URL;
if (!target) {
  console.error("Set ALWAYSDRAW_SMOKE_URL to the deployed AlwaysDraw URL.");
  process.exit(1);
}

const errors = [];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const backendSockets = [];
  page.on("websocket", (socket) => backendSockets.push(socket.url()));
  const wallUrl = new URL("/canvas", target).toString();
  const response = await page.goto(wallUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (!response?.ok()) throw new Error(`HTTP ${response?.status() ?? "no response"}`);

  async function expectLoadedWall() {
    await expect(page).toHaveTitle(/Live World Canvas/);
    await expect(page.locator("canvas")).toHaveCount(5);
    await expect(page.getByText("loading the wall", { exact: false })).toBeHidden({ timeout: 60_000 });
    await expect(page.getByText("the wall couldn't load", { exact: false })).toBeHidden();
    if (new URL(target).hostname === "alwaysdraw.com" &&
      backendSockets.some((url) => /127\.0\.0\.1|localhost/.test(url))) {
      throw new Error("Production canvas attempted to connect to a local backend");
    }
  }
  await expectLoadedWall();
  await page.getByRole("button", { name: "collapse section" }).first().click();
  await expect(page.getByRole("button", { name: "expand section" }).first()).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectLoadedWall();

  const sketchbookUrl = new URL("/sketchbook", target).toString();
  const sketchbookResponse = await page.goto(sketchbookUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (!sketchbookResponse?.ok()) throw new Error(`/sketchbook: HTTP ${sketchbookResponse?.status() ?? "no response"}`);
  await page.getByText("Sketchbook", { exact: true }).first().waitFor({ state: "visible" });

  if (errors.length > 0) throw new Error(`Browser errors: ${errors.join(" | ")}`);

  console.log(JSON.stringify({ ok: true, url: page.url(), title: await page.title() }));
} finally {
  await browser.close();
}
