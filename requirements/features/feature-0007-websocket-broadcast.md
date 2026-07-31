---
id: F7
name: WebSocket Live Broadcast
phase: MVP
priority: High
effort: Medium
dependencies: [F1, F3, F5, F6]
---

# F7: WebSocket Live Broadcast

## Description
A WebSocket endpoint at `/ws/ping` that pushes real-time ping data to the dashboard as soon as new samples arrive via the ingest endpoint. Clients subscribe to specific monitors, receive a fresh snapshot on connection, and auto-reconnect with exponential backoff on disconnection.

## Acceptance Criteria

### Scenario: Client subscribes to a monitor
- **Given** a dashboard page is connected to `/ws/ping`
- **When** it sends a `subscribe` message with a `monitorId`
- **Then** the server acknowledges with a `subscribed` message
- **And** the client receives a `snapshot` message containing the latest N ping samples for that monitor
- **And** the client receives a `sample` message each time a new ping is ingested for that monitor

### Scenario: Client subscribes to multiple monitors
- **Given** a connected WebSocket client
- **When** it sends multiple `subscribe` messages with different `monitorId` values
- **Then** it receives independent `snapshot` and `sample` messages for each subscription
- **And** each incoming message includes the `monitorId` so the client can route it

### Scenario: Client unsubscribes from a monitor
- **Given** a client subscribed to monitor `123`
- **When** it sends an `unsubscribe` message with `monitorId: 123`
- **Then** the server acknowledges with an `unsubscribed` message
- **And** no further `sample` messages arrive for that monitor

### Scenario: Fresh snapshot on connect
- **Given** a monitor with existing historical data
- **When** a client first subscribes to it
- **Then** it receives a `snapshot` message with the most recent N samples (e.g., last 100) ordered chronologically
- **And** the snapshot includes the monitor's current state (latest latency, status, resolved address)

### Scenario: Auto-reconnect with backoff
- **Given** a WebSocket connection that drops unexpectedly
- **When** the client's reconnect logic triggers
- **Then** it attempts to reconnect with exponential backoff starting at 1s, doubling each attempt, capped at 30s
- **And** upon successful reconnect, it re-subscribes to the same monitors
- **And** it receives a fresh snapshot to fill any gap

### Scenario: Server pushes new samples immediately
- **Given** a client subscribed to monitor `123`
- **When** a new batch of ping samples is ingested via `POST /api/ping/ingest` for that monitor
- **Then** the subscribed client receives a `sample` message within 100ms of ingestion
- **And** the message contains the full sample payload (timestamp, latency, status, resolved address)

### Scenario: Connection limit per monitor
- **Given** a monitor with many subscribers
- **When** the number of WebSocket connections for a single monitor approaches a server-defined limit
- **Then** the server either enforces a reasonable cap or scales gracefully without degradation

## Implementation Notes

### Server-side (Nitro)
- Create a Nitro WebSocket handler at `/ws/ping` using Nitro's native WebSocket support (from F1 — backend setup).
- Maintain a `Map<monitorId, Set<WebSocket>>` to track subscriptions per monitor.
- On `subscribe`, look up the latest N samples from the database (or in-memory cache) and send a `snapshot` message.
- On every `POST /api/ping/ingest` success, broadcast the new samples to all subscribers of the affected monitor(s).
- On `unsubscribe`, remove the client from the monitor's subscriber set.
- Clean up stale connections on `close` and `error` events.

### Client-side (Dashboard)
- Use the native `WebSocket` API (or a lightweight wrapper like `reconnecting-websocket` if needed).
- On connect, send `subscribe` for each monitor the user is viewing.
- Implement exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (capped).
- Track active subscriptions in a Set; on reconnect, re-send all `subscribe` messages.
- Route incoming messages by `type` and `monitorId` to the correct chart/view component.

### Message Protocol (JSON over WebSocket)

#### Client → Server

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | Yes | `"subscribe"` or `"unsubscribe"` |
| `monitorId` | number | Yes | The monitor to subscribe/unsubscribe to |

**Subscribe example:**
```json
{ "type": "subscribe", "monitorId": 42 }
```

**Unsubscribe example:**
```json
{ "type": "unsubscribe", "monitorId": 42 }
```

#### Server → Client

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | Yes | `"subscribed"`, `"unsubscribed"`, `"snapshot"`, or `"sample"` |
| `monitorId` | number | Yes | The monitor this message concerns |
| `data` | object | Conditional | See message types below |

**subscribed (ack):**
```json
{ "type": "subscribed", "monitorId": 42 }
```

**unsubscribed (ack):**
```json
{ "type": "unsubscribed", "monitorId": 42 }
```

**snapshot (initial data on subscribe):**
```json
{
  "type": "snapshot",
  "monitorId": 42,
  "data": {
    "monitor": { /* latest monitor state from F5 */ },
    "samples": [
      { "timestampMs": 1700000000000, "latencyMs": 24.5, "status": "success", "resolvedAddress": "93.184.216.34" },
      // ... up to N samples, oldest first
    ]
  }
}
```

**sample (real-time push):**
```json
{
  "type": "sample",
  "monitorId": 42,
  "data": {
    "timestampMs": 1700000005000,
    "latencyMs": 23.1,
    "status": "success",
    "resolvedAddress": "93.184.216.34"
  }
}
```

### Snapshot size
- Default to the last 100 samples per monitor, configurable via a server constant.
- This gives the chart enough history to render a meaningful view without sending excessive data.

### Integration with ingest endpoint (F3)
- After a successful `POST /api/ping/ingest` commit, resolve the `monitorId` for each sample.
- Group new samples by `monitorId`, then broadcast to each monitor's subscriber set.
- Broadcast must not block the ingest response — use `setImmediate` or an async fire-and-forget.

## Data Model Changes
No new tables or schema changes. This feature uses existing `ping_samples` and `monitors` tables.

## API Contract

### WebSocket Endpoint
- **URL:** `ws://<host>/ws/ping` (or `wss://` in production)
- **Protocol:** JSON messages over WebSocket
- **Authentication:** None in MVP (relying on server-side trust — can be added later with token query param)
- **Message format:** JSON, one message per frame

### Message types summary

**Inbound (client → server):**
- `subscribe` — subscribe to a monitor's live feed
- `unsubscribe` — stop receiving updates for a monitor

**Outbound (server → client):**
- `subscribed` — acknowledgment of successful subscription
- `unsubscribed` — acknowledgment of successful unsubscription
- `snapshot` — initial batch of recent samples on subscription
- `sample` — real-time push of a new sample

### Reconnect policy (client-side)
- Initial delay: 1,000ms
- Multiplier: 2x (exponential)
- Maximum delay: 30,000ms
- Jitter: ±10% random variation to prevent thundering herd
- Reset to initial delay on successful reconnect
