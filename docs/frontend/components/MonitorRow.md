# Component: MonitorRow

**File:** `app/components/sidebars/MonitorRow.vue`
**Feature:** M2-T1 (Dashboard shell)

## Purpose

Single clickable row in the sidebar representing a monitor. Displays quality state dot, target name, host, and latest latency. Renders as a `<NuxtLink>` to the monitor detail page.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `monitor` | `MonitorListItem` | Yes | The monitor data from the API |

## Events

None.

## Slots

None.

## Usage

```vue
<template>
  <MonitorRow v-for="monitor in monitors" :key="monitor.id" :monitor="monitor" />
</template>
```

## Structure

```
MonitorRow (.monitor-row) — NuxtLink to /monitors/:id
├── StatusDot (quality state color indicator)
├── .target-copy
│   ├── strong: targetName (e.g., "Google DNS")
│   └── small: targetHost (e.g., "8.8.8.8")
└── .target-latency: "14 ms" (only shown if latencyMs != null)
```

## Active State

The row highlights when the current route matches the monitor's detail page:

```typescript
const route = useRoute();
const selected = computed(() => route.path.startsWith(`/monitors/${props.monitor.id}`));
```

The `selected` CSS class applies:
- Accent-colored border
- Gradient background (accent → transparent, left to right)

## Visual Styling

- **Layout:** CSS grid with 3 columns: `12px minmax(0, 1fr) auto`
- **Min height:** 54px for touch-friendly tap targets
- **Hover state:** Subtle border + background
- **Focus state:** 2px accent-colored outline for keyboard navigation (`:focus-visible`)
- **Text truncation:** `targetName` and `targetHost` truncate with ellipsis via CSS
- **Latency:** Monospace font, right-aligned, only shown when `latencyMs != null`

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="monitor-row"` | `.monitor-row` | E2E test selector |

## Edge Cases

- **Monitor with no latency:** Latency column is not rendered (`v-if="monitor.latencyMs != null"`). The row still shows the quality dot and target info.
- **Long target names:** Truncated with ellipsis (CSS `text-overflow: ellipsis` + `white-space: nowrap`)
- **Very long host IPs:** Also truncated — same CSS treatment

## Related

- [StatusDot](./StatusDot.md) — Quality state indicator within each row
- [ClientGroup](./ClientGroup.md) — Parent component
- [DashboardSidebar](./DashboardSidebar.md) — Ancestor component
- [Monitors [id] Page](../pages/monitors-id.md) — Destination page
- [Shared Types](../../shared/types.md) — `MonitorListItem` type
