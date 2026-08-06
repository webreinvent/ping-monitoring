---
name: lnpm-lessons-learned
description: Errors encountered and lessons learned during M1 and M2 implementation
metadata:
  type: project
  agent: "12"
  date: 2026-08-03
---

# LNPM Cloud Dashboard — Lessons Learned

## M1 Lessons

### WebSocket Message Handler Type Mismatch (Agent 08)
- **Error**: `server/ws/ping.ts` treated `message` as a `string`, but crossws passes a `Message` object with `.text` property.
- **Fix**: Changed `JSON.parse(message)` to `JSON.parse(message.text)`.
- **Lesson**: Nuxt 4 WebSocket handlers use a different message type than raw `ws`.

### Unused `ws` Import (Agent 08)
- **Error**: `import { WebSocketServer } from "ws"` in WebSocket handler — unused.
- **Fix**: Removed import.

### No Migration Error Handling (Agent 08)
- **Error**: `db.exec()` throws on malformed SQL with no try/catch.
- **Fix**: Added try/catch per migration with console.error + rethrow.

### Migrations Re-run Every Startup (Agent 08)
- **Error**: No tracking of applied migrations.
- **Fix**: Added `migrations` tracking table with INSERT after each successful migration and pre-check to skip applied ones.

### package.json Read Every Health Check (Agent 08)
- **Error**: `readFileSync` on `package.json` called on every request.
- **Fix**: Cached at module scope using IIFE with fallback.

### Missing `app/layouts/default.vue` (Agent 08)
- **Error**: `<NuxtLayout>` in `app.vue` had no layout file.
- **Fix**: Created `app/layouts/default.vue` with flex column layout and `min-height: 100vh`.

### Useless `imports.dirs` Config (Agent 08)
- **Error**: `imports: { dirs: ["shared"] }` — Nuxt auto-import doesn't pick up type interfaces.
- **Fix**: Removed from config.

### NaN Timeout from Bad Env Var (Agent 08)
- **Error**: `parseInt(process.env.START_SERVER_TIMEOUT)` returns `NaN` for non-numeric strings.
- **Fix**: Added `Number()` + `Number.isNaN()` guard with fallback.

### better-sqlite3 Segfault in Vitest Forked Workers (M1-T6)
- **Error**: Integration tests with `better-sqlite3` crash with segfaults in Vitest's forked worker pools.
- **Fix**: Use `vi.mock("./db", () => ({ getDb: vi.fn() }))` — mock the DB entirely. The mock DB pattern dispatches on SQL string matching.
- **Lesson**: Always mock `getDb()` in tests. Don't use real SQLite in Vitest tests.

### vi.doMock Inside Test Files Causes Parse Errors (M1-T6)
- **Error**: `vi.doMock()` inside `describe`/`test` block causes "Failed to parse source code" errors.
- **Fix**: Use top-level `vi.mock()` before imports.

### Playwright Test Files Fail Under Vitest (M1-T6)
- **Error**: `.spec.ts` files picked up by Vitest and failing with Playwright errors.
- **Fix**: Ensure `vitest.config.ts` include is `**/*.test.ts` (not `**/*.spec.ts`). Playwright = `.spec.ts`, Vitest = `.test.ts`.

### Test Classification Logic Without Real DB (M1-T10)
- **Error**: Cannot test `classifyMonitor()` directly — `getDb()` returns real better-sqlite3 that segfaults.
- **Fix**: Write tests verifying decision logic in pure JavaScript (same thresholds, same ordered-if chain).
- **Lesson**: Separate algorithm from data access. Test decision logic independently.

### Migration Numbering Must Be Sequential (M1-T10)
- **Error**: Referenced `005_create_indexes.sql` but 005 doesn't exist.
- **Fix**: Used `006_add_quality_state_updated_at.sql`.
- **Lesson**: Check existing migration files before assigning new numbers.

### Quality Sweep Interval Validation (M1-T10)
- **Error**: Non-numeric env var causes `setInterval(NaN)` = tight loop.
- **Fix**: `Number.isFinite()` + `> 0` validation with early return.

### Database Field Naming Mismatch (M1-T4)
- **Error**: `HealthResponse` type had `database` field instead of `db_path`.
- **Fix**: Updated `shared/types.ts` to match F14 API contract.

### Mock DB UPDATE Parameter Binding Bug (M2-T7)
- **Error**: Mock DB's `run()` method for UPDATE statements wasn't binding parameters correctly — `stmt.run(params)` was ignoring the params array.
- **Fix**: Updated `mock-db-factory.ts` to properly handle parameter binding in `run()` method.
- **Lesson**: Mock DB dispatchers must handle all SQL operation types (SELECT, INSERT, UPDATE, DELETE) with correct parameter binding.

### F13 Spec Compliance Requires Exact 429 Response Shape (M1-T12)
- **Error**: Initial implementation used human-readable error string and extra `code` field.
- **Fix**: Fixed to match F13 spec exactly: `{ error: "rate_limit_exceeded", retryAfter: N }`.
- **Lesson**: Cross-reference feature spec for exact response shapes.

## M2 Lessons

