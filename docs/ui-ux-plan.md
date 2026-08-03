# LNPM Cloud Dashboard — UI/UX Plan

> **Produced by:** Agent 04 (Plan UI/UX Design)
> **Consumed by:** Agent 05 (Create Implementation Plan)
> **Date:** 2026-08-02
> **Status:** Complete

---

## Design System

### CSS Custom Properties (mirrored from desktop `src/styles.css`, adapted for Nuxt 4 + Vue 3)

The cloud dashboard will use the **exact same CSS custom properties** as the desktop app. This ensures pixel-perfect visual consistency between the two platforms. The properties will be defined in a global stylesheet (`app/assets/css/global.css`) and imported via `nuxt.config.ts` → `css` array.

#### Layer 1 — Primitive (raw values)

| Token | Value | Purpose |
|-------|-------|---------|
| `--color-bg` | `#071016` | Deep dark background |
| `--color-panel` | `#0b161e` | Panel surfaces |
| `--color-panel-raised` | `#101e27` | Raised panels (modals, overlays) |
| `--color-panel-soft` | `#0d1a22` | Soft panel backgrounds |
| `--color-line` | `rgba(148, 176, 194, 0.14)` | Divider lines |
| `--color-line-strong` | `rgba(148, 176, 194, 0.25)` | Strong dividers, borders |
| `--color-text` | `#e7eef5` | Primary text |
| `--color-muted` | `#8799a7` | Muted text, labels |
| `--color-muted-strong` | `#a7b7c2` | Strong muted text |
| `--color-accent` | `#45dfc2` | Primary accent (teal) |
| `--color-accent-bright` | `#72f3dc` | Bright accent highlight |
| `--color-accent-soft` | `rgba(69, 223, 194, 0.12)` | Soft accent background |
| `--color-blue` | `#60a5fa` | Secondary blue (warming up) |
| `--color-warning` | `#f6a94a` | Warning state (orange) |
| `--color-warning-soft` | `rgba(246, 169, 74, 0.12)` | Soft warning background |
| `--color-danger` | `#ff6b78` | Danger state (red) |
| `--color-danger-soft` | `rgba(255, 107, 120, 0.12)` | Soft danger background |
| `--color-success` | `#4ade80` | Success/low state (green) |
| `--color-unstable` | `#c084fc` | Unstable state (purple) |

#### Layer 2 — Semantic (purpose aliases)

| Token | Maps To | Purpose |
|-------|---------|---------|
| `--bg` | `var(--color-bg)` | Page background |
| `--panel` | `var(--color-panel)` | Card/panel background |
| `--panel-raised` | `var(--color-panel-raised)` | Modal/overlay background |
| `--line` | `var(--color-line)` | Divider |
| `--line-strong` | `var(--color-line-strong)` | Border |
| `--text` | `var(--color-text)` | Primary text |
| `--muted` | `var(--color-muted)` | Secondary text |
| `--muted-strong` | `var(--color-muted-strong)` | Tertiary text |
| `--accent` | `var(--color-accent)` | Brand accent |
| `--accent-bright` | `var(--color-accent-bright)` | Accent highlight |
| `--accent-soft` | `var(--color-accent-soft)` | Accent background |
| `--danger` | `var(--color-danger)` | Error/danger |
| `--danger-soft` | `var(--color-danger-soft)` | Danger background |
| `--warning` | `var(--color-warning)` | Warning |
| `--warning-soft` | `var(--color-warning-soft)` | Warning background |

#### Layer 3 — Component (component-specific overrides)

These are defined inline in component `<style scoped>` blocks, not globally:
- `--series-color`: uPlot series line color (set per-series)
- `--swatch`: tooltip swatch color
- Component-level hover/active states use `rgba()` variants of the semantic tokens

#### Typography

| Scale | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | 20px | 650 | Dashboard headings (`h2`) |
| Heading | 19px | 650 | Modal titles (`h3`) |
| Subheading | 17px | 700 | Brand name (`h1`) |
| Body | 13px | 400 | Host labels, descriptions |
| Body Small | 12px | 400 | Chart axes, tooltips |
| Caption | 11px | 650 | Target names, metric labels |
| Eyebrow | 10px | 700 | Section labels, state pills |
| Micro | 9px | 400 | Popup text, small timestamps |

Font stack (from desktop):
```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", "Noto Sans CJK KR", "Noto Sans CJK JP", "Microsoft YaHei",
  "Microsoft JhengHei", sans-serif;
```

