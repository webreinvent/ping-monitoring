---
name: lnpm-decisions-made
description: Architectural and implementation decisions for LNPM Cloud Dashboard — M1-T1
metadata:
  type: project
  agent: "12"
  date: 2026-08-03
---

# LNPM Cloud Dashboard — Decisions Made

## Technology Choices

### Nuxt 4 + Nitro v2 (ADR-001)
- **Decision**: Use Nuxt 4 with Nitro v2 as the full-stack framework for the Cloud Dashboard.
- **Rationale**: Unified SSR/SSG/serverless-capable framework with built-in API routing, WebSocket support, and file-based routing. Replaces the desktop app's Tauri backend with a web-native approach.
- **Version**: Nuxt ^4.1.0, Nitro (bundled with Nuxt 4).

### Persistent `node-server` Runtime
- **Decision**: Nitro preset set to `node-server` (not serverless/cloudflare).
- **Rationale**: Requires persistent WebSocket connections, SQLite database, and in-memory cache — all incompatible with serverless cold starts.
- **Config**: `nitro.preset: "node-server"` in `nuxt.config.ts`.

### better-sqlite3 for Database
- **Decision**: Use `better-sqlite3` (synchronous, C++ bindings) over `sqlite3` (async) or `libsql`.
- **Rationale**: Synchronous API simplifies error handling in a persistent Node.js process. No need for connection pooling since it's a single-process SQLite. WAL mode enabled for concurrent reads.

### TypeScript ^5.7.0
- **Decision**: TypeScript 5.7.x for Nuxt 4.5 compatibility.
- **Rationale**: Nuxt 4 requires TypeScript 5.0+. 5.7 is the latest stable that's been tested with Nuxt 4.

## Architecture Decisions

### Database via `globalThis`
- **Decision**: Store DB instance on `globalThis.__db` for cross-module access.
- **Rationale**: Nitro doesn't have a built-in DI container. `globalThis` is the simplest way to share state across Nitro plugins and API routes. Common pattern in the Nitro ecosystem.
- **Known limitation**: Requires `as any` cast. Proper fix would be a module-level export, but Nitro's file-based architecture makes this tricky without a shared singleton module.

### No Auto-import for Shared Types
- **Decision**: Do not use `imports.dirs` for shared types. Import types explicitly.
- **Rationale**: Nuxt auto-import only picks up functions and constants — not type interfaces. The config was useless and was removed during code review (Agent 08).

### Migration Tracking Table Created at Runtime
- **Decision**: The `migrations` tracking table is created by the database plugin (not a migration file).
- **Rationale**: The tracking table must exist before any migration runs. Creating it in a migration file would create a chicken-and-egg problem. The plugin creates it with `CREATE TABLE IF NOT EXISTS` before iterating migrations.

### WebSocket via Nuxt's `defineWebSocketHandler`
- **Decision**: Use Nuxt's built-in WebSocket API (`defineWebSocketHandler`) instead of a raw WebSocket server.
- **Rationale**: Integrated with Nitro's server lifecycle, shares the same port, and is experimentally supported in Nuxt 4 (`nitro.experimental.websocket: true`).
- **Note**: `ws` package is still installed as a dependency for type definitions and potential manual peer management.

### Structured Logger Over Nitro's Built-in Logger
- **Decision**: Custom structured logger (`server/utils/logger.ts`) instead of Nitro's `useLogger`.
- **Rationale**: Need LOG_LEVEL control per environment, structured output format, and meta JSON support. Premature optimization but working.
- **Known**: Reimplements functionality Nitro provides — could be revisited later.

### Module-scope Caching for Health Endpoint
- **Decision**: Cache `package.json` version at module scope using an IIFE.
- **Rationale**: `package.json` doesn't change at runtime — reading it on every `/api/health` request wastes disk I/O. Discovered during code review (Agent 08).

### Test Setup Silences Console by Default
- **Decision**: Test setup replaces `console.*` methods with no-ops before all tests.
- **Rationale**: Keeps test output clean. Tests can still spy on console methods when they need to assert output — `afterEach` restores originals.

## Design Decisions

### Empty Placeholder Schema
- **Decision**: `schema/index.sql` is a placeholder; `001_initial_setup.sql` is also a placeholder.
- **Rationale**: Feature-specific tables (F2-F9) will have their own migration files. The schema index will be assembled later. Keeps M1-T1 minimal and focused on infrastructure.

### Minimal App Shell
- **Decision**: `app.vue` is a 7-line wrapper; `index.vue` shows a placeholder "monitors will appear here" message.
- **Rationale**: M1-T1 is about backend foundation. UI work is deferred to Phase 9 of the implementation plan.

## Ping Ingest Decisions (M1-T6)

