// Verify by clicking through time ranges to find a monitor with varied latency.
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Users/pk/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell",
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (msg) => {
  const t = msg.type();
  if (t === "error") errors.push(`console.error: ${msg.text()}`);
});

console.log("=== Loading /monitors/31 ===");
await page.goto("http://localhost:3000/monitors/31", {
  waitUntil: "networkidle",
  timeout: 30000,
});
await page.waitForSelector(".chart-wrapper canvas", { state: "attached", timeout: 15000 });
await page.waitForTimeout(1500);

// Click the 5m preset
const btn5m = await page.locator('button:has-text("5m")').first();
await btn5m.click();
await page.waitForTimeout(2500);

await page.screenshot({ path: "/tmp/dashboard-5m.png", fullPage: true });

const dashInfo = await page.evaluate(() => {
  const c = document.querySelector(".chart-wrapper canvas");
  if (!c) return { error: "no canvas" };
  const ctx = c.getContext("2d");
  const img = ctx.getImageData(0, 0, c.width, c.height);
  let nonZero = 0, green = 0, yellow = 0, orange = 0, red = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    if (img.data[i + 3] > 0 && r + g + b > 30) nonZero++;
    if (g > 200 && r < 100 && b < 150) green++;
    if (r > 200 && g > 200 && b < 50) yellow++;
    if (r > 200 && g > 100 && g < 200 && b < 100) orange++;
    if (r > 200 && g < 150 && b < 150) red++;
  }
  return {
    canvasW: c.width, canvasH: c.height,
    nonZero, green, yellow, orange, red,
  };
});
console.log("5m canvas analysis:", JSON.stringify(dashInfo, null, 2));

// Click 1h preset
const btn1h = await page.locator('button:has-text("1h")').first();
await btn1h.click();
await page.waitForTimeout(2500);

await page.screenshot({ path: "/tmp/dashboard-1h.png", fullPage: true });

const dash1h = await page.evaluate(() => {
  const c = document.querySelector(".chart-wrapper canvas");
  if (!c) return { error: "no canvas" };
  const ctx = c.getContext("2d");
  const img = ctx.getImageData(0, 0, c.width, c.height);
  let nonZero = 0, green = 0, yellow = 0, orange = 0, red = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    if (img.data[i + 3] > 0 && r + g + b > 30) nonZero++;
    if (g > 200 && r < 100 && b < 150) green++;
    if (r > 200 && g > 200 && b < 50) yellow++;
    if (r > 200 && g > 100 && g < 200 && b < 100) orange++;
    if (r > 200 && g < 150 && b < 150) red++;
  }
  return { nonZero, green, yellow, orange, red };
});
console.log("1h canvas analysis:", JSON.stringify(dash1h, null, 2));

if (errors.length > 0) {
  console.log("Errors:");
  for (const e of errors) console.log(" -", e);
}

await browser.close();
process.exit(0);
