---
title: LNPM - Agent 04 - UI/UX Plan
---

# UI/UX Plan

## Design System

### CSS Custom Properties (from desktop `src/styles.css`, adapted for Vue 3)

The desktop app uses a **dark theme** with a rich set of CSS custom properties. These will be ported directly to the dashboard as global custom properties in a root-level stylesheet (`app/assets/css/global.css`), mirroring the desktop exactly:

| Token | Value | Purpose |
|-------|-------|---------|
| `--bg` | `#071016` | Page background |
| `--panel` | `#0b161e` | Panel backgrounds |
| `--panel-raised` | `#101e27` | Elevated panels |
| `--panel-soft` | `#0d1a22` | Subtle panels |
| `--line` | `rgba(148, 176, 194, 0.14)` | Divider lines |
| `--line-strong` | `rgba(148, 176, 194, 0.25)` | Stronger borders |
| `--text` | `#e7eef5` | Primary text |
| `--muted` | `#8799a7` | Muted text |
| `--muted-strong` | `#a7b7c2` | Muted but brighter |
| `--accent` | `#45dfc2` | Brand accent (teal) |
| `--accent-bright` | `#72f3dc` | Bright accent |
| `--accent-soft` | `rgba(69, 223, 194, 0.12)` | Accent background tint |
| `--blue` | `#60a5fa` | Info blue |
| `--warning` | `#f6a94a` | Warning orange |
| `--warning-soft` | `rgba(246, 169, 74, 0.12)` | Warning tint |
| `--danger` | `#ff6b78` | Danger red |
| `--danger-soft` | `rgba(255, 107, 120, 0.12)` | Danger tint |
| `--radius` | `12px` | Default border radius |
| `--shadow` | `0 18px 55px rgba(0, 0, 0, 0.3)` | Drop shadow |

**Quality state colors** (status dots, pills, chart thresholds):
- `low`: `#4ade80` (green)
- `medium`: `#facc15` (yellow)
- `high`: `#fb923c` (orange)
- `veryHigh`: `#f87171` (red)
- `unstable`: `#c084fc` (purple)
- `disconnected`: `#ff9aa3` (pink-red)
- `warmingUp`: `#60a5fa` (blue)
- `paused`: `#8799a7` (gray)

**Chart series palette** (from desktop `src/chart.ts`):
```
["#5eead4", "#60a5fa", "#c084fc", "#f472b6", "#facc15"]
```
Extended to 12 colors per F8 spec for multi-monitor scenarios.

**Typography** (Inter + CJK fallbacks):
```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", "Noto Sans CJK KR", "Noto Sans CJK JP", "Microsoft YaHei",
  "Microsoft JhengHei", sans-serif;
```

**Monospace font** (for latency values, paths):
```css
"Cascadia Code", "SFMono-Regular", Consolas, monospace;
```

### Font Sizes (desktop hierarchy)
- H1: `17px`, weight 700 (brand)
- H2: `20px`, weight 650 (dashboard heading)
- H3: `19px`, weight 650 (modal headers)
- H4: `11px`, weight 700 (section labels)
- Body: `13px` (target names, hostnames)
- Small: `11px` (latency values, timestamps)
- Tiny: `10px` (eyebrow labels, metric labels)
- Micro: `9px` (duration labels, popup text)

## Components to Create

Based on F8 feature spec and desktop UI analysis, the following Vue 3 components will be created:

### Layout Components

| Component | Path | Description |
|-----------|------|-------------|
| `AppShell` | `components/layout/AppShell.vue` | Top-level layout: header + workspace (sidebar + dashboard panel). Mirrors desktop `.app-shell` structure. |
| `AppHeader` | `components/layout/AppHeader.vue` | Brand block + header actions (Live, Pause/Resume, Settings). Matches desktop `.app-header`. |
| `DashboardPanel` | `components/layout/DashboardPanel.vue` | Right-side main content area. Contains chart + metrics. Matches desktop `.dashboard-panel`. |

### Sidebar Components

