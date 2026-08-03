# Composable: useWebSocket

**File:** `app/composables/useWebSocket.ts`
**Feature:** M2-T5 (WebSocket live updates)

## Purpose

Manages WebSocket connections to the live ping feed endpoint (`/ws/ping`). Handles auto-connection, subscription management, exponential backoff reconnection, visibility change recovery, and cleanup. Exposes reactive connection state and callback registration for processing incoming messages.

## API

### `useWebSocket()`

```typescript
import { useWebSocket } from "~/composables/useWebSocket";

const {
  connectionState,
  subscribe,
  unsubscribe,
  onSample,
  onSnapshot,
  onClientNameUpdated,
  disconnect,
} = useWebSocket();
```

No parameters.

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `connectionState` | `Ref<ConnectionState>` | Reactive connection state |
| `subscribe(monitorId)` | `(id: number) => void` | Subscribe to a monitor's live feed |
| `unsubscribe(monitorId)` | `(id: number) => void` | Unsubscribe from a monitor's live feed |
| `onSample(callback)` | `Function` | Register callback for sample messages |
| `onSnapshot(callback)` | `Function` | Register callback for snapshot messages |
| `onClientNameUpdated(callback)` | `Function` | Register callback for client name update messages |
| `disconnect()` | `() => void` | Disconnect and clean up |

### ConnectionState Type

```typescript
type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";
```

## Usage

### Basic (Subscribe and Receive Samples)

```typescript
const { connectionState, subscribe, onSample } = useWebSocket();

onSample((monitorId, sample, qualityState) => {
  console.log(`Monitor ${monitorId}: ${sample.latencyMs}ms (${qualityState})`);
});

// Subscribe to specific monitors
subscribe(42);
subscribe(108);
```

### With Snapshot Processing

```typescript
const { subscribe, onSnapshot } = useWebSocket();

onSnapshot((monitorId, samples, monitorInfo) => {
  console.log(`Snapshot for ${monitorInfo.targetName}: ${samples.length} samples`);
  // Populate initial chart data from snapshot
});

subscribe(42);
```

### Monitoring Connection State

```vue
<template>
  <span class="ws-indicator" :class="connectionState">
    {{ connectionState === 'connected' ? 'Live' : 'Disconnected' }}
  </span>
</template>

<script setup lang="ts">
const { connectionState } = useWebSocket();
</script>
```

## Callback Signatures

### `onSample(fn)`

```typescript
fn(monitorId: number, sample: WsPingSample, qualityState: QualityState): void
```

Called for every `sample` message from the server.

### `onSnapshot(fn)`

```typescript
fn(
  monitorId: number,
  samples: WsPingSample[],
  monitorInfo: {
    id: number;
    targetHost: string;
    targetName: string;
    status: "up" | "down" | null;
    latencyMs: number | null;
    qualityState: QualityState;
    lastSeenMs: number | null;
  }
): void
```

Called for `snapshot` messages (initial data on subscription).

### `onClientNameUpdated(fn)`

```typescript
fn(clientSlug: string, newName: string): void
```

Called when the server broadcasts a `client_name_updated` message (e.g., after a client name change via the dashboard).

## Connection Behavior

### Auto-Connect

The WebSocket connection is automatically established when the composable is initialized (client-side only). No manual `connect()` call is needed.

### Auto-Reconnection

On unexpected disconnect:
1. Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (capped)
2. Jitter: ±10% of base delay to prevent thundering herd
3. State is set to `"reconnecting"` during backoff
4. On successful reconnect, all previously subscribed monitors are re-subscribed automatically

### Visibility Change

When the browser tab becomes visible again and the connection is disconnected, the composable automatically reconnects.

### Cleanup

`onScopeDispose` (Vue scope cleanup) triggers `disconnect()` — closing the socket, clearing timers, and resetting state. This happens when the component using the composable is unmounted.

## WebSocket URL

The URL is derived from the current page origin:
- `ws://` for HTTP pages
- `wss://` for HTTPS pages
- Path: `/ws/ping`

## Edge Cases

- **Server unavailable:** The composable enters `"reconnecting"` state and retries indefinitely with exponential backoff.
- **WebSocket not supported:** If `new WebSocket()` throws, the composable falls back to `"disconnected"` state.
- **Invalid JSON messages:** Malformed messages from the server are silently ignored.
- **Subscribe before connected:** The `subscribe` method adds the monitor to the local set and sends the message if the socket is open. If not yet connected, the subscription is re-sent on `onopen`.
- **Multiple `onSample` registrations:** Only the last callback is retained (overwrites previous). If multiple handlers are needed, the caller should compose a single callback.

## Related

- [WebSocket Protocol](../../websocket/protocol.md) — Server-side protocol documentation
- [DashboardHeader Component](../components/layout/DashboardHeader.md) — Displays connection state indicator
- [Shared Types](../../shared/types.md) — `WsPingSample`, `WsMonitorState`, `QualityState`
