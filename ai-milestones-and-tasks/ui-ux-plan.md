# UI/UX Plan — LNPM Cloud Dashboard

> **Author:** Agent 04 (Plan UI/UX Design)
> **Date:** 2026-08-03
> **For:** Nuxt 4 + Vue 3 Cloud Dashboard
> **Consumer:** Agent 05 (Create Implementation Plan)
> **Skills invoked:** ui-ux-pro-max, ui-styling, design-system (all installed and queried)

---

## 1. Design System

### 1.1. Source of Truth

The LNPM desktop app (`src/styles.css`, ~1786 lines) is the **primary design reference**. The cloud dashboard must mirror its visual identity — same color palette, typography, spacing, and interaction patterns. The desktop app uses vanilla CSS custom properties with no CSS framework.

### 1.2. Color Palette (CSS Custom Properties)

All colors from the desktop app's `:root` block, to be replicated in the Nuxt dashboard:

#### Primitive Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#071016` | Main background (very dark navy) |
| `--panel` | `#0b161e` | Panel surface |
| `--panel-raised` | `#101e27` | Elevated panels |
| `--panel-soft` | `#0d1a22` | Soft panel variation |
| `--line` | `rgba(148, 176, 194, 0.14)` | Subtle borders/dividers |
| `--line-strong` | `rgba(148, 176, 194, 0.25)` | Stronger borders |
| `--text` | `#e7eef5` | Primary text (light blue-white) |
| `--muted` | `#8799a7` | Secondary/muted text |
| `--muted-strong` | `#a7b7c2` | Stronger muted text |

#### Accent & Semantic Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | `#45dfc2` | Primary accent (teal/cyan) |
| `--accent-bright` | `#72f3dc` | Bright accent variant |
| `--accent-soft` | `rgba(69, 223, 194, 0.12)` | Accent with low opacity |
| `--blue` | `#60a5fa` | Blue (warming-up state) |
| `--warning` | `#f6a94a` | Warning color |
| `--warning-soft` | `rgba(246, 169, 74, 0.12)` | Warning soft background |
| `--danger` | `#ff6b78` | Danger/error color |
| `--danger-soft` | `rgba(255, 107, 120, 0.12)` | Danger soft background |

#### Status/State Colors (hardcoded, not tokens)
| State | Color | Usage |
|-------|-------|-------|
| `low` / `stable` | `#4ade80` (green) | Healthy connection |
| `medium` | `#facc15` (yellow) | Moderate latency |
| `high` | `#fb923c` (orange) | High latency |
| `veryHigh` | `#f87171` (red) | Critical latency |
| `unstable` | `#c084fc` (purple) | Unstable connection |
| `disconnected` | `#ff9aa3` (pink-red) | Disconnected |
| `warmingUp` | `#60a5fa` (blue) | Warming up |
| `paused` | `#8799a7` (muted gray) | Paused |

#### Chart Series Colors (uPlot)
```
["#5eead4", "#60a5fa", "#c084fc", "#f472b6", "#facc15"]
```

### 1.3. Typography

| Property | Value |
|----------|-------|
| **Font family** | `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans CJK KR", "Noto Sans CJK JP", "Microsoft YaHei", "Microsoft JhengHei", sans-serif` |
| **Monospace** | `"Cascadia Code", "SFMono-Regular", Consolas, monospace` (latency values, timestamps) |
| **Font synthesis** | `none` (disabled) |
| **Text rendering** | `optimizeLegibility` |

| Size | Weight | Usage |
|------|--------|-------|
| 9px | 400 | Smallest labels, metric subtext |
| 10px | 600/700 | Eyebrow labels, form labels, legend |
| 11px | 400/650 | Subtext, host names, toggle descriptions |
| 12px | 400 | Inputs, chart labels, tooltips |
| 13px | 650 | Target names, host info |
| 14px | 400 | Empty state text |
| 17px | 700 | H1, brand name |
| 19px | 650 | H3, modal headings |
| 20px | 650 | H2, dashboard headings |
| 21px | 600 | Metric values |