| Component | Path | Description |
|-----------|------|-------------|
| `MonitorSidebar` | `components/sidebars/MonitorSidebar.vue` | Full sidebar with heading, target list, and empty state. Matches desktop `.target-sidebar`. |
| `ClientGroup` | `components/sidebars/ClientGroup.vue` | Collapsible client group section. Shows client name (slug-derived), count badge, and nested monitor rows. **New for cloud dashboard** — not in desktop app. |
| `MonitorRow` | `components/sidebars/MonitorRow.vue` | Single monitor row with status dot, name, host, latest latency, and toggle. Matches desktop `.target-row`. |
| `AllMonitorsRow` | `components/sidebars/AllMonitorsRow.vue` | "All monitors" row (combined view entry). Matches desktop `.all-target-row`. |
| `SidebarResizer` | `components/sidebars/SidebarResizer.vue` | Draggable sidebar width resizer. Matches desktop `.sidebar-resizer`. |

### Chart Components

| Component | Path | Description |
|-----------|------|-------------|
| `LatencyChart` | `components/charts/LatencyChart.vue` | Vue 3 wrapper around `uPlot`. Wraps the existing chart logic from `src/chart.ts`. Handles `onMounted`/`onUnmounted` lifecycle. |
| `ChartCard` | `components/charts/ChartCard.vue` | Container for chart + loading state + legend. Matches desktop `.chart-card`. |
| `ChartLegend` | `components/charts/ChartLegend.vue` | Series legend with toggle buttons. Matches desktop `.chart-legend`. |
| `ChartTooltip` | `components/charts/ChartTooltip.vue` | Positioned tooltip overlay. Mirrors desktop `.chart-tooltip` behavior. |

### Metric Components

| Component | Path | Description |
|-----------|------|-------------|
| `SummaryGrid` | `components/metrics/SummaryGrid.vue` | 5-column metric cards grid. Matches desktop `.summary-grid`. |
| `MetricCard` | `components/metrics/MetricCard.vue` | Single metric card with label, value, and optional sub-value. Matches desktop `.metric-card`. |
| `StatePill` | `components/shared/StatePill.vue` | Quality state badge with colored dot. Matches desktop `.state-pill`. |

### Shared Components

| Component | Path | Description |
|-----------|------|-------------|
| `StatusDot` | `components/shared/StatusDot.vue` | Colored circular status indicator. Matches desktop `.status-dot`. |
| `TimeRangeSelector` | `components/shared/TimeRangeSelector.vue` | Range button group (Live, 5M, 10M, 30M, 1H, 6H, 12H, 24H, 7D, 30D, Custom). Matches desktop `.range-controls`. |
| `EmptyState` | `components/shared/EmptyState.vue` | Empty radar animation + message. Matches desktop `.empty-targets`. |
| `ToggleButton` | `components/shared/ToggleButton.vue` | On/off toggle switch. Matches desktop `.target-toggle`. |
| `ToastStack` | `components/shared/ToastStack.vue` | Toast notification stack. Matches desktop `.toast-stack`. |
| `IconButton` | `components/shared/IconButton.vue` | Icon-only button. Matches desktop `.button.icon-button`. |
| `Button` | `components/shared/Button.vue` | Generic button with variants (primary, ghost, danger-text). Matches desktop `.button`. |

### Modal Components

| Component | Path | Description |
|-----------|------|-------------|
| `ClientNameDialog` | `components/modals/ClientNameDialog.vue` | Edit client display name (F11). New for cloud dashboard. |
| `CustomRangeDialog` | `components/modals/CustomRangeDialog.vue` | Custom date range picker. Matches desktop `#range-dialog`. |
| `ModalBase` | `components/modals/ModalBase.vue` | Reusable modal wrapper with backdrop, close button, header/footer. |

### Reusable from Desktop (conceptual — logic ported, not file-imported)

| Desktop Source | Cloud Adaptation | Notes |
|---------------|-----------------|-------|
| `src/chart.ts` (`LatencyChart` class) | `components/charts/LatencyChart.vue` | Port uPlot initialization, data alignment, aggregation, threshold zones, interval drawing, tooltip logic. The DOM-manipulation patterns in the desktop code (`innerHTML`, event binding) become Vue template + reactivity. |
| `src/chart-tooltip.ts` | `components/charts/ChartTooltip.vue` | Position calculation + content rendering. |
| `src/i18n.ts` | `composables/useI18n.ts` | Port locale resolution, formatting utilities (`formatLatency`, `formatPercent`, `formatDuration`, `formatDateTime`, `formatBytes`, `formatError`). |
| `src/dashboard-selection.ts` | `composables/useDashboardSelection.ts` | `aggregateRangeSummary` + `aggregateState` logic. |
| `src/styles.css` | `assets/css/global.css` | All custom properties + base styles + component class definitions. |
| `src/locales/*.json` | `assets/i18n/*.json` | Copy all 5 locale files (en, ko, ja, zh-CN, zh-TW). |

