---
milestoneId: M2
title: Dashboard UI
category: Frontend
priority: High
status: "🟢 Complete"
estimatedEffort: "5-7 days"
dependencies:
  - M1
features:
  - F8
  - F9
  - F11
---

# Milestone M2 — Dashboard UI

> **Category:** Frontend
> **Priority:** High
> **Status:** 🟢 Complete
> **Estimated Effort:** 5-7 days
> **Dependencies:** M1 — Backend Platform

## Objective

Build the complete web dashboard UI mirroring the LNPM desktop application design: sidebar with client-grouped monitors, all-monitors combined line chart, per-monitor detail view with rich metrics, live WebSocket updates, client settings page, and inline client name editing. All built on Nuxt 4 + Vue 3 + uPlot + Pinia, consuming the backend APIs from M1.

## Success Criteria

- [ ] Dashboard home page loads with sidebar showing client groups and monitors
- [ ] All-monitors combined uPlot chart renders with multiple series and threshold lines
- [ ] Per-monitor detail view shows dedicated chart, quality intervals, and range summary
- [ ] Live WebSocket updates push new samples to charts without page reload
- [ ] Sidebar supports collapsible client groups and monitor toggle (show/hide in chart)
- [ ] Time range controls work (1h, 6h, 24h, 7d presets)
- [ ] Client settings page displays identity, sync controls, and status indicator
- [ ] Inline client name editing works with real-time WebSocket broadcast
- [ ] Status dots reflect quality state colors (green/yellow/red/gray)
- [ ] Empty state shows when no monitors exist
- [ ] Responsive layout works on mobile (hamburger sidebar, full chart area)
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors and health endpoint returns 200

## Tasks

- M2-T1 — Build dashboard shell with layout, sidebar, and routing (F8)
- M2-T2 — Create monitors list composable and sidebar components (F8)
- M2-T3 — Implement all-monitors combined uPlot chart (F8)
- M2-T4 — Build per-monitor detail view with chart and metrics (F8)
- M2-T5 — Implement WebSocket composable with live chart updates (F8, F7)
- M2-T6 — Add client settings page with sync controls and status indicator (F9)
- M2-T7 — Implement inline client name editing with WebSocket broadcast (F11)

## Dependencies

- **Blocks:** None
- **Requires:** M1 — Backend Platform