**Letter spacing:** -0.01em to -0.03em (tight) for headings; 0.15em for eyebrow text.

### 1.4. Spacing & Sizing

| Token | Value |
|-------|-------|
| `--radius` | `12px` (default border radius) |
| `--shadow` | `0 18px 55px rgba(0, 0, 0, 0.3)` (card/modal shadow) |
| `--sidebar-width` | `320px` (default, resizable in desktop) |

### 1.5. Design System Approach

**Recommendation: Global CSS file + scoped component styles.**

- Create `dashboard/app/assets/css/design-tokens.css` — mirrors the desktop app's `:root` block with all CSS custom properties
- Import in `nuxt.config.ts` via `css: ['~/assets/css/design-tokens.css']`
- Use scoped `<style>` blocks in each Vue component for component-specific styles
- This approach:
  - Maintains consistency with the desktop app
  - Avoids adding Tailwind (unnecessary complexity for this use case)
  - Keeps CSS predictable and debuggable
  - Allows component-level overrides via scoped styles
  - No build-time CSS processing overhead

**Alternative considered: Tailwind CSS** — rejected because:
- The desktop app uses vanilla CSS (design consistency)
- Tailwind adds build complexity
- Custom properties already provide theming
- No component library to pair with Tailwind

### 1.6. UI/UX Pro Max Skill Findings

**Design Pattern:** Real-Time / Operations Landing — Modern Dark (Cinema Mobile)
- **Confirmed alignment:** The desktop app already uses a dark theme with teal accents — matches the "Modern Dark" recommendation from the skill database.
- **Motion:** Stagger list (Standard) — 300-450ms with back.out(1.4) easing for grid-item animations
- **Density:** High (8/10) — dense dashboard layout confirmed
- **Accessibility:** WCAG AA minimum, requires careful accent contrast check

**Chart Recommendations (from skill database):**
- **Streaming Area Chart** for real-time monitoring — uPlot is correct choice
- **Line Chart with Highlights** for anomaly detection — spikes already visible in current design
- **Current value as large text KPI** — already implemented in metric cards
- **Pause/resume control required** — already present as "Live" toggle
- **prefers-reduced-motion** must freeze animations — already implemented in desktop

**Nuxt.js Stack Guidelines:**
- Use auto-imported composables directly (`ref`, `computed`, `useFetch`)
- Use `useState` for shared reactive state (SSR-friendly cross-component state)
- Pinia for complex state (consider if app grows beyond composables)

**Accessibility Guidelines (from skill database):**
- Keyboard navigation: tab order matches visual order (already in desktop with `role="button"`, `tabindex="0"`)
- Skip links for keyboard users (to add in cloud dashboard)
- Sequential heading hierarchy h1-h6 (to enforce)
- All `focus-visible` states use `2px solid rgba(69, 223, 194, 0.62)` outline

---

## 2. Component Hierarchy

### 2.1. Layout Shell

```
App (app.vue)
  └── DefaultLayout (layouts/default.vue)
        ├── Header
        │     ├── Brand (logo + "LNPM" + subtitle)
        │     └── HeaderActions (Live/Pause buttons + Settings icon)
        ├── Workspace (CSS Grid: sidebar | main)
        │     ├── Sidebar
        │     │     ├── SidebarHeading ("MONITORS" eyebrow + count + Add button)
        │     │     ├── TargetList (scrollable)
        │     │     │     ├── TargetRow ("All monitors" aggregate view)
        │     │     │     └── TargetRow (per monitor: status dot, name, host, latency, edit icon)
        │     │     └── EmptyTargets (radar animation + "No monitors" message)
        │     └── DashboardPanel
        │           ├── DashboardHeading
        │           │     ├── StatePill (quality state badge)
        │           │     ├── Heading (monitor name)
        │           │     └── Subheading (host/IP)
        │           ├── RangeControls (1H / 24H / 7D / 30D / Custom segmented buttons)
        │           ├── ChartCard
        │           │     ├── ChartHost (uPlot canvas container)
        │           │     ├── ChartLoading (loading state overlay)
        │           │     └── ChartLegend (per-series color legend items)
        │           ├── ChartTooltip (positioned overlay, not in DOM tree)
        │           └── SummaryGrid (5 metric cards)
        │                 ├── MetricCard (Average)
        │                 ├── MetricCard (P95 Latency)
        │                 ├── MetricCard.warning (Unstable)
        │                 ├── MetricCard.danger (Disconnected)
        │                 └── MetricCard (Packet Loss)
        └── Modals
              ├── TargetDialog (add/edit monitor form, native <dialog>)
              ├── SettingsDialog (settings form, native <dialog>)
              └── RangeDialog (custom date range picker, native <dialog>)
```