## State Management

### Approach: Vue 3 Composables (No Pinia for MVP)

The dashboard state is moderate complexity. Vue 3 composables with `ref`/`reactive` + `provide`/`inject` are sufficient. Pinia would only be warranted if the app grows beyond 5 stores or requires devtools time-travel debugging.

### Composables

| Composable | Path | Purpose |
|------------|------|---------|
| `useMonitors` | `composables/useMonitors.ts` | Fetch monitors list from `GET /api/monitors`, manage client groups, handle WebSocket status updates. Exposes `monitors` (reactive), `selectedMonitorId` (ref), `refresh()` (method). |
| `useMonitorHistory` | `composables/useMonitorHistory.ts` | Fetch history data from `GET /api/monitors/:id` with `fromMs`, `toMs`, `maxPoints` params. Exposes `history` (ref), `isLoading` (ref), `load()` (method). |
| `useWebSocket` | `composables/useWebSocket.ts` | WebSocket connection lifecycle, subscribe/unsubscribe per monitor, auto-reconnect with exponential backoff. Exposes `connect()`/`disconnect()`, `subscribe(monitorId)`, `unsubscribe(monitorId)`, `onMessage(callback)`. |
| `useChartSeries` | `composables/useChartSeries.ts` | Transform `HistoryPoint[]` into uPlot-ready `[timestamp, value][]` arrays. Handles multi-series aggregation. |
| `useTimeWindow` | `composables/useTimeWindow.ts` | Manage selected time range. Exposes `fromMs`, `toMs`, `followLive`, `setPreset()`, `setCustomRange()`. |
| `useDashboardPalette` | `composables/useDashboardPalette.ts` | Assign colors to monitor series from the 12-color palette. Stable assignment by monitor ID. |
| `useI18n` | `composables/useI18n.ts` | Locale resolution, translation function `t()`, formatting utilities. |
| `useSidebarWidth` | `composables/useSidebarWidth.ts` | Persistent sidebar width via CSS custom property `--sidebar-width` + localStorage. |
| `useToast` | `composables/useToast.ts` | Global toast notification queue. Exposes `show(message, kind)`. |

### Provided/Injected Context

```
AppShell
  ├── provide: MonitorsContext (useMonitors)
  ├── provide: WebSocketContext (useWebSocket)
  ├── provide: TimeWindowContext (useTimeWindow)
  ├── provide: ToastContext (useToast)
  ├── MonitorSidebar
  │     └── uses: MonitorsContext
  ├── DashboardPanel
  │     ├── LatencyChart
  │     │     └── uses: MonitorsContext, TimeWindowContext, useMonitorHistory
  │     ├── SummaryGrid
  │     │     └── uses: MonitorsContext, useMonitorHistory
  │     └── TimeRangeSelector
  │           └── uses: TimeWindowContext
  └── ToastStack
        └── uses: ToastContext
```

## Styling Strategy

**Decision: Continue with vanilla CSS custom properties (no Tailwind).**

**Rationale:**
1. The desktop app already has a **complete, polished design system** with 15+ custom properties and ~1786 lines of well-structured CSS.
2. The dashboard is required to **mirror the desktop UI exactly** (per requirements). Adopting Tailwind would mean either rewriting the design system or maintaining two parallel styling approaches.
3. The CSS custom properties approach is already proven and works well for theming (dark mode only, but the token system supports extension).
4. **Scoped `<style>` blocks** in Vue components provide component-level isolation without CSS-in-JS overhead.
5. The existing CSS class names (`.target-row`, `.metric-card`, `.state-pill`, etc.) will be reused directly in Vue templates.

