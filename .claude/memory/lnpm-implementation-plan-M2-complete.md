# LNPM Cloud Dashboard — Implementation Plan (M2 Complete)

> **Date:** 2026-08-03
> **Branch:** `feature/M2-T1-dashboard-shell`
> **Scope:** M2-T1 through M2-T7 (full M2 milestone)
> **Status:** M2-T1 complete; M2-T2 through M2-T7 planned

---

## Executive Summary

M2-T1 (dashboard shell) is **complete** — layout, sidebar, routing, and base components are implemented. The remaining work is the **frontend data visualization layer**: charts, detail views, WebSocket live updates, and client management features.

**All backend APIs are complete** (M1: health, monitors, history, clients, ingest, WebSocket). The plan below covers 7 tasks across M2, organized by layer and dependency order.

---

## Current State Assessment

### M2-T1 — COMPLETE ✅

| File | Status |
|------|--------|
| `app.vue` | ✅ Working |
| `app/layouts/default.vue` | ✅ Grid layout with sidebar + main |
| `app/pages/index.vue` | ✅ Route works; placeholder content |
| `app/pages/monitors/[id].vue` | ✅ Route works; placeholder content |
| `app/pages/clients/[slug]/index.vue` | ✅ Route works; placeholder content |
| `app/components/DashboardSidebar.vue` | ✅ Desktop + mobile sidebar |
| `app/components/layout/DashboardHeader.vue` | ✅ Header with brand |
| `app/components/shared/SidebarContent.vue` | ✅ All Monitors + client groups |
| `app/components/sidebars/ClientGroup.vue` | ✅ Collapsible groups |
| `app/components/sidebars/MonitorRow.vue` | ✅ Status dot + name + navigation |
| `app/components/shared/StatusDot.vue` | ✅ 7-state color mapping |
| `app/components/shared/EmptyState.vue` | ✅ Radar animation + message |
| `app/components/shared/NavigationBreadcrumb.vue` | ✅ Back button |
| `app/composables/useMonitors.ts` | ✅ Fetch + group by client |
| `app/composables/useResponsiveSidebar.ts` | ✅ 980px breakpoint |
| `app/assets/css/dashboard.css` | ✅ ~650 lines of dark theme CSS |

### M2-T2 — MOSTLY COMPLETE ⚠️ (minor enhancements needed)

All sidebar components and the `useMonitors` composable are implemented. The acceptance criteria are mostly met:

| Criterion | Status |
|-----------|--------|
| `useMonitors` fetches and groups monitors | ✅ Done |
| Sidebar renders client groups | ✅ Done |
| Client groups are collapsible | ✅ Done |
| MonitorRow shows status dot, name | ✅ Done |
| Clicking monitor navigates to detail | ✅ Done |
| Status dot colors match spec | ✅ Done |
| **Toggle shows/hides in chart** | ❌ Not yet (no chart exists) |

**Gap:** The monitor toggle checkbox and the "show/hide in chart" behavior are not implemented because there is no chart yet. This is deferred to M2-T3.

---

## Implementation Plan

### Phase 1: Foundation — uPlot Integration (M2-T3 base)

**Goal:** Install and configure uPlot, create the base chart component and data transformation composables.

#### Step 1.1: Install uPlot and types

```
pnpm add uplot
pnpm add -D @types/uplot
```

Update `dashboard/package.json` to include:
- `uplot` in dependencies (latest stable)
- `@types/uplot` in devDependencies

#### Step 1.2: Create shared chart palette composable

**File:** `dashboard/app/composables/useDashboardPalette.ts`

- 12-color palette for simultaneous monitor series
- Colors: `#3b82f6, #ef4444, #10b981, #f59e0b, #8b5cf6, #ec4899, #06b6d4, #f97316, #14b8a6, #6366f1, #84cc16, #e11d48`
- Export `getPaletteColor(index: number): string`

#### Step 1.3: Create time window composable

**File:** `dashboard/app/composables/useTimeWindow.ts`

- Manage selected time range preset: `1h` (default), `6h`, `24h`, `7d`
- Export reactive `selectedPreset`, computed `fromMs`/`toMs`
- Presets: `1h = 3600000ms`, `6h = 21600000ms`, `24h = 86400000ms`, `7d = 604800000ms`

#### Step 1.4: Create history fetch composable