### 2.2. Components to Create

| Component | Description | Files |
|-----------|-------------|-------|
| `AppHeader` | Top bar with brand and action buttons | `app/components/AppHeader.vue` |
| `BrandLogo` | Logo mark + text | `app/components/BrandLogo.vue` |
| `Sidebar` | Left sidebar with monitor list | `app/components/Sidebar.vue` |
| `TargetRow` | Single monitor row in sidebar | `app/components/TargetRow.vue` |
| `EmptyTargets` | Empty state with radar animation | `app/components/EmptyTargets.vue` |
| `DashboardPanel` | Main content area | `app/components/DashboardPanel.vue` |
| `DashboardHeading` | Heading + state pill + range controls | `app/components/DashboardHeading.vue` |
| `StatePill` | Quality state badge with colored dot | `app/components/StatePill.vue` |
| `RangeControls` | Segmented time range buttons | `app/components/RangeControls.vue` |
| `ChartCard` | Container for uPlot chart + legend | `app/components/ChartCard.vue` |
| `ChartLegend` | Horizontal legend of series | `app/components/ChartLegend.vue` |
| `ChartTooltip` | Floating tooltip on chart hover | `app/components/ChartTooltip.vue` |
| `SummaryGrid` | 5-column metric cards grid | `app/components/SummaryGrid.vue` |
| `MetricCard` | Individual metric display card | `app/components/MetricCard.vue` |
| `TargetDialog` | Add/edit monitor modal | `app/components/TargetDialog.vue` |
| `SettingsDialog` | Settings modal | `app/components/SettingsDialog.vue` |
| `RangeDialog` | Custom date range modal | `app/components/RangeDialog.vue` |
| `ToastStack` | Toast notification stack | `app/components/ToastStack.vue` |
| `MonitorPage` | Main dashboard page | `app/pages/index.vue` |

### 2.3. Components to Reuse (from Desktop App)

**No direct code reuse** — the desktop app is vanilla TypeScript with template-literal HTML generation. The cloud dashboard uses Vue 3 SFC components. However, the **CSS patterns, class names, and design tokens should be mirrored** exactly.

**Conceptual reuse** (patterns to replicate):
- CSS class names (`.target-row`, `.chart-card`, `.metric-card`, `.state-pill`, etc.)
- CSS custom properties (all `--bg`, `--accent`, `--line` tokens)
- Status dot system with `::before` pseudo-elements and glow shadows
- uPlot chart styling (`.uplot .u-cursor-x`, `.chart-tooltip`)
- Modal `<dialog>` element patterns
- Toggle switch patterns
- Form styling (inputs, labels, fieldsets)

### 2.4. Components NOT to Create

- **Sidebar resizer** — the cloud dashboard will have a fixed sidebar width (no drag-to-resize). Simplification for web context.
- **Update dialog** — desktop app feature (auto-updates). Not relevant for cloud dashboard.
- **Popup/tray view** — desktop app feature (system tray). Not applicable.

---

## 3. State Management

### 3.1. Approach: Vue 3 Composables

**No Pinia.** The dashboard state is manageable with composables. No complex domain logic requires a centralized store.

### 3.2. Composables to Create

