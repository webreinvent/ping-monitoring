---
taskId: M2-T6
milestone: M2
title: Add client settings page with sync controls and status indicator
priority: High
status: "🟢 Complete"
estimatedEffort: "3-4 hours"
features:
  - F9
completed: "2026-08-06"
---

# Task M2-T6 — Add client settings page with sync controls and status indicator

> **Milestone:** M2 (Dashboard UI)
> **Priority:** High
> **Status:** 🟢 Complete
> **Estimated Effort:** 3-4 hours
> **Completed:** 2026-08-06
> **Branch:** `feature/M2-T6-client-settings-page` (merged into develop)
> **Commit:** `e456745`

## Description

Build the client settings page that displays client identity information, sync controls (toggle, interval, backend URL), and a real-time sync status indicator. Backend endpoints for settings management are also created here.

## Task Goals

- [x] Create client settings page with identity display
- [x] Build sync settings controls (toggle, interval, URL)
- [x] Implement sync status indicator with color-coded states
- [x] Create backend API endpoints for settings CRUD

## Acceptance Criteria

- [x] Settings page loads with client identity and sync config
- [x] Identity fields displayed as read-only (username, hostname, MAC)
- [x] Sync toggle works (on/off)
- [x] Sync interval selector with allowed values
- [x] Backend URL input with HTTPS validation
- [x] Sync status indicator shows correct state (connected/disconnected/disabled/not_configured)
- [x] Settings update via API, WebSocket broadcast
- [x] Form validation on all fields

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors

## Testing Checklist

- [x] Settings page renders
- [x] Settings update works
- [x] Validation correct
- [x] GET endpoint tests pass (sync status computation, response shape, thresholds)

## Implementation Summary

### New Files (4)
1. `dashboard/server/api/clients/[slug].settings.get.ts` — GET settings endpoint with computed sync_status
2. `dashboard/server/api/clients/[slug].settings.get.test.ts` — Tests for GET endpoint
3. `dashboard/app/composables/useClientSettings.ts` — Settings composable with optimistic updates
4. `dashboard/app/components/clients/ClientIdentity.vue` — Read-only identity display

### Files Modified (6)
1. `dashboard/shared/types.ts` — Added SyncStatus type and ClientSettings interface
2. `dashboard/server/api/clients/[slug].settings.put.ts` — Fixed intervals, added WebSocket broadcast
3. `dashboard/server/ws/ping.ts` — Added broadcastSettingsUpdate() function
4. `dashboard/app/components/clients/SyncStatusIndicator.vue` — 5 states with correct labels
5. `dashboard/app/components/clients/SyncSettingsForm.vue` — Fixed intervals, localhost HTTP exception
6. `dashboard/app/pages/clients/[slug]/settings.vue` — Added ClientIdentity, improved sync_status

## Dependencies

- **Requires:** M2-T2 (monitors list), M1-T5 (client identity)
- **Blocks:** None

## Documentation References

- F9: [Client settings UI](../../requirements/features/feature-0009-client-settings.md)
