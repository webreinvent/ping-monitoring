# Composable: useTimeWindow

**File:** `app/composables/useTimeWindow.ts`
**Feature:** M2-T3 (All-monitors chart), M2-T4 (Monitor detail view)

## Purpose

Manages the selected time window preset for chart queries. Persists the selection to `localStorage` so it survives page navigation and browser refresh. Provides reactive `fromMs` and `toMs` computed values derived from the selected preset.

## API

### `useTimeWindow()`

```typescript
import { useTimeWindow } from "~/composables/useTimeWindow";

const { selectedPreset, fromMs, toMs, selectPreset } = useTimeWindow();
```

No parameters.

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `selectedPreset` | `Ref<string>` | Currently selected preset (e.g., `"1h"`, `"24h"`) |
| `fromMs` | `ComputedRef<number>` | Epoch ms of the window start (`Date.now() - duration`) |
| `toMs` | `ComputedRef<number>` | Epoch ms of the window end (`Date.now()`) |
| `selectPreset(preset: string)` | `Function` | Change the time window preset |

## Time Window Presets

| Preset | Duration | Milliseconds |
|--------|----------|--------------|
| `"1h"` | 1 hour | 3,600,000 |
| `"6h"` | 6 hours | 21,600,000 |
| `"24h"` | 24 hours | 86,400,000 |
| `"7d"` | 7 days | 604,800,000 |

## localStorage Persistence

- **Key:** `lnpm-chart-time-window`
- **Value:** The preset string (e.g., `"1h"`)
- **Restored on init:** The composable reads from `localStorage` on initialization (client-side only)
- **Persisted on change:** A `watch` on `selectedPreset` writes the new value to `localStorage`
- **Validation:** Only values matching known presets are restored from `localStorage`
- **Graceful fallback:** If `localStorage` is unavailable (e.g., SSR, private browsing), the default `"1h"` is used silently

## Usage

### With TimeRangeSelector

```vue
<template>
  <TimeRangeSelector v-model="timeWindow" />
</template>

<script setup lang="ts">
const { selectedPreset: timeWindow } = useTimeWindow();
</script>
```

### As Query Parameters

```vue
<script setup lang="ts">
const { fromMs, toMs } = useTimeWindow();

const { data } = useAsyncData(
  `monitor-history-${monitorId}-${selectedPreset.value}`,
  async () => $fetch(`/api/monitors/${monitorId}`, {
    query: { fromMs: fromMs.value, toMs: toMs.value, maxPoints: 2000 },
  }),
);
</script>
```

## Reactive Behavior

- `fromMs` and `toMs` are computed from `Date.now()` — they are **live** and update continuously
- The `useAsyncData` key should use `selectedPreset.value` (not `fromMs.value`) to avoid constant re-fetching. When the preset changes, a re-fetch is triggered.
- `selectPreset(preset)` only accepts valid preset keys; invalid values are ignored.

## Edge Cases

- **SSR:** `useTimeWindow` is safe to call during SSR — it checks `typeof window !== "undefined"` before accessing `localStorage` or `Date.now()`.
- **localStorage disabled:** The composable gracefully falls back to `"1h"` default with no error.
- **Corrupt localStorage value:** Values not matching a known preset are ignored, and `"1h"` is used as default.

## Related

- [TimeRangeSelector Component](../components/shared/TimeRangeSelector.md) — UI for changing presets
- [useMonitorHistory Composable](./useMonitorHistory.md) — Consumes `fromMs`/`toMs` for queries
- [AllMonitorsChart Component](../components/charts/AllMonitorsChart.md) — Uses `fromMs`/`toMs` for data fetches
- [Monitor Detail Page](../pages/monitors-id.md) — Uses time window for chart data