**Implementation:**
- `app/assets/css/global.css` — root custom properties + base styles (port from `src/styles.css`)
- Scoped `<style>` blocks per component for component-specific styles
- Shared utility classes for repeated patterns (`.eyebrow`, `.toggle-row`, `.form-grid`, etc.)
- No CSS framework dependency — keeps bundle size minimal

## Chart Approach

### uPlot in Vue 3 Lifecycle

The existing `src/chart.ts` class (`LatencyChart`) will be adapted into a Vue 3 component:

```vue
<!-- components/charts/LatencyChart.vue -->
<template>
  <div ref="container" class="chart-host"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import uPlot from 'uplot'

const props = defineProps<{
  history: HistoryResponse
  selectedTargetId: string | null
  compact?: boolean
}>()

const container = ref<HTMLElement>()
let plot: uPlot | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  plot = createUPlot(container.value!, props)
  resizeObserver = new ResizeObserver(() => /* resize plot */)
  resizeObserver.observe(container.value!)
})

watch(() => props.history, () => {
  plot?.destroy()
  plot = createUPlot(container.value!, props)
})

onUnmounted(() => {
  plot?.destroy()
  resizeObserver?.disconnect()
})
</script>
```

**Key adaptations from desktop code:**
- `innerHTML` + event binding patterns → Vue template reactivity + `@click` directives
- `ResizeObserver` lifecycle → `onMounted`/`onUnmounted` hooks
- Chart data transformation (`alignSeries`, `aggregateData`) → extracted to `useChartSeries` composable
- Tooltip positioning → reactive `useChartTooltip` composable
- Range change callback → `onRangeChanged` event emission
- WebSocket live updates → `watch` on incoming samples, incremental `plot.setData()`

## Accessibility

**Inherited from desktop app:**
- **ARIA labels:** All interactive elements have `aria-label` attributes (buttons, toggles, chart range group)
- **Keyboard navigation:** `tabindex="0"` on monitor rows, Enter/Space activation via `keydown` handlers
- **`focus-visible` outlines:** 2px accent-colored outline on all interactive elements (buttons, inputs, selects, monitor rows)
- **Semantic HTML:** `<header>`, `<main>`, `<aside>`, `<section>`, `<article>`, `<dialog>` elements used correctly
- **`aria-live="polite"`** on toast stack for screen reader announcements
- **`role="button"`** on monitor rows

**Dashboard-specific additions:**
- `role="tree"` / `role="treeitem"` for sidebar client groups
- `role="group"` + `aria-label` for time range controls
- Chart canvas: `aria-label` with current view description
- Reconnect indicator: `role="status"` + `aria-live="polite"`

## Responsive Design

**Strategy: Desktop-first (monitoring tool), functional on tablets.**

**Breakpoints:**
- **Desktop (≥981px):** Full layout with 320px default sidebar. Matches desktop app.
- **Tablet (768px–980px):** Sidebar narrows to 210px (per desktop media query). Summary grid collapses from 5 to 3 columns.
- **Mobile (<768px):** Sidebar collapses to hamburger menu. Chart takes full width. Summary grid collapses to 2 columns.

**Implementation:**
- Desktop CSS media query (`@media (max-width: 980px)`) already handles sidebar width and grid columns
- New Vue component: `HamburgerMenu` for mobile sidebar toggle
- Sidebar state persisted in `useSidebarWidth` composable
- Chart auto-resizes via `ResizeObserver` (already implemented in `LatencyChart`)

**Not in scope:** Mobile-first design, touch-optimized chart interactions (pan/zoom already works with pointer events)

## i18n

**Strategy: Mirror the 5-locale approach from the desktop app.**

**Implementation:**
- **Approach:** Lightweight custom i18n (not a heavy Nuxt i18n module). The desktop's `src/i18n.ts` already implements locale resolution, message interpolation, and formatting utilities.
- **Locale files:** Copy `src/locales/*.json` to `assets/i18n/*.json` (en, ko, ja, zh-CN, zh-TW)
- **Composable:** `useI18n()` — wraps locale detection (`resolveLanguage`), translation (`t()`), and formatting utilities
- **Nuxt layer:** Use `#imports` auto-import to make `t()` available globally
- **Language switching:** Settings modal includes language selector (matches desktop `.settings-section` → `Appearance`)

