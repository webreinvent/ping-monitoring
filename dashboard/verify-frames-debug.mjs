// Inspect WS frames more carefully — attach listener BEFORE goto
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Users/pk/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell",
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const allFrames = [];
page.on("websocket", (ws) => {
  console.log("[WS open]", ws.url());
  ws.on("framereceived", (frame) => {
    const size = frame.payload?.length ?? 0;
    const preview = frame.payload?.slice(0, 200);
    console.log(`[recv] ${ws.url().slice(-20)} size=${size} preview=${preview}`);
  });
  ws.on("framesent", (frame) => {
    const size = frame.payload?.length ?? 0;
    const preview = frame.payload?.slice(0, 200);
    console.log(`[send] ${ws.url().slice(-20)} size=${size} preview=${preview}`);
  });
  ws.on("close", () => console.log("[WS close]", ws.url()));
});

// Listen for ALL events from start
await page.goto("http://localhost:3000/monitors/31", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(15000);

console.log("\nTotal frames captured:", allFrames.length);
await browser.close();
process.exit(0);
