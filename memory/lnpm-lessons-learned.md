---
name: lnpm-lessons-learned
description: Errors encountered and lessons learned during M1-T1 implementation
metadata:
  type: project
  agent: "12"
  date: 2026-08-01
---

# LNPM Cloud Dashboard — Lessons Learned

## Errors and Fixes

### WebSocket Message Handler Type Mismatch (Agent 08)
- **Error**: `server/ws/ping.ts` treated `message` as a `string`, but Nuxt's crossws passes a `Message` object with a `.text` property.
- **Fix**: Changed `JSON.parse(message)` to `JSON.parse(message.text)`.
- **Lesson**: Nuxt 4 WebSocket handlers use a different message type than raw `ws` — always check the handler signature.

### Unused `ws` Import (Agent 08)
- **Error**: `import { WebSocketServer } from "ws"` in `server/ws/ping.ts` — unused, causing potential bundle bloat.
- **Fix**: Removed import.
- **Lesson**: When using Nuxt's `defineWebSocketHandler`, the `ws` package is not needed for the handler itself.

### No Migration Error Handling (Agent 08)
- **Error**: `db.exec()` throws on malformed SQL with no try/catch — silent migration failures.
- **Fix**: Added try/catch per migration with `console.error` and rethrow.
- **Lesson**: Always wrap database operations in error handlers, especially for startup-time operations like migrations.

### Migrations Re-run Every Startup (Agent 08)
- **Error**: No tracking of applied migrations — all migrations execute every time the server starts, causing failures for non-idempotent DDL (e.g., `ALTER TABLE`, `CREATE TABLE` without `IF NOT EXISTS`).
- **Fix**: Added `migrations` tracking table with `INSERT INTO migrations (name) VALUES (?)` after each successful migration, and a pre-check (`SELECT name FROM migrations`) to skip applied ones.
- **Lesson**: Migration tracking is essential — even for simple projects. The tracking table must be created by the plugin, not a migration file.

### package.json Read Every Health Check (Agent 08)
- **Error**: `readFileSync` on `package.json` called on every `/api/health` request — wasted disk I/O.
- **Fix**: Cached at module scope using an IIFE with fallback.
- **Lesson**: Cache module-level constants that don't change at runtime.

### Missing `app/layouts/default.vue` (Agent 08)
- **Error**: `<NuxtLayout>` in `app.vue` had no layout file — Nuxt renders a no-op when no default layout exists.
- **Fix**: Created `app/layouts/default.vue` with flex column layout and `min-height: 100vh`.
- **Lesson**: Always create a default layout when using `<NuxtLayout>`, even if minimal.

### Useless `imports.dirs` Config (Agent 08)
- **Error**: `imports: { dirs: ["shared"] }` in `nuxt.config.ts` — Nuxt auto-import only picks up functions and constants, not type interfaces.
- **Fix**: Removed from config.
- **Lesson**: Nuxt auto-import does not work for type-only exports — import types explicitly.

### NaN Timeout from Bad Env Var (Agent 08)
- **Error**: `parseInt(process.env.START_SERVER_TIMEOUT)` returns `NaN` for non-numeric strings.
- **Fix**: Added `Number()` + `Number.isNaN()` guard with 60s fallback.
- **Lesson**: Always validate env vars before using them as numbers — `parseInt` and `Number` silently produce `NaN` or `0`.

## General Lessons

### TypeScript Strict Mode
- TypeScript strict mode (`nuxt.config.ts → typescript.strict: true`) is essential — it catches type mismatches early (like the WebSocket message handler issue).

### better-sqlite3 WAL Mode
- Always enable WAL mode (`PRAGMA journal_mode = WAL`) for better concurrent read/write performance. Enable foreign keys (`PRAGMA foreign_keys = ON`) for data integrity.

### Vitest Setup for Nitro
- The test setup file (`test/setup.ts`) needs to clear `globalThis.__db` before each test to ensure test isolation. Without this, tests share the same database instance.

### Nuxt 4 Compatibility
- `compatibilityVersion` is not needed in Nuxt 4 (removed from config).
- `nuxt typecheck` (not `nuxi typecheck`) is the correct command in Nuxt 4.
