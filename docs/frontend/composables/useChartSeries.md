# Composable: useChartSeries

**File:** `app/composables/useChartSeries.ts`
**Feature:** M2-T3 (All-monitors chart), M2-T4 (Monitor detail view)

## Purpose

Exports two utility functions for transforming monitor history data into uPlot-ready format. uPlot expects `Float64Array` columns with timestamps in seconds — these functions handle the conversion from the API's `HistoryResponse` format.

## API

### `transformToUPlotData(history: HistoryResponse): Float64Array[]`

Transforms a full `HistoryResponse` (from `GET /api/monitors/:id`) into uPlot-ready data.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `history` | `HistoryResponse` | The history response from the API |

**Returns:** `Float64Array[]` — uPlot data columns:
- Column 0: timestamps in seconds (epoch / 1000)
- Column 1: average latency in ms (NaN for null values)

**Example:**

```typescript
import { transformToUPlotData } from "~/composables/useChartSeries";

const { data: history } = useMonitorHistory(monitorId, fromMs, toMs);
const chartData = computed(() =>
  history.value ? transformToUPlotData(history.value) : [new Float64Array(0)]
);
```

### `transformPointsToUPlotSeries(points: HistoryPoint[]): [Float64Array, Float64Array]`

Transforms a single monitor's history points for a multi-series chart. Returns a tuple of two Float64Arrays.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `points` | `HistoryPoint[]` | The history points for a single monitor |

**Returns:** `[Float64Array, Float64Array]` — `[timestamps (seconds), values (ms)]`

**Example:**

```typescript
import { transformPointsToUPlotSeries } from "~/composables/useChartSeries";

const history = await $fetch<HistoryResponse>(`/api/monitors/${monitor.id}`, {
  query: { fromMs, toMs, maxPoints: 2000 },
});
const [timestamps, values] = transformPointsToUPlotSeries(
  history.series[0]?.points ?? []
);
```

## Null Handling

Both functions represent null `averageLatencyMs` values as `NaN` in the output Float64Array. uPlot skips NaN values when rendering, creating a visual break in the line at that point. This is the correct behavior for gaps in ping data.

## Empty Data Handling

- `transformToUPlotData`: Returns `[new Float64Array(0)]` when the history has no data
- `transformPointsToUPlotSeries`: Returns `[new Float64Array(0), new Float64Array(0)]` when points is empty

## Timestamp Conversion

Both functions divide `timestampMs` by 1000 to convert from milliseconds to seconds, as required by uPlot's time scale.

## Edge Cases

- **No series in response:** `transformToUPlotData` returns `[new Float64Array(0)]` if `history.series` is empty or the first series has no points.
- **Single point:** Works correctly — produces arrays of length 1.
- **All null latencies:** Produces a Float64Array of all `NaN` values — uPlot renders no line.

## Related

- [LatencyChart Component](../components/charts/LatencyChart.md) — Consumer of uPlot data
- [AllMonitorsChart Component](../components/charts/AllMonitorsChart.md) — Uses `transformPointsToUPlotSeries`
- [Shared Types](../../shared/types.md) — `HistoryResponse`, `HistoryPoint`, `HistorySeries`
- [Monitor History API](../../api/monitors-history.md) — Data source
