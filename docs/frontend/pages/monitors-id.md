# Page: Monitor Detail

**File:** `app/pages/monitors/[id].vue`
**Route:** `/monitors/:id`
**Feature:** M2-T1 (Dashboard shell), M2-T4 (Monitor detail view)

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

## Related

- [Monitors History API](../../api/monitors-history.md) — Data source
- [LatencyChart Component](../components/charts/LatencyChart.md) — Chart rendering
- [useChartSeries Composable](../composables/useChartSeries.md) — Data transforms
- [quality-bands Utility](../utils/quality-bands.md) — Quality band generation
- [useTimeWindow Composable](../composables/useTimeWindow.md) — Time window management
- [Shared Types](../../shared/types.md) — `HistoryResponse`, `RangeSummary`, `QualityState`
