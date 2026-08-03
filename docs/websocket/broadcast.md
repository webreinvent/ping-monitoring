# WebSocket Broadcast API

**File:** `server/ws/ping.ts`
**Feature:** F7 (WebSocket Live Broadcast)

## Purpose

The `broadcastSample` function is the integration point between the ingest pipeline and the WebSocket live broadcast system. It is called by the ingest endpoint (`server/api/ping/ingest.post.ts`) after each new sample is successfully inserted into the database, to push that sample to all subscribed WebSocket clients.

## API

### `broadcastSample(monitorId, sample): void`

Broadcast a single ping sample to all WebSocket subscribers of a monitor.

```typescript
import { broadcastSample } from "#server/ws/ping";

broadcastSample(42, {
  timestampMs: 1725200405000,
  latencyMs: 13.1,
  status: "success",
  resolvedAddress: "8.8.8.8",
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `monitorId` | `number` | The monitor ID to broadcast to |
| `sample` | `object` | The sample data to broadcast |

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

## Message Format

The broadcast produces a `SampleMessage` with this shape:

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

## Performance

- **Broadcast latency:** Within 100ms of ingest (fire-and-forget from ingest endpoint)
- **No blocking:** Broadcast does not block the ingest HTTP response
- **No retries:** Failed sends are not retried — the client's reconnect logic handles recovery
- **Copy-on-iterate:** The `[...subSet]` copy has minimal overhead (Set is typically small)

## Related

- [WebSocket Protocol](protocol.md) — Full message protocol documentation
- [Ping Ingest API](../api/ping-ingest.md) — The ingest endpoint that calls `broadcastSample`
- [Ping Ingest Engine](../utils/ping-ingest.md) — Core ingest pipeline
- [Shared Types](../shared/types.md) — `WsPingSample` type definition
- [Feature F7 Specification](../../requirements/features/feature-0007-websocket-broadcast.md) — Original requirements
