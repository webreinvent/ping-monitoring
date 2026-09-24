import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:3000/ws/ping");
let snapshot = null;
let sampleCount = 0;
let timer;

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "subscribe", monitorId: 28773, window: "1h" }));
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === "snapshot") {
    snapshot = msg;
    sampleCount = msg.data?.samples?.length || 0;
    ws.close();
    clearTimeout(timer);
  }
});

ws.on("error", (err) => console.error("[error]", err.message));

timer = setTimeout(() => {
  ws.close();
}, 5000);

ws.on("close", () => {
  if (snapshot) {
    const d = snapshot.data;
    console.log(`snapshot monitor=${d.monitor?.targetHost} status=${d.monitor?.status} samples=${d.samples?.length}`);
    if (d.samples?.length) {
      console.log(`first sample:`, JSON.stringify(d.samples[0]));
      console.log(`last sample:`, JSON.stringify(d.samples[d.samples.length - 1]));
    }
  } else {
    console.log("no snapshot received");
  }
});