Monospace (for latency values):
```css
font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
```

#### Spacing & Layout

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `12px` | Primary border radius (cards, modals) |
| `--radius-md` | `10px` | Cards, buttons |
| `--radius-sm` | `8px` | Inputs, small buttons |
| `--radius-xs` | `6px` | Pill buttons, legend items |
| `--shadow` | `0 18px 55px rgba(0, 0, 0, 0.3)` | Modal/card elevation |

Spacing scale (8px base, dense dashboard):
`2px, 3px, 5px, 6px, 7px, 8px, 9px, 10px, 12px, 13px, 14px, 16px, 18px, 20px, 22px, 24px`

#### Status State Colors

| State | Color | Glow | Usage |
|-------|-------|------|-------|
| `low` / `stable` | `#45dfc2` (accent) | `rgba(69, 223, 194, 0.38)` | Good health |
| `medium` | `#eab308` | `rgba(234, 179, 8, 0.38)` | Moderate |
| `high` | `#f97316` | `rgba(249, 115, 22, 0.38)` | High latency |
| `veryHigh` | `#ef4444` | `rgba(239, 68, 68, 0.38)` | Critical |
| `unstable` | `#a855f7` | `rgba(168, 85, 247, 0.38)` | Unstable |
| `disconnected` | `#ff6b78` (danger) | `rgba(255, 107, 120, 0.38)` | Disconnected |
| `paused` | `#8799a7` (muted) | none | Paused |
| `warmingUp` | `#60a5fa` (blue) | `rgba(96, 165, 250, 0.1)` | Warming up |

---

## Components to Create

### 1. `AppLayout` (replaces `default.vue`)

**File:** `app/components/AppLayout.vue`

**Purpose:** Main layout shell wrapping the entire dashboard. Provides the header bar and two-column workspace grid.

**Structure:**
```
┌─────────────────────────────────────────────┐
│ Header: Brand + Actions (Live, Pause, ⚙)    │
├──────────────┬──────────────────────────────┤
│ Sidebar      │ Dashboard Panel              │
│ (280-320px)  │ (flex: 1)                    │
│              │                              │
│ Monitors     │ Chart + Metrics              │
│ list         │                              │
│              │                              │
└──────────────┴──────────────────────────────┘
```

**Key features:**
- `<header class="app-header">` with brand block (logo + title + subtitle) and action buttons
- CSS grid `.workspace` with `grid-template-columns: var(--sidebar-width, 320px) 1px minmax(0, 1fr)`
- Draggable sidebar resizer (mirrors desktop `.sidebar-resizer`)
- `<slot>` for page content

**Accessibility:**
- `role="banner"` on header
- `role="navigation"` on sidebar
- `role="main"` on dashboard panel
- `aria-label` on all icon buttons (Live, Pause, Settings)
- Keyboard-focusable sidebar resizer

---

### 2. `MonitorSidebar`

**File:** `app/components/MonitorSidebar.vue`

**Purpose:** Left sidebar displaying the monitor list grouped by client, with "All Monitors" row at top.

**Structure:**
```
MONITORS  [5]  [+]
┌──────────────────────┐
│ ⊞ All Monitors       │  ← "select all" row
├──────────────────────┤
│ ● Google    41 ms ✎ │  ← monitor row
│   google.com         │
├──────────────────────┤
│ ● Inner     4.0 ms ✎│  ← monitor row (selected)
│   192.168.25.1       │
└──────────────────────┘
```

**Props:**
- `monitors: MonitorListItem[]` — list of monitors from API
- `selectedId: string | null` — currently selected monitor ID (null = all)

**Events:**
- `select(id: string | null)` — emit when a row is clicked
- `toggle(id: string)` — emit when toggle switch is clicked
- `edit(id: string)` — emit when edit icon is clicked
- `add` — emit when "+" button is clicked

**Accessibility:**
- `role="listbox"` on list container
- `role="option"` + `aria-selected` on each row
- `tabindex="0"` on rows with keyboard Enter/Space handler
- Status dot uses `aria-label` (not color-only — text label in tooltip)

---

### 3. `MonitorRow`

**File:** `app/components/MonitorRow.vue`

**Purpose:** Individual monitor list item with status dot, name, host, latency, toggle switch, and edit icon.

**Props:**
- `monitor: MonitorListItem`
- `selected: boolean`