**File:** `dashboard/app/composables/useMonitorHistory.ts`

- Fetch `GET /api/monitors/[id]?fromMs=...&toMs=...&maxPoints=2000`
- Uses `useAsyncData` with key `"monitor-history-{id}-{fromMs}"`
- Returns `HistoryResponse` typed data (already defined in `shared/types.ts`)
- Handles loading/error states

#### Step 1.5: Create chart data transformation composable

**File:** `dashboard/app/composables/useChartSeries.ts`

- Transform `HistoryPoint[]` into uPlot-ready `number[][]` format
- Column 0: timestamps (seconds, not ms — uPlot convention)
- Column 1+: latency values
- Handle null/missing data points (use `NaN` for gaps)
- Export `transformToUPlotData(history: HistoryResponse): number[][]`

#### Step 1.6: Create base LatencyChart component

**File:** `dashboard/app/components/charts/LatencyChart.vue`

- Wraps uPlot canvas element
- Props: `data: number[][]`, `options: uPlot.Options`, `width`, `height`
- Uses `useRef` for canvas element, `onMounted` to create uPlot instance
- `watch` on data prop to call `uPlot.update()` when data changes
- Destroy on unmount
- CSS: dark theme background, responsive container

**Dependencies:** Phase 1.2, 1.3, 1.4, 1.5

---

### Phase 2: All-Monitors Chart (M2-T3)

**Goal:** Replace the index page placeholder with a multi-series chart showing all monitors.

#### Step 2.1: Create AllMonitorsChart component

**File:** `dashboard/app/components/charts/AllMonitorsChart.vue`

- Multi-series uPlot chart
- Fetches history for each monitor in parallel using `useMonitorHistory`
- Assigns colors from `useDashboardPalette`
- Props: `monitorIds: number[]`, `timeWindow: string`
- Toggles series visibility via sidebar state
- Handles empty data (show EmptyState)
- CSS: `.all-monitors-chart` container, legend styling

#### Step 2.2: Create TimeRangeSelector component

**File:** `dashboard/app/components/shared/TimeRangeSelector.vue`

- Button group: `1h`, `6h`, `24h`, `7d`
- Emits `select(preset: string)` event
- Active state styling (highlighted button)
- CSS: `.time-range-selector` with button group

#### Step 2.3: Update index page

**Modify:** `dashboard/app/pages/index.vue`

- Remove placeholder
- Compose: `<AllMonitorsChart>` + `<TimeRangeSelector>`
- Fetch all monitor IDs via `useMonitors`
- Watch time window change → refetch data

#### Step 2.4: Add monitor toggle state to useMonitors

**Modify:** `dashboard/app/composables/useMonitors.ts`

- Add `visibleMonitors` Set (persisted to localStorage)
- Add `toggleMonitor(id: number)` function
- Add `isVisible(id: number): boolean` computed

#### Step 2.5: Add toggle checkbox to MonitorRow

**Modify:** `dashboard/app/components/sidebars/MonitorRow.vue`

- Add checkbox/toggle prop for visibility
- Emit `toggle` event
- Visual state: dimmed when hidden

**Dependencies:** Phase 1 (all steps)

---

### Phase 3: Per-Monitor Detail View (M2-T4)

**Goal:** Replace the monitor detail placeholder with chart, quality intervals, and metrics.

#### Step 3.1: Create MonitorHeader component

**File:** `dashboard/app/components/charts/MonitorHeader.vue`

- Displays monitor name, target host, current quality state
- Latest latency, status, resolved address
- Uses `MonitorListItem` from `shared/types.ts`

#### Step 3.2: Create QualityIntervals component

**File:** `dashboard/app/components/charts/QualityIntervals.vue`

- Renders quality interval bands on uPlot chart
- Uses `QualityIntervalRecord[]` from `HistoryResponse`
- Implementation: uPlot `align` bands or custom series with `paths.stroke()` override
- Color mapping from `QUALITY_COLORS` (already in `server/utils/quality-states.ts`, port to frontend)

#### Step 3.3: Create MonitorSummary component

**File:** `dashboard/app/components/charts/MonitorSummary.vue`

- Displays `RangeSummary` metrics
- Grid layout: packet loss %, avg/min/max/p95 latency
- Stability percentages: stable %, unstable %, disconnected %
- CSS: `.monitor-summary` grid with labeled stat cards

