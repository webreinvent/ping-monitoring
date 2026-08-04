---
name: agent-05-plan-M2-T3
description: Agent 05 implementation plan for M2-T3 — filling 2 remaining gaps: monitor toggle wiring and threshold lines
metadata:
  type: project
  task: M2-T3
  milestone: M2
  agent: "05"
  date: 2026-08-04
  hook: Implementation plan for M2-T3 all-monitors chart completion
---

# Agent 05: Implementation Plan — M2-T3 All-Monitors Chart Completion

## Status: COMPLETE

## Skills Invoked

- **design-system** — Verified CSS custom property tokens for threshold colors
- **brainstorming** — Two approaches evaluated; Approach A (incremental patching) chosen
- **sequential-thinking** — 7 ordered steps decomposed

## Current State: 5 of 7 Acceptance Criteria Met

Two gaps remain:
1. **Monitor toggle not wired** — `useMonitors()` has `toggleMonitor`/`isVisible`, but `AllMonitorsChart` doesn't filter by visibility
2. **Threshold lines not rendered** — `LatencyChart` supports single `thresholdValue`, but `AllMonitorsChart` doesn't pass it; needs multi-threshold support

## 7-Step Implementation Plan

### Step 1: Add `thresholdValues` prop to LatencyChart
- File: `dashboard/app/components/charts/LatencyChart.vue`
- Add optional `thresholdValues?: number[]` prop
- Draw multiple dashed lines in `drawClear` hook using THRESHOLD_COLORS mapping
- Colors: 50ms=#45dfc2 (accent/green), 100ms=#f6a94a (warning/yellow), 150ms=#f97316 (orange), 200ms=#ff6b78 (danger/red)
- Keep existing `thresholdValue` prop for backward compat (detail view)
- **No dependencies** — can start immediately

### Step 2: Wire `useMonitors()` toggle into AllMonitorsChart
- File: `dashboard/app/components/charts/AllMonitorsChart.vue`
- Call `useMonitors()` to get `toggleMonitor`, `isVisible`
- Filter `seriesConfig` computed by `isVisible(m.id)`
- Filter `chartData` computed entries by `isVisible(id)`
- **Critical:** Use `props.monitors.indexOf(m)` for palette color index (stable colors)
- **No dependencies** — can start in parallel with Step 1

### Step 3: Make legend items clickable
- File: `dashboard/app/components/charts/AllMonitorsChart.vue`
- Add `@click="toggleMonitor(item.id)"` to `.chart-legend-item`
- Add `:class="{ 'chart-legend-item--hidden': !isVisible(item.id) }"`
- **Depends on:** Step 2

### Step 4: Pass threshold values to LatencyChart
- File: `dashboard/app/components/charts/AllMonitorsChart.vue`
- Add `:threshold-values="[50, 100, 150, 200]"` to `<LatencyChart>` component
- **Depends on:** Step 1

### Step 5: Add CSS for legend toggle states
- File: `dashboard/app/assets/css/charts.css`
- Add `.chart-legend-item { cursor: pointer; transition: opacity 140ms ease; }`
- Add `.chart-legend-item:hover { color: var(--text); }`
- Add `.chart-legend-item--hidden { opacity: 0.4; text-decoration: line-through; }`
- **Depends on:** Step 3
- **Can run in parallel with:** Steps 2-3

### Step 6: Write unit tests
- File: `dashboard/app/components/charts/AllMonitorsChart.test.ts` (NEW)
  - Tests: all visible by default, toggle filters series, palette index stable, chartData excludes hidden, seriesConfig length matches visible
- File: `dashboard/app/components/charts/LatencyChart.test.ts` (NEW)
  - Tests: single thresholdValue, multi thresholdValues, correct colors, dashed lines, no lines when empty
- **Depends on:** Steps 1-5

### Step 7: Verify and test
- `npx nuxi typecheck` — no errors
- `npx vitest run` — all tests pass
- `npx nuxi dev` — starts without errors
- Manual: chart renders, toggle works, thresholds visible, detail view still works
- **Depends on:** Step 6

## File Inventory

**Modify (3):**
1. `dashboard/app/components/charts/LatencyChart.vue` — multi-threshold prop + draw logic
2. `dashboard/app/components/charts/AllMonitorsChart.vue` — toggle wiring + legend clicks + threshold prop
3. `dashboard/app/assets/css/charts.css` — legend hidden state + cursor

**Create (2):**
1. `dashboard/app/components/charts/AllMonitorsChart.test.ts` — toggle + visibility tests
2. `dashboard/app/components/charts/LatencyChart.test.ts` — threshold rendering tests

## Dependency Graph

```
Step 1 ──→ Step 4 ─┐
                    ├─→ Step 6 ──→ Step 7
Step 2 ──→ Step 3 ─┤
                    │
Step 5 ─────────────┘
```

**Parallelizable:** Steps 1 and 2; Step 5 with Steps 2-3

## Risks (7 identified)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| uPlot re-render on series count change | Medium | High | Computed filtering; may need chart destroy/recreate |
| Palette color shift on toggle | Low | Medium | Use original index via `indexOf(m)` |
| Threshold lines overlap data | Low | Low | Draw in `drawClear`, dashed style |
| `visibleMonitors` desync | Low | Medium | Singleton composable |
| Type errors from prop changes | Low | Low | Optional prop, backward compat |
| Detail view breaks (M2-T4) | Low | High | Single `thresholdValue` unchanged |
| Existing tests break | Low | Medium | No changes to composables |

## Complexity: Medium

## Acceptance Criteria Mapping

| # | Criterion | Satisfied By |
|---|-----------|-------------|
| 4 | Monitor toggle shows/hides series | Steps 2, 3, 5 |
| 5 | Threshold lines rendered | Steps 1, 4 |
| (1,2,3,6,7) | Already met | Existing implementation |

## Next Agent: Agent 06 (Audit & Present Plan)