**Emits:**
- `select`, `toggle`, `edit`

**States:**
- Default: transparent background, transparent border
- Hover: `border-color: var(--line)`, `background: rgba(255, 255, 255, 0.025)`
- Selected: `border-color: rgba(69, 223, 194, 0.18)`, gradient background

**Design notes:**
- Mirrors `.target-row` from desktop CSS exactly
- 54px min-height, grid layout (12px icon + flex content + auto actions)
- Status dot uses `.status-dot.state-{state}` classes with color + glow box-shadow
- Toggle switch uses `.toggle-track` / `.toggle-thumb` pattern from desktop

---

### 4. `DashboardPanel`

**File:** `app/components/DashboardPanel.vue`

**Purpose:** Right panel containing the dashboard heading, chart, and metric summary.

**Structure:**
```
┌─────────────────────────────────────────────┐
│ ● Warming up  Inner  192.168.25.1    [1H..] │  ← heading
├─────────────────────────────────────────────┤
│                                             │
│          ┌───────────────────────────┐      │
│          │                           │      │  ← ChartCard
│          │    uPlot Chart Area       │      │
│          │                           │      │
│          └───────────────────────────┘      │
│                                             │
│  [Average 10ms] [P95 628ms] [Unstable 1.78%]  ← MetricCards
│  [Disconnected 0.00%] [Packet loss 0.00%]     │
└─────────────────────────────────────────────┘
```

**Props:**
- `selectedMonitor: MonitorListItem | null` — current selection (null = all)
- `qualityState: QualityState` — aggregate state
- `range: { fromMs: number, toMs: number }` — time range

**Emits:**
- `update:range` — when range selector is changed

**Slots:**
- `heading-actions` — custom buttons in heading area

---

### 5. `ChartCard`

**File:** `app/components/ChartCard.vue`

**Purpose:** uPlot chart container with loading state, canvas host, and legend bar.

**Structure:**
```
┌──────────────────────────────────────┐
│ Chart loading overlay (hidden)       │
│ ┌──────────────────────────────────┐ │  ← #chart-host
│ │                                  │ │  ← uPlot canvas
│ │         Chart Area               │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│ ──────────────────────────────────── │  ← chart-legend
│ [All] [Google] [Inner] [.57] [...]   │
└──────────────────────────────────────┘
```

**Props:**
- `history: HistoryResponse | null` — chart data
- `selectedTargetId: string | null` — highlighted series

**Emits:**
- `range-changed(fromMs, toMs)` — when user dranges/zooms chart
- `legend-select(id)` — when legend item clicked

**Implementation:**
- uPlot instance created in `onMounted`, destroyed in `onUnmounted`
- Canvas rendered in `<div id="chart-host">`
- Loading overlay shown during data fetch
- Legend items use `.legend-item` with swatch colors
- Chart tooltip uses `.chart-tooltip` (custom HTML, not uPlot default)
- Series colors: `["#5eead4", "#60a5fa", "#c084fc", "#f472b6", "#facc15"]` (5-color cycle)

**Accessibility:**
- `aria-label` on chart container: "Ping latency chart for {monitor name}"
- `role="img"` with `aria-label` describing chart insight
- `aria-live="polite"` on tooltip region
- Keyboard-navigable legend items

---

### 6. `MetricCard`

**File:** `app/components/MetricCard.vue`

**Purpose:** Summary metric display card (average, p95, unstable %, disconnected %, packet loss %).

**Props:**
- `label: string` — metric label (e.g., "Average")
- `value: string` — formatted value (e.g., "10 ms")
- `subValue?: string` — secondary value (e.g., "26s" for unstable duration)
- `variant?: "default" | "warning" | "danger"` — styling variant

**Design:**
- 94px min-height, 1px border, 10px radius
- Label: 10px muted, Value: 21px 650 weight, Sub: 9px muted
- Warning variant: `border-color: rgba(246, 169, 74, 0.15)`, orange value
- Danger variant: `border-color: rgba(255, 107, 120, 0.15)`, red value
- Subtle background glow circle (65px, bottom-right) via `::after` pseudo-element

**Layout:**
5-column grid (`.summary-grid`): `grid-template-columns: repeat(5, minmax(108px, 1fr))`

---

### 7. `StatePill`

**File:** `app/components/StatePill.vue`

**Purpose:** Quality state indicator pill with dot + text label.