#### Step 3.4: Create ChartThreshold component

**File:** `dashboard/app/components/charts/ChartThreshold.vue`

- Horizontal line overlay at configured p95 latency threshold
- Uses `QualityThresholds.p95LatencyMs` from `Target` type
- uPlot `Line` plugin or custom series

#### Step 3.5: Update monitors/[id] page

**Modify:** `dashboard/app/pages/monitors/[id].vue`

- Remove placeholder
- Compose: `<NavigationBreadcrumb>` + `<MonitorHeader>` + `<LatencyChart>` + `<QualityIntervals>` + `<MonitorSummary>` + `<TimeRangeSelector>`
- Fetch history via `useMonitorHistory`
- 404 handling: redirect to `/` if monitor not found

**Dependencies:** Phase 2, Phase 1

---

### Phase 4: WebSocket Live Updates (M2-T5)

**Goal:** Real-time sample push to charts, auto-reconnect, reconnect indicator.

#### Step 4.1: Create useWebSocket composable

**File:** `dashboard/app/composables/useWebSocket.ts`

- Manage WebSocket connection to `ws://<host>/ws/ping`
- States: `connecting`, `connected`, `disconnected`, `reconnecting`
- Expose reactive `connectionState` ref
- Subscribe/unsubscribe per monitor ID
- Expose `subscribe(monitorId: number)`, `unsubscribe(monitorId: number)`
- Expose `onSample(fn: (data: WsPingSample) => void)` event handler

#### Step 4.2: Implement auto-reconnect with exponential backoff

- Initial delay: 1000ms
- Multiplier: 2x
- Maximum delay: 30000ms
- Jitter: +/- 10% random variation
- Sequence: 1s → 2s → 4s → 8s → 16s → 30s (capped)
- On successful reconnect: re-subscribe to all previous monitors

#### Step 4.3: Integrate WebSocket with AllMonitorsChart

**Modify:** `dashboard/app/components/charts/AllMonitorsChart.vue`

- On mount: subscribe to all visible monitors via `useWebSocket`
- On sample received: push new data point to uPlot series
- Throttle updates to 1-second intervals (batch samples)
- Use uPlot's `setData()` or direct series mutation + `uPlot.update()`
- On unmount: unsubscribe from all monitors

#### Step 4.4: Integrate WebSocket with detail view

**Modify:** `dashboard/app/pages/monitors/[id].vue`

- Subscribe to single monitor on mount
- Push samples to detail chart
- Unsubscribe on navigate away

#### Step 4.5: Update header with connection indicator

**Modify:** `dashboard/app/components/layout/DashboardHeader.vue`

- Add WebSocket connection state indicator
- States: green dot (connected), yellow pulse (reconnecting), gray (disconnected)
- "Reconnecting..." text during reconnect state

#### Step 4.6: Handle client_name_updated WebSocket messages

- On `client_name_updated` message: update client name in `useMonitors` state
- No refetch needed — just update the relevant client name in the local state

**Dependencies:** Phase 2 or Phase 3 (can run in parallel)

---

### Phase 5: Client Overview Page (M2-T6 partial)

**Goal:** Populate the client overview page with real data.

#### Step 5.1: Create ClientInfo component

**File:** `dashboard/app/components/clients/ClientInfo.vue`

- Displays client identity: slug, name, username, hostname, MAC
- Read-only fields
- CSS: `.client-info` card layout

#### Step 5.2: Create ClientMonitors component

**File:** `dashboard/app/components/clients/ClientMonitors.vue`

- List of monitors for this client
- Shows status, latency, quality state for each
- Links to detail views
- Reuses `<MonitorRow>` and `<StatusDot>` components

#### Step 5.3: Update clients/[slug] page

**Modify:** `dashboard/app/pages/clients/[slug]/index.vue`

- Remove placeholder
- Fetch client identity via `GET /api/clients/[slug]`
- Filter monitors by `clientSlug` from `useMonitors`
- Compose: `<NavigationBreadcrumb>` + `<ClientInfo>` + `<ClientMonitors>`

**Dependencies:** Phase 1

---

### Phase 6: Client Settings Page (M2-T6)

**Goal:** Settings page with sync controls and status indicator.

#### Step 6.1: Create settings page route

**File:** `dashboard/app/pages/clients/[slug]/settings.vue`

- New route under client path
- `<NavigationBreadcrumb>` back to client overview

