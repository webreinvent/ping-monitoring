# LNPM Key Files by Task Type

## Dashboard — New API Endpoint

| Order | File | Purpose |
|---|---|---|
| 1 | `dashboard/shared/types.ts` | Add/update request/response types (client-server contract) |
| 2 | `dashboard/schema/migrations/NNN_*.sql` | New migration if schema changes (also update `index.sql`) |
| 3 | `dashboard/server/utils/{module}.ts` | Business logic (pure functions, testable) |
| 4 | `dashboard/server/utils/{module}.test.ts` | Colocated vitest (mock DB) |
| 5 | `dashboard/server/api/{route}.ts` | h3 handler (`defineEventHandler`, try/catch, structured JSON) |
| 6 | `docs/api/{endpoint-name}.md` | API documentation |

## Dashboard — New WebSocket Feature

| Order | File | Purpose |
|---|---|---|
| 1 | `dashboard/shared/types.ts` | WS message types |
| 2 | `dashboard/server/routes/ws/ping.ts` | Extend `defineWebSocketHandler` + broadcast functions |
| 3 | `dashboard/app/composables/useWebSocket.ts` | Client-side subscribe/handle |
| 4 | `dashboard/app/composables/useLiveChart.ts` | WS → uPlot bridge (if chart data) |
| 5 | `docs/websocket/protocol.md` | Protocol documentation |

**Gotcha:** To call WS broadcast functions from API routes, use dynamic `import()`:
```typescript
const { broadcastSample } = await import("#server/routes/ws/ping");
```

## Dashboard — New Vue Component

| Order | File | Purpose |
|---|---|---|
| 1 | `dashboard/app/components/{feature}/{ComponentName}.vue` | `<script setup lang="ts">`, `data-testid`, scoped CSS |
| 2 | `dashboard/app/composables/use{Feature}.ts` | Data-fetching / state composable (if needed) |
| 3 | `dashboard/app/composables/use{Feature}.test.ts` | Vitest for composable |
| 4 | `dashboard/app/pages/...` | Wire component into page (last) |
| 5 | `docs/frontend/components/{ComponentName}.md` | Component documentation |

## Dashboard — New Migration

| Order | File | Purpose |
|---|---|---|
| 1 | `dashboard/schema/migrations/NNN_description.sql` | New migration (3-digit prefix, idempotent) |
| 2 | `dashboard/schema/index.sql` | Append new migration SQL |
| 3 | `docs/database/{table-name}-table.md` | Update table documentation |

**Note:** Modifying `schema/migrations/` requires user confirmation before applying.

## Tauri — New Command / Feature

| Order | File | Purpose |
|---|---|---|
| 1 | `src-tauri/src/domain.rs` | Core types if changed |
| 2 | `src-tauri/src/{module}.rs` | Business logic + `#[cfg(test)]` unit tests |
| 3 | `src-tauri/src/storage.rs` | DB schema (rusqlite, `schema_info` version + `ALTER TABLE`) |
| 4 | `src-tauri/src/commands.rs` | New `#[tauri::command]` fn + `CommandError` mapping |
| 5 | `src-tauri/src/lib.rs` | Register in `generate_handler!` + state |
| 6 | `src/api.ts` | Frontend `invoke` bridge |
| 7 | `src/types.ts` | Frontend types (mirror Rust serde output) |
| 8 | `src/main.ts` | UI wiring (last) |

## Tauri — Chart / UI Change (e.g., M3-T1)

| Order | File | Purpose |
|---|---|---|
| 1 | `src/chart.ts` | uPlot wrapper — palette, thresholds, quality bands |
| 2 | `src/chart-tooltip.ts` | Tooltip logic if changed |
| 3 | `src/styles.css` | CSS for desktop UI |
| 4 | `src/main.ts` | UI wiring |
| 5 | `src/*.test.ts` | Colocated vitest for pure logic |

## Cross-Stack — New API Endpoint + Tauri Sync

| Order | File | Purpose |
|---|---|---|
| 1 | `dashboard/shared/types.ts` | Shared type contract |
| 2 | `dashboard/schema/migrations/NNN_*.sql` | Migration (if schema changes) |
| 3 | `dashboard/server/utils/{module}.ts` | Business logic |
| 4 | `dashboard/server/api/{route}.ts` | HTTP route |
| 5 | `dashboard/app/composables/` | Dashboard frontend composable |
| 6 | `dashboard/app/components/` | Dashboard Vue component |
| 7 | `src-tauri/src/sync.rs` | Tauri SyncService payload (must match `shared/types.ts`) |
| 8 | `src-tauri/src/commands.rs` | New Tauri command (if needed) |
| 9 | `src/api.ts` | Frontend invoke bridge |
| 10 | `src/types.ts` | Frontend types |

**Critical:** The Tauri `IngestPayload` in `sync.rs` must match `dashboard/shared/types.ts`. `targetHost` is the host **string** (not UUID). `mac_address` stays snake_case (deliberate contract exception). All other fields are camelCase.

## Milestone / Tracking Files

| File | Purpose |
|---|---|
| `ai-milestones-and-tasks/project-dashboard.md` | Milestone dashboard (update task status + progress) |
| `ai-milestones-and-tasks/milestone-{NN}-{name}/task-{ID}-*.md` | Individual task file (update `Status:` + append Completion Notes) |
| `AGENTS.md` | Append new conventions/ADRs (do NOT rewrite) |
| `docs/` | Update/create docs for the feature |
