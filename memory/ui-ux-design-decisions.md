---
name: ui-ux-design-decisions
description: UI/UX design plan from Agent 04 for the LNPM Cloud Dashboard
metadata:
  type: project
  hook: Dashboard UI styling strategy, component hierarchy, state management, and design system decisions
---

# UI/UX Design Plan — LNPM Cloud Dashboard

## Design System

### Color Palette (CSS Custom Properties)

**Mirror the desktop app's existing tokens exactly** — the dark navy/teal scheme is well-established and tested:

```css
:root {
  /* Background layers */
  --bg: #071016;
  --panel: #0b161e;
  --panel-raised: #101e27;
  --panel-soft: #0d1a22;
  /* Text hierarchy */
  --text: #e7eef5;
  --muted: #8799a7;
  --muted-strong: #a7b7c2;
  /* Accent & semantic */
  --accent: #45dfc2;
  --accent-bright: #72f3dc;
  --accent-soft: rgba(69, 223, 194, 0.12);
  --blue: #60a5fa;
  --warning: #f6a94a;
  --warning-soft: rgba(246, 169, 74, 0.12);
  --danger: #ff6b78;
  --danger-soft: rgba(255, 107, 120, 0.12);
  /* Structural */
  --line: rgba(148, 176, 194, 0.14);
  --line-strong: rgba(148, 176, 194, 0.25);
  --radius: 12px;
  --shadow: 0 18px 55px rgba(0, 0, 0, 0.3);
  --sidebar-width: 320px;
}
```

### Typography

**Use the desktop app's existing font stack** — Inter + system fonts + CJK fallbacks.

```
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
"Noto Sans CJK KR", "Noto Sans CJK JP", "Microsoft YaHei", "Microsoft JhengHei",
sans-serif
```

**Monospace for latency values:** "Cascadia Code", "SFMono-Regular", Consolas, monospace

## Components to Create

| Component | Purpose | Location |
|-----------|---------|----------|
| `AppHeader` | Brand, title, Live/Pause/Settings actions | `app/components/AppHeader.vue` |
| `TargetSidebar` | Monitor list with count badge, "All monitors" row, add button | `app/components/TargetSidebar.vue` |
| `TargetRow` | Single monitor row: status dot, name, host, latency, toggle, edit | `app/components/TargetRow.vue` |
| `AllTargetRow` | "All monitors" combined view with layers icon, toggle-all | `app/components/AllTargetRow.vue` |
| `DashboardHeading` | State pill + title + host + range controls | `app/components/DashboardHeading.vue` |
| `RangeControls` | Time range selector (1H, 24H, 7D, 30D, Custom) | `app/components/RangeControls.vue` |
| `ChartCard` | uPlot container with loading overlay and legend | `app/components/ChartCard.vue` |
| `ChartLegend` | Scrollable legend with swatches and series names | `app/components/ChartLegend.vue` |
| `SummaryGrid` | 5-column grid of metric cards | `app/components/SummaryGrid.vue` |
| `MetricCard` | Single metric (label, value, small subtext) | `app/components/MetricCard.vue` |
| `StatePill` | Quality state indicator with dot | `app/components/StatePill.vue` |
| `StatusDot` | 8px colored dot with glow | `app/components/StatusDot.vue` |
| `TargetDialog` | Add/edit monitor dialog (native `<dialog>`) | `app/components/TargetDialog.vue` |
| `SettingsDialog` | Settings modal with sections, toggles | `app/components/SettingsDialog.vue` |
| `RangeDialog` | Custom range picker (compact modal) | `app/components/RangeDialog.vue` |
| `EmptyState` | Radar animation when no monitors exist | `app/components/EmptyState.vue` |
| `ToastStack` | Bottom-right toast notifications | `app/components/ToastStack.vue` |

### Components to Reuse (Patterns from Desktop App)

The following CSS classes from `src/styles.css` are ported to the dashboard's global stylesheet:

- `.app-header`, `.brand-block`, `.brand-mark` — header and branding
- `.button` (with `.primary`, `.ghost`, `.icon-button`, `.danger-text` variants)
- `.workspace` — CSS Grid layout with sidebar | resizer | main
- `.target-sidebar`, `.target-list`, `.target-row`, `.all-target-row`
- `.sidebar-resizer` — drag handle for resizable sidebar
- `.dashboard-panel`, `.dashboard-heading`
- `.state-pill`, `.status-dot` (with all `state-*` variants)
- `.range-controls`, `.range-button`
- `.chart-card`, `.chart-host`, `.chart-loading`, `.chart-legend`, `.legend-item`
- `.summary-grid`, `.metric-card` (with `.warning`/`.danger` variants)
- `.modal`, `.modal-close`, `.form-grid`, `.input-suffix`, `.toggle-row`
- `.toast-stack`, `.toast`
- `.eyebrow`, `.ui-icon` — labels and SVG icons
- `.empty-targets`, `.empty-radar`
- uPlot overrides: `.uplot`, `.chart-tooltip`

### Layout Hierarchy

