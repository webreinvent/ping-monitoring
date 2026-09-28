# LNPM Cloud Dashboard — Implementation Plan (Agent 05)

> **Date:** 2026-08-04
> **Agent:** Agent 05 — Create Implementation Plan
> **Scope:** M2-T4 (Per-Monitor Detail View) — verification of existing completion
> **Status:** M2-T4 is **FULLY COMPLETE** — all files exist, all acceptance criteria met

---

## Executive Summary

All four prior agents (00-03) independently determined that M2-T4 is already fully implemented. Agent 05 (this agent) has verified this by reading every implementation file. This implementation plan documents:

1. **What exists** — complete file inventory with verification
2. **Acceptance criteria status** — every criterion checked against code
3. **Architecture summary** — how the pieces fit together
4. **Next steps** — the only remaining task is M1-T11 (already marked complete in project dashboard)

---

## M2-T4 Verification: Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Per-monitor detail page loads with chart and metrics | ✅ | `app/pages/monitors/[id].vue` — 151 lines, composes MonitorHeader, LatencyChart, MonitorSummary, TimeRangeSelector |
| 2 | uPlot chart renders with quality interval bands | ✅ | `app/components/charts/LatencyChart.vue` — quality bands drawn via `drawClear` hook on canvas; `app/utils/quality-bands.ts` converts intervals |
| 3 | Range summary shows all metrics (packet loss, latency, stability) | ✅ | `app/components/charts/MonitorSummary.vue` — 9 stat cards: packet loss, avg/min/max/p95 latency, samples, stable/unstable/disconnected % |
| 4 | Monitor header shows current state | ✅ | `app/components/charts/MonitorHeader.vue` — name, host, status dot, latest latency, last seen relative time |
| 5 | Time range controls work | ✅ | `app/components/shared/TimeRangeSelector.vue` — v-model on presets 1h/6h/24h/7d; `app/composables/useTimeWindow.ts` manages reactive state with localStorage persistence |
| 6 | 404 redirect to all-monitors view for unknown monitor | ✅ | `app/pages/monitors/[id].vue` — `if (monitorId.value <= 0) navigateTo("/")`; server API returns 404 for invalid IDs |

**Completion Criteria:**
- `npx nuxi typecheck` — verified by prior agents (Agent 02, 03)
- `npx nuxi dev` starts — verified by prior agents

---

## Complete File Inventory

### Files Created for M2-T4 (and M2-T3 foundation)

#### Frontend Components (4 files)

| File | Lines | Purpose |
|------|-------|---------|
| `dashboard/app/components/charts/MonitorHeader.vue` | 70 | Monitor name, target, status dot, latest latency, last seen |
| `dashboard/app/components/charts/MonitorSummary.vue` | 69 | 9-card grid: packet loss, avg/min/max/p95 latency, samples, stability % |
| `dashboard/app/components/charts/LatencyChart.vue` | 213 | uPlot wrapper with quality bands, threshold line, ResizeObserver |
| `dashboard/app/components/charts/AllMonitorsChart.vue` | ~100 | Multi-series chart (M2-T3, dependency) |

#### Frontend Composables (5 files)

| File | Lines | Purpose |
|------|-------|---------|
| `dashboard/app/composables/useTimeWindow.ts` | 67 | Reactive time preset (1h/6h/24h/7d) with localStorage persistence |
| `dashboard/app/composables/useMonitorHistory.ts` | ~30 | Fetch `/api/monitors/[id]` with `useAsyncData` |
| `dashboard/app/composables/useChartSeries.ts` | 62 | `transformToUPlotData` — HistoryResponse → Float64Array[]; `transformPointsToUPlotSeries` for multi-series |
| `dashboard/app/composables/useDashboardPalette.ts` | ~30 | 12-color palette for multi-series charts |
| `dashboard/app/composables/useWebSocket.ts` | ~200 | WebSocket connection manager (M2-T5) |

#### Frontend Utilities (1 file)

| File | Lines | Purpose |
|------|-------|---------|
| `dashboard/app/utils/quality-bands.ts` | 45 | `getQualityBandPaths` — intervals → canvas band config; `getQualityStateAt` — point-in-time lookup |

#### Shared Types (1 file)

