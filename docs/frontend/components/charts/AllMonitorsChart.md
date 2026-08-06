# Component: AllMonitorsChart

**File:** `app/components/charts/AllMonitorsChart.vue`
**Feature:** M2-T3 (All-monitors chart), M2-T5 (Live WebSocket updates)

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

The component internally uses `useMonitors()` for toggle state (`toggleMonitor`, `isVisible`) and `useTimeWindow()` for the time range. Threshold values `[50, 100, 150, 200]` are hardcoded and passed to `LatencyChart`.

## Series Configuration

The `seriesConfig` computed property builds uPlot series configuration for visible monitors only:

- **Visibility filter**: `props.monitors.filter((m) => isVisible(m.id))` — only visible monitors produce series
- **Color stability**: Uses `props.monitors.indexOf(m)` (original index) for `getPaletteColor()` — colors don't shift when monitors are toggled
- **Series structure**: Each series has `label` (targetName), `stroke` (palette color), `width: 1.5`, and `points: { show: false }`

## Data Fetching

On mount and when the monitor list or time window changes, the component fetches history for each monitor via `GET /api/monitors/:id` with the following query parameters:

| Parameter | Description |
|-----------|-------------|
| `fromMs` | Start of the time range (from `useTimeWindow().fromMs`) |
| `toMs` | End of the time range (from `useTimeWindow().toMs`) |
| `maxPoints` | Maximum data points per monitor (default 2000) |

All fetches run in parallel via `Promise.allSettled`. Individual monitor fetch failures are silently skipped — the chart still renders with data from other monitors.

## Live WebSocket Updates (M2-T5)

The component uses `useLiveChart()` to receive real-time WebSocket samples and update the chart without page reload:

### Auto-Subscribe

When the monitor list changes, the component auto-subscribes to all visible monitors:

```typescript
watch(
  () => props.monitors.map((m) => m.id).join(","),
  (newIds) => {
    const ids = newIds.split(",").map(Number);
    for (const id of ids) {
      if (isVisible(id) && !isSubscribed(id)) subscribe(id);
    }
  },
  { immediate: true }
);
```

### Live + HTTP Data Merge

The `chartData` computed property prefers live WebSocket data over HTTP-fetched data:

```typescript
const chartData = computed(() => {
  for (const m of props.monitors) {
    if (!isVisible(m.id)) continue;
    const liveEntry = liveData.value.get(m.id);
    const httpEntry = monitorData.value.get(m.id);
    if (liveEntry) entries.push([m.id, liveEntry]);
    else if (httpEntry) entries.push([m.id, httpEntry]);
  }
  // Merge into uPlot format...
});
```

- **Live data takes precedence**: When a monitor has WebSocket data (from snapshot or live samples), it replaces the HTTP-fetched data
- **Seamless transition**: Initial load uses HTTP data; once WebSocket snapshot arrives, the chart switches to live data
- **rAF-debounced updates**: `onUpdate(triggerChartUpdate)` registers a callback that fires on `requestAnimationFrame`, ensuring smooth updates even with rapid sample arrival

### Update Callback Registration

```typescript
const chartRef = ref<{ updateChart: () => void } | null>(null);

function triggerChartUpdate(): void {
  if (chartRef.value) chartRef.value.updateChart();
}

onUpdate(triggerChartUpdate);

onBeforeUnmount(() => {
  offUpdate(triggerChartUpdate);
});
```

The `onUpdate`/`offUpdate` pattern is critical — it ensures chart updates are batched to one per animation frame, preventing reactivity overhead from frequent WebSocket messages.

## Data Merging

Multiple monitor time series are merged into a single uPlot dataset. The `chartData` computed property filters by visibility (using `isVisible(id)` from `useMonitors`) before merging:

1. **Filter by visibility**: Only include monitors where `isVisible(id)` returns `true`
2. **Collect all unique timestamps** from visible monitors into a sorted set
3. **Build a merged time column** (Float64Array) from the sorted timestamps
4. **For each visible monitor**, build a value column that maps timestamps to values, using `NaN` for timestamps where that monitor has no data point

This approach ensures all series share the same X-axis while preserving gaps per monitor. Hidden monitors are excluded from both the data and the series configuration.

## Chart Legend

A color-coded legend is rendered below the chart when there are monitors to display:

```
[●] Google DNS    [●] Cloudflare DNS    [●] Internal Server
```

- Color is determined by `getPaletteColor(index)` from `useDashboardPalette`
- Label is the monitor's `targetName`
- Legend items are ordered by monitor index

### Legend Toggle Interaction

Legend items are **clickable** to toggle the visibility of the corresponding monitor series:

- **Click handler**: `@click="toggleMonitor(item.id)"` — calls `useMonitors().toggleMonitor()` to toggle the monitor's visibility
- **Keyboard accessibility**: `@keydown.enter` and `@keydown.space` also toggle
- **Visual state**: Hidden monitors get `.chart-legend-item--hidden` class — `opacity: 0.4` + `text-decoration: line-through`
- **ARIA**: Each item has `role="button"`, `tabindex="0"`, `aria-pressed="true/false"`, and `aria-label="Toggle {name}"`
- **Color stability**: When a monitor is hidden, its palette color is preserved (uses `props.monitors.indexOf(m)` — the original index, not a filtered index). This prevents colors from shifting when toggling monitors

### Threshold Lines

The AllMonitorsChart passes a standard set of threshold values `[50, 100, 150, 200]` to the underlying `LatencyChart` via the `:threshold-values` prop. These match the desktop app's threshold zones (50ms = good, 100ms = caution, 150ms = elevated, 200ms = bad).

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
- **All monitors hidden via toggle:** `chartData` returns `[new Float64Array(0)]` — uPlot renders with empty data. The `EmptyState` component is shown when `hasNoData` is `true` (but note: `hasNoData` is based on data fetch results, not toggle state). Visible legend items are dimmed with line-through styling.
- **Hidden monitor re-shown:** Palette color is preserved (original index used) — no color flicker. The series data is available from `monitorData` map and the `chartData` computed re-includes it.
- **WebSocket disconnected:** Live data is not updated; chart falls back to the last HTTP-fetched data. `connectionState` is exposed via `useLiveChart` for UI indicator.
- **Live data exceeds MAX_POINTS (2000):** Oldest points are automatically dropped by `useLiveChart` — no action needed by the component.
- **Sample with null latencyMs:** Stored as `NaN` in the values array — uPlot shows a gap in the line.

## Related

- [LatencyChart](./LatencyChart.md) — Underlying chart component
- [useLiveChart Composable](../../composables/useLiveChart.md) — WebSocket-to-chart bridge
- [useTimeWindow Composable](../../composables/useTimeWindow.md) — Time window management
- [useDashboardPalette Composable](../../composables/useDashboardPalette.md) — Color palette
- [useChartSeries Composable](../../composables/useChartSeries.md) — Data transforms
- [Monitors History API](../../../api/monitors-history.md) — Data source
- [Index Page](../pages/index.md) — Primary consumer

## Related

- [LatencyChart](./LatencyChart.md) — Underlying chart component
- [useTimeWindow Composable](../../composables/useTimeWindow.md) — Time window management
- [useDashboardPalette Composable](../../composables/useDashboardPalette.md) — Color palette
- [useChartSeries Composable](../../composables/useChartSeries.md) — Data transforms
- [Monitors History API](../../../api/monitors-history.md) — Data source
- [Index Page](../pages/index.md) — Primary consumer
