# Composable: useLiveChart

**File:** `app/composables/useLiveChart.ts`
**Feature:** M2-T5 (WebSocket live chart updates)

## Purpose

Centralized composable that bridges WebSocket ping samples into reactive chart data. Consumes `useWebSocket()` internally and exposes a `liveData` Map of per-monitor time series data that chart components consume and push to uPlot. Provides auto-subscribe, bounded data storage, and rAF-debounced update callbacks.

## API

### `useLiveChart()`

```typescript
import { useLiveChart } from "~/composables/useLiveChart";

const {
  liveData,
  subscribedMonitorIds,
  subscribe,
  unsubscribe,
  isSubscribed,
  onUpdate,
  offUpdate,
  connectionState,
} = useLiveChart();
```

No parameters.

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `liveData` | `Ref<Map<number, { timestamps: Float64Array, values: Float64Array }>>` | Per-monitor live chart data |
| `subscribedMonitorIds` | `Ref<Set<number>>` | Set of currently subscribed monitor IDs |
| `subscribe(monitorId)` | `(id: number) => void` | Subscribe to a monitor's live feed |
| `unsubscribe(monitorId)` | `(id: number) => void` | Unsubscribe from a monitor's live feed |
| `isSubscribed(monitorId)` | `(id: number) => boolean` | Check if a monitor is subscribed |
| `onUpdate(callback)` | `(fn: () => void) => void` | Register rAF update callback |
| `offUpdate(callback)` | `(fn: () => void) => void` | Remove registered update callback |
| `connectionState` | `Ref<ConnectionState>` | Reactive connection state (delegated from `useWebSocket`) |

### Live Data Structure

Each entry in `liveData` is a `MonitorLiveData` object:

```typescript
interface MonitorLiveData {
  timestamps: Float64Array;  // Unix seconds (timestampMs / 1000)
  values: Float64Array;      // Latency in ms (NaN for failures)
}
```

**Constants:**
- `MAX_POINTS_PER_MONITOR = 2000` — Maximum data points per monitor. Oldest points are dropped when this limit is exceeded.

## Usage

### Basic Integration (Single Monitor)

```vue
<script setup lang="ts">
const { subscribe, liveData } = useLiveChart();

// Subscribe when the monitor ID is set
watch(monitorId, (id) => {
  if (id > 0) subscribe(id);
}, { immediate: true });

// Chart data: prefer live data, fall back to HTTP
const chartData = computed(() => {
  const live = liveData.value.get(monitorId.value);
  if (live && live.timestamps.length > 0) {
    return [live.timestamps, live.values];
  }
  return transformToUPlotData(historyData.value);
});
</script>
```

### Multi-Monitor Chart with Auto-Subscribe

```vue
<script setup lang="ts">
const { toggleMonitor, isVisible } = useMonitors();
const { subscribe, isSubscribed, liveData, onUpdate, offUpdate } = useLiveChart();

// Auto-subscribe to visible monitors
watch(
  () => props.monitors.map(m => m.id).join(","),
  (newIds) => {
    for (const id of newIds.split(",").map(Number)) {
      if (isVisible(id) && !isSubscribed(id)) subscribe(id);
    }
  },
  { immediate: true }
);

// Merge live + HTTP data
const chartData = computed(() => {
  for (const m of props.monitors) {
    if (!isVisible(m.id)) continue;
    const liveEntry = liveData.value.get(m.id);
    const httpEntry = monitorData.value.get(m.id);
    if (liveEntry) entries.push([m.id, liveEntry]);
    else if (httpEntry) entries.push([m.id, httpEntry]);
  }
  // ... merge into uPlot format
});

// Register chart update callback
const chartRef = ref<{ updateChart: () => void } | null>(null);
onUpdate(() => chartRef.value?.updateChart());

onBeforeUnmount(() => {
  offUpdate(() => chartRef.value?.updateChart());
});
</script>
```

### Registering Update Callbacks

```typescript
// Register once — called on requestAnimationFrame when new data arrives
function triggerChartUpdate(): void {
  if (chartRef.value) {
    chartRef.value.updateChart();
  }
}

onUpdate(triggerChartUpdate);

// Cleanup on unmount
onBeforeUnmount(() => {
  offUpdate(triggerChartUpdate);
});
```

## Data Flow

### Snapshot (Initial Data)

When subscribing to a monitor, the server sends a `snapshot` message with the last 100 samples. `useLiveChart` handles this by:

