# WebSocket Protocol — Live Broadcast

**Endpoint:** `ws://localhost:3000/ws/ping` (or `wss://` in production)
**File:** `server/ws/ping.ts`
**Feature:** F7 (WebSocket Live Broadcast)

## Purpose

The WebSocket endpoint enables real-time ping data delivery to dashboard clients. Clients subscribe to specific monitors, receive a fresh snapshot of recent data on subscription, and get live `sample` messages pushed to them whenever new ping data is ingested.

## Configuration

Enabled via Nitro experimental flag in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  nitro: {
    experimental: {
      websocket: true,
    },
  },
});
```

## Connection

### Connecting

```javascript
const ws = new WebSocket("ws://localhost:3000/ws/ping");

ws.onopen = () => {
  // Server sends a "connected" acknowledgment
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  switch (message.type) {
    case "connected":
      console.log("Connected at", message.timestamp);
      break;
    case "subscribed":
      console.log("Subscribed to monitor", message.monitorId);
      break;
    case "snapshot":
      console.log("Received snapshot with", message.data.samples.length, "samples");
      break;
    case "sample":
      console.log("New sample for monitor", message.monitorId);
      break;
    case "unsubscribed":
      console.log("Unsubscribed from monitor", message.monitorId);
      break;
    case "client_name_updated":
      console.log("Client", message.clientSlug, "renamed to", message.newName);
      break;
    case "error":
      console.error("WebSocket error:", message.message);
      break;
  }
};
```

### On Connect Response

The server sends a connection confirmation message immediately after the WebSocket opens:

```json
{
  "type": "connected",
  "timestamp": "2026-08-03T12:00:00.000Z"
}
```

## Message Protocol

All messages are JSON objects with a `type` discriminator field. One JSON object per WebSocket frame.

### Client → Server (Inbound)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | `"subscribe"` or `"unsubscribe"` |
| `monitorId` | `number` | Yes | The monitor ID to subscribe/unsubscribe to |

#### Subscribe

```json
{ "type": "subscribe", "monitorId": 42 }
```

Subscribes to live data for a specific monitor. The server responds with:
1. A `subscribed` acknowledgment
2. A `snapshot` message with the latest N samples (see below)

If the monitor does not exist, the server responds with an `error` message and does not subscribe.

#### Unsubscribe

```json
{ "type": "unsubscribe", "monitorId": 42 }
```

Stops receiving live data for a specific monitor. The server responds with an `unsubscribed` acknowledgment.

If the client is not subscribed to the monitor, the server still sends the `unsubscribed` acknowledgment (idempotent).

#### Multiple Subscriptions

A single WebSocket connection can subscribe to multiple monitors simultaneously. Each subscription is independent — `snapshot` and `sample` messages include the `monitorId` so the client can route them to the correct view.

```json
// Subscribe to monitor 1
{ "type": "subscribe", "monitorId": 1 }

// Subscribe to monitor 2
{ "type": "subscribe", "monitorId": 2 }

