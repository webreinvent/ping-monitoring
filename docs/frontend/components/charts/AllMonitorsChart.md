# Component: AllMonitorsChart

**File:** `app/components/charts/AllMonitorsChart.vue`
**Feature:** M2-T3 (All-monitors chart)

## Purpose

Renders a combined multi-series uPlot chart showing all monitors on a single timeline. Fetches history data for each monitor, merges the timestamps into a unified time axis, and displays a color-coded legend. Used on the dashboard index page.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `monitors` | `MonitorListItem[]` | Yes | Array of monitors to display on the chart |

## Events

None.

## Slots

None.

## Usage

```vue
<template>
  <AllMonitorsChart :monitors="monitorList" data-testid="all-monitors-chart" />
</template>

<script setup lang="ts">
const { monitors } = useMonitors();
const monitorList = computed(() => monitors.value);
</script>
```

## Data Fetching

On mount and when the monitor list or time window changes, the component fetches history for each monitor via `GET /api/monitors/:id` with the following query parameters:

| Parameter | Description |
|-----------|-------------|
| `fromMs` | Start of the time range (from `useTimeWindow().fromMs`) |
| `toMs` | End of the time range (from `useTimeWindow().toMs`) |
| `maxPoints` | Maximum data points per monitor (default 2000) |

All fetches run in parallel via `Promise.allSettled`. Individual monitor fetch failures are silently skipped — the chart still renders with data from other monitors.

## Data Merging

Multiple monitor time series are merged into a single uPlot dataset:

1. **Collect all unique timestamps** from all monitors into a sorted set
2. **Build a merged time column** (Float64Array) from the sorted timestamps
3. **For each monitor**, build a value column that maps timestamps to values, using `NaN` for timestamps where that monitor has no data point

This approach ensures all series share the same X-axis while preserving gaps per monitor.

## Chart Legend

A color-coded legend is rendered below the chart when there are monitors to display:

```
[●] Google DNS    [●] Cloudflare DNS    [●] Internal Server
```

- Color is determined by `getPaletteColor(index)` from `useDashboardPalette`
- Label is the monitor's `targetName`
- Legend items are ordered by monitor index

## Empty State

When no data is available (all monitors returned empty or all fetches failed), an `EmptyState` component is rendered with the message "No data to display".

## Time Window Integration

The component uses `useTimeWindow()` to get the current time window (`fromMs`, `toMs`, `selectedPreset`). A reactive `watch` triggers a re-fetch when:
- The monitor list changes (detected by monitoring the joined list of monitor IDs)
- The selected time preset changes

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="all-monitors-chart"` | `.chart-container` | E2E test selector |

## Edge Cases

- **Empty monitor list:** Renders `EmptyState` with no data.
- **Single monitor:** Works correctly — renders one series with one legend item.
- **All fetches fail:** `hasNoData` becomes `true`, showing `EmptyState`.
- **Monitor with no samples:** The monitor's series column is filled with `NaN` — uPlot skips NaN values.
- **Time window change during load:** The `watch` on `selectedPreset` triggers a fresh fetch, replacing the previous data.

## Related

- [LatencyChart](./LatencyChart.md) — Underlying chart component
- [useTimeWindow Composable](../../composables/useTimeWindow.md) — Time window management
- [useDashboardPalette Composable](../../composables/useDashboardPalette.md) — Color palette
- [useChartSeries Composable](../../composables/useChartSeries.md) — Data transforms
- [Monitors History API](../../../api/monitors-history.md) — Data source
- [Index Page](../pages/index.md) — Primary consumer