**Props:**
- `state: QualityState` — current state

**Design:**
- Inline-flex, 26px min-height, 99px radius (pill shape)
- 1px border, 6px status dot via `::before`
- Text: 10px 700 weight, capitalized state name
- Colors map to status state color table above

**Accessibility:**
- `role="status"` for screen readers
- `aria-label` with full state description (not color-dependent)

---

### 8. `RangeSelector`

**File:** `app/components/RangeSelector.vue`

**Purpose:** Time range selector button group (Live, 5M, 10M, 30M, 1H, 6H, 12H, 24H, 7D, 30D, Custom).

**Props:**
- `activeRange: string` — currently active range key
- `showLive: boolean` — whether to show "Live" button

**Emits:**
- `select(range: string)` — when a button is clicked

**Design:**
- Inline-flex with 3px padding wrapper, 1px border, 9px radius
- Buttons: 28px min-height, 6px radius, 10px 700 weight
- Active: `color: var(--accent-bright)`, `background: var(--accent-soft)`
- Inactive: `color: var(--muted)`, transparent background
- 2px gap between buttons

---

### 9. `TargetDialog` (Add/Edit Monitor Modal)

**File:** `app/components/TargetDialog.vue`

**Purpose:** Modal for adding or editing a monitor target.

**Props:**
- `modelValue: boolean` — open/closed state (v-model)
- `target?: Partial<Target>` — existing target for edit mode

**Emits:**
- `update:modelValue`
- `save(target: Target)`
- `delete(id: string)` (edit mode only)

**Form fields:**
- Display name (text, required, max 40 chars)
- Hostname (text, required)
- Address family (select: auto, IPv4, IPv6)
- Interval (number, 1-60, suffix "s")
- Timeout (number, 250-10000, step 250, suffix "ms")
- Unstable thresholds (fieldset): packet loss %, jitter ms, p95 latency ms
- Monitoring enabled (toggle checkbox)
- Test result area (hidden by default, shown after test)

**Footer actions:**
- Delete button (danger, edit mode only)
- Test ping button (ghost)
- Cancel button (ghost)
- Save button (primary)

**Accessibility:**
- `<dialog>` element with `.showModal()` / `.close()`
- `role="dialog"` + `aria-modal="true"`
- Focus trapped within dialog when open
- Close button and Escape key support
- Form labels with `for` attributes
- Error state with `aria-invalid` and `aria-describedby`

---

### 10. `SettingsDialog`

**File:** `app/components/SettingsDialog.vue`

**Purpose:** Settings modal for dashboard configuration.

**Sections:**
- **Monitoring:** retention days (select), notifications toggle, start at login toggle
- **Appearance:** language selector (auto, en, ko, ja, zh-CN, zh-TW)
- **Data:** database size display, path display, open folder / backup / cleanup buttons

**Design:**
- 580px max-width, 680px max-height
- Scrollable content area (`.settings-scroll-area`)
- Fixed footer with version badge and save/cancel buttons
- `.settings-section` cards with border + 14px padding

---

### 11. `ToastNotification`

**File:** `app/components/ToastNotification.vue`

**Purpose:** Toast notification component for feedback messages.

**Props:**
- `message: string` — toast text
- `kind: "success" | "error" | "warning"` — styling variant
- `timeout?: number` — auto-dismiss duration (default 4500ms)

**Design:**
- Max 360px, 1px border, 9px radius
- Success: `border-color: rgba(69, 223, 194, 0.35)`
- Error: `border-color: rgba(255, 107, 120, 0.35)`
- Bottom-right stack with 7px gap
- Fade-in/slide-up animation (180ms ease)
- Fade-out on dismiss

**Accessibility:**
- `aria-live="polite"` for screen reader announcement
- `role="status"` on each toast
- Does not steal focus (WCAG guideline from quick-reference)

---

### 12. `EmptyState`

**File:** `app/components/EmptyState.vue`

**Purpose:** Empty state display when no monitors are configured.

**Props:**
- `variant: "no-monitors" | "no-data" | "error"` — empty state type

**Design:**
- Centered content with radar animation (for no-monitors variant)
- Radar: 72px circle with spinning sweep line (2.8s animation)
- Title: 14px bold, Description: 11px muted, line-height 1.6
- CTA button (primary, "Add Target")

---

## Components to Reuse (Conceptual — Not Directly Copyable)

