---
taskId: M2-T2
milestone: M2
title: Create monitors list composable and sidebar components
priority: Critical
status: "Not Started"
estimatedEffort: "3-4 hours"
features:
  - F8
---

# Task M2-T2 — Create monitors list composable and sidebar components

> **Milestone:** M2 (Dashboard UI)
> **Priority:** Critical
> **Status:** Not Started
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

- [ ] `useMonitors` fetches and groups monitors by client
- [ ] Sidebar renders client groups with monitors
- [ ] Client groups are collapsible
- [ ] MonitorRow shows status dot, name, and toggle
- [ ] Clicking monitor navigates to detail view
- [ ] Status dot colors match spec (green/yellow/red/gray)
- [ ] Toggle shows/hides monitor in all-monitors chart

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] Monitors list loads correctly
- [ ] Sidebar renders with groups
- [ ] Status colors correct

## Dependencies

- **Requires:** M2-T1 (dashboard shell)
- **Blocks:** M2-T3, M2-T4

## Documentation References

- F8: [Web dashboard UI](../../requirements/features/feature-0008-web-dashboard.md) — Sidebar, Components
