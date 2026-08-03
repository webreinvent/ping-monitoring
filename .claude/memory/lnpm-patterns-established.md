# LNPM Cloud Dashboard — Patterns Established

> Saved: 2026-08-02
> Task: M1-T4 — Build health check endpoint with server metrics

## Nuxt 4 + Nitro Route Handler Pattern

**Pattern:** `server/api/*.get.ts` files using `defineEventHandler()` for API routes.

- File naming convention: `{route}.get.ts` (method-based routing)
- Uses Nitro's `defineEventHandler()` as the entry point
- Returns objects directly (automatically serialized to JSON)
- No explicit `send()` or `res.end()` needed
- Located under `dashboard/server/api/`

**Example:**
```typescript
export default defineEventHandler(async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});
```

## Database Plugin Pattern (better-sqlite3 + Nuxt)

**Pattern:** Global database singleton via `globalThis.__db` with lazy initialization in a Nitro plugin.

- Database connection is created once in `server/plugins/database.ts` (Nuxt plugin)
- Uses `better-sqlite3` with WAL mode for concurrent reads
- Singleton stored on `globalThis.__db` for test isolation (can be cleared per-test)
- `getDb()` helper in `server/utils/db.ts` returns the singleton or creates it
- Plugin runs on server init, migrations execute automatically

**Key insight:** The `globalThis.__db` pattern enables test isolation — tests can `delete globalThis.__db` in `beforeEach` to get a fresh connection.

## Version Caching Pattern (IIFE at module level)

**Pattern:** Cache runtime-expensive reads (like package.json version) using a module-level IIFE.

```typescript
const pkgVersion = (() => {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
```

- Runs once at module load time
- Safely handles missing/corrupt files with fallback defaults
- No need for `setTimeout` or lazy caching — module loads once per process

## Health Check Extended Metrics Pattern (F14)

**Pattern:** Separate `getExtendedMetrics()` function for database+filesystem queries, wrapped in try-catch at the handler level.

- Basic health (status probe) is lightweight: `SELECT 1` to verify DB connectivity
- Extended metrics (F14) are gathered in a separate function: file size via `statSync`, COUNT queries, MAX timestamp
- Error boundary: outer try-catch returns structured `{ status: "error", message }` on any failure
- All queries are simple aggregates (COUNT, MAX) — negligible cost even on large tables

## Structured Logging Pattern

**Pattern:** Custom logger with leveled functions (`debug`, `info`, `warn`, `error`) writing structured JSON to stderr.

- Uses `console.error` internally (correct for server-side logging — stderr is the standard log stream)
- Each log entry is a JSON object with timestamp, level, message, and optional context
- Supports 4 levels: debug, info, warn, error
- Context objects are merged into the JSON payload

## Test Isolation Pattern (Vitest + globalThis DB)

**Pattern:** Clear `globalThis.__db` in `beforeEach` and `vi.restoreAllMocks()` in `afterEach`.

```typescript
beforeEach(() => {
  delete globalThis.__db; // Clear DB singleton for test isolation
});

afterEach(() => {
  vi.restoreAllMocks();
  setEnv("DATABASE_PATH", undefined);
});
```

- Ensures each test gets a fresh database state
- Mock databases can be injected via `globalThis.__db = mockDb`
- Environment variables are reset after each test

## Unit Test Structure Pattern

**Pattern:** Comprehensive test suites organized by concern with descriptive `describe` blocks.

- Response shape tests (success and error variants)
- Database connectivity tests
- Error handler edge cases (Error, string, null, number, boolean thrown values)
- Version parsing tests (fallback, caching, actual file read)
- Uptime rounding tests
- Timestamp format tests
- F14 metric type tests
- COUNT query simulation tests
- Path resolution tests (DATABASE_PATH env var)
- Full endpoint integration tests (mock DB + handler flow)
