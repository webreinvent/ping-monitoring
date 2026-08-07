// Verify bar count after aggregation by reading uPlot's data column length.
// Accesses the chart via the Vue component instance attached to the wrapper DOM.
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
// Wait longer so the WS snapshot has time to arrive and the chart to redraw
await page.waitForTimeout(5000);

// Walk Vue's internal component tree on the wrapper element to find the
// LatencyChart instance and call its exposed getRenderState() helper.
const barInfo = await page.evaluate(() => {
  const wrapper = document.querySelector(".chart-wrapper");
  if (!wrapper) return { error: "no wrapper" };

  // Vue 3 attaches the component proxy to the root DOM node via __vue_app__.
  // We need to descend into the component tree to find LatencyChart's exposed
  // methods. Vue stashes the internal instance on __vueParentComponent.
  const root = wrapper;
  const seen = new Set();
  function walk(el, depth) {
    if (!el || seen.has(el) || depth > 8) return null;
    seen.add(el);
    const inst = el.__vueParentComponent;
    if (inst) {
      const exposed = inst.exposed ?? null;
      if (exposed && typeof exposed.getRenderState === "function") {
        return exposed.getRenderState();
      }
      // Look at child component refs
      if (inst.subTree) {
        // Try walking subTree children
      }
    }
    // Walk children
    for (const child of el.children) {
      const r = walk(child, depth + 1);
      if (r) return r;
    }
    return null;
  }
  const state = walk(root, 0);
  if (!state) return { error: "could not find exposed getRenderState" };
  return state;
});
console.log("Render state:", JSON.stringify(barInfo, null, 2));

// Count bars by reading uPlot's data via the component's exposed chart.
const uplotInfo = await page.evaluate(() => {
  const wrapper = document.querySelector(".chart-wrapper");
  const canvas = wrapper?.querySelector("canvas");
  // uPlot stashes the instance on the canvas DOM node
  const uplotInstance = canvas?.__uplot ?? null;
  if (!uplotInstance) return { found: false };

  // Inspect the actual data column 0 (timestamps) to see the time distribution
  const tsCol = uplotInstance.data[0];
  const valCol = uplotInstance.data[1];
  const firstTs = tsCol[0];
  const lastTs = tsCol[tsCol.length - 1];
  const firstVal = valCol[0];
  const lastVal = valCol[valCol.length - 1];

  // Sample timestamps at 0%, 25%, 50%, 75%, 100% of the data
  const samples = [];
  for (const frac of [0, 0.25, 0.5, 0.75, 1.0]) {
    const idx = Math.min(tsCol.length - 1, Math.floor(frac * (tsCol.length - 1)));
    samples.push({ frac, idx, ts: tsCol[idx], val: valCol[idx] });
  }

  // Convert to readable dates
  function fmtTs(sec) {
    if (sec == null) return "null";
    return new Date(sec * 1000).toISOString().slice(11, 19);
  }

  return {
    found: true,
    dataLengths: uplotInstance.data.map((c) => (c instanceof Float64Array ? c.length : Array.isArray(c) ? c.length : 0)),
    xMin: uplotInstance.scales?.x?.min ?? null,
    xMax: uplotInstance.scales?.x?.max ?? null,
    firstTs: fmtTs(firstTs),
    lastTs: fmtTs(lastTs),
    firstVal,
    lastVal,
    samples: samples.map((s) => ({ ...s, tsFmt: fmtTs(s.ts) })),
  };
});
console.log("uPlot info:", JSON.stringify(uplotInfo, null, 2));

// Take a screenshot for visual comparison
const box = await page.locator(".chart-wrapper canvas").boundingBox();
if (box) {
  await page.screenshot({
    path: "/tmp/dashboard-bars-after-fix.png",
    clip: { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 60 },
  });
  console.log("Screenshot saved to /tmp/dashboard-bars-after-fix.png");
}

if (errors.length > 0) {
  console.log("\nErrors:");
  for (const e of errors) console.log(" -", e);
}

await browser.close();
process.exit(0);