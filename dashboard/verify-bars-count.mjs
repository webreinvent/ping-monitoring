// Inspect the actual WebSocket snapshot and chart data.
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Users/pk/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell",
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const wsMessages = [];
page.on("websocket", (ws) => {
  console.log("WebSocket opened:", ws.url());
  ws.on("framereceived", (frame) => {
    try {
      const data = JSON.parse(frame.payload);
      if (data.type === "snapshot") {
        // Snapshot payload: { type, monitorId, data: { monitor, samples: [...] } }
        const samples = data.data?.samples;
        wsMessages.push({
          type: "snapshot",
          monitorId: data.monitorId,
          sampleCount: samples?.length,
          firstSample: samples?.[0],
          lastSample: samples?.[samples.length - 1],
          timestampSpan: samples?.length > 0
            ? samples[samples.length - 1].timestampMs - samples[0].timestampMs
            : null,
        });
      } else if (data.type === "sample") {
        // Sample payload: { type, monitorId, qualityState, data: { timestampMs, ... } }
        const sample = data.data;
        wsMessages.push({
          type: "sample",
          monitorId: data.monitorId,
          timestampMs: sample?.timestampMs,
          latencyMs: sample?.latencyMs,
        });
      }
    } catch {
      // ignore non-JSON frames
    }
  });
});

console.log("=== Loading /monitors/31 ===");
await page.goto("http://localhost:3000/monitors/31", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(".chart-wrapper canvas", { state: "attached", timeout: 30000 });
await page.waitForTimeout(8000);

const chartData = await page.evaluate(() => {
  const canvas = document.querySelector(".chart-wrapper canvas");
  if (!canvas) return { error: "no canvas" };
  // Inspect uPlot via its private property
  const uplotDiv = document.querySelector(".chart-wrapper .uplot");
  const seriesCount = uplotDiv?.querySelectorAll(".u-series")?.length;
  return {
    canvasW: canvas.width,
    canvasH: canvas.height,
    seriesCount,
  };
});
console.log("Chart state:", JSON.stringify(chartData, null, 2));

console.log("\nWebSocket messages received:");
const snapshots = wsMessages.filter((m) => m.type === "snapshot");
const samples = wsMessages.filter((m) => m.type === "sample");
console.log(`  Snapshots: ${snapshots.length}`);
for (const s of snapshots) {
  console.log(`    monitorId=${s.monitorId} samples=${s.sampleCount} span=${s.timestampSpan}ms first=${s.firstSample?.timestampMs} last=${s.lastSample?.timestampMs}`);
}
console.log(`  Samples: ${samples.length}`);
if (samples.length > 0) {
  console.log(`    First: monitorId=${samples[0].monitorId} ts=${samples[0].timestampMs} lat=${samples[0].latencyMs}`);
  console.log(`    Last:  monitorId=${samples[samples.length - 1].monitorId} ts=${samples[samples.length - 1].timestampMs} lat=${samples[samples.length - 1].latencyMs}`);
}

await browser.close();
process.exit(0);
