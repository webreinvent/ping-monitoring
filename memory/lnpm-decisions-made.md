---
name: lnpm-decisions-made
description: Architectural and implementation decisions for LNPM Cloud Dashboard — M1-T1
metadata:
  type: project
  agent: "12"
  date: 2026-08-01
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
