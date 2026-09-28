# Utility: quality-bands

**File:** `app/utils/quality-bands.ts`
**Feature:** M2-T4 (Monitor detail view)

## Purpose

Maps `QualityState` values to RGBA background colors for chart overlays and converts `QualityIntervalRecord[]` (from the history API) into uPlot-compatible band configurations. Used to render colored background regions on latency charts showing quality state changes over time.

## API

### `getQualityBandPaths(intervals: QualityIntervalRecord[]): { start: number; end: number; color: string }[]`

Converts quality intervals from the API response into uPlot band objects.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `intervals` | `QualityIntervalRecord[]` | Quality intervals from the history API |

**Returns:** Array of band objects:

```typescript
{
  start: number;  // Start timestamp in seconds
  end: number;    // End timestamp in seconds (or current time if endMs is null)
  color: string;  // RGBA background color
}
```

**Example:**

```typescript
import { getQualityBandPaths } from "~/utils/quality-bands";

const qualityBands = computed(() => {
  const intervals = historyData.value?.series[0]?.intervals ?? [];
  return getQualityBandPaths(intervals);
});
```

### `getQualityStateAt(intervals: QualityIntervalRecord[], timestampMs: number): QualityState | null`

Looks up the quality state at a given timestamp.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `intervals` | `QualityIntervalRecord[]` | Quality intervals |
| `timestampMs` | `number` | Timestamp in epoch ms |

**Returns:** `QualityState \| null` — The quality state at that timestamp, or `null` if no interval covers it.

**Example:**

```typescript
import { getQualityStateAt } from "~/utils/quality-bands";

const state = getQualityStateAt(intervals, Date.now());
```

## Color Mapping

| Quality State | Color | Description |
|---------------|-------|-------------|
| `veryHigh` | `rgba(34, 197, 94, 0.12)` | Green — excellent quality |
| `high` | `rgba(132, 204, 22, 0.12)` | Lime — good quality |
| `medium` | `rgba(234, 179, 8, 0.12)` | Yellow — moderate quality |
| `low` | `rgba(249, 115, 22, 0.15)` | Orange — poor quality |
| `unstable` | `rgba(239, 68, 68, 0.18)` | Red — unstable/high jitter |
| `disconnected` | `rgba(107, 114, 128, 0.20)` | Gray — no recent data |
| `warmingUp` | `rgba(156, 163, 175, 0.10)` | Light gray — insufficient data |

The alpha values (0.10–0.20) are deliberately low to provide background color without obscuring the data lines.

## Timestamp Handling

- `getQualityBandPaths` converts timestamps from milliseconds to seconds (divides by 1000) — uPlot's time scale uses seconds
- Open-ended intervals (where `endMs` is `null`) use `Date.now() / 1000` as the end timestamp — so they extend to the present moment

## Edge Cases

- **Empty intervals:** Returns an empty array — no bands rendered on the chart.
- **Unknown quality state:** Falls back to `warmingUp` color — no crash, just a sensible default.
- **Intervals with no endMs:** Treated as extending to the present (the `Date.now()` snapshot at call time).
- **Overlapping intervals:** The utility does not merge overlapping intervals — each interval from the API is rendered as a separate band. The chart's `drawClear` hook paints them in order, so later intervals visually overlap earlier ones.

## Related

- [LatencyChart Component](../components/charts/LatencyChart.md) — Consumes band paths for rendering
- [Shared Types](../../shared/types.md) — `QualityIntervalRecord`, `QualityState` types
- [Quality Classifier](../../utils/quality-classifier.md) — Backend quality state computation
- [Monitor Detail Page](../pages/monitors-id.md) — Primary integration point
