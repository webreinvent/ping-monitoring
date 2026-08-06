# LNPM Cloud Dashboard — Task Complete: M2-T7

> Task: M2-T7 — Implement inline client name editing with WebSocket broadcast (F11)
> Date: 2026-08-06
> Branch: `feature/M2-T7-inline-client-name-edit-v1`

## Summary

Completed the WebSocket broadcast for client name updates. The feature was substantially pre-implemented — the UI, API endpoint, and frontend listener all existed. The gap was the server-side broadcast mechanism: a `broadcastClientNameUpdated()` function and global `allPeers` Set to reach all connected WebSocket clients.

## What Was Done

### Files Modified (5)

1. **`dashboard/shared/types.ts`** — Added `"client_name_updated"` to `WsOutboundType` union type
2. **`dashboard/server/ws/ping.ts`** — Added:
   - `allPeers: Set<WebSocketType>` — global peer tracking for non-monitor-scoped broadcasts
   - `ClientNameUpdatedMessage` interface — `{ type: "client_name_updated", clientSlug, newName }`
   - `broadcastClientNameUpdated(clientSlug, newName)` — exported broadcast function
   - `open()` handler now adds peer to `allPeers`
   - `close()` handler now removes peer from `allPeers`
3. **`dashboard/server/api/clients/[slug].name.put.ts`** — Added import of `broadcastClientNameUpdated` and call after successful update
4. **`dashboard/server/ws/ping.test.ts`** — Added 5 new tests for `broadcastClientNameUpdated`:
   - Export verification
   - Message shape correctness
   - Broadcast reaches all connected peers
   - Skips closed peers (readyState !== 1)
   - Handles send errors gracefully
5. **`dashboard/server/api/clients/[slug].name.put.integration.test.ts`** — Added 3 new integration tests:
   - Mock broadcast function verification
   - Broadcast receives correct args
   - Endpoint flow: broadcast called after successful update

### Key Implementation Details

- **`allPeers` Set**: Tracks ALL connected WebSocket peers independently of monitor subscriptions. Populated on `open()`, cleaned up on `close()`. Enables global broadcasts (name updates, settings updates).
- **`broadcastClientNameUpdated()`**: Iterates `[...allPeers]` (copy) to send `{ type: "client_name_updated", clientSlug, newName }` to every connected peer. ReadyState check and error handling per peer.
- **Endpoint integration**: `PUT /api/clients/:slug/name` now calls `broadcastClientNameUpdated(row.slug, row.name)` after `updateClientName()` succeeds. Non-blocking — broadcast failure doesn't affect API response.
- **Frontend wiring**: Already in place — `SidebarContent.vue` calls `useWebSocket().onClientNameUpdated((slug, name) => { ... })` to update sidebar client names reactively.
- **8 new tests** across 2 test files — broadcast function behavior, message shape, peer handling, and endpoint integration.

## Test Results

- `npx nuxi typecheck` — passes (verified by Agent 03)
- `npx nuxi dev` — starts without errors (verified by Agent 03)
- All existing tests pass (no regressions)
- 8 new tests added for broadcast function and integration

## Acceptance Criteria Status

- [x] Edit icon in sidebar client group header (pre-existing from M2-T2)
- [x] Inline text input with Save/Cancel buttons (pre-existing from M2-T2)
- [x] Name saved via API, sidebar updates immediately (pre-existing API + frontend wiring)
- [x] All connected clients receive name update via WebSocket (NEW — Agent 02)
- [x] Cancel/Escape reverts to original name (pre-existing from M2-T2)
- [x] Validation: rejects empty, whitespace, >100 chars (pre-existing API validation)
- [x] Optimistic UI update (pre-existing from M2-T2)

## Files Changed Summary

- 0 new files created
- 5 existing files modified
- 0 files deleted
- 8 new tests added
