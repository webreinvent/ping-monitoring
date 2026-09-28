---
taskId: M1-T9
milestone: M1
title: Create WebSocket live broadcast with subscription management
priority: High
status: "🟢 Complete"
estimatedEffort: "4-6 hours"
features:
  - F7
---

# Task M1-T9 — Create WebSocket live broadcast with subscription management

> **Milestone:** M1 (Backend Platform)
> **Priority:** High
> **Status:** 🟢 Complete
> **Estimated Effort:** 4-6 hours

## Description

Build the WebSocket endpoint at `/ws/ping` for real-time ping data broadcast. Maintains a subscription map per monitor, sends fresh snapshots on subscribe, and pushes new samples to all subscribers when ingest occurs.

## Task Goals

- Create Nitro WebSocket handler at `/ws/ping`
- Implement subscription management (subscribe/unsubscribe)
- Send snapshot of last 100 samples on subscribe
- Broadcast new samples to subscribers after ingest
- Clean up stale connections on close/error

## Acceptance Criteria

- [x] WebSocket connection accepted at `/ws/ping`
- [x] `subscribe` message sends `subscribed` ack + `snapshot` with last 100 samples
- [x] `unsubscribe` message sends `unsubscribed` ack and stops further messages
- [x] New samples from ingest are broadcast to subscribers within 100ms
- [x] Multiple subscribers per monitor all receive samples
- [x] Stale connections cleaned up on close/error
- [x] Message protocol matches F7 spec (subscribe, unsubscribe, subscribed, unsubscribed, snapshot, sample)

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors

## Testing Checklist

- [x] WebSocket connection works
- [x] Subscribe/snapshot protocol
- [x] Unsubscribe stops messages
- [x] Live sample broadcast

## Dependencies

- **Requires:** M1-T6 (ingest — sample source), M1-T8 (history — snapshot data)
- **Blocks:** None

## Documentation References

- F7: [WebSocket live broadcast](../../requirements/features/feature-0007-websocket-broadcast.md)
