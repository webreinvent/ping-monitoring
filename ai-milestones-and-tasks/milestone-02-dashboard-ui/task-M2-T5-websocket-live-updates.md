---
taskId: M2-T5
milestone: M2
title: Implement WebSocket composable with live chart updates
priority: High
status: "🟢 Complete"
estimatedEffort: "3-4 hours"
features:
  - F8
  - F7
---

# Task M2-T5 — Implement WebSocket composable with live chart updates

> **Milestone:** M2 (Dashboard UI)
> **Priority:** High
> **Status:** 🟢 Complete
> **Estimated Effort:** 3-4 hours

## Description

Build the `useWebSocket` composable that manages WebSocket connections, handles subscribe/unsubscribe for monitors, implements auto-reconnect with exponential backoff, and pushes live samples to charts.

## Task Goals

- Create `useWebSocket` composable with full connection management
- Subscribe to monitors for live updates
- Push new samples to uPlot charts without page reload
- Auto-reconnect with exponential backoff
- Handle WebSocket disconnect indicator

## Acceptance Criteria

- [x] WebSocket connection established on dashboard load
- [x] Subscribe/unsubscribe protocol works
- [x] New samples push to charts without page reload
- [x] Auto-reconnect with exponential backoff (1s-30s)
- [x] Re-subscribe to monitors on reconnect
- [x] Client name updates broadcast to sidebar
- [x] Reconnect indicator shown during disconnection
- [x] Connection state exposed for UI

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors

## Testing Checklist

- [x] WebSocket connects
- [x] Live updates work
- [x] Reconnect works

## Dependencies

- **Requires:** M2-T3 (all-monitors chart), M1-T9 (WebSocket backend)
- **Blocks:** None

## Documentation References

- F7: [WebSocket live broadcast](../../requirements/features/feature-0007-websocket-broadcast.md) — Message protocol
- F8: [Web dashboard UI](../../requirements/features/feature-0008-web-dashboard.md) — Live WebSocket updates