#### Step 6.2: Create SyncStatusIndicator component

**File:** `dashboard/app/components/clients/SyncStatusIndicator.vue`

- Color-coded sync state: green (connected), yellow (syncing), red (error), gray (disabled)
- Pulsing animation for syncing state

#### Step 6.3: Create SyncSettingsForm component

**File:** `dashboard/app/components/clients/SyncSettingsForm.vue`

- Toggle: sync on/off
- Select: sync interval (allowed values per spec)
- Input: backend URL with HTTPS validation
- Form validation on all fields
- Submit via API (PUT endpoint — may need new backend endpoint)

#### Step 6.4: Create backend settings endpoint (if needed)

**Check:** `PUT /api/clients/[slug]/settings` — verify if M1 already covers this. If not, create:
- `dashboard/server/api/clients/[slug].settings.put.ts`
- Accepts `{ sync_enabled, sync_interval_min, backend_url }`
- Validates: HTTPS URL, interval within allowed range, boolean for enabled

**Dependencies:** Phase 5

---

### Phase 7: Inline Client Name Editing (M2-T7)

**Goal:** Inline edit in sidebar client group header.

#### Step 7.1: Add edit capability to ClientGroup

**Modify:** `dashboard/app/components/sidebars/ClientGroup.vue`

- Add edit icon button in group header
- On click: switch to inline edit mode with text input + Save/Cancel buttons
- Validation: 1-100 chars, trim whitespace, reject empty
- Save: `PUT /api/clients/[slug]/name` (already exists from M1)
- Optimistic update: show new name immediately, revert on error
- Cancel/Escape: revert to original

#### Step 7.2: Listen for client_name_updated WebSocket messages

**Modify:** `dashboard/app/composables/useMonitors.ts`

- Subscribe to `client_name_updated` messages from WebSocket
- Update local client name state without refetch

**Dependencies:** Phase 4 (WebSocket)

---

## File Inventory

### Files to Create (22 new files)

| Layer | File | Task | Description |
|-------|------|------|-------------|
| Composable | `app/composables/useDashboardPalette.ts` | M2-T3 | 12-color palette |
| Composable | `app/composables/useTimeWindow.ts` | M2-T3 | Time range preset management |
| Composable | `app/composables/useMonitorHistory.ts` | M2-T3 | History API fetch |
| Composable | `app/composables/useChartSeries.ts` | M2-T3 | HistoryPoint → uPlot data |
| Composable | `app/composables/useWebSocket.ts` | M2-T5 | WebSocket connection manager |
| Component | `app/components/charts/LatencyChart.vue` | M2-T3 | Base uPlot chart wrapper |
| Component | `app/components/charts/AllMonitorsChart.vue` | M2-T3 | Multi-series chart |
| Component | `app/components/shared/TimeRangeSelector.vue` | M2-T3 | Time preset buttons |
| Component | `app/components/charts/MonitorHeader.vue` | M2-T4 | Monitor title bar |
| Component | `app/components/charts/QualityIntervals.vue` | M2-T4 | Quality interval bands |
| Component | `app/components/charts/MonitorSummary.vue` | M2-T4 | RangeSummary metrics |
| Component | `app/components/charts/ChartThreshold.vue` | M2-T4 | Threshold line overlay |
| Component | `app/components/clients/ClientInfo.vue` | M2-T6 | Client identity display |
| Component | `app/components/clients/ClientMonitors.vue` | M2-T6 | Client's monitor list |
| Component | `app/components/clients/SyncStatusIndicator.vue` | M2-T6 | Sync state indicator |
| Component | `app/components/clients/SyncSettingsForm.vue` | M2-T6 | Sync settings form |
| Page | `app/pages/clients/[slug]/settings.vue` | M2-T6 | Settings page |
| CSS | `app/assets/css/charts.css` | M2-T3 | Chart-specific styles |
| Server | `server/api/clients/[slug].settings.put.ts` | M2-T6 | Settings PUT endpoint (if needed) |
| Test | `tests/e2e/chart.spec.ts` | M2-T3 | Chart rendering E2E |
| Test | `tests/e2e/websocket-live.spec.ts` | M2-T5 | WebSocket live update E2E |
| Test | `tests/e2e/settings.spec.ts` | M2-T6 | Settings page E2E |

### Files to Modify (8 existing files)

