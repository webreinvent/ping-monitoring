---
taskId: M2-T5
milestone: M2
title: Implement WebSocket composable with live chart updates
priority: High
status: "Not Started"
estimatedEffort: "3-4 hours"
features:
  - F8
  - F7
---

# Task M2-T5 — Implement WebSocket composable with live chart updates

> **Milestone:** M2 (Dashboard UI)
> **Priority:** High
> **Status:** Not Started
> **Estimated Effort:** 3-4 hours

## Description

Build the `useWebSocket` composable that manages WebSocket connections, handles subscribe/unsubscribe for monitors, implements auto-reconnect with exponential backoff, and pushes live samples to charts.

## Task Goals

- Create `useWebSocket` composable with full connection management
- Subscribe to monitors for live updates
- Push new samples to uPlot charts without page reload
- Auto-reconnect with exponential backoff
- Handle WebSocket disconnect indicator

## Implementation Plan

### Steps

1. Create `app/composables/useWebSocket.ts`:
   - Connect to `ws://<host>/ws/ping` (or `wss://` in production)
   - `subscribe(monitorId)`: send subscribe message
   - `unsubscribe(monitorId)`: send unsubscribe message
   - Handle incoming messages by type: snapshot, sample, client_name_updated
   - Auto-reconnect: 1s -> 2s -> 4s -> 8s -> 16s -> 30s (capped)
   - Track connection state: connecting, connected, disconnected
   - Re-subscribe to all monitors on reconnect
2. Integrate with chart components:
   - On `sample` message, push data point to uPlot series
   - Batch updates to avoid per-sample re-render (1s interval)
   - Update sidebar status dot on new sample
3. Integrate with sidebar:
   - On `client_name_updated` message, patch client name in sidebar
4. Add reconnect indicator in header:
   - "Reconnecting..." indicator during disconnection

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `nuxt` | Vue 3 composable patterns | Composable |
| `filesystem` (MCP) | File creation | Writing files |

## Acceptance Criteria

- [ ] WebSocket connection established on dashboard load
- [ ] Subscribe/unsubscribe protocol works
- [ ] New samples push to charts without page reload
- [ ] Auto-reconnect with exponential backoff (1s-30s)
- [ ] Re-subscribe to monitors on reconnect
- [ ] Client name updates broadcast to sidebar
- [ ] Reconnect indicator shown during disconnection
- [ ] Connection state exposed for UI

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] WebSocket connects
- [ ] Live updates work
- [ ] Reconnect works

## Dependencies

- **Requires:** M2-T3 (all-monitors chart), M1-T9 (WebSocket backend)
- **Blocks:** None

## Documentation References

- F7: [WebSocket live broadcast](../../requirements/features/feature-0007-websocket-broadcast.md) — Message protocol
- F8: [Web dashboard UI](../../requirements/features/feature-0008-web-dashboard.md) — Live WebSocket updates