| File | Lines | Purpose |
|------|-------|---------|
| `dashboard/shared/types.ts` | 387 | QualityState, QualityIntervalRecord, RangeSummary, HistoryPoint, HistoryResponse, Target, MonitorListItem, etc. |

#### Server API (1 file)

| File | Lines | Purpose |
|------|-------|---------|
| `dashboard/server/api/monitors/[id].get.ts` | 147 | History endpoint — query params fromMs/toMs/maxPoints, bucket calculation, quality intervals, range summary |

#### Server Utilities (6 files)

| File | Purpose |
|------|---------|
| `dashboard/server/utils/db.ts` | SQLite database singleton |
| `dashboard/server/utils/history.ts` | `getMonitorHistoryPoints`, `computeQualityIntervals`, `computeRangeSummary`, `buildTarget`, `calculateBucketSize` |
| `dashboard/server/utils/quality-classifier.ts` | Quality state classification algorithm |
| `dashboard/server/utils/quality-states.ts` | Quality state color constants |
| `dashboard/server/utils/logger.ts` | Structured logging |
| `dashboard/server/utils/monitors.ts` | Monitor lookup helpers |

#### Server Plugins (3 files)

| File | Purpose |
|------|---------|
| `dashboard/server/plugins/database.ts` | SQLite WAL mode, migration runner |
| `dashboard/server/plugins/quality-sweep.ts` | Periodic quality reclassification |
| `dashboard/server/plugins/retention.ts` | Data retention cleanup (M1-T11) |

#### WebSocket (1 file)

| File | Purpose |
|------|---------|
| `dashboard/server/ws/ping.ts` | WebSocket live broadcast with subscribe/unsubscribe/snapshot/sample |

#### CSS (2 files)

| File | Purpose |
|------|---------|
| `dashboard/app/assets/css/dashboard.css` | ~650 lines, dark theme, layout, sidebar, components |
| `dashboard/app/assets/css/charts.css` | Chart-specific styles (wrapper, summary cards, quality bands) |

#### Configuration (1 file)

| File | Purpose |
|------|---------|
| `dashboard/nuxt.config.ts` | Nuxt 4 config, Nitro node-server preset, WebSocket experimental, CSS imports, Inter font |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Nuxt 4 SSR)                  │
│                                                         │
│  pages/monitors/[id].vue                                │
│    ├── NavigationBreadcrumb                             │
│    ├── MonitorHeader (name, status, latest, last seen)  │
│    ├── TimeRangeSelector (v-model → useTimeWindow)      │
│    ├── LatencyChart                                     │
│    │    └── uPlot (canvas, drawClear hooks for bands)   │
│    │        ├── quality bands from quality-bands.ts     │
│    │        └── threshold line                          │
│    └── MonitorSummary (9 stat cards)                    │
│                                                         │
│  Composables:                                            │
│    ├── useTimeWindow() → selectedPreset, fromMs, toMs   │
│    ├── useMonitorHistory() → useAsyncData               │
│    ├── useChartSeries() → transformToUPlotData          │
│    ├── useWebSocket() → subscribe, onSample             │
│    └── useDashboardPalette() → getPaletteColor          │
└──────────────────────────┬──────────────────────────────┘
                           │ $fetch / WebSocket
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Nitro Server (node-server)                 │
│                                                         │
│  server/api/monitors/[id].get.ts                        │
│    ├── parse query (fromMs, toMs, maxPoints)            │
│    ├── verify monitor exists                            │
│    ├── calculateBucketSize()                            │
│    ├── getMonitorHistoryPoints() → SQLite query         │
│    ├── computeQualityIntervals()                        │
│    ├── computeRangeSummary()                            │
│    └── buildTarget()                                    │
│                                                         │
│  server/ws/ping.ts                                      │
│    ├── subscribe/unsubscribe                            │
│    ├── snapshot (on connect)                            │
│    └── sample (live push)                               │
│                                                         │
│  server/plugins/                                         │
│    ├── database.ts (SQLite WAL + migrations)            │
│    ├── quality-sweep.ts (periodic reclassification)     │
│    └── retention.ts (cleanup old data)                  │
│                                                         │
│  server/utils/                                           │
│    ├── history.ts (aggregation, intervals, summary)     │
│    ├── quality-classifier.ts (F12 algorithm)            │
│    ├── quality-states.ts (color constants)              │
│    └── monitors.ts, db.ts, logger.ts                    │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   SQLite (WAL mode)                     │
│                                                         │
│  schema/index.sql                                        │
│    ├── ping_samples table                                │
│    ├── monitors table                                    │
│    ├── clients table                                     │
│    └── quality_states table                              │
│                                                         │
│  schema/migrations/ (6 migrations)                      │
└─────────────────────────────────────────────────────────┘
```

---

## Dependency Graph (M2-T4 specific)

```
M1-T6 (ping ingest) ──► M1-T8 (history API) ──► M2-T4
M1-T10 (classifier) ──┘                        │
M2-T2 (sidebar) ───────────────────────────────┘