| File | Task | Change |
|------|------|--------|
| `dashboard/package.json` | M2-T3 | Add `uplot`, `@types/uplot` |
| `app/pages/index.vue` | M2-T3 | Replace placeholder with AllMonitorsChart |
| `app/pages/monitors/[id].vue` | M2-T4 | Replace placeholder with detail view |
| `app/pages/clients/[slug]/index.vue` | M2-T6 | Replace placeholder with client overview |
| `app/composables/useMonitors.ts` | M2-T3 + M2-T7 | Add toggle state, WebSocket listener |
| `app/components/sidebars/MonitorRow.vue` | M2-T3 | Add visibility toggle checkbox |
| `app/components/sidebars/ClientGroup.vue` | M2-T7 | Add inline edit mode |
| `app/components/layout/DashboardHeader.vue` | M2-T5 | Add WebSocket connection indicator |

### Directory Structure (after plan)

```
dashboard/
├── app/
│   ├── assets/
│   │   └── css/
│   │       ├── dashboard.css       (existing)
│   │       └── charts.css          (new)
│   ├── components/
│   │   ├── charts/
│   │   │   ├── LatencyChart.vue    (new)
│   │   │   ├── AllMonitorsChart.vue (new)
│   │   │   ├── MonitorHeader.vue   (new)
│   │   │   ├── QualityIntervals.vue (new)
│   │   │   ├── MonitorSummary.vue  (new)
│   │   │   └── ChartThreshold.vue  (new)
│   │   ├── clients/
│   │   │   ├── ClientInfo.vue      (new)
│   │   │   ├── ClientMonitors.vue  (new)
│   │   │   ├── SyncStatusIndicator.vue (new)
│   │   │   └── SyncSettingsForm.vue (new)
│   │   ├── shared/                 (existing + 1 new)
│   │   │   └── TimeRangeSelector.vue (new)
│   │   ├── sidebars/               (existing, modified)
│   │   └── layout/                 (existing, modified)
│   ├── composables/
│   │   ├── useMonitors.ts          (existing, modified)
│   │   ├── useResponsiveSidebar.ts (existing)
│   │   ├── useDashboardPalette.ts  (new)
│   │   ├── useTimeWindow.ts        (new)
│   │   ├── useMonitorHistory.ts    (new)
│   │   ├── useChartSeries.ts       (new)
│   │   └── useWebSocket.ts         (new)
│   ├── layouts/
│   │   └── default.vue             (existing)
│   └── pages/
│       ├── index.vue               (existing, modified)
│       ├── monitors/
│       │   └── [id].vue            (existing, modified)
│       └── clients/
│           └── [slug]/
│               ├── index.vue       (existing, modified)
│               └── settings.vue    (new)
├── server/
│   ├── api/                        (existing + 1 new)
│   │   └── clients/
│   │       └── [slug].settings.put.ts (new, if needed)
│   ├── ws/                         (existing)
│   ├── plugins/                    (existing)
│   ├── utils/                      (existing)
│   └── middleware/                 (existing)
├── schema/                         (existing)
├── shared/
│   └── types.ts                    (existing)
└── tests/
    └── e2e/
        ├── chart.spec.ts           (new)
        ├── websocket-live.spec.ts  (new)
        └── settings.spec.ts        (new)
```

---

## Dependency Graph

```
M2-T1 (COMPLETE) ──────────────────┐
                                    │
M2-T2 (MOSTLY COMPLETE) ───────────┤
  └─ toggle checkbox ──► M2-T3     │
                                    │
M2-T3 (Chart Foundation + All) ─────┼──► M2-T5 (WebSocket)
  ├─ Phase 1: uPlot + composables   │     └─ live updates
  └─ Phase 2: AllMonitorsChart      │
                                    │
M2-T4 (Detail View) ────────────────┤
  └─ Phase 3: depends on Phase 1    │
                                    │
M2-T5 (WebSocket Live Updates) ─────┼──► M2-T7 (Name Editing)
  └─ Phase 4: parallel to T3/T4     │
                                    │
M2-T6 (Settings Page) ──────────────┤
  └─ Phase 5 + 6: can start after Phase 1
                                    │
M2-T7 (Name Editing) ───────────────┘
  └─ Phase 7: depends on M2-T5 (WebSocket)
```

### Parallelizable Work

