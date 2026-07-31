---
taskId: M2-T4
milestone: M2
title: Build per-monitor detail view with chart and metrics
priority: Critical
status: "Not Started"
estimatedEffort: "3-4 hours"
features:
  - F8
---

# Task M2-T4 — Build per-monitor detail view with chart and metrics

> **Milestone:** M2 (Dashboard UI)
> **Priority:** Critical
> **Status:** Not Started
> **Estimated Effort:** 3-4 hours

## Description

Build the per-monitor detail view page with dedicated uPlot chart, quality interval bands, range summary metrics panel, and monitor header showing current state.

## Task Goals

- Create `monitors/[id].vue` page with dedicated chart
- Render quality intervals as colored bands on chart
- Display range summary metrics (packet loss, latency stats, stability)
- Show monitor header with current state

## Implementation Plan

### Steps

1. Create `app/pages/monitors/[id].vue`:
   - Fetch history data for single monitor
   - Render: header, chart, summary panel
2. Create `app/components/charts/LatencyChart.vue`:
   - Single-series uPlot chart
   - Quality interval bands overlay
3. Create `app/components/charts/QualityIntervals.vue`:
   - Render quality intervals as background zones
4. Create `app/components/charts/MonitorSummary.vue`:
   - RangeSummary metrics: sampleCount, packetLoss, avg/min/max/p95 latency, stable/unstable/disconnected percent
5. Create `app/components/charts/MonitorHeader.vue`:
   - Monitor name, target host, current state, latest latency
6. Create `app/components/charts/ChartThreshold.vue`:
   - Threshold line overlay

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `nuxt` | Vue 3 composables, uPlot | Chart components |
| `filesystem` (MCP) | File creation | Writing files |

## Acceptance Criteria

- [ ] Per-monitor detail page loads with chart and metrics
- [ ] uPlot chart renders with quality interval bands
- [ ] Range summary shows all metrics (packet loss, latency, stability)
- [ ] Monitor header shows current state
- [ ] Time range controls work
- [ ] 404 redirect to all-monitors view for unknown monitor

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] Detail view renders
- [ ] Chart with intervals
- [ ] Metrics correct

## Dependencies

- **Requires:** M2-T2 (monitors list), M1-T8 (history API)
- **Blocks:** None

## Documentation References

- F8: [Web dashboard UI](../../requirements/features/feature-0008-web-dashboard.md) — Per-monitor view
