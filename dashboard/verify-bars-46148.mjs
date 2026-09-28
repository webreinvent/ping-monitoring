// Verify bar chart on healthy monitor (46148 = 1.1.1.1)
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
  if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
});

console.log("=== Loading /monitors/46148?range=6h ===");
await page.goto("http://localhost:3000/monitors/46148?range=6h", {
  waitUntil: "networkidle",
  timeout: 30000,
});
await page.waitForSelector(".chart-wrapper canvas", { state: "attached", timeout: 15000 });
await page.waitForTimeout(3000);

await page.screenshot({ path: "/tmp/dashboard-46148-6h.png", fullPage: false });

const dashInfo = await page.evaluate(() => {
  const c = document.querySelector(".chart-wrapper canvas");
  if (!c) return { error: "no canvas" };
  const ctx = c.getContext("2d");
  const img = ctx.getImageData(0, 0, c.width, c.height);
  let nonZero = 0, blue = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    if (img.data[i + 3] > 0 && r + g + b > 30) nonZero++;
    if (b > 200 && r < 150 && g < 200) blue++;
  }
  return { canvasW: c.width, canvasH: c.height, nonZero, blue };
});
console.log("6h canvas analysis:", JSON.stringify(dashInfo));
console.log("Errors:", errors);
await browser.close();