| Parallel Group | Tasks | Rationale |
|----------------|-------|-----------|
| Group A | Phase 1 (Steps 1.1-1.6) | Sequential — each step builds on previous |
| Group B | Phase 2 + Phase 3 + Phase 5 | After Group A completes; independent chart/detail/overview work |
| Group C | Phase 4 (WebSocket) | Can start after Group A; runs parallel to Group B |
| Group D | Phase 6 + Phase 7 | After Group B + C; settings and name editing |

### Recommended Execution Order

1. **Phase 1.1-1.6** — Foundation (uPlot, composables) — sequential
2. **Phase 2.1-2.5** — All-Monitors Chart — sequential
3. **Phase 3.1-3.5** — Detail View — can start after Phase 1.6
4. **Phase 4.1-4.6** — WebSocket — can start after Phase 1.6
5. **Phase 5.1-5.3** — Client Overview — can start after Phase 1.6
6. **Phase 6.1-6.4** — Settings — after Phase 5
7. **Phase 7.1-7.2** — Name Editing — after Phase 4
8. **Tests** — write alongside each phase, not at the end

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| uPlot compatibility with Vue 3 reactivity | High | Medium | Use `ref` for uPlot instance, `watch` for data changes; test early |
| WebSocket reconnection race conditions | Medium | Medium | Exponential backoff with jitter; test disconnect scenarios |
| Chart performance with 20+ monitors | High | Low | uPlot handles thousands of points; verify with load testing |
| SSR/CSR transition for uPlot | Medium | High | Use `onMounted` for chart init; SSR renders placeholder, CSR hydrates |
| Type mismatches between shared/types.ts and uPlot | Medium | Medium | Create adapter layer in `useChartSeries.ts` |
| Missing backend settings endpoint for M2-T6 | Medium | High | Verify M1 coverage; create if needed |
| Browser WebSocket auto-reconnect during dev | Low | High | Use `beforeunload` to close; reconnect on visibility change |

---

## Complexity Assessment

**Overall Complexity: Medium**

- **Backend:** Complete (M1 done). No backend work needed except possibly one settings endpoint.
- **Frontend:** The main challenge is the uPlot integration (20% of effort), WebSocket live updates (25%), and wiring everything together (25%). The remaining 30% is standard Vue component work.
- **Estimated Total Effort:** 20-25 hours across all M2 tasks
- **Key Risk Area:** SSR compatibility with uPlot — must ensure charts only render on client side

---

## Acceptance Criteria Checklist

| M2 Task | Criteria | Status |
|---------|----------|--------|
| M2-T1 | Layout renders | ✅ Done |
| M2-T1 | Routes work | ✅ Done |
| M2-T1 | Responsive | ✅ Done |
| M2-T1 | Empty state | ✅ Done |
| M2-T1 | Matches design | ✅ Done |
| M2-T2 | useMonitors works | ✅ Done |
| M2-T2 | Sidebar renders | ✅ Done |
| M2-T2 | Collapsible groups | ✅ Done |
| M2-T2 | Status dot colors | ✅ Done |
| M2-T2 | Monitor toggle | ❌ After M2-T3 |
| M2-T3 | uPlot chart renders | Planned |
| M2-T3 | Multi-series with colors | Planned |
| M2-T3 | Time range presets | Planned |
| M2-T3 | Monitor toggle | Planned |
| M2-T3 | Threshold lines | Planned |
| M2-T4 | Detail page with chart | Planned |
| M2-T4 | Quality interval bands | Planned |
| M2-T4 | Range summary metrics | Planned |
| M2-T4 | Monitor header | Planned |
| M2-T4 | 404 redirect | Planned |
| M2-T5 | WebSocket connects | Planned |
| M2-T5 | Live updates | Planned |
| M2-T5 | Auto-reconnect | Planned |
| M2-T5 | Reconnect indicator | Planned |
| M2-T6 | Settings page | Planned |
| M2-T6 | Sync controls | Planned |
| M2-T7 | Inline name editing | Planned |
| M2-T7 | WebSocket broadcast | Planned |

---

## Next Steps

1. **Agent 06** — Audit & Present Plan: Review this plan for completeness, identify gaps, present to user
2. **Agent 07** — Implementation: Execute Phase 1-7 in order, testing as you go
3. **Agent 08** — Verification: Run typecheck, E2E tests, final review
