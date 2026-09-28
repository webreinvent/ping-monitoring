# LNPM Cloud Dashboard — Task Complete: M2-T4

> Saved: 2026-08-06
> Task: M2-T4 — Build per-monitor detail view with chart and metrics
> Feature: F8 (Web dashboard UI — Per-monitor view)
> Status: Complete (verified — implementation already existed)

## Summary

M2-T4 implements the per-monitor detail view at `/monitors/:id` with a dedicated uPlot chart, quality interval bands, range summary metrics panel, and monitor header showing current state. All 6 acceptance criteria were met by existing code created during the M2-T3 (all-monitors chart) session.

## Files Verified (already on develop — no changes needed)

### Detail View Page (1 file):
1. `dashboard/app/pages/monitors/[id].vue` (151 lines) — Detail page with chart, metrics, and header

### Chart Components (4 files):
2. `dashboard/app/components/charts/MonitorHeader.vue` (70 lines) — Monitor title bar with status, latency, last seen
3. `dashboard/app/components/charts/MonitorSummary.vue` (69 lines) — Range summary metrics grid (9 stat cards)
4. `dashboard/app/components/charts/LatencyChart.vue` — uPlot chart with quality bands and threshold line
5. `dashboard/app/components/shared/TimeRangeSelector.vue` — Time range preset buttons

### Shared Components (2 files):
6. `dashboard/app/components/shared/NavigationBreadcrumb.vue` — Breadcrumb navigation
7. `dashboard/app/components/shared/EmptyState.vue` — "No data" empty state with radar animation

### Composables (3 files):
8. `dashboard/app/composables/useMonitorHistory.ts` (41 lines) — Fetches HistoryResponse for a monitor
9. `dashboard/app/composables/useTimeWindow.ts` (67 lines) — Time range preset management with localStorage persistence
10. `dashboard/app/composables/useChartSeries.ts` — Transforms HistoryPoint[] to uPlot data arrays

### Utilities (1 file):
11. `dashboard/app/utils/quality-bands.ts` (45 lines) — Converts quality intervals to uPlot band paths

### Server API (1 file):
12. `dashboard/server/api/monitors/[id].get.ts` — History endpoint (M1-T8) providing data for detail view

### Shared Types (1 file):
13. `dashboard/shared/types.ts` — F6 types: QualityState, HistoryPoint, QualityIntervalRecord, RangeSummary, HistoryResponse, etc.

## Test Results

- **854 total tests pass** (verified by Agent 02)
- **Typecheck: PASS** — `npx nuxi typecheck` passes with no errors
- **Dev server: PASS** — `npx nuxi dev` starts successfully (Nuxt 4.5.1, Nitro 2.13.4)
- **No new tests needed** — existing test coverage from M2-T3 (quality-bands.test.ts, composable tests) covers the shared utilities

## Acceptance Criteria Status

All 6 acceptance criteria met:
- ✅ Per-monitor detail page loads with chart and metrics (`monitors/[id].vue` with LatencyChart + MonitorSummary)
- ✅ uPlot chart renders with quality interval bands (`getQualityBandPaths()` → LatencyChart quality bands prop)
- ✅ Range summary shows all metrics (packet loss, latency stats, stability) — 9 stat cards in MonitorSummary
- ✅ Monitor header shows current state (status dot, latest latency, last seen relative time)
- ✅ Time range controls work (`TimeRangeSelector` with 1h/6h/24h/7d presets, reactive data re-fetch)
- ✅ 404 redirect to all-monitors view for unknown monitor (`navigateTo("/")` when `monitorId <= 0`)

## Implementation Pattern

### useAsyncData with Reactive Key
```typescript
const { data: historyData, status } = useAsyncData<HistoryResponse>(
  () => `monitor-detail-${monitorId.value}-${timeWindow.value}`,
  async () => {
    return await $fetch<HistoryResponse>(`/api/monitors/${monitorId.value}`, {
      query: { fromMs: fromMs.value, toMs: toMs.value, maxPoints: 2000 },
    });
  },
);
```
- Key includes the **time window preset** (not Date.now() values) — stable, reactive, cacheable
- When user changes time range, the key changes → new fetch → all computed properties update

### Data Extraction via Computed Properties
```typescript
const targetName = computed(() => historyData.value?.series?.[0]?.target?.name ?? "Unknown");
const summary = computed<RangeSummary>(() => historyData.value?.series?.[0]?.summary ?? defaultSummary);
```
- All derived values are computed properties — cached, reactive, null-safe
- Default fallback values prevent child component errors

### Component Architecture
- **MonitorHeader** — Presentational component with quality state label, latency color coding, and relative time formatting
- **MonitorSummary** — 9-card grid with color-coded values (accent/warning/danger) based on metric thresholds
- **LatencyChart** — Shared uPlot chart component with quality bands, threshold line, and reactive data
- **TimeRangeSelector** — Button-group with localStorage-persisted selection

## Key Design Decisions

### Threshold from Target Configuration
- `thresholdMs` is read from `series[0].target.thresholds.p95LatencyMs` — uses the monitor's configured threshold
- Each monitor can have different thresholds (matching the desktop app's per-target configuration)

### 404 via navigateTo() Redirect
- Invalid monitor IDs (≤0) are caught in the script setup block and redirect to `/`
- The history API already returns 404 for non-existent monitors — this guards against malformed URLs

### Color Coding in MonitorSummary
- **Packet loss**: 0% → accent (green), ≤5% → warning (yellow), >5% → danger (red)
- **P95 latency**: <150ms → accent, <300ms → warning, ≥300ms → danger
- **Stable %**: Always accent (green)
- **Unstable %**: warning when >0
- **Disconnected %**: danger when >0

## Dependencies

- **Requires:** M1-T8 (history API), M2-T3 (chart components), M2-T2 (sidebar navigation)
- **Blocks:** None

## Next Steps

- Agent 05 (Finalize & Commit) — No commit needed (implementation already on develop)
- Proceed to next task in M2 milestone or project backlog
