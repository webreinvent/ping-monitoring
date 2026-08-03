# Component: LatencyChart

**File:** `app/components/charts/LatencyChart.vue`
**Feature:** M2-T3 (All-monitors chart), M2-T4 (Monitor detail view)

## Purpose

Core chart component that wraps uPlot for rendering latency data over time. Supports quality interval bands (colored background regions), threshold lines, and automatic resizing via `ResizeObserver`. Used by both the All-Monitors overview chart and the per-monitor detail view.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `data` | `Float64Array[]` | Yes | — | uPlot data columns. Column 0 is timestamps (seconds), column 1+ are values (latency in ms) |
| `seriesConfig` | `uPlot.Series[]` | No | `[]` | uPlot series configuration (index 0 is always time). Does NOT include the time series — that is added internally |
| `height` | `number` | No | `300` | Chart height in pixels |
| `qualityBands` | `QualityBand[]` | No | `[]` | Background regions showing quality state intervals |
| `thresholdValue` | `number \| null` | No | `null` | Horizontal threshold line Y value in ms |

### QualityBand Interface

```typescript
interface QualityBand {
  start: number;  // Start timestamp in seconds
  end: number;    // End timestamp in seconds
  color: string;  // Background color (CSS rgba)
}
```

## Events

None.

## Slots

None.

## Exposed

| Name | Type | Description |
|------|------|-------------|
| `chart` | `uPlot \| null` | The uPlot instance (for programmatic access) |
| `updateChart()` | `() => void` | Update the chart data without re-creating the instance |

## Usage

### Single Monitor Chart (Detail View)

```vue
<template>
  <LatencyChart
    :data="chartData"
    :series-config="[{ label: 'Google DNS', stroke: '#3b82f6', width: 1.5, points: { show: false } }]"
    :quality-bands="qualityBands"
    :threshold-value="100"
    :height="320"
  />
</template>

<script setup lang="ts">
import { transformToUPlotData } from "~/composables/useChartSeries";
import { getQualityBandPaths } from "~/utils/quality-bands";

const { data: history } = useMonitorHistory(monitorId, fromMs, toMs, 2000);
const chartData = computed(() => transformToUPlotData(history.value));
const qualityBands = computed(() => getQualityBandPaths(history.value?.series[0]?.intervals ?? []));
</script>
```

### Multi-Series Chart (All Monitors)

```vue
<template>
  <LatencyChart
    :data="mergedData"
    :series-config="seriesConfig"
    :height="320"
  />
</template>

<script setup lang="ts">
import { getPaletteColor } from "~/composables/useDashboardPalette";

const seriesConfig = computed(() => monitors.value.map((m, i) => ({
  label: m.targetName,
  stroke: getPaletteColor(i),
  width: 1.5,
  points: { show: false },
})));
</script>
```

## Chart Configuration

The chart uses these uPlot options:

- **Title:** "Latency"
- **X-axis:** Time scale, no tick values (clean axis)
- **Y-axis:** Auto-scaled latency in ms, 50px width on left side
- **Cursor:** Crosshair with draggable zoom (`setScale: true`)
- **Points:** 4px radius, teal stroke/fill with low opacity

### Quality Bands

Quality bands are drawn on the `drawClear` hook before any data series. Each band:
- Is clipped to the visible chart area (`bbox`)
- Uses `fillRect` to paint a semi-transparent background
- Uses `toLeft(scale, timestamp)` to convert data coordinates to pixel coordinates

### Threshold Line

When `thresholdValue` is set, a dashed red horizontal line is drawn at that Y value:
- Stroke: `rgba(239, 68, 68, 0.6)`, dashed `[8, 4]`
- Clipped to the chart bounding box
- Drawn on `drawClear` hook (so it renders behind data)

## Lifecycle

- **`onMounted` (after `nextTick`):** Initializes uPlot instance and sets up `ResizeObserver`
- **`onBeforeUnmount`:** Disconnects `ResizeObserver` and destroys uPlot instance
- **ResizeObserver:** Re-measures wrapper width and calls `chart.setSize()` on change

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="all-monitors-chart"` | `.chart-container` (parent) | E2E test selector for all-monitors chart |

## Edge Cases

- **Empty data:** uPlot renders with an empty Float64Array. The parent component should handle showing an `EmptyState` before mounting the chart.
- **Zero-width wrapper:** If `wrapperRef.clientWidth === 0` (e.g., hidden element), `initChart` skips initialization. The `ResizeObserver` will retry on next layout change.
- **NaN values:** Missing latency data is represented as `NaN` in the Float64Array — uPlot handles this by breaking the line at that point (spanGaps behavior).
- **Quality bands outside visible range:** Bands that don't overlap the current viewport are skipped (`x0 >= bbox.width || x1 < 0`).
- **Threshold outside Y range:** If the threshold value is outside the current Y scale, the line is not drawn but doesn't cause errors.

## Related

- [AllMonitorsChart](./AllMonitorsChart.md) — Uses `LatencyChart` for multi-series display
- [useChartSeries Composable](../../composables/useChartSeries.md) — Transforms `HistoryResponse` to uPlot data
- [quality-bands Utility](../../utils/quality-bands.md) — Generates quality band paths from `QualityIntervalRecord[]`
- [useDashboardPalette Composable](../../composables/useDashboardPalette.md) — Color palette for multi-series charts
- [Shared Types](../../../shared/types.md) — `HistoryResponse`, `HistoryPoint`, `QualityIntervalRecord`
- [charts.css](../../css-design.md) — Chart-specific CSS styles
