# Component: MonitorSummary

**File:** `app/components/charts/MonitorSummary.vue`
**Feature:** M2-T4 (Monitor detail view)

## Purpose

Grid of 9 metric cards displaying aggregate statistics for the current time window. Rendered below the chart in the monitor detail view, sourced from the `RangeSummary` returned by the history API.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `summary` | `RangeSummary` | Yes | Aggregate statistics from the history API |

## Events

None.

## Slots

None.

## Usage

```vue
<template>
  <MonitorSummary :summary="summary" />
</template>

<script setup lang="ts">
import type { RangeSummary } from "#shared/types";

const { data: history } = useMonitorHistory(monitorId, fromMs, toMs, 2000);
const summary = computed<RangeSummary>(() =>
  history.value?.series[0]?.summary ?? { /* default */ }
);
</script>
```

## Metrics Displayed

| Card | Source Field | Color Logic |
|------|-------------|-------------|
| **Packet Loss** | `packetLossPercent` | Green (0%), Orange (≤5%), Red (>5%) |
| **Avg Latency** | `averageLatencyMs` | No color |
| **Min Latency** | `minimumLatencyMs` | No color |
| **Max Latency** | `maximumLatencyMs` | Red if > 300ms |
| **P95 Latency** | `p95LatencyMs` | Green (<150ms), Orange (<300ms), Red (≥300ms) |
| **Samples** | `sampleCount` | No color |
| **Stable** | `stablePercent` | Green (accent) |
| **Unstable** | `unstablePercent` | Orange if > 0% |
| **Disconnected** | `disconnectedPercent` | Red if > 0% |

Null values (e.g., `averageLatencyMs` is `null`) are displayed as "—".

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="monitor-summary"` | `.monitor-summary` | E2E test selector |

## Edge Cases

- **All null values:** Displays "—" for all nullable fields. `sampleCount` defaults to 0, percentages default to 0%.
- **No samples:** The `RangeSummary` from the API contains all-zero/default values. The component renders correctly with zero values.

## Related

- [Monitor Detail Page](../pages/monitors-id.md) — Primary consumer
- [Shared Types](../../../shared/types.md) — `RangeSummary` type definition
- [Monitors History API](../../../api/monitors-history.md) — Data source for `RangeSummary`
