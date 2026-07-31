---
taskId: M1-T9
milestone: M1
title: Create WebSocket live broadcast with subscription management
priority: High
status: "Not Started"
estimatedEffort: "4-6 hours"
features:
  - F7
---

# Task M1-T9 — Create WebSocket live broadcast with subscription management

> **Milestone:** M1 (Backend Platform)
> **Priority:** High
> **Status:** Not Started
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

- [ ] WebSocket connection accepted at `/ws/ping`
- [ ] `subscribe` message sends `subscribed` ack + `snapshot` with last 100 samples
- [ ] `unsubscribe` message sends `unsubscribed` ack and stops further messages
- [ ] New samples from ingest are broadcast to subscribers within 100ms
- [ ] Multiple subscribers per monitor all receive samples
- [ ] Stale connections cleaned up on close/error
- [ ] Message protocol matches F7 spec (subscribe, unsubscribe, subscribed, unsubscribed, snapshot, sample)

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] WebSocket connection works
- [ ] Subscribe/snapshot protocol
- [ ] Unsubscribe stops messages
- [ ] Live sample broadcast

## Dependencies

- **Requires:** M1-T6 (ingest — sample source), M1-T8 (history — snapshot data)
- **Blocks:** None

## Documentation References

- F7: [WebSocket live broadcast](../../requirements/features/feature-0007-websocket-broadcast.md)