The following desktop app code provides **conceptual patterns** to adapt for the Vue 3 dashboard. These files are from the Tauri desktop app (`src/`) and use vanilla DOM manipulation — they are **not directly reusable** as Vue components but serve as reference implementations.

| Desktop File | Purpose | Reuse Approach |
|--------------|---------|----------------|
| `src/chart.ts` | uPlot chart class | Re-implement as Vue composable `useChart()` wrapping uPlot instance |
| `src/chart-tooltip.ts` | Custom tooltip | Re-implement as `<ChartTooltip>` Vue component |
| `src/i18n.ts` | i18n engine | Port 5-locales JSON to Nuxt i18n module format |
| `src/styles.css` | Design tokens | Copy CSS custom properties to `app/assets/css/global.css` |
| `src/locales/*.json` | 5 locale files | Copy to `dashboard/public/locales/` or Nuxt i18n structure |
| `src/main.ts` | UI structure | Use as reference for component hierarchy (not code) |

**Files NOT to reuse:**
- All `src/` files use Tauri APIs (`@tauri-apps/api/*`) — not applicable to web
- `src/api.ts` — desktop API client (IPC), not HTTP
- `src/update-state.ts` — desktop-specific update logic
- `src/dashboard-selection.ts` — desktop-specific aggregation

---

## State Management

### Approach: Vue 3 Composables + `useState` (No Pinia)

Given the scope of the dashboard (single-page monitoring view, moderate state), **Vue 3 composables with Nuxt's `useState`** are sufficient. Pinia is not needed at this stage.

### Composables

| Composable | File | Purpose |
|------------|------|---------|
| `useMonitors()` | `app/composables/useMonitors.ts` | Fetch and manage monitor list state. Reactive `monitors` ref, `selectedId` ref. API calls to `GET /api/monitors`. |
| `useHistory()` | `app/composables/useHistory.ts` | Manage chart history data. Reactive `history` ref, `range` ref. API calls to `GET /api/monitors/:id`. |
| `useWebSocket()` | `app/composables/useWebSocket.ts` | WebSocket connection management. Reconnect with exponential backoff (1s → 2s → 4s → 8s → 16s → 30s). Subscribe/unsubscribe to monitor topics. |
| `useChart()` | `app/composables/useChart.ts` | uPlot chart lifecycle. Creates/destroys uPlot instance in `onMounted`/`onUnmounted`. Renders `HistoryResponse` data. |
| `useRange()` | `app/composables/useRange.ts` | Time range management. Reactive `range` ref, range presets (5M, 10M, 30M, 1H, 6H, 12H, 24H, 7D, 30D). |
| `useToast()` | `app/composables/useToast.ts` | Toast notification system. `addToast(message, kind)` function. Reactive `toasts` array. |
| `useSettings()` | `app/composables/useSettings.ts` | Dashboard settings state. Reactive settings object, language preference. |
| `useHealth()` | `app/composables/useHealth.ts` | Health check polling. Periodic `GET /api/health` calls, reactive health status. |

### `useState` Usage

For cross-component reactive state that persists across SSR hydration:

```ts
// useMonitors.ts
export function useMonitors() {
  const monitors = useState<MonitorListItem[]>('monitors', () => []);
  const selectedId = useState<string | null>('selectedMonitorId', () => null);
  // ...
}
```

This ensures the state is shared across server and client renders, avoiding hydration mismatches.

---

## Styling Strategy

### Decision: Vanilla CSS Custom Properties (No Tailwind)

**Rationale:**
1. **Existing design is already fully tokenized** — the desktop app uses CSS custom properties extensively (~40 tokens). Adopting Tailwind would require remapping all these tokens, creating inconsistency, and duplicating effort.
2. **Pixel-perfect match** — the dashboard must mirror the desktop app's look. Using the same CSS approach ensures consistency.
3. **Bundle size** — Tailwind adds build-time processing and runtime CSS. The desktop CSS is ~1800 lines of highly specific, well-tested styles.
4. **Component scoping** — Vue 3's `<style scoped>` works perfectly with CSS custom properties. Each component can override specific tokens without affecting others.
5. **No CSS framework dependency** — keeps the project lean. The dashboard is a single-page monitoring tool, not a multi-page app needing rapid prototyping.

### Implementation

