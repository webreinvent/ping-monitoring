import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:3000/ws/ping");
const events = [];
let timer;

ws.on("open", () => {
  console.log("[open] connected");
  ws.send(JSON.stringify({ type: "subscribe", monitorId: 28773, window: "1h" }));
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  events.push(msg);
  console.log(`[msg ${events.length}]`, JSON.stringify(msg).slice(0, 200));
  if (events.length >= 3) {
    ws.close();
    clearTimeout(timer);
  }
});

ws.on("error", (err) => console.error("[error]", err.message));

timer = setTimeout(() => {
  console.log(`[timeout] received ${events.length} messages`);
  ws.close();
}, 5000);

ws.on("close", () => process.exit(events.length > 0 ? 0 : 1));