1. Sorting samples by timestamp (defensive — server should already send sorted)
2. Capping at `MAX_POINTS_PER_MONITOR` (keeping newest points)
3. Converting timestamps from milliseconds to seconds (uPlot format)
4. Storing `NaN` for null `latencyMs` values
5. Replacing any existing data for that monitor (full data reset)

### Sample (Live Update)

When a new sample arrives:

1. If no existing data for the monitor, initialize from this single point
2. If at capacity (`MAX_POINTS_PER_MONITOR`), drop the oldest point before appending
3. Append the new timestamp/latency pair
4. Schedule a debounced update via `requestAnimationFrame`

### rAF Debouncing

```
Sample 1 ──┐
Sample 2 ──┤
Sample 3 ──┤──→ scheduleUpdate() ──→ requestAnimationFrame ──→ callbacks fire once
Sample 4 ──┘
```

Multiple samples arriving between frames trigger only one `scheduleUpdate()` call (due to the `pendingUpdate` flag). The callbacks fire on the next animation frame, aligned with the browser's rendering cycle.

## Integration with Existing Composables

### useWebSocket

`useLiveChart` internally calls `useWebSocket()` and registers callbacks:
- `ws.onSample(appendSample)` — Called for every `sample` message
- `ws.onSnapshot(handleSnapshot)` — Called for every `snapshot` message

This means `useLiveChart` creates its own WebSocket connection instance via `useWebSocket()`. If other components (e.g., `DashboardHeader`) also use `useWebSocket()`, they share the same connection state but have independent callback registrations.

### useMonitors

Chart components use `useMonitors()` for visibility state (`isVisible()`, `toggleMonitor()`). `useLiveChart` auto-subscribes to monitors where `isVisible(id)` is `true`. These two composables work in tandem:
- `useMonitors` manages which monitors are visible in the UI
- `useLiveChart` manages which monitors receive live data

## Edge Cases

- **First sample for a new monitor**: Initializes the data from a single point. The chart will show one point until more samples arrive.
- **Null latencyMs**: Stored as `NaN` in the `values` array. uPlot treats `NaN` as a gap — the line breaks at that point.
- **Exceeding MAX_POINTS_PER_MONITOR**: Oldest points are dropped (shift data by 1 position) before appending the new point. No separate cleanup needed.
- **Empty snapshot**: Silently ignored (no data entry created).
- **Multiple `onUpdate` callbacks**: Each callback is tracked independently in a `Set`. All registered callbacks fire on each rAF cycle.
- **Callback failure**: Each callback is wrapped in try/catch — one failing callback doesn't crash the update cycle.
- **Subscribe before connected**: `useWebSocket()` handles this — the monitor is added to the subscription set and re-subscribed when the connection opens.
- **Reconnect**: `useWebSocket()` automatically re-subscribes all monitors after reconnect. `useLiveChart` doesn't need to manage this — it delegates to `useWebSocket()`.

## Performance Considerations

- **Float64Array**: Uses typed arrays for chart data — matches uPlot's expected format and enables zero-copy on `setData()`.
- **rAF debouncing**: Critical for smooth rendering. Without it, 1-second ping intervals would trigger a Vue re-render for every sample.
- **Bounded data**: 2000 points per monitor is the hard limit — prevents memory leaks during long sessions.
- **No deep watch**: The `onUpdate` callback pattern avoids `watch(liveData, ..., { deep: true })` which would trigger Vue's reactivity system on every data change.

## Testing

`useLiveChart.test.ts` tests the core data transformation logic:
- **Snapshot initialization**: Correct length, timestamp conversion, null handling, sorting, cap enforcement, empty input
- **Sample appending**: First sample, multiple samples, cap enforcement, independent multi-monitor data
- **Subscribe/unsubscribe**: Set-based tracking, no double-subscribe
- **rAF debounce**: Single rAF call per batch of samples

Tests use plain `Map` objects to mirror internal state — no Vue composable mocking needed.

## Related

- [useWebSocket Composable](./useWebSocket.md) — WebSocket connection management
- [useMonitors Composable](./useMonitors.md) — Monitor visibility toggle state
- [AllMonitorsChart Component](../components/charts/AllMonitorsChart.md) — Multi-monitor chart consumer
- [LatencyChart Component](../components/charts/LatencyChart.md) — uPlot chart renderer
- [WebSocket Protocol](../../websocket/protocol.md) — Server-side message protocol
