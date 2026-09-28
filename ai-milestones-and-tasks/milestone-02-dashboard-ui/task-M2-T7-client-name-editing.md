---
taskId: M2-T7
milestone: M2
title: Implement inline client name editing with WebSocket broadcast
priority: Medium
status: "🟢 Complete"
estimatedEffort: "1-2 hours"
features:
  - F11
---

# Task M2-T7 — Implement inline client name editing with WebSocket broadcast

> **Milestone:** M2 (Dashboard UI)
> **Priority:** Medium
> **Status:** 🟢 Complete
> **Estimated Effort:** 1-2 hours

## Description

Add inline editing capability for client names in the sidebar. Click edit icon to change the display name, save via API, and broadcast the change to all connected clients via WebSocket.

## Task Goals

- Create inline edit UI in sidebar client group header
- Save name via `PUT /api/clients/:slug/name`
- Broadcast to all connected clients via WebSocket
- Handle errors and cancellation

## Acceptance Criteria

- [x] Edit icon in sidebar client group header
- [x] Inline text input with Save/Cancel buttons
- [x] Name saved via API, sidebar updates immediately
- [x] All connected clients receive name update via WebSocket
- [x] Cancel/Escape reverts to original name
- [x] Validation: rejects empty, whitespace, >100 chars
- [x] Optimistic UI update

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors

## Testing Checklist

- [x] Inline edit works
- [x] WebSocket broadcast works
- [x] Validation correct

## Dependencies

- **Requires:** M2-T2 (sidebar components), M1-T5 (client API), M2-T5 (WebSocket)
- **Blocks:** None

## Documentation References

- F11: [Dashboard client name editing](../../requirements/features/feature-00011-edit-client-name.md)
