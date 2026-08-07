// Verify live bar count stays fixed at ~60 over time
// (matching Tauri's popup live window of 60s)
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

console.log("=== Loading /monitors/31 (live mode) ===");
await page.goto("http://localhost:3000/monitors/31", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(".chart-wrapper canvas", { state: "attached", timeout: 30000 });
await page.waitForTimeout(5000);

async function readBarState() {
  return await page.evaluate(() => {
    const wrapper = document.querySelector(".chart-wrapper");
    if (!wrapper) return { error: "no wrapper" };

    const seen = new Set();
    let chart = null;
    function walk(el, depth) {
      if (!el || seen.has(el) || depth > 12) return;
      seen.add(el);
      const inst = el.__vueParentComponent;
      if (inst && inst.setupState && inst.setupState.chart) {
        chart = inst.setupState.chart;
        return;
      }
      if (el.children && typeof el.children.length === "number") {
        for (const child of el.children) {
          walk(child, depth + 1);
          if (chart) return;
        }
      }
    }
    walk(wrapper, 0);

    if (!chart) return { found: false, reason: "no chart found" };
    if (!chart.data) return { found: false, reason: "chart has no data" };

    const tsCol = chart.data[0];
    const valCol = chart.data[1];

    const ts0 = tsCol[0];
    const tsN = tsCol[tsCol.length - 1];
    const nowSec = Date.now() / 1000;

    return {
      found: true,
      dataLengths: chart.data.map((c) => (c instanceof Float64Array ? c.length : Array.isArray(c) ? c.length : 0)),
      firstTs: ts0,
      lastTs: tsN,
      nowSec,
      rangeSec: tsN - ts0,
      ageAtRightEdgeSec: nowSec - tsN,
      ageAtLeftEdgeSec: nowSec - ts0,
      lastVal: valCol[valCol.length - 1],
    };
  });
}

const samples = [];
const checkpoints = [0, 15, 30, 60, 90, 120];
console.log("Tracking bar count over time (target: ~60 bars, range ~60s):");

for (const t of checkpoints) {
  if (t > 0) await page.waitForTimeout((t - (checkpoints[checkpoints.indexOf(t) - 1] ?? 0)) * 1000);
  const state = await readBarState();
  console.log(`  T+${t}s:`, JSON.stringify(state));
  samples.push({ t, ...state });
}

console.log("\n=== Verdict ===");
const lengths = samples.map((s) => s.dataLengths?.[0] ?? 0).filter((n) => n > 0);
const ranges = samples.map((s) => s.rangeSec).filter((n) => n > 0);

if (lengths.length > 0) {
  const minLen = Math.min(...lengths);
  const maxLen = Math.max(...lengths);
  const avgLen = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  console.log(`Bar count: min=${minLen}, max=${maxLen}, avg=${avgLen}`);
  if (maxLen - minLen <= 2) {
    console.log(`✓ Bar count stable (${maxLen - minLen} variance)`);
  } else {
    console.log(`✗ Bar count drifting (${maxLen - minLen} variance)`);
  }
}

if (ranges.length > 0) {
  const minR = Math.min(...ranges);
  const maxR = Math.max(...ranges);
  console.log(`Range: min=${minR.toFixed(1)}s, max=${maxR.toFixed(1)}s`);
  if (maxR - minR <= 2) {
    console.log(`✓ Time range stable (within ${maxR - minR}s)`);
  } else {
    console.log(`✗ Time range drifting (${maxR - minR}s spread)`);
  }
}

const box = await page.locator(".chart-wrapper canvas").boundingBox();
if (box) {
  await page.screenshot({
    path: "/tmp/dashboard-live-window.png",
    clip: { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 60 },
  });
  console.log("Screenshot saved to /tmp/dashboard-live-window.png");
}

if (errors.length > 0) {
  console.log("\nErrors:");
  for (const e of errors) console.log(" -", e);
}

await browser.close();
process.exit(0);