1. **Global stylesheet:** `app/assets/css/global.css`
   - Import all CSS custom properties from desktop `src/styles.css`
   - Import global resets (`box-sizing`, `html/body` rules)
   - Import uPlot-specific overrides (`.uplot .u-cursor-x`, etc.)
   - Import `@keyframes radar-spin` animation

2. **Nuxt config:** Add to `nuxt.config.ts` → `css: ['~/assets/css/global.css']`

3. **Component styles:** Each Vue component uses `<style scoped>` with:
   - CSS custom properties (no raw hex values)
   - Class names that mirror desktop app classes (for easy cross-reference)
   - Scoped overrides only (no global pollution)

4. **Design token validation:** Optionally use the `design-system` skill's `validate-tokens.cjs` script to catch hardcoded hex values.

---

## Chart Approach

### uPlot in Vue 3 Lifecycle

uPlot is a Canvas-based charting library that requires direct DOM access. Integration follows a lifecycle pattern:

```vue
<script setup lang="ts">
import uPlot from 'uplot';
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';

const chartRef = ref<HTMLDivElement>();
let chart: uPlot | null = null;

onMounted(async () => {
  await nextTick();
  chart = new uPlot(options, initialData, chartRef.value!);
});

onUnmounted(() => {
  chart?.destroy();
});

// Watch for data changes and re-render
watch([history, selectedTargetId], async () => {
  await nextTick();
  chart?.setData(newData);
  // Re-bind legend events if needed
});
</script>

<template>
  <div class="chart-card">
    <div ref="chartRef" class="chart-host"></div>
    <div class="chart-legend" id="chart-legend"></div>
  </div>
</template>
```

### uPlot Options

- **Font:** Inherit from CSS (`font-family: inherit`)
- **Cursor:** Crosshair X only (`.u-cursor-y` hidden, `.u-select` hidden)
- **Title/Legend:** Hidden (custom legend implemented)
- **Series colors:** 5-color cycle `["#5eead4", "#60a5fa", "#c084fc", "#f472b6", "#facc15"]`
- **Tooltip:** Custom HTML tooltip (`.chart-tooltip`), positioned absolutely
- **Quality intervals:** Background bands for state intervals (warming up, low, medium, etc.)
- **Responsive:** `resize: true` to handle container width changes

### Desktop uPlot Code Reference

The desktop `src/chart.ts` contains:
- `LatencyChart` class with full uPlot configuration
- Series mapping from `HistoryResponse`
- Quality interval background rendering
- Custom tooltip positioning and content
- Range change event handling

This code will be adapted into the `useChart()` composable.

---

## Accessibility

### Strategy

Follow WCAG 2.1 AA standards. The desktop app already has strong accessibility foundations — the dashboard will mirror and extend them.

### Key Requirements

