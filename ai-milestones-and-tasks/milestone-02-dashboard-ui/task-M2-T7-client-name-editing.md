---
taskId: M2-T7
milestone: M2
title: Implement inline client name editing with WebSocket broadcast
priority: Medium
status: "Not Started"
estimatedEffort: "1-2 hours"
features:
  - F11
---

# Task M2-T7 — Implement inline client name editing with WebSocket broadcast

> **Milestone:** M2 (Dashboard UI)
> **Priority:** Medium
> **Status:** Not Started
> **Estimated Effort:** 1-2 hours

## Description

Add inline editing capability for client names in the sidebar. Click edit icon to change the display name, save via API, and broadcast the change to all connected clients via WebSocket.

## Task Goals

- Create inline edit UI in sidebar client group header
- Save name via `PUT /api/clients/:slug/name`
- Broadcast to all connected clients via WebSocket
- Handle errors and cancellation

## Implementation Plan

### Steps

1. Update `app/components/sidebars/ClientGroup.vue`:
   - Add edit icon button in client name header
   - Click to show inline text input with Save/Cancel
   - Auto-focus input
2. Create `app/composables/useClientEdit.ts`:
   - Manage edit state
   - Call `PUT /api/clients/:slug/name`
   - Optimistic UI update
   - Revert on failure
3. Backend integration:
   - `PUT /api/clients/:slug/name` (already created in M1-T5)
   - WebSocket `client_name_updated` broadcast (already integrated in M1-T9)
4. Handle edge cases:
   - Empty/whitespace name rejected (400)
   - >100 chars rejected (400)
   - Escape/Cancel reverts to original name

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `nuxt` | Vue 3 composable patterns | Component update |
| `filesystem` (MCP) | File editing | Modifying components |

## Acceptance Criteria

- [ ] Edit icon in sidebar client group header
- [ ] Inline text input with Save/Cancel buttons
- [ ] Name saved via API, sidebar updates immediately
- [ ] All connected clients receive name update via WebSocket
- [ ] Cancel/Escape reverts to original name
- [ ] Validation: rejects empty, whitespace, >100 chars
- [ ] Optimistic UI update

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] Inline edit works
- [ ] WebSocket broadcast works
- [ ] Validation correct

## Dependencies

- **Requires:** M2-T2 (sidebar components), M1-T5 (client API), M2-T5 (WebSocket)
- **Blocks:** None

## Documentation References

- F11: [Dashboard client name editing](../../requirements/features/feature-00011-edit-client-name.md)
