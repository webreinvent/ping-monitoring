# CSS Design System

**File:** `app/assets/css/dashboard.css`
**Feature:** M2-T1 (Dashboard shell)

## Purpose

Global stylesheet for the LNPM Cloud Dashboard. Provides CSS custom properties (design tokens), layout grid, component styles, and responsive breakpoints. Matches the LNPM desktop app's dark theme aesthetic.

## CSS Custom Properties (Design Tokens)

### Color Tokens

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg` | `#071016` | Page background (dark navy) |
| `--panel` | `#0b161e` | Panel/card backgrounds |
| `--panel-raised` | `#101e27` | Elevated panels |
| `--line` | `rgba(148, 176, 194, 0.14)` | Subtle borders/dividers |
| `--line-strong` | `rgba(148, 176, 194, 0.25)` | Visible borders |
| `--text` | `#e7eef5` | Primary text |
| `--muted` | `#8799a7` | Secondary/muted text |
| `--muted-strong` | `#a7b7c2` | Emphasized secondary text |
| `--accent` | `#45dfc2` | Primary accent (teal) |
| `--accent-bright` | `#72f3dc` | Bright accent (highlights) |
| `--accent-soft` | `rgba(69, 223, 194, 0.12)` | Accent background (badges) |
| `--danger` | `#ff6b78` | Error/disconnected color |
| `--danger-soft` | `rgba(255, 107, 120, 0.12)` | Danger background |
| `--warning` | `#f6a94a` | Warning color |
| `--warning-soft` | `rgba(246, 169, 74, 0.12)` | Warning background |
| `--blue` | `#60a5fa` | Info/secondary accent |

### Structural Tokens

| Variable | Value | Usage |
|----------|-------|-------|
| `--sidebar-width` | `320px` | Sidebar width |
| `--header-height` | `68px` | Header minimum height |
| `--radius` | `12px` | Default border radius |
| `--shadow` | `0 18px 55px rgba(0, 0, 0, 0.3)` | Drop shadow (modals, overlays) |

## Typography

- **Font family:** Inter (loaded from Google Fonts, weights 400, 500, 600, 650, 700)
- **Fallback stack:** `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **Font smoothing:** `-webkit-font-smoothing: antialiased` + `text-rendering: optimizeLegibility`

### Common Type Sizes

| Element | Size | Weight | Context |
|---------|------|--------|---------|
| `h1` (header brand) | 17px | 700 | DashboardHeader |
| `h2` (page heading) | 20px | 650 | Page titles |
| strong (monitor name) | 13px | 650 | MonitorRow |
| small (monitor host) | 11px | 400 | MonitorRow |
| breadcrumb | 12px | 600 | NavigationBreadcrumb |
| client label (eyebrow) | 10px | 700, letter-spacing 0.15em | ClientGroup |
| latency | 11px | 400, monospace | MonitorRow |
| connection status | 10px | 600 | DashboardHeader |

## Breakpoints

| Breakpoint | Value | Purpose |
|-----------|-------|---------|
| `980px` | `max-width: 980px` | Mobile layout — sidebar becomes overlay, hamburger appears |

This is the **only** responsive breakpoint in the dashboard. The design assumes:
- **> 980px:** Full desktop layout with sidebar
- **≤ 980px:** Mobile layout with overlay sidebar

## Layout Grid

### Workspace Grid

```css
.workspace {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-columns: var(--sidebar-width) 1px minmax(0, 1fr);
  /*               →  320px       1px     flexible       */
}
```

Mobile override:

```css
@media (max-width: 980px) {
  .workspace {
    grid-template-columns: 1fr;  /* Single column */
  }
}
```

### Monitor Row Grid

```css
.monitor-row {
  grid-template-columns: 12px minmax(0, 1fr) auto;
  /*             →  dot     flexible content   latency     */
}
```

### All Monitors Row Grid

```css
.all-monitors-row {
  grid-template-columns: 18px minmax(0, 1fr) auto;
  /*           →  icon    flexible content    count badge  */
}
```

## Component Styling Highlights

### Status Dot (`.status-dot`)

8×8px circle with state-specific colors and glow effects:

```css
.status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #6f808b;  /* Default gray */
  box-shadow: 0 0 0 3px rgba(111, 128, 139, 0.09);
}
.status-dot.state-veryHigh { background: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1), 0 0 8px rgba(239, 68, 68, 0.38); }
/* ... other states follow same pattern */
```

### Selected Row (`.monitor-row.selected`, `.all-monitors-row.selected`)

Accent-colored gradient background with accent border:

```css
.monitor-row.selected {
  border-color: rgba(69, 223, 194, 0.18);
  background: linear-gradient(90deg, rgba(69, 223, 194, 0.12), rgba(69, 223, 194, 0.025));
}
```

### Empty State Radar (`.empty-radar`)

72×72px animated radar with spinning sweep:

```css
@keyframes radar-spin {
  to { transform: rotate(360deg); }
}
.empty-radar::after {
  animation: radar-spin 2.8s linear infinite;
}
```

### Scrollbar Styling

Custom thin scrollbar (7px) for sidebar overflow:

```css
::-webkit-scrollbar { width: 7px; }
::-webkit-scrollbar-thumb {
  border-radius: 99px;
  background: rgba(148, 176, 194, 0.18);
}
```

## Accessibility

### Reduced Motion

The `prefers-reduced-motion: reduce` media query disables all animations and transitions:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Focus Styles

Interactive elements (`.monitor-row`) have visible focus outlines:

```css
.monitor-row:focus-visible {
  outline: 2px solid rgba(69, 223, 194, 0.55);
  outline-offset: -2px;
}
```

## Chart Placeholder

The `.chart-placeholder` class provides consistent styling for chart placeholder areas:

- **Min height:** 300px
- **Flex:** `1 0 300px` (grows to fill available space)
- **Background:** Subtle gradient + dark panel color
- **Border:** 1px solid `var(--line)` with `var(--radius)` border-radius
- **Text:** Centered, muted color, 12px font

## Related

- [Frontend Architecture](./architecture.md) — How CSS fits into the overall architecture
- [Default Layout](./layout/default.md) — Grid layout implementation
- [Cloud Dashboard Design](../../cloud-dashboard-design.md) — Original design specification
- [LNPM Desktop Styles](../../src/styles.css) — Desktop app CSS (reference for matching)