| Requirement | Implementation | Priority |
|-------------|---------------|----------|
| **Color contrast** | All text meets 4.5:1 ratio (verified against desktop palette). Status colors include glow + text, not color-only. | CRITICAL |
| **Focus indicators** | `outline: 2px solid rgba(69, 223, 194, 0.62)` with 2px offset on all interactive elements. | CRITICAL |
| **Keyboard navigation** | All functionality accessible via keyboard. Tab order matches visual order. Enter/Space activate rows/buttons. | CRITICAL |
| **Screen reader labels** | `aria-label` on all icon buttons, status dots, and chart containers. `aria-live="polite"` on toast/toast region. | HIGH |
| **Skip links** | "Skip to main content" link at top of page (hidden visually, focused on Tab). | HIGH |
| **Semantic HTML** | `<header>`, `<main>`, `<aside>`, `<section>`, `<article>`, `<dialog>` used appropriately. | HIGH |
| **Heading hierarchy** | Sequential h1 → h2 → h3, no level skips. | MEDIUM |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` disables all animations (already in desktop CSS). | MEDIUM |
| **Form labels** | All inputs have visible labels with `for` attributes. No placeholder-only inputs. | HIGH |
| **Error handling** | `aria-invalid` + `aria-describedby` on invalid form fields. Error messages near fields. | HIGH |

### Color-Only Information

Per WCAG 1.4.1 (Use of Color):
- Status dots always have text labels (state name in `StatePill`)
- Quality states use both color AND shape (dot glow + text label)
- Chart series use color AND name (legend text)
- Toggle switches use track position, not just color

---

## Responsive Design

### Strategy: Desktop-First, Tablet-Fallback

This is a monitoring tool used primarily on desktop screens. Responsive design ensures it functions on tablets but does not optimize for mobile phone screens.

### Breakpoints

| Breakpoint | Width | Changes |
|------------|-------|---------|
| **Desktop** | ≥ 981px | Full layout: 320px sidebar, full chart, 5-column metrics |
| **Tablet** | 640px - 980px | 210px sidebar, 3-column metrics, reduced padding |
| **Mobile** | < 640px | Collapsed sidebar (toggleable), 2-column metrics, simplified chart |

### Desktop CSS (from `src/styles.css` line 1770)
```css
@media (max-width: 980px) {
  .workspace { grid-template-columns: 210px 1px minmax(0, 1fr); }
  .dashboard-panel { padding: 18px; }
  .summary-grid { grid-template-columns: repeat(3, 1fr); }
}
```

### Implementation Notes
- Min-width constraint: `min-width: 840px` on `.app-shell` (from desktop). The dashboard should set this on the layout.
- Sidebar resizer is desktop-only — not needed on tablet/mobile.
- Chart legend scrolls horizontally on narrow screens (already supported via `overflow-x: auto`).
- Metric grid collapses: 5 columns → 3 columns → 2 columns across breakpoints.

---

## i18n Strategy

### Approach: Nuxt i18n Module (`@nuxtjs/i18n`)

The desktop app uses a lightweight JSON-based i18n system with 5 locales. The dashboard will use Nuxt's official i18n module for SSR-compatible, auto-routed localization.

### Configuration

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [
      { code: 'en', file: 'en.json', name: 'English' },
      { code: 'ko', file: 'ko.json', name: '한국어' },
      { code: 'ja', file: 'ja.json', name: '日本語' },
      { code: 'zh-CN', file: 'zh-CN.json', name: '简体中文' },
      { code: 'zh-TW', file: 'zh-TW.json', name: '繁體中文' },
    ],
    defaultLocale: 'en',
    strategy: 'no_prefix', // No locale prefix in URLs (single-language per session)
    detection: {
      redirect: true,
      useCookie: true,
      cookieKey: 'lnpm-lang',
    },
    langDir: 'assets/locales/',
  },
})
```

### Locale Files

1. **Copy desktop locale files** (`src/locales/*.json`) to `app/assets/locales/`
2. **Extend with dashboard-specific keys** — the desktop locales cover ~200 keys. The dashboard will need additional keys for:
   - Dashboard-specific headings ("Monitors", "All Monitors")
   - WebSocket connection states ("Connecting...", "Reconnecting...")
   - Cloud-specific actions ("Sync Now", "Cloud Status")
3. **Merge strategy:** Start with desktop locale files as baseline, add dashboard keys alongside existing keys.

### Language Resolution

Mirror the desktop's `resolveLanguage()` function:
```ts
// useSettings.ts
export function useSettings() {
  const language = useState<Language>('language', () => 'en');

  function resolveLanguage(preference: LanguagePreference = 'auto'): Language {
    if (preference !== 'auto') return preference;
    // Use navigator.language or cookie preference
    const browserLang = navigator.language.toLowerCase();
    // ... same resolution logic as desktop
  }
}
```

### Key Considerations
- **SSR compatibility:** `@nuxtjs/i18n` handles locale detection on the server side (via Accept-Language header) and client side (via cookie/browser preference).
- **No URL prefix:** The dashboard uses `strategy: 'no_prefix'` since language is a user preference, not a routing concern.
- **Dynamic content:** WebSocket messages and real-time updates use the `$t()` composable from `@nuxtjs/i18n`.
- **Fallback:** Missing keys fall back to English (same as desktop behavior).

---

## Current UI State

### Screenshot Reference

The screenshot at `docs/assets/lnpm-dashboard.png` shows the **desktop app** in its fully functional state:
- 5 monitors configured (Google, Inner, .57, .58, .59)
- "Inner" monitor selected (192.168.25.1)
- Warming up state (blue pill)
- 1H time range active
- uPlot chart with multiple series and quality interval bands
- Metric cards showing Average (10ms), P95 (628ms), Unstable (1.78%), Disconnected (0.00%), Packet loss (0.00%)

### Current Dashboard State

The **cloud dashboard** (`dashboard/`) currently has:
- `app.vue` — minimal wrapper with `<NuxtLayout>` and `<NuxtPage>`
- `app/layouts/default.vue` — bare layout shell with minimal styling
- `app/pages/index.vue` — placeholder with "Monitors will appear here once data is ingested"

