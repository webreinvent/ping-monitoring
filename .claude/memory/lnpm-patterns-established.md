# LNPM Cloud Dashboard — Patterns Established

> Saved: 2026-08-03
> Tasks: M1-T4 (health check), M1-T5 (client identity), M1-T7 (monitors list API), M1-T8 (monitor history API), M1-T9 (WebSocket live broadcast)

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

## WebSocket Live Broadcast Pattern (M1-T9 / F7)

**Pattern:** Nitro WebSocket handler with subscription map, snapshot delivery, and live sample broadcast.

### WebSocket Handler Structure
- Uses `defineWebSocketHandler()` with `open`, `message`, `close` lifecycle methods
- Located at `server/ws/ping.ts` — auto-mapped to `/ws/ping` endpoint
- JSON message protocol with `type` discriminator field
- No authentication at WebSocket level (relies on HTTP-level auth via Nuxt proxy)

### Subscription Map
- `Map<number, Set<WebSocketType>>` — key is monitor_id, values are raw WebSocket objects
- Raw WebSocket (`(peer as any).ws`) stored for external broadcast capability (from ingest endpoint)
- `getSubscribers(monitorId)` — get or create subscriber set
- `cleanupEmptyMonitor(monitorId)` — remove empty sets to prevent memory leaks

### Message Protocol (F7 spec)
- **Client → Server:** `subscribe` (monitorId), `unsubscribe` (monitorId)
- **Server → Client:** `subscribed` (ack), `unsubscribed` (ack), `snapshot` (monitor + last 100 samples), `sample` (single new sample), `error` (error message)

### Snapshot on Subscribe
- Queries last 100 samples via `getSnapshotSamples()` (ORDER BY timestamp_ms DESC LIMIT 100)
- Reverses to oldest-first order for chart consumption
- Includes monitor state (targetHost, targetName, status, qualityState, lastSeenMs)
- Map functions (`mapMonitorStatus`, `mapQualityState`) translate DB values to API contract

### Broadcast from Ingest
- `broadcastSample(monitorId, sample)` exported from `server/ws/ping.ts`
- Called from `server/api/ping/ingest.post.ts` after successful DB insert
- Iterates over `[...subSet]` (copy) to avoid iteration issues if set changes during broadcast
- Checks `ws.readyState === 1` (OPEN) before sending; catches send errors

### Cleanup on Disconnect
- `close` handler iterates all monitor subscription sets removing the disconnected WebSocket
- `error` events are handled by the same cleanup path (Nitro emits close on error)
- Prevents memory leaks from stale connections

## Quality Classifier Patterns (M1-T10)

### Quality State Constants Module
- **File**: `server/utils/quality-states.ts`
- **Pattern**: Dedicated constants module with all classification thresholds as named exports (`QUALITY_WINDOW_MS`, `QUALITY_MIN_SAMPLES`, etc.)
- **mapQualityState()**: Safe string-to-typed converter with legacy fallback (`good`→`veryHigh`, `degraded`→`medium`, `poor`→`low`, unknown→`warmingUp`)
- **QUALITY_COLORS**: Record mapping each QualityState to a Tailwind-compatible hex color

### Classification Engine (First-Match-Wins)
- **File**: `server/utils/quality-classifier.ts`
- **Pattern**: Two-query approach: (1) aggregate window stats + current quality_state in one query, (2) last sample time for disconnected detection
- **Metrics**: packet_loss, avg_latency, CV (coefficient of variation) computed inline using `variance = E[X²] - E[X]²`
- **Decision chain**: disconnected → warmingUp → unstable → veryHigh → high → medium → low (ordered, first match wins)
- **Persist**: Single UPDATE sets `quality_state`, `quality_state_updated_at`, `updated_at`

### Batch Classification with Change Detection
- **Pattern**: `ClassifyResultWithDiff` extends `ClassifyResult` with `previousState` and `stateChanged` boolean
- Per-monitor try/catch in batch — one failure doesn't stop the batch
- Returns `Map<monitorId, QualityState>` of only changed monitors
- `info()` log for changes, `debug()` for unchanged

### Background Sweep Plugin
- **File**: `server/plugins/quality-sweep.ts`
- **Pattern**: `defineNitroPlugin` with `setInterval` (default 60s), graceful shutdown via cleanup function
- Queries for monitors with samples in last 10 min only (avoids classifying dead monitors)
- Env var validation: `Number.isFinite()` + `> 0` guard on interval

### Post-Ingest Classification
- Runs AFTER transaction commits (outside `db.transaction()`) so classifier sees new data
- Best-effort: classification failure is logged but never causes ingest to fail