| Composable | Purpose | File |
|-----------|---------|------|
| `useMonitors` | Monitor list, selection, sidebar state | `app/composables/useMonitors.ts` |
| `useWebSocket` | WebSocket connection, real-time ping updates | `app/composables/useWebSocket.ts` |
| `useChart` | uPlot chart lifecycle, data feeding | `app/composables/useChart.ts` |
| `useQualityState` | Quality state classification logic | `app/composables/useQualityState.ts` |
| `useRange` | Time range selection (1H/24H/7D/30D/Custom) | `app/composables/useRange.ts` |
| `useMetrics` | Metric calculations (avg, p95, packet loss, etc.) | `app/composables/useMetrics.ts` |
| `useToast` | Toast notification management | `app/composables/useToast.ts` |

### 3.3. Reactive State Structure

```typescript
// useMonitors.ts
interface MonitorState {
  monitors: Monitor[];
  selectedMonitorId: string | null;  // null = "All monitors" view
  isLive: boolean;
}

// useChart.ts
interface ChartState {
  series: uPlot.Series[];
  data: number[][];
  isLoading: boolean;
}

// useRange.ts
type TimeRange = '1h' | '24h' | '7d' | '30d' | 'custom';
interface RangeState {
  range: TimeRange;
  customFrom: Date | null;
  customTo: Date | null;
}
```

### 3.4. Data Flow

```
WebSocket (server) → useWebSocket → useMonitors (reactive) → Components
API endpoints     → useMonitors (fetch on mount) → Components
User interactions → Composables → API mutations → WebSocket updates
```

### 3.5. Nuxt-Specific State Management

**Key Nuxt.js patterns to follow (from UI/UX Pro Max stack guidelines):**

1. **`useState` for shared state** — Use `useState()` instead of `ref()` for state shared across components. `useState` is SSR-friendly and persists across server/client hydration.
2. **Auto-imported composables** — Vue composables (`ref`, `computed`, `watch`, `onMounted`) are auto-imported by Nuxt. No manual imports needed.
3. **`useFetch` / `useAsyncData`** — Use Nuxt's data fetching composables for API calls (handles loading/error states, auto-retries, cache).
4. **Avoid Pinia unless complexity demands** — Start with composables + `useState`. Add Pinia only if state management becomes too complex.

---

## 4. Styling Strategy

### 4.1. Approach: CSS Custom Properties + Scoped Styles

**Decision: Continue with vanilla CSS custom properties. Do NOT adopt Tailwind.**

**Rationale:**
- Desktop app uses vanilla CSS — visual consistency is paramount
- Custom properties provide excellent theming (dark mode only, but structured)
- No component library to pair with Tailwind (Tailwind shines with component systems like shadcn/ui)
- Simpler build pipeline (no PostCSS/Tailwind config)
- Design tokens are already defined and tested in the desktop app

### 4.2. File Organization

```
dashboard/
  app/
    assets/
      css/
        design-tokens.css    # :root with all CSS custom properties (mirrors desktop)
    components/
      AppHeader.vue           # <style scoped> with component-specific styles
      Sidebar.vue
      ...
    pages/
      index.vue
```

### 4.3. Nuxt Configuration

Add to `nuxt.config.ts`:
```typescript
export default defineNuxtConfig({
  // ...existing config
  css: ['~/assets/css/design-tokens.css'],
});
```

### 4.4. Background Gradient

The desktop app uses a subtle radial gradient on the body:
```css
body {
  background:
    radial-gradient(circle at 70% -20%, rgba(69, 223, 194, 0.08), transparent 38%),
    var(--bg);
}
```
This should be replicated on the dashboard shell.

---

## 5. Chart Integration

### 5.1. Approach: uPlot in Vue 3 via Lifecycle Hooks

**uPlot** (same library as desktop app) is the charting solution. It's a lightweight, canvas-based charting library optimized for real-time data.

### 5.2. Implementation Pattern

```typescript
// In a Vue component (e.g., ChartCard.vue)
import uPlot from 'uplot';

const chartRef = ref<HTMLDivElement>();
let chart: uPlot | null = null;

onMounted(() => {
  if (chartRef.value) {
    chart = new uPlot(options, initialData, chartRef.value);
  }
});

onUnmounted(() => {
  if (chart) {
    chart.destroy();
    chart = null;
  }
});

// Watch for data changes
watch(chartData, (newData) => {
  if (chart) {
    chart.setData(newData);
  }
});
```