```
┌─────────────────────────────────────────────────────┐
│  AppHeader (68px, backdrop blur, border-bottom)     │
│  ┌─Brand (logo + title + subtitle)───┐ ┌─Actions───┐│
│  └────────────────────────────────────┘ └───────────┘│
├───────────────────────────────────────────────────────┤
│  Workspace (CSS Grid: sidebar | resizer | flex-1)    │
│  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ TargetSidebar │  │ DashboardPanel               │  │
│  │ 320px         │  │ ┌─DashboardHeading─────────┐ │  │
│  │ Monitors list │  │ │ state-pill + h2 + host   │ │  │
│  │ + Add button  │  │ │ range-controls (1H/24H..) │ │  │
│  │               │  │ ├──────────────────────────┤ │  │
│  │               │  │ │ ChartCard                 │ │  │
│  │               │  │ │ ┌─uPlot canvas─────────┐ │ │  │
│  │               │  │ │ ├──────────────────────┤ │ │  │
│  │               │  │ │ │ chart-legend         │ │ │  │
│  │               │  │ │ └──────────────────────┘ │ │  │
│  │               │  │ ├──────────────────────────┤ │  │
│  │               │  │ │ SummaryGrid (5 cards)    │ │  │
│  │               │  │ └──────────────────────────┘ │  │
│  └──────────────┘  └──────────────────────────────┘  │
│  Resizer (1px)                                        │
└───────────────────────────────────────────────────────┘
```

## State Management

**Vue 3 composables (no Pinia for M1).** Per [[memory/MEMORY.md]], use `useState` for SSR-friendly shared state.

### Planned Composables

| Composable | Purpose |
|------------|---------|
| `useMonitors()` | Monitor list, selection, CRUD |
| `useWebSocket()` | WebSocket connection to ping stream |
| `useChart()` | uPlot chart instance lifecycle |
| `useTimeRange()` | Time range selection (1H/24H/7D/30D/Custom) |
| `useQualityState()` | Quality classification from metrics |
| `useToast()` | Toast notification queue |
| `usei18n()` | Translation function, locale management |

### State Flow

```
WebSocket → useWebSocket → PingSample events
  ↓
useMonitors (aggregates samples into Monitor state)
  ↓
useChart (reacts to monitor selection, renders uPlot)
  ↓
useQualityState (classifies current quality from metrics)
```

## Styling Strategy

**Vanilla CSS custom properties with scoped `<style>` blocks** — no Tailwind.

**Why not Tailwind:**
1. Desktop app's design system is mature and well-tested
2. Tailwind adds unnecessary complexity for a monitoring dashboard
3. CSS custom properties already provide the theming infrastructure
4. No migration benefit — building a web version of an existing app

### File Structure

```
dashboard/
  app/
    assets/
      styles/
        global.css          ← CSS custom properties + base styles
        uplot.css           ← uPlot-specific overrides
```

Imported in `nuxt.config.ts` via `css: ['~/assets/styles/global.css', '~/assets/styles/uplot.css']`.

## Chart Approach

**uPlot in Vue 3** — lightweight (~13KB), high-performance, proven in desktop app.

### Vue Integration Pattern

```vue
<script setup lang="ts">
import uPlot from 'uplot';
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';

const chartRef = ref<HTMLDivElement>();
let chart: uPlot | null = null;

onMounted(async () => {
  await nextTick();
  if (chartRef.value) {
    chart = new uPlot(props.options, props.data, chartRef.value);
  }
});
onUnmounted(() => chart?.destroy());
watch(() => props.data, async (newData) => {
  await nextTick();
  chart?.setData(newData);
});
</script>
<template><div ref="chartRef" class="chart-host" /></template>
```

### Chart Modes

- **Bar mode** — single target: threshold-colored bars (green <50ms, yellow <100ms, orange <200ms, red ≥200ms)
- **Line mode** — "All monitors": multi-series colored lines
- **Compact mode** — 80px min height, simplified legend

### Threshold Zone Lines

Dashed lines at 50/100/150/200ms in line mode.

## Accessibility

**WCAG AAA** for dark mode contrast. Desktop app already meets this.

- **Keyboard nav:** Tab order: Header → Sidebar → Dashboard → Modals; custom focus outline `2px solid rgba(69, 223, 194, 0.62)`
- **ARIA:** Chart `role="img"` with `aria-label`, status dots with `aria-label`, range buttons with `aria-pressed`, modals with `role="dialog"`
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` — disables all transitions/animations

## Responsive Design

**Desktop-first** (monitoring tool). Min width: 840px.

- Default: `--sidebar-width: 320px`, 5-column summary grid
- Tablet (≤980px): `--sidebar-width: 210px`, 3-column summary grid

## i18n

**5 locales:** en (default), ko, ja, zh-CN, zh-TW

**Approach: `@nuxtjs/i18n` module** — native Nuxt integration, SSR support, auto-imported composables.

Key structure mirrors desktop app: `app.*`, `dashboard.*`, `target.*`, `settings.*`, `state.*`, `reason.*`, `duration.*`, `error.*`

## Current UI State

The dashboard is a **skeleton** — minimal shell with placeholder "Monitors will appear here" text, gray text on white background. No dark theme, no components, no chart.

**Reference:** `docs/assets/lnpm-dashboard.png` shows the target UI state.

## Icon Strategy

**Lucide icons** — tree-shakeable, consistent stroke-based design (16x16, 1.8px stroke, round caps/joins).

## Anti-Patterns to Avoid

1. No emojis as icons — use SVG (Lucide)
2. No placeholder-only labels
3. No hover-only interactions
4. No raw hex in components — use CSS custom properties
5. No color-only state indicators — pair with text labels
6. No layout thrashing — reserve space for all elements

## Next Agent

**Agent 05 (Create Implementation Plan)** — consumes this plan for detailed implementation with file-by-file changes, task ordering, and acceptance criteria.

**Related:** [[agent-03-code-analysis]], [[implementation-plan]]
