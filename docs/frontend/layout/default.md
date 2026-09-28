# Layout: Default

**File:** `app/layouts/default.vue`
**Feature:** M2-T1 (Dashboard shell)

## Purpose

The primary layout shell for the dashboard, providing the three-panel grid structure: header at top, then sidebar + resizer + main content. All dashboard pages render within this layout.

## Structure

```
default.vue (.dashboard-shell)
├── DashboardHeader (top bar with brand, hamburger, connection status)
└── .workspace (CSS grid)
    ├── DashboardSidebar (monitor list, client groups)
    ├── .sidebar-resizer (desktop only, 1px drag handle)
    └── .main-content
        └── <slot> → NuxtPage (the route page content)
```

## Grid Layout

The `.workspace` uses CSS Grid with three columns:

```css
grid-template-columns: var(--sidebar-width) 1px minmax(0, 1fr);
/*              →  320px       1px     flexible    */
```

- **Sidebar:** Fixed 320px width
- **Resizer:** 1px divider (future: draggable sidebar resize)
- **Main content:** Flexible, fills remaining space (`minmax(0, 1fr)` prevents grid overflow)

## Responsive Behavior

On mobile (≤980px), the CSS media query changes:

```css
@media (max-width: 980px) {
  .workspace {
    grid-template-columns: 1fr;  /* Single column — sidebar hidden */
  }
  .sidebar-panel { display: none; }
  .sidebar-resizer { display: none; }
  .hamburger-btn { display: grid; }  /* Show hamburger */
}
```

The sidebar becomes a fixed overlay (managed by `DashboardSidebar` component), and the main content takes full width.

## Usage

This is the default layout — all pages render within it automatically unless explicitly overridden.

```vue
<!-- Nuxt automatically uses this layout -->
<!-- To override: definePageMeta({ layout: "custom" }) -->
```

## Composables Used

| Composable | Purpose |
|------------|---------|
| `useResponsiveSidebar()` | Provides `isMobile` to conditionally render the sidebar resizer |

## Edge Cases

- **Layout override:** Pages can override this layout with `definePageMeta({ layout: "custom" })`. Currently no custom layouts exist.
- **Main content overflow:** The `.main-content` div has `overflow: auto` and `min-width: 0` to handle wide content (like charts) without breaking the grid.

## Related

- [DashboardHeader](../components/DashboardHeader.md) — Header component
- [DashboardSidebar](../components/DashboardSidebar.md) — Sidebar component
- [useResponsiveSidebar](../composables/useResponsiveSidebar.md) — Mobile detection
- [CSS Design System](../css-design.md) — Grid, sidebar, and main content styling