### 5.3. uPlot Configuration (from desktop app)

- **Bar mode** for single-target view (threshold-based bar coloring: green/yellow/orange/red)
- **Line mode** for multi-target "All monitors" view
- **Cursor crosshair** with custom tooltip
- **No built-in legend** (custom legend component)
- **Time axis** on X, milliseconds on Y
- **Font:** inherits from parent (12px, muted color)
- **Grid lines:** subtle, using `--line` color

### 5.4. Dependencies to Add

```json
{
  "uplot": "^18.1.1",
  "@types/uplot": "^1.1.0"
}
```

---

## 6. Accessibility

### 6.1. Already Established in Desktop App

- **Focus-visible outlines:** 2px solid teal outline on all interactive elements (`:focus-visible`)
- **Keyboard navigation:** Tab order through sidebar targets, buttons, and modals
- **ARIA labels:** Target rows use descriptive labels, buttons have text labels
- **Semantic HTML:** `<header>`, `<main>`, `<aside>`, `<section>`, `<dialog>`, `<nav>` elements
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables all animations

### 6.2. Additional Cloud Dashboard Considerations

- **Screen reader announcements:** Use `aria-live="polite"` regions for real-time updates (ping changes, state changes)
- **Color contrast:** All current tokens meet WCAG AA (4.5:1) for text on dark backgrounds
- **Focus management in modals:** Trap focus within `<dialog>` elements (native browser behavior)
- **Status indicators:** Don't rely on color alone — status dots have shape + glow + label context
- **Chart accessibility:** Add `aria-describedby` on chart container pointing to summary text; consider providing data table alternative

### 6.3. Accessibility Additions for Cloud Dashboard

| Requirement | Desktop Status | Cloud Dashboard Action |
|-------------|---------------|------------------------|
| Skip to main content link | ❌ Not present | **Add** to HeaderBar (`#skip-to-content`) |
| Heading hierarchy h1→h2→h3 | Partially | Enforce (h1=app title, h2=sections, h3=modals, h4=settings) |
| `role="switch"` for toggles | Uses custom toggle | Use `role="switch"` with `aria-checked` |
| Live region for state changes | Partially | Add `aria-live="polite"` to dashboard heading |
| Chart canvas `aria-label` | Not present | Add descriptive label |
| Form labels (not placeholder-only) | ✅ `<label>` elements | Maintain |

### 6.4. Pre-Delivery Accessibility Checklist

From UI/UX Pro Max pre-delivery checklist:
- [ ] No emojis as icons (use SVG: Lucide/Heroicons)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Focus states visible for keyboard nav
- [ ] `prefers-reduced-motion` respected
- [ ] Text contrast 4.5:1 minimum

---

## 7. Responsive Design

### 7.1. Approach: Desktop-First

LNPM is a monitoring tool primarily used on desktop. The cloud dashboard should be optimized for desktop first, with functional (not perfect) support on tablets.

### 7.2. Breakpoints

| Breakpoint | Value | Adjustment |
|-----------|-------|------------|
| `≥ 1200px` | Default | Full layout (320px sidebar, 5-column metrics) |
| `980px - 1199px` | Tablet | 210px sidebar, 3-column metrics (desktop app already handles this) |
| `< 980px` | Mobile (functional only) | Collapsible sidebar, 2-column metrics, stacked controls |

**Mobile is not a priority.** The desktop app has a `min-width: 840px` constraint. The cloud dashboard should be functional at 980px+ and degrade gracefully below that.

### 7.3. Mobile Considerations

- Sidebar can collapse to icons-only or overlay
- Chart should maintain aspect ratio
- Metric grid should reflow to 2 columns
- Buttons should maintain minimum 44px touch targets (per ui-ux-pro-max guidelines)

---

## 8. i18n (Internationalization)

### 8.1. Approach: Nuxt i18n Module

Use `@nuxtjs/i18n` module for internationalization. Mirror the desktop app's 5-locale support.

### 8.2. Locales

