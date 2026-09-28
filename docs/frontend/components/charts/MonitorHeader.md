# Component: MonitorHeader

**File:** `app/components/charts/MonitorHeader.vue`
**Feature:** M2-T4 (Monitor detail view)

## Purpose

Header bar displayed at the top of a monitor detail view. Shows the target name, host, quality state (with `StatusDot`), latest latency with color coding, and relative "last seen" time.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `targetName` | `string` | Yes | Human-readable target name |
| `targetHost` | `string` | Yes | Target hostname or IP |
| `qualityState` | `QualityState` | Yes | Current quality state |
| `latestLatency` | `number \| null` | Yes | Latest latency in ms, or `null` |
| `lastSeenMs` | `number \| null` | Yes | Epoch ms of last sample, or `null` |

## Events

None.

## Slots

None.

## Usage

```vue
<template>
  <MonitorHeader
    :target-name="targetName"
    :target-host="targetHost"
    :quality-state="qualityState"
    :latest-latency="latestLatency"
    :last-seen-ms="lastSeenMs"
  />
</template>
```

## Computed Values

### Quality State Label

Maps `QualityState` to human-readable labels:

| Quality State | Label |
|---------------|-------|
| `veryHigh` | "Very High" |
| `high` | "High" |
| `medium` | "Medium" |
| `low` | "Low" |
| `unstable` | "Unstable" |
| `disconnected` | "Disconnected" |
| `warmingUp` | "Warming Up" |
| *unknown* | "Unknown" |

### Latest Latency Color

| Condition | CSS Class |
|-----------|-----------|
| `< 50ms` | `accent` (green/teal) |
| `< 150ms` | `warning` (orange/yellow) |
| `>= 150ms` | `danger` (red) |
| `null` | *(no class)* |

### Last Seen Relative Time

| Time Since Last Sample | Display |
|------------------------|---------|
| `< 60s` | "Xs ago" |
| `< 60m` | "Xm ago" |
| `>= 60m` | "Xh ago" |
| `null` | "—" |

## Edge Cases

- **No latency data:** `latestLatency` is `null` — the "LATEST" meta-item is not rendered.
- **Never seen:** `lastSeenMs` is `null` — displays "—" for "LAST SEEN".
- **Unknown quality state:** Falls back to "Unknown" label.

## Related

- [Monitor Detail Page](../pages/monitors-id.md) — Primary consumer
- [StatusDot Component](../shared/StatusDot.md) — Quality state indicator
- [Shared Types](../../../shared/types.md) — `QualityState` type
