# Component: DashboardSidebar

**File:** `app/components/DashboardSidebar.vue`
**Feature:** M2-T2 (Monitors list composable and sidebar components)

## Purpose

Responsive sidebar wrapper that renders the sidebar content differently on desktop (persistent) and mobile (fixed overlay with backdrop). Delegates content rendering to `SidebarContent` to avoid duplication between desktop and mobile layouts.

## Props

None.

## Events

None.

## Slots

None.

## Usage

```vue
<!-- Used inside the default layout — no direct usage needed -->
<DashboardSidebar />
```

The component is consumed by the `default` layout and should not be manually instantiated in pages.

## Internal Behavior

- Uses `useResponsiveSidebar()` for mobile detection and sidebar open/close state
- Delegates content rendering to `<SidebarContent />` — the same component is used in both desktop and mobile layouts
- Renders two layouts:
  - **Desktop:** Persistent sidebar panel with `v-show="!isMobile"`
  - **Mobile:** Fixed overlay sidebar with `v-if="isMobile"` and `:class="{ open: isOpen }"`

## Structure

```
DashboardSidebar
├── Mobile overlay (.sidebar-overlay) — visible when isMobile && isOpen
├── Desktop sidebar (.sidebar-panel) — v-show="!isMobile"
│   └── SidebarContent
└── Mobile sidebar (.sidebar-mobile) — v-if="isMobile", transforms on isOpen
    ├── Close button (×)
    └── SidebarContent (in .sidebar-panel with padding-top: 48px)
```

## Mobile Overlay

On mobile, the sidebar renders as a fixed overlay:

- **Backdrop:** `.sidebar-overlay` with semi-transparent dark background + blur
- **Sidebar:** `.sidebar-mobile` with `transform: translateX(-100%)` (hidden) → `translateX(0)` (open)
- **Close button:** × button in the top-right corner
- Clicking the backdrop or close button calls `close()` from `useResponsiveSidebar()`

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="dashboard-sidebar"` | Both `.sidebar-panel` and `.sidebar-mobile` | E2E test selector |

## Related

- [SidebarContent](./shared/SidebarContent.md) — Shared sidebar content component
- [ClientGroup](./ClientGroup.md) — Renders client groups within sidebar content
- [MonitorRow](./MonitorRow.md) — Renders individual monitor rows
- [EmptyState](./EmptyState.md) — Shown when no monitors exist
- [useResponsiveSidebar](../composables/useResponsiveSidebar.md) — Mobile state management
- [Default Layout](../layout/default.md) — Consumer
