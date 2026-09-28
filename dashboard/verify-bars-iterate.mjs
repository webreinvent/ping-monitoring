// Iterate through all monitors and find one with varied latency in 24h range.
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

// Try monitors 24-30 (older ones) with 24h range
const monitorIds = [30, 25, 26, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14];

for (const id of monitorIds) {
  console.log(`\n=== /monitors/${id} ===`);
  await page.goto(`http://localhost:3000/monitors/${id}`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForSelector(".chart-wrapper canvas", { state: "attached", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Click 24h
  const btn24h = await page.locator('button:has-text("24h")').first();
  if (await btn24h.count() > 0) {
    await btn24h.click().catch(() => {});
    await page.waitForTimeout(2500);
  }

  const info = await page.evaluate(() => {
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
    const header = document.querySelector("h3, h2, .target-name")?.textContent ?? "";
    return { header, nonZero, green, yellow, orange, red };
  });
  console.log(`  ${info.header}: nonZero=${info.nonZero} g=${info.green} y=${info.yellow} o=${info.orange} r=${info.red}`);

  if (info.yellow > 100 || info.orange > 100 || info.red > 100) {
    await page.screenshot({ path: `/tmp/dashboard-monitor-${id}.png`, fullPage: true });
    console.log(`  *** Found varied data — screenshot saved ***`);
    break;
  }
}

if (errors.length > 0) {
  console.log("\nErrors:");
  for (const e of errors) console.log(" -", e);
}

await browser.close();
process.exit(0);