### WebSocket Composable Lifecycle Hook (Agent 08)
- **Error**: `useWebSocket.ts` used `onBeforeMount` instead of `onMounted` for initialization. WebSocket connection was set up too early, before the component was mounted.
- **Fix**: Changed to `onMounted` for initialization, `onUnmounted` for cleanup.
- **Lesson**: WebSocket connections should be established in `onMounted`, not `onBeforeMount`. The connection needs the component to be fully mounted.

### Deep Watch on Typed Arrays (Agent 08)
- **Error**: `watch` with `{ deep: true }` on `Float64Array` data was ineffective — deep watch doesn't detect mutations on typed arrays.
- **Fix**: Used regular watch on the source data (HistoryPoint[]) and transform in the callback.
- **Lesson**: Typed arrays are value objects — deep watch won't detect their mutations. Watch the source data instead.

### Duplicated CSS in dashboard.css (Agent 08)
- **Error**: Agent 07's changes to `dashboard.css` duplicated some CSS rules that were already present.
- **Fix**: Removed duplicate rules during code review.
- **Lesson**: When modifying CSS files, read the existing content first to avoid duplicating rules.

### Redundant onMounted in Chart Components (Agent 08)
- **Error**: Some chart components had redundant `onMounted` calls — one for uPlot initialization and another for data fetching, when a single lifecycle hook with proper sequencing would suffice.
- **Fix**: Consolidated into single `onMounted` with sequential async calls.
- **Lesson**: Minimize lifecycle hooks — one `onMounted` per component is cleaner than multiple.

### Unused Imports After Refactoring (Agent 08)
- **Error**: Multiple files had unused imports after refactoring (e.g., `ref` imported but not used, `watch` imported but replaced with direct calls).
- **Fix**: Cleaned up all unused imports across 5+ files.
- **Lesson**: After refactoring, always run `npx nuxi typecheck` to catch unused imports — they cause warnings but not errors by default.

### uPlot setData Requires Proper Array Structure (M2-T3)
- **Error**: Initial chart data transform returned flat arrays instead of uPlot's expected `[[timestamps], [series1], [series2], ...]` structure.
- **Fix**: `useChartSeries()` composable properly transforms `HistoryPoint[]` into uPlot column format.
- **Lesson**: uPlot uses column-major format (array of columns), not row-major (array of rows). Always use the composable for transforms.

### Qual Plugin Path Generation Must Handle Edge Cases (M2-T3)
- **Error**: Quality band path generation crashed when given empty intervals or single-point intervals.
- **Fix**: Added guards for empty arrays and single-point intervals in `quality-bands.ts`.
- **Lesson**: Chart utilities must handle all edge cases — empty data, single points, and gaps in time series.

### better-sqlite3@13 Requires Node 22+ (M1-T5)
- **Error**: `better-sqlite3@13` crashes on Node 20 with segfault for native bindings.
- **Fix**: Tests use mock DBs exclusively (the `globalThis.__db` pattern). The server itself requires Node 22+.
- **Lesson**: When using native Node.js modules, check Node version compatibility. The `globalThis.__db` mock pattern is the project standard for testing.

### Task May Already Be Implemented (Lessons 8, 14, 19, 27)
- **Error**: Multiple tasks (M1-T5, M1-T8, M1-T9, M1-T12) were already implemented by earlier agents but listed as "Not Started".
- **Lesson**: Always check for existing implementation before writing new code. The `git diff --stat` command and reading existing files reveals what's already done. Agent 02 should always check for existing implementation.

## General Lessons

### TypeScript Strict Mode
- TypeScript strict mode catches type mismatches early.

### better-sqlite3 WAL Mode
- Always enable WAL mode (`PRAGMA journal_mode = WAL`) and foreign keys (`PRAGMA foreign_keys = ON`).

### Vitest Setup for Nitro
- Clear `globalThis.__db` before each test for isolation.

### Nuxt 4 Compatibility
- `nuxt typecheck` (not `nuxi typecheck`) is the correct command in Nuxt 4.
- `compatibilityVersion` is not needed in Nuxt 4.

### Environment Variable Config Reading at Runtime
- Read env vars inside functions (not at module scope) when they need to be testable. Tests can stub with `vi.stubEnv()`.

### Mock DB SQL Dispatching by String Matching
- When mocking `better-sqlite3`'s `prepare()`, dispatch on `sql.includes("INSERT INTO monitors")`. This is fragile but works for unit tests.

### Worker Exit Errors Are Infrastructure, Not Code
- 4 worker exit errors appear in every Vitest run — these are Vitest infrastructure issues, not test failures. Don't chase them.

### Iterating Mutable Sets — Always Copy
- When iterating over sets that may change (like subscriber sets), always iterate a copy (`[...subSet]`).

## M2-T4 Lessons

### useAsyncData Key Must Use Stable Values (M2-T4)
- **Error**: Using `fromMs.value` and `toMs.value` in the `useAsyncData` key causes infinite re-fetches — they're computed from `Date.now()` and change on every reactive update.
- **Fix**: Use the time window preset name (e.g., `"1h"`, `"24h"`) as the key component — it only changes when the user explicitly selects a different range.
- **Lesson**: Always use stable, user-controlled values in `useAsyncData` keys. Never use `Date.now()`-derived values.
