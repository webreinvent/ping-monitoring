# Component: DashboardSidebar

**File:** `app/components/DashboardSidebar.vue`
**Feature:** M2-T1 (Dashboard shell)

## Purpose

The main sidebar component that displays the monitor list grouped by client. Renders differently on desktop (persistent) and mobile (fixed overlay with backdrop). Shows an "All Monitors" row at the top followed by collapsible client groups.

## Props

None. Fetches data internally via `useMonitors()` and manages responsive state via `useResponsiveSidebar()`.

## Events

None. Navigation is handled via Nuxt's `navigateTo()` for the "All Monitors" row; individual monitors use `<NuxtLink>`.

## Slots

None.

## Internal Behavior

- Fetches monitors via `useMonitors()` — groups them by client
- Determines active monitor from the current route (`/monitors/:id`)
- Renders two layouts:
  - **Desktop:** Persistent sidebar panel with `v-show="!isMobile"`
  - **Mobile:** Fixed overlay sidebar with `v-if="isMobile"` and `:class="{ open: isOpen }"`

## Usage

```vue
<!-- Used inside default layout — no direct usage needed -->
<DashboardSidebar />
```

The component is consumed by the `default` layout and should not be manually instantiated in pages.

## Structure

```
DashboardSidebar
├── All Monitors Row (links to `/`, highlights when on `/`)
│   ├── Grid icon (4 squares)
│   ├── "All Monitors" label
│   └── Monitor count badge
├── ClientGroup ×N (from groupedByClient)
│   └── MonitorRow ×N
└── EmptyState (when no monitors)
```

## Mobile Overlay

On mobile, the sidebar renders as a fixed overlay:

- **Backdrop:** `.sidebar-overlay` with semi-transparent dark background + blur
- **Sidebar:** `.sidebar-mobile` with `transform: translateX(-100%)` (hidden) → `translateX(0)` (open)
- **Close button:** × button in the top-right corner
- Clicking the backdrop or close button calls `close()` from `useResponsiveSidebar()`

## Active State

The selected monitor is determined by matching the current route:

```typescript
const route = useRoute();
const selectedMonitorId = computed(() => {
  const match = route.path.match(/^\/monitors\/(\d+)$/);
  return match ? Number(match[1]) : null;
});
```

- When on `/` (All Monitors), the "All Monitors" row gets the `selected` class
- When on `/monitors/:id`, the matching `MonitorRow` gets the `selected` class

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="dashboard-sidebar"` | Sidebar panels | E2E test selector |

## Related

- [ClientGroup](./ClientGroup.md) — Renders client groups within sidebar
- [MonitorRow](./MonitorRow.md) — Renders individual monitor rows
- [EmptyState](./EmptyState.md) — Shown when no monitors exist
- [useMonitors](../composables/useMonitors.md) — Data source
- [useResponsiveSidebar](../composables/useResponsiveSidebar.md) — Mobile state management
- [Default Layout](../layout/default.md) — Consumer
