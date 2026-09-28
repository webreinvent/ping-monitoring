// Test the /ws/ping endpoint with native ws client
import { WebSocket } from "ws";

const ws = new WebSocket("ws://localhost:3000/ws/ping");

let received = 0;
ws.on("open", () => {
  console.log("[open] sending subscribe");
  ws.send(JSON.stringify({ type: "subscribe", monitorId: 31 }));
});

ws.on("message", (data) => {
  received++;
  const text = data.toString();
  console.log(`[recv ${received}] bytes=${text.length} preview=${text.slice(0, 300)}`);
  if (text.includes("snapshot")) {
    const parsed = JSON.parse(text);
    console.log("[snapshot type]:", parsed.type, "samples:", parsed.data?.samples?.length);
  }
  if (received >= 5) {
    ws.close();
    process.exit(0);
  }
});

ws.on("error", (e) => console.log("[error]", e.message));
ws.on("close", (code, reason) => console.log("[close]", code, reason.toString()));

setTimeout(() => {
  console.log("Final received count:", received);
  process.exit(received > 0 ? 0 : 1);
}, 8000);