**No actual UI components exist yet.** The plan above defines the complete component set to be built.

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **CSS Framework** | Vanilla CSS custom properties | Existing design is fully tokenized; Tailwind would add complexity without benefit |
| **State Management** | Composables + `useState` | Scope is single-page; Pinia not needed. `useState` provides SSR-safe shared state |
| **i18n** | `@nuxtjs/i18n` module | SSR-compatible, auto-routing, integrates with Nuxt lifecycle |
| **Charts** | uPlot (same as desktop) | Performance, consistency, small bundle. Canvas-based handles thousands of points |
| **Responsive** | Desktop-first, tablet-fallback | Monitoring tool primarily used on desktop; tablet support for convenience |
| **Icons** | SVG inline (Lucide) | No emoji icons. Desktop uses inline SVG paths — consistent approach |
| **Modals** | Native `<dialog>` element | Already used in desktop. Browser-native with `.showModal()`, backdrop, and focus trapping |
| **Animations** | 150-300ms transitions, `prefers-reduced-motion` respected | Already established in desktop CSS. Chart animations minimal (data updates only) |

---

## Next Agent: Agent 05 (Create Implementation Plan)

This UI/UX plan provides the design system, component hierarchy, state management approach, styling strategy, and accessibility considerations needed for Agent 05 to create a detailed implementation plan with specific tasks, file paths, and code structure.

### Artifacts Produced

| Artifact | Location |
|----------|----------|
| UI/UX Plan | `docs/ui-ux-plan.md` (this file) |
| Design System (persisted) | `design-system/lnpm-cloud-dashboard/MASTER.md` (if persisted via ui-ux-pro-max) |

### Files to Create (for reference by Agent 05)

| File | Component |
|------|-----------|
| `app/assets/css/global.css` | Global design tokens + resets |
| `app/layouts/default.vue` | `AppLayout` (replaces current placeholder) |
| `app/components/MonitorSidebar.vue` | Monitor list sidebar |
| `app/components/MonitorRow.vue` | Individual monitor row |
| `app/components/DashboardPanel.vue` | Chart + metrics panel |
| `app/components/ChartCard.vue` | uPlot chart with legend |
| `app/components/MetricCard.vue` | Summary metric card |
| `app/components/StatePill.vue` | Quality state pill |
| `app/components/RangeSelector.vue` | Time range buttons |
| `app/components/TargetDialog.vue` | Add/edit monitor modal |
| `app/components/SettingsDialog.vue` | Settings modal |
| `app/components/ToastNotification.vue` | Toast notification |
| `app/components/EmptyState.vue` | Empty state display |
| `app/composables/useMonitors.ts` | Monitor state management |
| `app/composables/useHistory.ts` | Chart history management |
| `app/composables/useWebSocket.ts` | WebSocket connection |
| `app/composables/useChart.ts` | uPlot chart lifecycle |
| `app/composables/useRange.ts` | Time range management |
| `app/composables/useToast.ts` | Toast notification system |
| `app/composables/useSettings.ts` | Settings + language |
| `app/composables/useHealth.ts` | Health check polling |
| `app/assets/locales/en.json` | English locale |
| `app/assets/locales/ko.json` | Korean locale |
| `app/assets/locales/ja.json` | Japanese locale |
| `app/assets/locales/zh-CN.json` | Simplified Chinese locale |
| `app/assets/locales/zh-TW.json` | Traditional Chinese locale |
| `app/pages/index.vue` | Dashboard home page |

---

## Gate Checklist

- [x] All design skills installed and invoked (ui-ux-pro-max, design-system)
- [x] Current design analyzed (desktop `src/styles.css`, `src/main.ts`, screenshot)
- [x] Reusable components identified (conceptual patterns from desktop code)
- [x] UI implementation plan documented (this document)
- [x] Design system tokens defined (3-layer architecture)
- [x] Component specifications written (12 components with props, events, accessibility)
- [x] State management approach defined (composables + `useState`)
- [x] Styling strategy decided (vanilla CSS custom properties)
- [x] Chart approach defined (uPlot in Vue 3 lifecycle)
- [x] Accessibility requirements documented (WCAG 2.1 AA)
- [x] Responsive design strategy defined (desktop-first, 3 breakpoints)
- [x] i18n strategy defined (5 locales, `@nuxtjs/i18n` module)