**Locale resolution order:**
1. User preference (localStorage)
2. Browser `navigator.language` → mapped to supported locale
3. Fallback: `en`

**Formatting utilities to port:**
- `formatLatency(value)` → `"12 ms"` / `"3.5 ms"`
- `formatPercent(value)` → `"5.00%"`
- `formatDuration(ms)` → `"12h 30m"` (localized units)
- `formatDateTime(timestampMs)` → localized date/time
- `formatBytes(bytes)` → `"1.2 MB"`
- `formatError(error)` → localized error messages

## Current UI State

The dashboard currently has a **minimal shell** (`app.vue`):
- Basic header with "LNPM Cloud Dashboard" title
- Placeholder "Dashboard loading..." message
- No functional components
- No routing beyond default `/` page

The **desktop app** (`src/main.ts` + `src/styles.css`) provides the full design reference:
- Dark theme monitoring dashboard with sidebar (monitor list) + main panel (chart + metrics)
- uPlot-based latency charts with bar/line mode
- Quality state indicators (status dots, pills)
- Modal dialogs for settings, target management, custom range
- Toast notifications
- Tray popup view (not applicable to cloud dashboard)
- 5-locale i18n support

## Component Tree (Visual)

```
AppShell
├── AppHeader
│   ├── BrandBlock (logo + title)
│   └── HeaderActions (Live, Pause, Settings)
├── MonitorSidebar
│   ├── SidebarResizer
│   ├── SidebarHeading (MONITORS + count + Add)
│   ├── AllMonitorsRow
│   ├── ClientGroup (collapsible)
│   │   ├── ClientGroupHeader
│   │   └── MonitorRow[]
│   │       ├── StatusDot
│   │       ├── MonitorName + Host
│   │       ├── LatestLatency
│   │       ├── ToggleButton
│   │       └── EditButton
│   └── EmptyState
├── DashboardPanel
│   ├── DashboardHeading
│   │   ├── StatePill
│   │   ├── MonitorName + Host
│   │   └── TimeRangeSelector
│   ├── ChartCard
│   │   ├── LatencyChart (uPlot)
│   │   ├── ChartLoading
│   │   └── ChartLegend
│   └── SummaryGrid
│       └── MetricCard[] (Average, P95, Unstable, Disconnected, Packet Loss)
├── Modals (overlay)
│   ├── ClientNameDialog
│   ├── CustomRangeDialog
│   └── (future: SettingsDialog)
└── ToastStack
```

## Dependencies Summary

| Category | Package | Purpose |
|----------|---------|---------|
| Chart | `uplot` | Canvas-based latency charts |
| i18n | Custom (from `src/i18n.ts`) | Lightweight locale resolution + formatting |
| State | Vue 3 composables | No Pinia for MVP |
| Styling | Vanilla CSS custom properties | Desktop design system port |
| Icons | Inline SVGs (from desktop `iconSvg()`) | Consistent icon set |
| WebSocket | Nitro native | Per-monitor topic subscriptions |

## Design Skills Invoked

### ui-ux-pro-max (nextlevelbuilder/ui-ux-pro-max-skill)

**Installed and invoked.** Design system generated:
- **Pattern:** "Real-Time / Operations Landing" — dark or neutral, status colors, data-dense but scannable
- **Style:** "Dark Mode (OLED)" — high contrast, deep black/midnight blue, eye-friendly, WCAG AAA
- **Chart domain:** "Streaming Area Chart" recommended for live monitoring (≥1Hz updates)
- **UX domain:** keyboard navigation (tab order), color contrast (4.5:1 min), bulk actions
- **Stack guidelines (nuxtjs):** `useState` for shared state, auto-imports, Pinia for complex apps

**Design dials:** Variance 5/10, Motion 3/10 (subtle), Density 8/10 (dense/dashboard)

### tailwind-best-practices

Evaluated — **decision: skip Tailwind** (see Styling Strategy rationale below).

### primevue

Evaluated — **decision: skip PrimeVue** (desktop app uses vanilla CSS; no migration benefit).

## Next Agent

**Agent 05 (Create Implementation Plan)** — consumes this UI/UX plan to produce the detailed implementation plan with file-by-file tasks, dependency order, and acceptance criteria for building the dashboard UI.
