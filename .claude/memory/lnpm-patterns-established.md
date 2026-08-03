# LNPM Cloud Dashboard — Patterns Established

> Saved: 2026-08-03
> Tasks: M1-T4 (health check), M1-T5 (client identity), M1-T7 (monitors list API), M1-T8 (monitor history API)

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

## Client Identity Pattern (M1-T5 / F2)

**Pattern:** Slug generation as a pure function with deterministic, URL-safe output; client upsert via `INSERT ... ON CONFLICT`; separation of `ClientRow` (DB shape) from `ClientResponse` (API shape).

### Slug Generation
- Pure function `generateSlug(username, hostname, macAddress)` with no external dependencies
- Format: `<username>-<hostname>-<truncated-mac>` (last 10 hex chars of MAC)
- Steps: strip non-hex from MAC → build raw string → replace non-alphanumeric with hyphens → collapse consecutive hyphens → trim leading/trailing hyphens
- Throws on empty inputs (fail-fast validation)

### ClientRow vs ClientResponse Type Separation
- `ClientRow` — raw database row shape (snake_case, epoch-ms timestamps, internal fields)
- `ClientResponse` — API response shape (snake_case keys matching API contract, ISO 8601 string timestamps, excludes internal fields like `sync_enabled`, `sync_interval_min`, `backend_url`, `last_synced_at_ms`)
- `toClientResponse(row: ClientRow): ClientResponse` is the sole serialization function — prevents leaking DB internals

### Upsert Pattern
- Uses `INSERT ... ON CONFLICT(slug) DO UPDATE SET` — single SQL statement, no application-level existence checks
- Default name is `username@hostname` (auto-generated)
- Returns the upserted row via `getClientBySlug()` after insert

### API Endpoint Pattern (Parameterized Routes)
- `GET /api/clients/[slug].get.ts` — uses Nitro's file-based routing with dynamic `[slug]` parameter
- `PUT /api/clients/[slug].name.put.ts` — nested route with method-specific handler
- Both follow: parse params → validate → call utility → return response or throw error
- 400 for validation errors, 404 for missing resources

## CTE + ROW_NUMBER Pattern for Latest-State Queries (M1-T7 / F5)

**Pattern:** Use a CTE with `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ... DESC)` to efficiently fetch the latest row per entity, then LEFT JOIN to the main table.

```sql
WITH latest_samples AS (
  SELECT monitor_id, status, latency_ms, timestamp_ms,
    ROW_NUMBER() OVER (PARTITION BY monitor_id ORDER BY timestamp_ms DESC) AS rn
  FROM ping_samples
)
SELECT m.id, c.slug AS client_slug, c.name AS client_name,
  m.target_host, m.target_name,
  ls.status AS last_status, ls.latency_ms AS last_latency_ms, ls.timestamp_ms AS last_seen_ms,
  m.quality_state, m.created_at
FROM monitors m
INNER JOIN clients c ON m.client_id = c.id
LEFT JOIN latest_samples ls ON m.id = ls.monitor_id AND ls.rn = 1
ORDER BY COALESCE(ls.timestamp_ms, 0) DESC, m.id ASC
```

- **Single query, no N+1** — all data fetched in one SQL call
- **LEFT JOIN** ensures monitors with no samples still appear (with null state fields)
- **COALESCE(null_timestamp, 0) DESC** pushes monitors with no samples to the end of results
- **Stable tiebreaker**: `m.id ASC` ensures deterministic order when timestamps match

## Monitors List Utility Pattern (M1-T7)

**Pattern:** Separate `utils/monitors.ts` utility with `getAllMonitorsWithLatestState()` returning `MonitorListItem[]`, followed by field mapping.

- Pure utility function with no HTTP context — testable in isolation
- SQL query returns snake_case DB fields; `.map()` transforms to camelCase API fields
- Mapping functions (`mapSampleStatus`, `mapQualityState`) are private helpers within the module
- Null-safe: `target_name ?? target_host` for fallback, `null` for missing sample fields
- `created_at` (epoch ms in DB) → `new Date(row.created_at).toISOString()` for API

## Mock DB Pattern for Integration Tests (M1-T7)

**Pattern:** Mock `getDb()` with `vi.mock()` and construct a minimal `Database` stub returning pre-configured rows.

```typescript
vi.mock("../utils/db", () => ({ getDb: vi.fn() }));

function createMockDb(rows: Array<{ ... }>): Database {
  return {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue(rows),
    }),
  } as unknown as Database;
}
```

- Avoids better-sqlite3 segfault on Node 20 by never importing the real DB
- Tests the full query + mapping pipeline without a real database
- Follows the same pattern established by `ping-ingest.integration.test.ts`

## History Aggregation Pattern (M1-T8 / F6)

**Pattern:** SQL `GROUP BY` on timestamp-truncated buckets for time-series aggregation, with application-side quality classification and down-sampling.

### SQL Bucket Aggregation
```sql
SELECT
  strftime('%s', datetime(timestamp_ms / 1000, 'unixepoch'), 'unixepoch', '+' || :bucketMs || ' milliseconds') * 1000 AS bucket_ms,
  COUNT(*) AS sample_count,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
  AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END) AS avg_latency_ms
FROM ping_samples
WHERE monitor_id = ? AND timestamp_ms > ? AND timestamp_ms <= ?
GROUP BY bucket_ms
ORDER BY bucket_ms ASC
```

- **Single query, single pass** — no subqueries or window functions needed for aggregation
- **Bucket alignment:** Uses `strftime` with offset to align buckets to clean boundaries
- **Composite index** (`idx_ping_monitor_time`) makes the WHERE + GROUP BY efficient
- **Null-safe aggregation:** `AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END)` excludes failures from latency stats

### Quality Interval Computation
- Linear scan over aggregated points, classifying each bucket as: `warmingUp`, `low`, `medium`, `high`, `veryHigh`, `unstable`, `disconnected`
- Consecutive same-state buckets are merged into intervals (startMs, endMs, state, reasons)
- Reasons array is a defensive copy — mutation of returned array doesn't affect internals
- Thresholds from F6 spec: packet loss %, latency p50/p95, jitter, consecutive failures

### Down-sampling via Bucket Size Adjustment
- `calculateBucketSize(fromMs, toMs, maxPoints)` computes optimal bucket size
- Starts at 1-minute buckets; increases through clean sizes (1m, 5m, 15m, 30m, 1h) until point count ≤ maxPoints
- Clean bucket sizes align with frontend chart rendering (no fractional buckets)

### Range Summary Computation
- Aggregate statistics over all points: packetLossPercent, p50Latency, p95Latency, avgLatency, minLatency, maxLatency, stablePercent, unstablePercent
- p95 uses per-bucket averages as proxy (acceptable approximation for MVP; documented)
- Stable/unstable computed from quality state distribution

### HistoryResponse Shape
- `HistoryResponse = { target, series, points, intervals, summary }` — complete response for uPlot chart
- `series` array: `[{ label: "latency", unit: "ms" }]` — uPlot column descriptors
- `points` = `HistoryPoint[]` (bucket_ms, latencyMs, packetLoss, sampleCount, status, qualityState)
- `intervals` = `QualityIntervalRecord[]` (merged quality state intervals)
- `summary` = `RangeSummary` (aggregate statistics for the time range)
