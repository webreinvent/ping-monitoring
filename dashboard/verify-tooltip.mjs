// Verify hover tooltip renders and live updates work.
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
await page.goto("http://localhost:3000/monitors/31", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(".chart-wrapper canvas", { state: "attached", timeout: 30000 });
await page.waitForTimeout(2000);

// Hover over the chart center to trigger tooltip
const canvas = page.locator(".chart-wrapper canvas");
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas bbox");
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
console.log("Hovering at", cx, cy);
await page.mouse.move(cx, cy);
await page.waitForTimeout(800);

// Take screenshot with tooltip visible
await page.screenshot({ path: "/tmp/dashboard-tooltip.png", clip: { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 60 } });

// Inspect tooltip
const tooltipInfo = await page.evaluate(() => {
  const t = document.querySelector(".chart-tooltip");
  if (!t) return { exists: false };
  const cs = window.getComputedStyle(t);
  return {
    exists: true,
    visible: t.classList.contains("visible"),
    opacity: cs.opacity,
    visibility: cs.visibility,
    text: t.textContent?.trim(),
    left: cs.left,
    top: cs.top,
    classes: t.className,
    time: t.querySelector(".chart-tooltip-time")?.textContent,
    rows: Array.from(t.querySelectorAll(".chart-tooltip-row")).map((r) => r.textContent?.trim()),
    stateText: t.querySelector(".chart-tooltip-state")?.textContent?.trim(),
    stateClasses: t.querySelector(".chart-tooltip-state")?.className,
  };
});
console.log("Tooltip:", JSON.stringify(tooltipInfo, null, 2));

// Move away to hide tooltip
await page.mouse.move(0, 0);
await page.waitForTimeout(500);

// Check live updates — capture first sample count, wait 5s, check again
const liveCheck = await page.evaluate(async () => {
  // Find the chart instance via Vue devtools-style __vueParentComponent
  const canvas = document.querySelector(".chart-wrapper canvas");
  if (!canvas) return { error: "no canvas" };
  // uPlot instance is on canvas.__uplot or accessible via the wrapper's .uplot class
  const uplotDiv = document.querySelector(".chart-wrapper .uplot");
  const series = uplotDiv?.querySelectorAll(".u-series")?.length;
  // Sample count: read from the first non-time column of uPlot's data
  // uPlot stores data via (canvas as any).__uplot or in the wrapper
  const wrapper = document.querySelector(".chart-wrapper");
  // Walk up to find uPlot instance — try the canvas directly
  const w = window;
  const beforeLen = canvas.dataset.testLen || "?";
  return { series, beforeLen };
});
console.log("Initial live check:", JSON.stringify(liveCheck, null, 2));

await page.waitForTimeout(8000);

const liveCheck2 = await page.evaluate(async () => {
  const wrapper = document.querySelector(".chart-wrapper");
  // Read uPlot data via the wrapper
  const canvas = document.querySelector(".chart-wrapper canvas");
  return {
    series: wrapper?.querySelectorAll(".u-series")?.length,
    // Use the canvas dimensions to check if chart re-rendered
    canvasW: canvas?.width,
    canvasH: canvas?.height,
  };
});
console.log("After 8s wait:", JSON.stringify(liveCheck2, null, 2));

// Take a final screenshot
await page.screenshot({ path: "/tmp/dashboard-final.png", clip: { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 60 } });

if (errors.length > 0) {
  console.log("\nErrors:");
  for (const e of errors) console.log(" -", e);
}

await browser.close();
process.exit(0);