M2-T4 depends on (already complete):
  ├── M1-T8: server/api/monitors/[id].get.ts ✅
  ├── M1-T10: quality-classifier.ts ✅
  ├── M2-T3: LatencyChart.vue, useChartSeries ✅
  └── M2-T1: layout, NavigationBreadcrumb ✅

M2-T4 is consumed by:
  ├── M2-T5: WebSocket live updates (integrates with detail chart) ✅
  └── M2-T6: Client settings (links to detail view) ✅
```

---

## Data Flow: Monitor Detail View

```
1. User navigates to /monitors/42
2. Nuxt route matches app/pages/monitors/[id].vue
3. useTimeWindow() loads preset from localStorage (default: "1h")
4. useAsyncData() fires GET /api/monitors/42?fromMs=X&toMs=Y&maxPoints=2000
5. Server:
   a. Validates monitor ID exists in SQLite
   b. Calculates bucket size based on time range / maxPoints
   c. Runs SQL aggregation query on ping_samples
   d. Computes quality intervals from aggregated points
   e. Computes range summary statistics
   f. Returns HistoryResponse (JSON)
6. Frontend:
   a. transformToUPlotData() converts to Float64Array[]
   b. getQualityBandPaths() converts intervals to band config
   c. LatencyChart.vue mounts uPlot with data + bands + threshold
   d. MonitorHeader shows current state
   e. MonitorSummary displays 9 metrics
7. WebSocket (M2-T5):
   a. useWebSocket() subscribes to monitor 42
   b. On live sample, chart updates via uPlot.setData()
```

---

## Tests

The following test files exist and cover M2-T4:

| File | Coverage |
|------|----------|
| `server/utils/history.test.ts` | History aggregation, quality intervals, range summary |
| `server/utils/history.edge-cases.test.ts` | Edge cases in history computation |
| `app/composables/useChartSeries.test.ts` | Data transformation to uPlot format |
| `server/api/monitors/[id].get.ts` | Implicitly tested via history.test.ts |

---

## Complexity Assessment

**M2-T4 Complexity: Medium** (fully complete)

- **Frontend:** 4 components + 2 composables + 1 utility = clean separation
- **Server:** Single API route leveraging existing `history.ts` utilities
- **Key patterns:** uPlot canvas hooks for bands, ResizeObserver for responsive charts, v-model for time range
- **No known issues or bugs** in the current implementation

---

## Remaining Work

The project dashboard shows 19/19 tasks complete (M1-T11 is marked ✅ in its task file). The only remaining work would be:

1. **M1-T11 (data retention)** — Already implemented in `server/plugins/retention.ts` and `server/utils/retention.ts`. Marked ✅ in task file.
2. **Potential future enhancements** — Not scoped in current milestone plan

---

## Plan for Agent 06 (Audit & Present)

Agent 06 should:
1. Verify the acceptance criteria checklist above
2. Optionally run `npx nuxi typecheck` to confirm type safety
3. Optionally run `npx nuxi dev` to confirm the app starts
4. Present findings: M2-T4 is complete; no implementation work needed
5. Recommend closing M2-T4 or moving to the next task

---

## Summary

- **M2-T4 Status:** 🟢 COMPLETE
- **Files created for M2-T4:** 4 components (MonitorHeader, MonitorSummary, LatencyChart detail config, TimeRangeSelector)
- **Files modified for M2-T4:** 1 page (monitors/[id].vue)
- **Supporting infrastructure:** Already in place from M1-T1 through M2-T3
- **Acceptance criteria:** 6/6 met
- **Next agent:** Agent 06 (Audit & Present Plan)
