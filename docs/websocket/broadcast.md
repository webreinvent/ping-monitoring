# WebSocket Broadcast API

**File:** `server/ws/ping.ts`
**Feature:** F7 (WebSocket Live Broadcast), F11 (Client Name Editing)

## Purpose

The WebSocket broadcast system provides two broadcast mechanisms:
1. **Monitor-scoped broadcast** (`broadcastSample`) — pushes ping samples to subscribers of specific monitors
2. **Global broadcast** (`broadcastClientNameUpdated`, `broadcastSettingsUpdate`) — reaches ALL connected WebSocket peers regardless of monitor subscriptions

The `broadcastSample` function is the integration point between the ingest pipeline and the WebSocket live broadcast system. It is called by the ingest endpoint (`server/api/ping/ingest.post.ts`) after each new sample is successfully inserted into the database, to push that sample to all subscribed WebSocket clients.

## API

### `broadcastSample(monitorId, sample, qualityState?): void`

Broadcast a single ping sample to all WebSocket subscribers of a monitor.

```typescript
import { broadcastSample } from "#server/ws/ping";

broadcastSample(42, {
  timestampMs: 1725200405000,
  latencyMs: 13.1,
  status: "success",
  resolvedAddress: "8.8.8.8",
}, "veryHigh");
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `monitorId` | `number` | The monitor ID to broadcast to |
| `sample` | `object` | The sample data to broadcast |
| `qualityState` | `QualityState` (optional) | F12 quality classification (default: `"warmingUp"`) |

#### `sample` Shape

| Field | Type | Description |
|-------|------|-------------|
| `timestampMs` | `number` | Epoch milliseconds of the ping |
| `latencyMs` | `number \| null` | Round-trip latency (null on failure) |
| `status` | `"success" \| "timeout" \| "error"` | Ping result status |
| `resolvedAddress` | `string \| null` | Resolved IP address (null on failure) |

#### Returns

`void` — This function is fire-and-forget. No return value.

#### Behavior

1. Looks up the subscriber set for the given `monitorId`
2. If no subscribers exist (monitor not in map or empty set), returns immediately (no-op)
3. Serializes the sample into a `SampleMessage` JSON payload
4. Iterates over a **copy** of the subscriber set (`[...subSet]`) to prevent iteration issues if the set changes
5. Sends the payload to each subscriber whose `readyState === 1` (OPEN)
6. Failed sends are logged at `warn` level and silently skipped

### `broadcastClientNameUpdated(clientSlug, newName): void` (F11)

Broadcast a client name update to ALL connected WebSocket clients.

```typescript
import { broadcastClientNameUpdated } from "#server/ws/ping";

broadcastClientNameUpdated("alice-desktop-00bb11cc22", "Alice Work Laptop");
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `clientSlug` | `string` | The client's unique slug identifier |
| `newName` | `string` | The new display name |

#### Returns

`void` — This function is fire-and-forget. No return value.

#### Behavior

1. Creates a `ClientNameUpdatedMessage` with `{ type: "client_name_updated", clientSlug, newName }`
2. Iterates over a **copy** of the global `allPeers` Set (`[...allPeers]`) to prevent iteration issues
3. Sends the JSON payload to each peer whose `readyState === 1` (OPEN)
4. Failed sends are logged at `warn` level and silently skipped

#### Integration

Called from `PUT /api/clients/:slug/name` endpoint after a successful `updateClientName()` call. The endpoint passes `row.slug` and `row.name` from the updated database row.

#### Message Shape

```json
{
  "type": "client_name_updated",
  "clientSlug": "alice-desktop-00bb11cc22",
  "newName": "Alice Work Laptop"
}
```

This matches the `client_name_updated` message type in the [WebSocket Protocol](protocol.md).

### `broadcastSettingsUpdate(slug, settings): void` (F9)

Broadcast a client settings update to all connected WebSocket peers.

```typescript
import { broadcastSettingsUpdate } from "#server/ws/ping";

broadcastSettingsUpdate("alice-desktop-00bb11cc22", {
  sync_enabled: true,
  sync_interval_min: 5,
  backend_url: "https://example.com/api",
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | The client's unique slug |
| `settings` | `object` | The updated settings |

#### `settings` Shape

| Field | Type | Description |
|-------|------|-------------|
| `sync_enabled` | `boolean` | Whether cloud sync is enabled |
| `sync_interval_min` | `number` | Sync interval in minutes |
| `backend_url` | `string` | Backend API URL |

#### Returns

`void` — This function is fire-and-forget.

#### Behavior

Iterates over all monitor subscription sets (not `allPeers`) to find unique connected peers. This is the legacy approach; `broadcastClientNameUpdated` uses the more efficient `allPeers` Set.

### `getSubscriberCount(monitorId): number`

Get the current number of WebSocket subscribers for a monitor.

```typescript
import { getSubscriberCount } from "#server/ws/ping";

const count = getSubscriberCount(42);
// Returns: 0, 1, 2, ...
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `monitorId` | `number` | The monitor ID to check |

#### Returns

`number` — The count of active subscribers (0 if no subscribers).

**Used by:** Logging, debugging, and operational monitoring.

## Architecture

### Two-Level Peer Tracking

The WebSocket handler maintains two data structures for peer tracking:

1. **Per-monitor subscription map** (`Map<number, Set<WebSocket>>`) — for monitor-scoped broadcasts (`broadcastSample`)
2. **Global peer set** (`Set<WebSocket>` as `allPeers`) — for global broadcasts (`broadcastClientNameUpdated`)

```
┌─────────────────────┐     ┌──────────────────┐
│  Per-Monitor Map     │     │  Global allPeers │
│  Map<monitorId, Set> │     │  Set<WebSocket>  │
│                      │     │                  │
│  42 → { ws1, ws3 }   │     │  { ws1, ws2, ws3 }│
│  43 → { ws2 }        │     │                  │
└─────────────────────┘     └──────────────────┘
```

