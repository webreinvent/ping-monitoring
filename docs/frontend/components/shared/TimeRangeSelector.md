# Component: TimeRangeSelector

**File:** `app/components/shared/TimeRangeSelector.vue`
**Feature:** M2-T3 (All-monitors chart), M2-T4 (Monitor detail view)

## Purpose

A button-group component for selecting a time window preset. Uses Vue's `v-model` pattern to integrate with `useTimeWindow()` or any reactive state. Used on both the All-Monitors overview page and the monitor detail page.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `modelValue` | `string` | Yes | — | Currently selected time preset |
| `presets` | `string[]` | No | `["1h", "6h", "24h", "7d"]` | List of available time window presets |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `update:modelValue` | `string` | Emitted when the user selects a different preset |

## Slots

None.

## Usage

```vue
<template>
  <TimeRangeSelector v-model="timeWindow" />
</template>

<script setup lang="ts">
const { selectedPreset: timeWindow } = useTimeWindow();
</script>
```

### Custom Presets

```vue
<template>
  <TimeRangeSelector v-model="timeWindow" :presets="['6h', '12h', '24h', '48h']" />
</template>
```

## Time Window Presets

| Preset | Duration | Milliseconds |
|--------|----------|--------------|
| `1h` | 1 hour | 3,600,000 |
| `6h` | 6 hours | 21,600,000 |
| `24h` | 24 hours | 86,400,000 |
| `7d` | 7 days | 604,800,000 |

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="time-range-selector"` | `.time-range-selector` | E2E test selector for container |
| `data-testid="time-range-{preset}"` | `.time-range-btn` | E2E test selector for individual buttons (e.g., `time-range-1h`) |

## Styling

- Button group layout using flexbox
- Active button is styled with `.active` class (highlighted background)
- Button layout and colors inherit from the dashboard CSS token system

## Edge Cases

- **Empty presets array:** Renders no buttons — the parent should provide at least one preset.
- **Model value not in presets:** No button is highlighted. The parent should ensure the model value is always one of the available presets.
- **Rapid clicks:** Each click emits `update:modelValue` — the composable's `watch` handles debouncing via reactive updates.

## Related

- [useTimeWindow Composable](../composables/useTimeWindow.md) — Time window state management (persists to localStorage)
- [Index Page](../pages/index.md) — All-Monitors overview with time range selector
- [Monitor Detail Page](../pages/monitors-id.md) — Per-monitor view with time range selector
