// Take a clear screenshot of monitor 19 with 24h data (Globex server, lots of bars).
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

console.log("=== /monitors/19 (24h) ===");
await page.goto("http://localhost:3000/monitors/19", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForSelector(".chart-wrapper canvas", { state: "attached", timeout: 15000 });
await page.waitForTimeout(1500);

await page.locator('button:has-text("24h")').first().click();
await page.waitForTimeout(3000);

await page.screenshot({ path: "/tmp/dashboard-monitor-19-24h.png", fullPage: true });
console.log("Saved /tmp/dashboard-monitor-19-24h.png");

if (errors.length > 0) {
  console.log("Errors:");
  for (const e of errors) console.log(" -", e);
}

await browser.close();
process.exit(0);
