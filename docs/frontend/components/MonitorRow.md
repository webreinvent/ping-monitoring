# Component: MonitorRow

**File:** `app/components/sidebars/MonitorRow.vue`
**Feature:** M2-T2 (Monitors list composable and sidebar components)

## Purpose

Single clickable row in the sidebar representing a monitor. Displays a visibility toggle button, quality state dot, target name, host, and latest latency. Renders as a `<NuxtLink>` to the monitor detail page. Supports dimmed state for hidden monitors.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `monitor` | `MonitorListItem` | Yes | — | The monitor data from the API |
| `visible` | `boolean` | No | `true` | Whether this monitor is visible in the chart |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `toggle` | — (no payload) | Emitted when the visibility toggle button is clicked |

## Slots

None.

## Usage

```vue
<template>
  <MonitorRow
    v-for="monitor in monitors"
    :key="monitor.id"
    :monitor="monitor"
    :visible="isVisible(monitor.id)"
    @toggle="handleToggle(monitor.id)"
  />
</template>
```

## Structure

```
MonitorRow (.monitor-row-wrapper)
└── NuxtLink (.monitor-row) to /monitors/:id
    ├── .monitor-toggle (visibility toggle button)
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

- **Layout:** CSS grid with 4 columns: `16px 12px minmax(0, 1fr) auto`
- **Min height:** 54px for touch-friendly tap targets
- **Hover state:** Subtle border + background
- **Focus state:** 2px accent-colored outline for keyboard navigation (`:focus-visible`)
- **Text truncation:** `targetName` and `targetHost` truncate with ellipsis via CSS
- **Latency:** Monospace font, right-aligned, only shown when `latencyMs != null`
- **Dimmed state:** When `visible` is `false`, the wrapper gets a `.dimmed` class with `opacity: 0.35`
- **Toggle button:** Small checkbox-like button (`.monitor-toggle`) — visually checked when monitor is visible

## Visibility Toggle

- **Button:** A small checkbox-like button (`.monitor-toggle`) at the start of each row
- **Behavior:** Clicking toggles the monitor's visibility in the all-monitors chart
- **Event flow:** Emits `toggle` event → `ClientGroup` re-emits with monitor ID → `SidebarContent` calls `toggleMonitor()`
- **Accessibility:** Uses `aria-label` ("Show in chart" / "Hide in chart") and `aria-pressed` attribute
- **Click isolation:** Toggle button uses `@click.stop` to prevent navigation when clicking the toggle

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="monitor-row-wrapper"` | `.monitor-row-wrapper` | E2E test selector for wrapper |
| `data-testid="monitor-row"` | `.monitor-row` (NuxtLink) | E2E test selector for row |

## Edge Cases

- **Monitor with no latency:** Latency column is not rendered (`v-if="monitor.latencyMs != null"`). The row still shows the quality dot and target info.
- **Long target names:** Truncated with ellipsis (CSS `text-overflow: ellipsis` + `white-space: nowrap`)
- **Very long host IPs:** Also truncated — same CSS treatment
- **Toggle click vs row click:** Toggle button uses `@click.stop` so it doesn't navigate; clicking the rest of the row navigates to `/monitors/:id`
- **Hidden monitor navigation:** Dimmed monitors are still clickable — clicking navigates to the detail page even when hidden from chart

## Related

- [StatusDot](./StatusDot.md) — Quality state indicator within each row
- [ClientGroup](./ClientGroup.md) — Parent component
- [DashboardSidebar](./DashboardSidebar.md) — Ancestor component
- [Monitors [id] Page](../pages/monitors-id.md) — Destination page
- [Shared Types](../../shared/types.md) — `MonitorListItem` type