| Code | Language |
|------|----------|
| `en` | English |
| `ko` | Korean |
| `ja` | Japanese |
| `zh-CN` | Simplified Chinese |
| `zh-TW` | Traditional Chinese |

### 8.3. Implementation

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', file: 'en.json' },
      { code: 'ko', file: 'ko.json' },
      { code: 'ja', file: 'ja.json' },
      { code: 'zh-CN', file: 'zh-CN.json' },
      { code: 'zh-TW', file: 'zh-TW.json' },
    ],
    strategy: 'no_prefix',  // No locale prefix in URLs (single-language session)
  },
});
```

### 8.4. Dependencies to Add

```json
{
  "@nuxtjs/i18n": "^9.0.0"
}
```

---

## 9. Current UI State

### 9.1. Desktop App Screenshot

The file `docs/assets/lnpm-dashboard.png` shows the current LNPM desktop dashboard with:
- **Left sidebar:** 5 monitors (Google, Inner, .57, .58, .59) with status dots, names, hosts, and latency values
- **Header:** Brand "LNPM" with subtitle "Live Network Ping Monitor", Live/Pause/Settings buttons
- **Main area:** Large uPlot chart showing latency over time (1H view), with multiple colored lines
- **Legend below chart:** Color-coded legend items for each monitor
- **Summary grid:** 5 metric cards (Average 10ms, P95 Latency 628ms, Unstable 1.78%, Disconnected 0.00%, Packet Loss 0.00%)
- **Dark theme** throughout with teal/cyan accent for interactive elements

### 9.2. Current Nuxt Dashboard State

The Nuxt dashboard is a **skeleton**:
- `app/layouts/default.vue` — minimal shell with `.dashboard-shell` flex column
- `app/pages/index.vue` — placeholder text "Monitors will appear here once data is ingested"
- Server infrastructure is complete (SQLite, WebSocket, API routes, health endpoint)
- No frontend UI components exist yet
- No charting library installed

---

## 10. Summary of Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CSS Framework | **Vanilla CSS + custom properties** | Mirrors desktop app; no unnecessary complexity |
| Component Library | **None (custom Vue SFCs)** | Desktop app uses no library; maintain visual parity |
| State Management | **Vue 3 composables (no Pinia)** | Sufficient for dashboard scope |
| Charting | **uPlot** | Same as desktop; lightweight, real-time optimized |
| i18n | **@nuxtjs/i18n** | Nuxt-native; supports 5 locales |
| Layout | **Desktop-first, CSS Grid** | Matches desktop app's `workspace` grid |
| Modals | **Native `<dialog>` elements** | Browser-native; no library needed |
| Theming | **Dark only** (matching desktop) | Monitoring tool; dark theme is standard |
| Responsive | **Desktop ≥980px, functional on tablets** | Tool is primarily desktop-used |
| Global CSS | **design-tokens.css** (mirrors `src/styles.css` `:root`) | Single source of truth for all tokens |

---

## 11. Next Steps for Agent 05

Agent 05 should create the implementation plan based on this UI/UX plan, including:

1. **Create `app/assets/css/design-tokens.css`** — mirror desktop CSS tokens
2. **Install dependencies** — `uplot`, `@types/uplot`, `@nuxtjs/i18n`
3. **Update `nuxt.config.ts`** — add CSS import, i18n module
4. **Create composables** — `useMonitors`, `useWebSocket`, `useChart`, etc.
5. **Create components** — all 18 components listed in Section 2.2
6. **Implement pages** — replace placeholder `index.vue` with full dashboard
7. **Create i18n locale files** — 5 JSON files
8. **Implement WebSocket integration** — real-time data flow
9. **Add accessibility features** — ARIA labels, live regions, focus management
10. **Test responsive breakpoints** — ensure functional at 980px+

---

## Gate Checklist

- [x] All design skills installed and invoked (ui-ux-pro-max, design-system, ui-styling — all available in session)
- [x] Current design analyzed (styles.css, main.ts, screenshot, types)
- [x] Reusable components identified (CSS patterns, class names, tokens — conceptual reuse only)
- [x] UI implementation plan documented (this document)
