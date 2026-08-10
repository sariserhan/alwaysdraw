import { chromium } from "@playwright/test";

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

  const response = await page.goto(target, { waitUntil: "networkidle", timeout: 30_000 });
  if (!response?.ok()) throw new Error(`HTTP ${response?.status() ?? "no response"}`);

  await page.getByText("AlwaysDraw", { exact: true }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: /switch to (light|dark) theme/ }).waitFor();
  await page.getByTitle("Pan").click();
  const panPressed = await page.getByTitle("Pan").getAttribute("aria-pressed");
  if (panPressed !== "true") throw new Error("Pan tool did not become active");
  if (errors.length > 0) throw new Error(`Browser errors: ${errors.join(" | ")}`);

  console.log(JSON.stringify({ ok: true, url: page.url(), title: await page.title() }));
} finally {
  await browser.close();
}
