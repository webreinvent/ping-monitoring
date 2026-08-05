---
taskId: M2-T2
milestone: M2
title: Create monitors list composable and sidebar components
priority: Critical
status: "🟢 Complete"
estimatedEffort: "3-4 hours"
features:
  - F8
---

# Task M2-T2 — Create monitors list composable and sidebar components

> **Milestone:** M2 (Dashboard UI)
> **Priority:** Critical
> **Status:** 🟢 Complete
> **Estimated Effort:** 3-4 hours

## Description

Build the `useMonitors` composable for fetching and caching the monitors list, and create all sidebar components: ClientGroup, MonitorRow, and StatusDot. These form the navigation and monitor selection UI.

## Task Goals

- Create `useMonitors` composable: fetch from `GET /api/monitors`, cache, group by client
- Create `DashboardSidebar` with client groups
- Create `ClientGroup` component with collapsible sections
- Create `MonitorRow` with status dot, name, toggle
- Create `StatusDot` with quality state colors

## Acceptance Criteria

- [x] `useMonitors` fetches and groups monitors by client
- [x] Sidebar renders client groups with monitors
- [x] Client groups are collapsible
- [x] MonitorRow shows status dot, name, and toggle
- [x] Clicking monitor navigates to detail view
- [x] Status dot colors match spec (green/yellow/red/gray)
- [x] Toggle shows/hides monitor in all-monitors chart

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors

## Testing Checklist

- [x] Monitors list loads correctly
- [x] Sidebar renders with groups
- [x] Status colors correct

## Dependencies

- **Requires:** M2-T1 (dashboard shell)
- **Blocks:** M2-T3, M2-T4

## Documentation References

- F8: [Web dashboard UI](../../requirements/features/feature-0008-web-dashboard.md) — Sidebar, Components
