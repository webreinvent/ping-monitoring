# Component: StatusDot

**File:** `app/components/shared/StatusDot.vue`
**Feature:** M2-T1 (Dashboard shell)

## Purpose

Small circular indicator that displays the quality state of a monitor via color. Used in monitor rows and any component that needs a quality state visual indicator.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `qualityState` | `QualityState \| null \| undefined` | No | The monitor's quality state |

## Events

None.

## Slots

None.

## Usage

```vue
<template>
  <StatusDot :quality-state="monitor.qualityState" />
</template>
```

## Color Mapping

| Quality State | CSS Class | Color | Description |
|---------------|-----------|-------|-------------|
| `low` | `state-low` | `--accent` (teal) + glow | Good latency, low packet loss |
| `medium` | `state-medium` | `--accent` (teal) + glow | Acceptable latency |
| `high` | `state-high` | `#f97316` (orange) + glow | Elevated latency |
| `veryHigh` | `state-veryHigh` | `#ef4444` (red) + glow | High latency, degraded |
| `unstable` | `state-unstable` | `#a855f7` (purple) + glow | High jitter/CV |
| `disconnected` | `state-disconnected` | `--danger` (pink-red) + glow | No recent samples |
| `warmingUp` | `state-warmingUp` | `--blue` (blue) + glow | Insufficient data |
| `null`/`undefined` | *(no class)* | `#6f808b` (gray) | Unknown or not set |

## Implementation

```typescript
const stateClass = computed(() => {
  const state = props.qualityState;
  if (!state) return "";
  return `state-${state}`;
});
```

The component applies a CSS class (`state-{qualityState}`) which is styled in `dashboard.css` with specific background colors and box-shadow glow effects.

## Visual Details

- **Size:** 8×8px circle
- **Glow:** 3px transparent ring + 8px colored glow via `box-shadow`
- **Flex-shrink:** 0 — never compresses in flex layouts

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="status-dot"` | `.status-dot` | E2E test selector |

## Edge Cases

- **No quality state:** Renders as gray dot with no glow. This is the default fallback for monitors with no classification data.
- **Unknown quality state value:** If the API returns a value not matching the `QualityState` type, CSS will not match any `state-*` class and the dot will remain gray. This is safe — no JS error, just a visual fallback.

## Related

- [MonitorRow](./MonitorRow.md) — Primary consumer
- [Quality States](../../utils/quality-states.md) — Backend quality state constants and colors
- [Shared Types](../../shared/types.md) — `QualityState` type definition
- [CSS Design System](../css-design.md) — `.status-dot` styling
