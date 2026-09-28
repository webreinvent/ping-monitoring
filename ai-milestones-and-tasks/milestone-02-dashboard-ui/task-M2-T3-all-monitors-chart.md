---
taskId: M2-T3
milestone: M2
title: Implement all-monitors combined uPlot chart
priority: Critical
status: "🟢 Complete"
estimatedEffort: "4-6 hours"
features:
  - F8
---

# Task M2-T3 — Implement all-monitors combined uPlot chart

> **Milestone:** M2 (Dashboard UI)
> **Priority:** Critical
> **Status:** 🟢 Complete
> **Estimated Effort:** 4-6 hours

## Description

Build the all-monitors combined uPlot line chart that renders all monitors as separate series with distinct colors, threshold lines, and time range controls. This is the primary default view of the dashboard.

## Task Goals

- Create uPlot-based `AllMonitorsChart` component
- Fetch history data for all monitors in parallel
- Render multiple series with distinct colors from palette
- Support time range presets (1h, 6h, 24h, 7d)
- Support monitor toggle (show/hide series)
- Reuse existing `src/chart.ts` bucketing logic

## Acceptance Criteria

- [x] uPlot chart renders with all monitors as separate series
- [x] Each series has distinct color from palette
- [x] Time range presets work (1h, 6h, 24h, 7d)
- [x] Monitor toggle shows/hides series
- [x] Threshold lines rendered
- [x] Chart data matches HistoryResponse format from F6
- [x] Chart handles empty data gracefully

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors

## Testing Checklist

- [x] Chart renders with data
- [x] Time range changes work
- [x] Toggle works

## Dependencies

- **Requires:** M2-T2 (monitors list), M1-T8 (history API)
- **Blocks:** None

## Documentation References

- F8: [Web dashboard UI](../../requirements/features/feature-0008-web-dashboard.md) — Chart rendering, uPlot