### Separate ping-types.ts (Not shared/types.ts)
- **Decision**: Create `server/utils/ping-types.ts` for ping-specific types rather than adding to `shared/types.ts`.
- **Rationale**: `shared/types.ts` is stale (has old ingest types that don't match F3 contract). Keeping ping types co-located with the implementation avoids polluting the shared types file and keeps domain boundaries clear. The `shared/` directory is for client-server shared types; ping ingest types are server-only.

### Client Auto-Registration on First Ingest (ADR-002)
- **Decision**: The ingest endpoint auto-registers unknown clients when identity fields (`username`, `hostname`, `mac_address`) are provided.
- **Rationale**: Eliminates a separate registration step — the first ping batch from a new client registers it automatically. Matches F4 spec (client sync service). Requires all 3 identity fields to be present; if incomplete, returns 401 as usual.

### INSERT OR IGNORE for Dedup (ADR-003)
- **Decision**: Use `INSERT OR IGNORE INTO ping_samples ... VALUES (...)` with a unique index on `(monitor_id, timestamp_ms, status)` rather than a two-phase "SELECT then INSERT" approach.
- **Rationale**: Eliminates race conditions and is more performant. The unique index is guaranteed by the schema (migration 003). `stmt.run().changes` returns 0 for ignored rows, enabling accurate accepted vs duplicate counts.

### Rejected Count Based on Unique Sample Indices (ADR-004)
- **Decision**: A sample with 3 validation failures counts as 1 rejected sample (not 3). Rejected count uses `new Set(rejections.map(r => r.index)).size`.
- **Rationale**: The F3 spec says "rejected" is the count of rejected samples, not rejection reasons. The `rejections` array contains all individual reasons for traceability.

### Status Code 200 for All-Rejected (ADR-005)
- **Decision**: When all samples are rejected (accepted=0, duplicate=0), return 200 (not 207).
- **Rationale**: 200 indicates "the request was processed successfully." The rejections are returned in the response body. 207 is reserved for mixed outcomes (some accepted + some not).

### sendResponse Helper Instead of Direct Return (ADR-006)
- **Decision**: Use a `sendResponse(event, statusCode, body)` helper that calls `setResponseStatus(event, statusCode)` and returns the body.
- **Rationale**: Nitro's `defineEventHandler` returns the body as JSON but doesn't let you easily set a custom status code in the same expression. The helper separates status code setting from body return.

## Quality Classifier Decisions (M1-T10)

### 7-State Classification with First-Match-Wins (ADR-007)
- **Decision**: Use 7 quality states: `veryHigh`, `high`, `medium`, `low`, `unstable`, `disconnected`, `warmingUp`. Apply in deterministic priority order: disconnected → warmingUp → unstable → veryHigh → high → medium → low.
- **Rationale**: Simple, fast, and easy to reason about. No complex scoring system — just ordered thresholds. The `unstable` check comes before `veryHigh` so high-variance connections aren't misclassified as excellent.
- **Thresholds**: 5-minute window, 10 min samples, cv > 0.5 for unstable, packet_loss < 10% for unstable, 0% packet_loss + <50ms for veryHigh, 0% + <150ms for high, ≤10% + ≤300ms for medium, everything else is low.

### Disconnected Detection with Time Bounds (ADR-008)
- **Decision**: Monitor is `disconnected` when there are no samples in the 5-min window AND last sample was 5–60 min ago. If last sample was >1 hour ago, it's `warmingUp` (old/inactive monitor).
- **Rationale**: Without the 1-hour upper bound, monitors that stopped sending data weeks ago would show as `disconnected` instead of the more appropriate `warmingUp` (they haven't really "disconnected" — they were never active in the current session).

### Post-Ingest Classification After Transaction (ADR-009)
- **Decision**: Classification runs AFTER the transaction commits (outside `db.transaction()`), so it sees newly inserted samples. Failure is logged but never causes ingest to fail.
- **Rationale**: Classification is best-effory metadata. The ingest is the critical path — it must succeed even if classification has an issue. Running after the transaction ensures the classifier sees the new data.

### Background Sweep Scope (ADR-010)
- **Decision**: Background sweep only classifies monitors with samples in the last 10 minutes (2× the 5-min window), not all monitors.
- **Rationale**: Monitors without recent samples have no data to re-classify — they'll stay in their current state. This avoids unnecessary database reads on inactive monitors.

### Quality State Migration Strategy (ADR-011)
- **Decision**: Migration 006 maps legacy quality states (`warmingUp`→`disconnected`, `good`→`veryHigh`, `degraded`→`medium`, `poor`→`low`) to F12 equivalents.
- **Rationale**: Existing monitors have quality states from the pre-F12 system. The migration ensures they display correctly rather than showing unknown/garbage values.