- **`allPeers`** is populated on `open()` and cleaned up on `close()` — same extraction (`(peer as any).ws`) as the monitor subscription map
- **Global broadcasts** iterate `allPeers` directly — simpler and more correct than iterating all subscription sets
- **Per-monitor broadcasts** use the subscription map — only subscribers of the specific monitor receive the message

### Why Global vs. Per-Monitor

| Broadcast Type | Scope | Use Case | Peer Set |
|---------------|-------|----------|----------|
| `broadcastSample` | Per-monitor | New ping sample for a specific monitor | `Map<monitorId, Set>` |
| `broadcastClientNameUpdated` | Global | Client display name changed | `allPeers` Set |
| `broadcastSettingsUpdate` | Global | Client sync settings changed | All subscription sets (legacy) |

## Integration with Ingest

The ingest endpoint (`server/api/ping/ingest.post.ts`) calls `broadcastSample` from the `broadcastAcceptedSamples` internal function:

```typescript
// Inside ingest endpoint, after successful DB insert:
if (result.acceptedSamples && result.acceptedSamples.length > 0) {
  broadcastAcceptedSamples(result.acceptedSamples);
}
```

The integration has these properties:

- **Dynamic import**: Uses `await import("#server/ws/ping")` to avoid circular dependencies
- **Grouped by monitor**: Samples are grouped by `monitorId` before broadcasting for efficiency
- **Non-blocking**: The broadcast call is `async` but does not block the HTTP response — `setImmediate`-equivalent semantics
- **Per-sample broadcast**: Each sample is sent individually (not batched) so clients can process one at a time

## Integration with Name Update (F11)

The PUT name endpoint (`server/api/clients/[slug].name.put.ts`) calls `broadcastClientNameUpdated` after a successful update:

```typescript
import { updateClientName, toClientResponse } from "../../utils/client";
import { broadcastClientNameUpdated } from "../../ws/ping";

export default defineEventHandler(async (event) => {
  // ... validate name ...
  const row = updateClientName(slug, trimmed);
  if (!row) {
    throw createError({ statusCode: 404, message: "Client not found" });
  }

  // Broadcast to all connected WebSocket clients
  broadcastClientNameUpdated(row.slug, row.name);

  return toClientResponse(row);
});
```

The integration has these properties:

- **Direct import**: `import { broadcastClientNameUpdated } from "../../ws/ping"` — no dynamic import needed
- **After DB update**: Broadcast only fires after `updateClientName()` succeeds (row returned from DB)
- **Non-blocking**: Broadcast failure doesn't affect the API response
- **Fire-and-forget**: No await, no retry — the broadcast is best-effort

## Message Format

The `broadcastSample` produces a `SampleMessage` with this shape:

```json
{
  "type": "sample",
  "monitorId": 42,
  "data": {
    "timestampMs": 1725200405000,
    "latencyMs": 13.1,
    "status": "success",
    "resolvedAddress": "8.8.8.8"
  },
  "qualityState": "veryHigh"
}
```

This matches the `sample` message type in the [WebSocket Protocol](protocol.md).

## Subscription Map

The broadcast relies on the in-memory subscription map maintained by the WebSocket handler:

```
Map<monitorId: number, Set<WebSocket>>
```

- Subscribers are added by the `handleSubscribe` function (on `subscribe` message)
- Subscribers are removed by the `handleUnsubscribe` function and the `close` handler
- The broadcast function only reads from this map (never modifies it)

## Edge Cases

- **No subscribers:** Returns immediately — no overhead when no one is listening
- **Disconnected peer:** If a subscriber's WebSocket `readyState !== 1` (not OPEN), the send is silently skipped
- **Concurrent disconnect:** The subscriber set is copied (`[...subSet]`) before iteration, so a subscriber disconnecting during broadcast does not cause iteration errors
- **Send failure:** Failed `ws.send()` calls are caught and logged at `warn` level. The broadcast continues to the next subscriber.
- **Unknown monitor:** If no one has subscribed to a monitor ID, the lookup returns `undefined` and the function returns early.
- **No global peers:** `broadcastClientNameUpdated` iterates an empty `allPeers` set — no-op, no error.

## Performance

- **Broadcast latency:** Within 100ms of ingest (fire-and-forget from ingest endpoint)
- **No blocking:** Broadcast does not block the HTTP response
- **No retries:** Failed sends are not retried — the client's reconnect logic handles recovery
- **Copy-on-iterate:** The `[...subSet]` and `[...allPeers]` copies have minimal overhead (Sets are typically small)
- **Global broadcast O(n):** `broadcastClientNameUpdated` iterates all connected peers — linear in the number of WebSocket connections. Acceptable for dashboard-scale (tens to hundreds of connections).

## Related

- [WebSocket Protocol](protocol.md) — Full message protocol documentation
- [Ping Ingest API](../api/ping-ingest.md) — The ingest endpoint that calls `broadcastSample`
- [Ping Ingest Engine](../utils/ping-ingest.md) — Core ingest pipeline
- [Quality Classifier](../utils/quality-classifier.md) — `quality_state` included in broadcast messages
- [Shared Types](../shared/types.md) — `WsPingSample`, `WsOutboundType`, `QualityState` type definitions
- [Feature F7 Specification](../../requirements/features/feature-0007-websocket-broadcast.md) — WebSocket broadcast requirements
- [Feature F11 Specification](../../requirements/features/feature-00011-edit-client-name.md) — Client name editing requirements
- [Feature F12 Specification](../../requirements/features/feature-00012-quality-classifier.md) — Quality classifier
