# Composable: useMonitorHistory

**File:** `app/composables/useMonitorHistory.ts`
**Feature:** M2-T4 (Monitor detail view)

## Purpose

Fetches history data for a single monitor over a given time range using Nuxt's `useAsyncData`. Returns reactive data, loading state, error state, and a refresh function. Used by the monitor detail page to fetch chart data.

## API

### `useMonitorHistory(monitorId, fromMs, toMs, maxPoints?)`

```typescript
import { useMonitorHistory } from "~/composables/useMonitorHistory";

const { data, loading, hasError, error, refresh } = useMonitorHistory(
  monitorId,    // number
  fromMs,       // number — epoch ms start
  toMs,         // number — epoch ms end
  2000         // optional — max points (default 2000, capped at 5000)
);
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `monitorId` | `number` | — | The monitor ID |
| `fromMs` | `number` | — | Start of time range (epoch ms, exclusive) |
| `toMs` | `number` | — | End of time range (epoch ms, inclusive) |
| `maxPoints` | `number` | `2000` | Maximum data points (capped at 5000) |

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `data` | `Ref<HistoryResponse \| null>` | History response data |
| `loading` | `ComputedRef<boolean>` | `true` while fetching |
| `hasError` | `ComputedRef<boolean>` | `true` if fetch failed |
| `error` | `Ref<NuxtError \| null>` | Nuxt error object if failed |
| `refresh` | `() => Promise<void>` | Re-fetch the data |

## Usage

```vue
<template>
  <div v-if="loading">Loading...</div>
  <LatencyChart v-else-if="data" :data="chartData" />
  <EmptyState v-else message="No data available" />
</template>

<script setup lang="ts">
import { transformToUPlotData } from "~/composables/useChartSeries";

const { data, loading } = useMonitorHistory(monitorId, fromMs, toMs, 2000);
const chartData = computed(() =>
  data.value ? transformToUPlotData(data.value) : [new Float64Array(0)]
);
</script>
```

## Implementation Details

### Async Data Key

The `useAsyncData` key is constructed as `` `monitor-history-${monitorId}-${fromMs}-${toMs}` ``. This means:
- Each unique combination of monitor ID and time range creates a separate cache entry
- Changing the time range (e.g., via `TimeRangeSelector`) triggers a fresh fetch
- Changing the monitor ID (e.g., navigating to a different monitor) triggers a fresh fetch

### maxPoints Cap

The `maxPoints` parameter is capped at 5000 on the client side (`Math.min(maxPoints, 5000)`) before being sent to the API. This prevents accidentally requesting too many data points.

## Edge Cases

- **Invalid monitorId:** The API returns a 404 error. `hasError` becomes `true`, `error` contains the Nuxt error.
- **No data in range:** The API returns an empty `HistoryResponse` with no series. `data.value` is truthy but `data.value.series` is empty.
- **Time range too large:** The API's `maxPoints` parameter limits the number of returned points. If the range is too large, the server aggregates data into larger buckets.

## Related

- [Monitor Detail Page](../pages/monitors-id.md) — Primary consumer
- [Monitors History API](../../api/monitors-history.md) — `GET /api/monitors/:id` endpoint
- [Shared Types](../../shared/types.md) — `HistoryResponse` type
- [useTimeWindow Composable](./useTimeWindow.md) — Provides `fromMs` and `toMs` values
