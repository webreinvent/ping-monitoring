// Inspect raw WebSocket frames to see what is actually sent.
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Users/pk/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell",
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const allFrames = [];
page.on("websocket", (ws) => {
  console.log("WS opened:", ws.url());
  ws.on("framereceived", (frame) => {
    allFrames.push({ url: ws.url(), dir: "recv", size: frame.payload?.length ?? 0 });
  });
  ws.on("framesent", (frame) => {
    allFrames.push({ url: ws.url(), dir: "send", size: frame.payload?.length ?? 0 });
  });
});

console.log("=== Loading /monitors/31 ===");
await page.goto("http://localhost:3000/monitors/31", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(".chart-wrapper canvas", { state: "attached", timeout: 30000 });
await page.waitForTimeout(8000);

console.log("\nAll WS frames:");
for (const f of allFrames) {
  console.log(`  ${f.dir} ${f.url}  size=${f.size}`);
}

const chartData = await page.evaluate(() => {
  const uplotDiv = document.querySelector(".chart-wrapper .uplot");
  const seriesCount = uplotDiv?.querySelectorAll(".u-series")?.length;
  // Try to find the Vue component's chart instance
  // uPlot stores data on the instance via .data
  const canvas = document.querySelector(".chart-wrapper canvas");
  return {
    seriesCount,
    canvasW: canvas?.width,
    canvasH: canvas?.height,
  };
});
console.log("Chart state:", JSON.stringify(chartData, null, 2));

await browser.close();
process.exit(0);
