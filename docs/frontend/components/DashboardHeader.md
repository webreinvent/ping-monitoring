# Component: DashboardHeader

**File:** `app/components/layout/DashboardHeader.vue`
**Feature:** M2-T1 (Dashboard shell)

## Purpose

Top header bar of the dashboard displaying the brand mark, navigation hamburger (mobile), and connection status indicator. Provides the visual anchor for the dashboard shell.

## Props

None.

## Events

None.

## Slots

None.

## Usage

```vue
<!-- Used inside default layout — no direct usage needed -->
<DashboardHeader />
```

## Structure

```
DashboardHeader (.dashboard-header)
├── .brand-block
│   ├── .hamburger-btn (mobile only) → calls toggle()
│   ├── .brand-mark (LNPM clock icon)
│   └── Text: "LNPM" + "Cloud Dashboard"
└── .connection-status
    ├── .connection-dot (pulsing green dot when connected)
    └── "Live" label
```

## Visual Elements

### Brand Mark

- SVG clock icon inside a bordered square (34×34px)
- Accent-colored border and background with subtle transparency
- Matches LNPM desktop app branding

### Connection Status

- Shows a dot + "Live" label on the right side
- Dot color:
  - **Gray (default):** Not connected yet (no WebSocket)
  - **Green with glow:** Connected (`.connected` class, to be activated by WebSocket state in M2-T2)
- The `.connected` class is CSS-ready but not yet bound to WebSocket state — placeholder for future integration

### Hamburger Button

- Only visible on mobile (`display: none` on desktop, `display: grid` at `max-width: 980px`)
- 3-line icon inside bordered square (34×34px)
- Hover state: light background + brighter text
- Calls `toggle()` from `useResponsiveSidebar()` on click

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="dashboard-header"` | `.dashboard-header` | E2E test selector |

## Accessibility

- Hamburger button: `aria-label="Toggle sidebar"`
- Brand text: `<h1>` element for document heading hierarchy

## Related

- [useResponsiveSidebar](../composables/useResponsiveSidebar.md) — Provides `toggle()` function
- [Default Layout](../layout/default.md) — Consumer
- [CSS Design System](../css-design.md) — Header styling, `.hamburger-btn` mobile visibility
