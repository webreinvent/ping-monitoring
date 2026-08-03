---
name: lnpm-lessons-learned
description: Errors encountered and lessons learned during M1-T1 implementation
metadata:
  type: project
  agent: "12"
  date: 2026-08-03
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

## M1-T6 Lessons (Ping Ingest)

### better-sqlite3 Segfault in Vitest Forked Workers
- **Error**: Integration tests with `better-sqlite3` crash with segfaults in Vitest's forked worker pools. The native module doesn't play well with Vitest's forked process model.
- **Root cause**: `better-sqlite3` uses C++ bindings that don't survive process forking cleanly. This happens in both `--pool=forks` (default) and `--pool=threads` modes.
- **Fix**: Use `vi.mock("./db", () => ({ getDb: vi.fn() }))` for unit tests — mock the DB entirely. Integration tests are problematic and should use in-memory SQLite with careful process isolation if needed. The mock DB pattern (dispatching on SQL string) is the recommended approach.
- **Lesson**: Always mock `getDb()` in tests that involve `better-sqlite3`. Don't try to use the real database in Vitest tests unless you control the process lifecycle.

### vi.doMock Inside Test Files Causes Parse Errors
- **Error**: `vi.doMock()` called inside a `describe`/`test` block causes "Failed to parse source code" errors in Vitest.
- **Root cause**: `vi.doMock()` must be called before any `import` statements that use the mocked module. Inside a test file, all imports are already hoisted.
- **Fix**: Use top-level `vi.mock()` (not `vi.doMock()`) at the file level before imports. Or use the mock pattern already established in the project (top-level `vi.mock("./module", () => ({ fn: vi.fn() }))`).

### Playwright Test Files Fail Under Vitest
- **Error**: `.spec.ts` files (Playwright tests) were being picked up by Vitest and failing with "Playwright Test did not expect test.describe()".
- **Root cause**: The `vitest.config.ts` include pattern was too broad, matching `.spec.ts` files.
- **Fix**: Ensure `vitest.config.ts` include is `**/*.test.ts` (not `**/*.spec.ts`). Playwright tests use `.spec.ts`, Vitest uses `.test.ts`. The two don't conflict when naming conventions are respected.

### Environment Variable Config Reading at Runtime
- **Lesson**: `INGEST_MAX_SAMPLES` and `INGEST_FUTURE_WINDOW_MS` are read at function call time (not module load time). This means tests can stub env vars with `vi.stubEnv()` and the module will pick up the new values — no need to re-import.
- **Pattern**: Always read env vars inside functions (not at module scope) when they need to be testable.

### Mock DB SQL Dispatching by String Matching
- **Pattern**: When mocking `better-sqlite3`'s `prepare()`, dispatch on `sql.includes("INSERT INTO monitors")` etc. This is fragile but works for unit tests. The key is to match enough of the SQL string to uniquely identify each query path.
- **Lesson**: This pattern requires the SQL strings to be stable. If a SQL string changes (e.g., adding a column), the mock needs to be updated. This is a tradeoff for avoiding real SQLite in tests.
