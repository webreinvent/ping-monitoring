# WebSocket Protocol

**Endpoint:** `ws://localhost:3000/ws/ping`
**File:** `server/ws/ping.ts`

## Overview

The WebSocket endpoint enables real-time communication between the server and connected clients (dashboard frontend). Currently implements a stub handler that accepts connections and echoes messages. Full topic-based subscription and broadcast logic is planned for Phase 6.

## Configuration

Enabled via Nitro experimental flag:

```typescript
// nuxt.config.ts
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
  console.log("Connected");
};
```

### On Connect Response

The server sends a connection confirmation message:

```json
{
  "type": "connected",
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

## Current Message Protocol

### Client → Server

Any valid JSON message is accepted:

```json
{
  "anyField": "value"
}
```

### Server → Client (Echo)

The server echoes the message back:

```json
{
  "type": "echo",
  "data": { "anyField": "value" },
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

### Server → Client (Error)

If the message is not valid JSON:

```json
{
  "type": "error",
  "message": "Invalid JSON",
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

## Planned Protocol (Phase 6)

### Subscription Model

```
// Subscribe to a specific monitor
{ "action": "subscribe", "monitorId": 1 }

// Unsubscribe from a monitor
{ "action": "unsubscribe", "monitorId": 1 }

// Subscribe to all monitors
{ "action": "subscribe_all" }
```

### Server Messages (Planned)

| Type | Description |
|------|-------------|
| `ping_update` | New ping sample for a subscribed monitor |
| `monitor_status` | Monitor status change (up/down/degraded) |
| `client_online` | Client came online |
| `client_offline` | Client went offline |
| `snapshot` | Historical snapshot sent on subscribe (last 100 samples) |
| `subscribed` | Confirmation of subscription |
| `unsubscribed` | Confirmation of unsubscription |

### Peer Management

```typescript
// Planned: topic-based subscription map
const subscriptions = new Map<number, Set<WebSocketPeer>>();

// Broadcast to all subscribers of a monitor
function broadcastToMonitor(monitorId: number, message: WsMessage): void {
  const peers = subscriptions.get(monitorId);
  if (peers) {
    for (const peer of peers) {
      peer.send(JSON.stringify(message));
    }
  }
}
```

## Implementation Details

### Handler API

Uses Nitro's `defineWebSocketHandler` with three lifecycle hooks:

```typescript
export default defineWebSocketHandler({
  open(peer) {
    // Called when a new WebSocket connection is established
    peer.send(JSON.stringify({
      type: "connected",
      timestamp: new Date().toISOString(),
    }));
  },

  message(peer, message) {
    // Called when the server receives a message from a client
    const data = JSON.parse(message.text);
    // ... process and respond
  },

  close(peer) {
    // Called when a client disconnects
    // F7: remove peer from subscription map
  },
});
```

### WebSocket Peer

The `peer` object provides:

- `peer.send(text: string)` — Send a message to the client
- `peer.close(code?: number, reason?: string)` — Close the connection

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `WS_HEARTBEAT_INTERVAL_MS` | `30000` | Ping/pong heartbeat interval (ms) |
| `WS_MAX_CLIENTS` | `1000` | Maximum concurrent connections |

## Edge Cases

- **Invalid JSON:** The server sends an error message and keeps the connection open.
- **Large messages:** No message size limit is currently enforced — planned for Phase 6.
- **Reconnection:** The client is responsible for reconnection logic with exponential backoff (1s → 2s → 4s → 8s → 16s → 30s).
- **Server restart:** WebSocket connections are lost on server restart. Clients should implement auto-reconnect.

## Related

- [Shared Types — WsMessageType, WsMessage](../shared/types.md)
- [Architecture Overview](../architecture/overview.md)
