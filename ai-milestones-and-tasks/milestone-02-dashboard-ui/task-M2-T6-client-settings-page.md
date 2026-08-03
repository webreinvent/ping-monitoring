---
taskId: M2-T6
milestone: M2
title: Add client settings page with sync controls and status indicator
priority: High
status: "🟢 Complete"
estimatedEffort: "3-4 hours"
features:
  - F9
---

# Task M2-T6 — Add client settings page with sync controls and status indicator

> **Milestone:** M2 (Dashboard UI)
> **Priority:** High
> **Status:** 🟢 Complete
> **Estimated Effort:** 3-4 hours

## Description

Build the client settings page that displays client identity information, sync controls (toggle, interval, backend URL), and a real-time sync status indicator. Backend endpoints for settings management are also created here.

## Task Goals

- Create client settings page with identity display
- Build sync settings controls (toggle, interval, URL)
- Implement sync status indicator with color-coded states
- Create backend API endpoints for settings CRUD

## Acceptance Criteria

- [ ] Settings page loads with client identity and sync config
- [ ] Identity fields displayed as read-only (username, hostname, MAC)
- [ ] Sync toggle works (on/off)
- [ ] Sync interval selector with allowed values
- [ ] Backend URL input with HTTPS validation
- [ ] Sync status indicator shows correct state (connected/disconnected/disabled)
- [ ] Settings update via API, WebSocket broadcast
- [ ] Form validation on all fields

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] Settings page renders
- [ ] Settings update works
- [ ] Validation correct

## Dependencies

- **Requires:** M2-T2 (monitors list), M1-T5 (client identity)
- **Blocks:** None

## Documentation References

- F9: [Client settings UI](../../requirements/features/feature-0009-client-settings.md)
