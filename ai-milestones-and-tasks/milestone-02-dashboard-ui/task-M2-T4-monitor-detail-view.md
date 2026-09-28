---
taskId: M2-T4
milestone: M2
title: Build per-monitor detail view with chart and metrics
priority: Critical
status: "🟢 Complete"
estimatedEffort: "3-4 hours"
features:
  - F8
---

# Task M2-T4 — Build per-monitor detail view with chart and metrics

> **Milestone:** M2 (Dashboard UI)
> **Priority:** Critical
> **Status:** 🟢 Complete
> **Estimated Effort:** 3-4 hours

## Description

Build the per-monitor detail view page with dedicated uPlot chart, quality interval bands, range summary metrics panel, and monitor header showing current state.

## Task Goals

- Create `monitors/[id].vue` page with dedicated chart
- Render quality intervals as colored bands on chart
- Display range summary metrics (packet loss, latency stats, stability)
- Show monitor header with current state

## Acceptance Criteria

- [x] Per-monitor detail page loads with chart and metrics
- [x] uPlot chart renders with quality interval bands
- [x] Range summary shows all metrics (packet loss, latency, stability)
- [x] Monitor header shows current state
- [x] Time range controls work
- [x] 404 redirect to all-monitors view for unknown monitor

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors

## Testing Checklist

- [x] Detail view renders
- [x] Chart with intervals
- [x] Metrics correct

## Dependencies

- **Requires:** M2-T2 (monitors list), M1-T8 (history API)
- **Blocks:** None

## Documentation References

- F8: [Web dashboard UI](../../requirements/features/feature-0008-web-dashboard.md) — Per-monitor view
