# Page: Monitor Detail

**File:** `app/pages/monitors/[id].vue`
**Route:** `/monitors/:id`
**Feature:** M2-T1 (Dashboard shell), M2-T4 (Monitor detail view), M2-T5 (Live WebSocket updates)

## Purpose

Detailed view for a single monitor showing a latency chart with quality bands, threshold line, and aggregate metrics. The time range selector allows filtering the view by 1h, 6h, 24h, or 7d.

## Usage

This page is rendered by Nuxt's file-based routing at `/monitors/:id`. It renders inside the `default` layout.

### Navigation

```vue
<!-- From any component/page -->
<NuxtLink :to="`/monitors/${monitor.id}`">View Detail</NuxtLink>
```

## Structure

```
monitors/[id].vue (.monitor-detail-page)
├── NavigationBreadcrumb (label="All Monitors", to="/")
├── [loading state]
│   └── "Loading monitor data..."
├── [data state]
│   ├── MonitorHeader (target, status, latest latency, last seen)
│   ├── .page-heading
│   │   ├── h3: "Latency Over Time"
│   │   └── TimeRangeSelector (v-model="timeWindow")
│   ├── LatencyChart (data, series, quality bands, threshold)
│   └── MonitorSummary (9 metric cards)
└── [no data state]
    └── EmptyState: "No data available for this monitor"
```

## Components Used

| Component | Purpose |
|-----------|---------|
| [NavigationBreadcrumb](../components/shared/NavigationBreadcrumb.md) | Back navigation to All Monitors |
| [MonitorHeader](../components/charts/MonitorHeader.md) | Monitor title bar with status |
| [TimeRangeSelector](../components/shared/TimeRangeSelector.md) | Time window selection |
| [LatencyChart](../components/charts/LatencyChart.md) | uPlot chart with quality bands and threshold |
| [MonitorSummary](../components/charts/MonitorSummary.md) | 9 metric cards (packet loss, latency, quality %) |
| [EmptyState](../components/shared/EmptyState.md) | No data fallback |

## Data Flow

1. `useTimeWindow()` provides the selected time preset and computed `fromMs`/`toMs`
2. `useAsyncData` fetches history from `GET /api/monitors/:id` with query params `fromMs`, `toMs`, `maxPoints`
3. The async data key uses `monitorId` + `timeWindow` preset (not `fromMs`/`toMs`) to avoid constant re-fetches
4. `transformToUPlotData()` converts the history response to uPlot data format
5. `getQualityBandPaths()` converts quality intervals to chart band overlays

### Chart Data Transform

```typescript
const chartData = computed(() =>
  historyData.value ? transformToUPlotData(historyData.value) : [new Float64Array(0)]
);

const qualityBands = computed(() => {
  const intervals = historyData.value?.series[0]?.intervals ?? [];
  return getQualityBandPaths(intervals);
});
```

## Live WebSocket Updates (M2-T5)

The detail page uses `useLiveChart()` to receive real-time samples for the specific monitor:

### Subscribe on Mount

```typescript
const { subscribe, liveData } = useLiveChart();

watch(monitorId, (id) => {
  if (id > 0) subscribe(id);
}, { immediate: true });
```

### Live + HTTP Data Merge

The `chartData` computed property prefers live WebSocket data over HTTP-fetched data:

```typescript
const chartData = computed(() => {
  const live = liveData.value.get(monitorId.value);
  if (live && live.timestamps.length > 0) {
    return [live.timestamps, live.values];
  }
  if (!historyData.value) return [new Float64Array(0)];
  return transformToUPlotData(historyData.value);
});
```

- **Live data takes precedence**: When WebSocket data is available (from snapshot or live samples), it replaces the HTTP-fetched data
- **Seamless transition**: Initial load shows HTTP data; once WebSocket snapshot arrives, the chart switches to live data
- **rAF-debounced updates**: `onUpdate(triggerChartUpdate)` ensures smooth chart updates

### Update Callback

```typescript
const chartRef = ref<{ updateChart: () => void } | null>(null);
onUpdate(() => chartRef.value?.updateChart());
```

## Invalid Monitor Handling

If the `id` parameter is invalid (≤ 0), the page redirects to `/`:

```typescript
if (monitorId.value <= 0) {
  navigateTo("/");
}
```

## Head

Dynamic page title based on the monitor's target name:

```typescript
useHead({
  title: computed(() => `Monitor — ${targetName.value}`),
});
```

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="monitor-detail-page"` | Page container | E2E test selector |
| `data-testid="time-range-selector"` | TimeRangeSelector | E2E time range selector |

## Edge Cases

- **No data for monitor:** The API returns an empty response — `EmptyState` is shown.
- **Monitor not found:** The API returns 404 — `hasError` becomes `true`, showing `EmptyState`.
- **Quality bands not available:** Empty array — no bands are drawn on the chart.
- **Threshold not set:** `thresholdMs` is `null` — no threshold line is drawn.
- **WebSocket disconnected:** Live data is not updated; chart falls back to the last HTTP-fetched data.
- **Live data exceeds MAX_POINTS (2000):** Oldest points are automatically dropped by `useLiveChart` — no action needed by the page.
- **Sample with null latencyMs:** Stored as `NaN` — uPlot shows a gap in the line.

## Related

- [Monitors History API](../../api/monitors-history.md) — Data source
- [LatencyChart Component](../components/charts/LatencyChart.md) — Chart rendering
- [useLiveChart Composable](../composables/useLiveChart.md) — WebSocket-to-chart bridge
- [useChartSeries Composable](../composables/useChartSeries.md) — Data transforms
- [quality-bands Utility](../utils/quality-bands.md) — Quality band generation
- [useTimeWindow Composable](../composables/useTimeWindow.md) — Time window management
- [Shared Types](../../shared/types.md) — `HistoryResponse`, `RangeSummary`, `QualityState`