// Subscribe to monitor 3
{ "type": "subscribe", "monitorId": 3 }
```

### Server → Client (Outbound)

| Type | Description |
|------|-------------|
| `connected` | Connection established (sent once on connect) |
| `subscribed` | Subscription acknowledged |
| `unsubscribed` | Unsubscription acknowledged |
| `snapshot` | Initial batch of recent samples (sent after `subscribed`) |
| `sample` | Real-time push of a new sample |
| `client_name_updated` | Client display name has changed (broadcast to all connections) |
| `error` | Error message (connection stays open) |

#### Subscribed (Acknowledgment)

```json
{
  "type": "subscribed",
  "monitorId": 42
}
```

Sent immediately after a valid `subscribe` message. The client should consider itself subscribed upon receiving this message.

#### Unsubscribed (Acknowledgment)

```json
{
  "type": "unsubscribed",
  "monitorId": 42
}
```

Sent after a valid `unsubscribe` message. No further `sample` messages will be sent for this monitor.

#### Snapshot (Initial Data)

```json
{
  "type": "snapshot",
  "monitorId": 42,
  "data": {
    "monitor": {
      "id": 42,
      "targetHost": "8.8.8.8",
      "targetName": "Google DNS",
      "status": "up",
      "latencyMs": 12.5,
      "qualityState": "veryHigh",
      "lastSeenMs": 1725200400000
    },
    "samples": [
      {
        "timestampMs": 1725200000000,
        "latencyMs": 11.2,
        "status": "success",
        "resolvedAddress": "8.8.8.8"
      },
      {
        "timestampMs": 1725200001000,
        "latencyMs": 12.8,
        "status": "success",
        "resolvedAddress": "8.8.8.8"
      }
    ]
  }
}
```

Sent immediately after `subscribed`. Contains:

- **`data.monitor`**: The monitor's current state (latest latency, status, quality)
- **`data.samples`**: Up to 100 recent samples, ordered **oldest first** (chronological order for chart rendering)

**Snapshot details:**

| Field | Type | Description |
|-------|------|-------------|
| `data.monitor.id` | `number` | Monitor ID |
| `data.monitor.targetHost` | `string` | Target hostname or IP |
| `data.monitor.targetName` | `string` | Human-readable target name (falls back to targetHost) |
| `data.monitor.status` | `"up" \| "down" \| null` | Current status (`null` = no samples yet) |
| `data.monitor.latencyMs` | `number \| null` | Latest latency in ms |
| `data.monitor.qualityState` | `QualityState` | F12 quality classification (e.g., `"veryHigh"`, `"high"`, `"medium"`, `"low"`, `"unstable"`, `"disconnected"`, `"warmingUp"`) |
| `data.monitor.lastSeenMs` | `number \| null` | Epoch ms of latest sample |

**Sample details (within snapshot and `sample` messages):**

| Field | Type | Description |
|-------|------|-------------|
| `timestampMs` | `number` | Epoch milliseconds of the ping |
| `latencyMs` | `number \| null` | Round-trip latency (null on failure) |
| `status` | `"success" \| "timeout" \| "error"` | Ping result |
| `resolvedAddress` | `string \| null` | Resolved IP address (null on failure) |

#### Sample (Real-Time Push)

```json
{
  "type": "sample",
  "monitorId": 42,
  "data": {
    "timestampMs": 1725200405000,
    "latencyMs": 13.1,
    "status": "success",
    "resolvedAddress": "8.8.8.8"
  }
}
```

Pushed to all subscribers whenever a new sample is ingested for their subscribed monitor. Sent within 100ms of the ingest endpoint processing the sample.

#### Client Name Updated

```json
{
  "type": "client_name_updated",
  "clientSlug": "alice-desktop-00bb11cc22",
  "newName": "Alice Work Laptop"
}
```

Broadcast to all connected WebSocket clients when a client's display name is updated (via `PUT /api/clients/:slug/name`). This allows dashboards to update the sidebar and any displayed client names in real time without refreshing.

| Field | Type | Description |
|-------|------|-------------|
| `clientSlug` | `string` | The client's unique slug |
| `newName` | `string` | The new display name |

#### Error

```json
{
  "type": "error",
  "message": "Monitor 999 not found"
}
```

Sent when the server encounters an error processing a client message. The connection stays open — the client can continue to send other messages.

**Common error conditions:**

| Message | Cause |
|---------|-------|
| `"Invalid JSON"` | Non-JSON or malformed JSON in inbound message |
| `"Message must include 'type' and 'monitorId' (number)"` | Missing `type` field or non-numeric `monitorId` |
| `"Monitor N not found"` | Subscribe request for a non-existent monitor |
| `"Unknown message type: X"` | Client sent an unrecognized `type` value |

## Subscription Map

The server maintains an in-memory subscription map:

```
Map<monitorId: number, Set<WebSocket>>
```

- Each WebSocket connection can subscribe to multiple monitors
- Each monitor can have multiple subscribers
- The map is cleaned up on `close` — the peer is removed from all subscription sets
- Empty subscription sets are removed to prevent memory leaks

## Ingest Integration

When the ingest endpoint (`POST /api/ping/ingest`) successfully inserts new samples, it calls `broadcastSample()` to push them to all subscribers of the affected monitor(s). This is:

- **Non-blocking**: The broadcast does not delay the ingest response
- **Fire-and-forget**: Failed sends are logged but do not retry
- **Per-sample**: Each sample is broadcast individually (not batched)

See [Broadcast API](broadcast.md) for details on the `broadcastSample` function.

## Reconnection

The **client** is responsible for reconnection logic. The server does not maintain any reconnection state. Recommended approach:

```javascript
function connect() {
  const ws = new WebSocket("ws://localhost:3000/ws/ping");

  ws.onopen = () => {
    // Re-subscribe to all previously monitored monitors
    for (const monitorId of activeMonitors) {
      ws.send(JSON.stringify({ type: "subscribe", monitorId }));
    }
  };

  ws.onclose = () => {
    // Reconnect with exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (capped)
    const delay = Math.min(initialDelay * Math.pow(2, retryCount), 30000);
    retryCount++;
    setTimeout(connect, delay);
  };
}
```

Upon reconnection, the client should re-subscribe to all active monitors. The server will send a fresh `snapshot` to fill any data gap.

## Edge Cases

- **Invalid JSON:** The server sends an `error` message and keeps the connection open.
- **Large messages:** No message size limit is currently enforced.
- **Non-existent monitor:** Subscribe to a monitor ID that doesn't exist returns an `error`. No subscription is created.
- **Unsubscribe from unknown monitor:** The server sends `unsubscribed` acknowledgment regardless (idempotent).
- **Server restart:** WebSocket connections are lost on server restart. Clients should implement auto-reconnect.
- **Stale connections:** The `close` handler removes the peer from all subscription sets. No special heartbeat is implemented.
- **Concurrent send failures:** If a subscriber's WebSocket is in a non-OPEN state during broadcast, the send is silently skipped.

## Performance

- **Snapshot size:** Default 100 samples per monitor (`SNAPSHOT_SIZE` constant in `server/ws/ping.ts`)
- **Broadcast latency:** Within 100ms of ingest (fire-and-forget from ingest endpoint)
- **Broadcast iteration:** Uses `[...subSet]` copy to prevent iteration issues if the set changes during broadcast
- **No connection cap:** No per-monitor or global connection limit is enforced (scales with available memory)

## Related

- [Broadcast API](broadcast.md) — `broadcastSample()` function documentation
- [Shared Types](../shared/types.md) — `WsPingSample`, `WsMonitorState`, `WsInboundType`, `WsOutboundType`, `QualityState`
- [Quality Classifier](../utils/quality-classifier.md) — `quality_state` included in WebSocket messages
- [Ping Ingest API](../api/ping-ingest.md) — Integration point for WebSocket broadcast
- [Feature F7 Specification](../../requirements/features/feature-0007-websocket-broadcast.md) — Original requirements
- [Feature F12 Specification](../../requirements/features/feature-00012-quality-classifier.md) — Quality classifier
