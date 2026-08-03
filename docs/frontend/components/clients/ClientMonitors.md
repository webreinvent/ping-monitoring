# Component: ClientMonitors

**File:** `app/components/clients/ClientMonitors.vue`
**Feature:** M2-T6 (Client overview page)

## Purpose

List component that renders all monitors for a specific client. Delegates rendering to `MonitorRow` for each monitor. Shows an `EmptyState` when no monitors exist.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `monitors` | `MonitorListItem[]` | Yes | Array of monitors belonging to this client |

## Events

None.

## Slots

None.

## Usage

```vue
<template>
  <ClientMonitors :monitors="clientMonitors" />
</template>

<script setup lang="ts">
import type { MonitorListItem } from "#shared/types";

const { monitors } = useMonitors();
const clientMonitors = computed(() =>
  monitors.value.filter((m) => m.clientSlug === slug.value)
);
</script>
```

## Rendering

- Each monitor is rendered as a `MonitorRow` component
- When `monitors.length === 0`, an `EmptyState` is shown with the message "No monitors for this client"
- Monitor order matches the order of the `monitors` array (typically from API, sorted by last seen)

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="client-monitors-list"` | `.client-monitors-list` | E2E test selector |

## Edge Cases

- **Empty array:** Renders `EmptyState` with no error.
- **Single monitor:** Renders one `MonitorRow` — no special handling needed.
- **Monitor props mismatch:** `MonitorRow` expects a `MonitorListItem` — the `monitors` prop from `useMonitors()` already provides the correct shape.

## Related

- [Client Overview Page](../pages/clients-slug.md) — Primary consumer
- [MonitorRow Component](../sidebars/MonitorRow.md) — Per-monitor rendering
- [EmptyState Component](../shared/EmptyState.md) — Empty state fallback
- [useMonitors Composable](../../composables/useMonitors.md) — Data source
- [Shared Types](../../../shared/types.md) — `MonitorListItem` type
