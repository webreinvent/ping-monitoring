---
name: lnpm-patterns-established
description: Patterns established during M1-T1 — Nuxt 4 + Nitro foundation patterns
metadata:
  type: project
  agent: "12"
  date: 2026-08-03
---

# LNPM Cloud Dashboard — Patterns Established

## Nuxt 4 + Nitro Patterns

### Database Plugin Pattern
- **File**: `server/plugins/database.ts`
- **Pattern**: Nitro plugin initializes SQLite (better-sqlite3) with WAL mode, foreign keys, and runs migrations at startup. Stores instance on `globalThis.__db` for cross-module access.
- **Key**: Singleton via closure-scoped `getDatabase()` — only one DB connection per process.
- **Related**: [[lnpm-decisions-made]]

### Migration Runner Pattern
- **Location**: `server/plugins/database.ts` → `runMigrations()`
- **Pattern**: Reads `schema/migrations/*.sql` files, sorts alphabetically, skips already-applied migrations using a tracking table. Each migration is tracked by filename in a `migrations` table (created IF NOT EXISTS before running).
- **Error handling**: try/catch per migration with console.error + rethrow.

### Database Helper Pattern
- **File**: `server/utils/db.ts`
- **Pattern**: `getDb()` reads from `globalThis.__db`, throws if uninitialized. Simple typed accessor — no pooling, no async.
- **Related**: [[lnpm-lessons-learned]]

### Structured Logger Pattern
- **File**: `server/utils/logger.ts`
- **Pattern**: LOG_LEVEL-aware logger with 4 levels (debug/info/warn/error). Respects `LOG_LEVEL` env var, falls back to `NODE_ENV` (production→info, development→debug). ISO 8601 timestamps, optional JSON meta.
- **Export**: Named exports (`debug`, `info`, `warn`, `error`) — no default export.

### Health Endpoint Pattern
- **File**: `server/api/health.get.ts`
- **Pattern**: `defineEventHandler` with try/catch, returns structured JSON. Caches `package.json` version at module scope (IIFE). Checks DB connectivity inline.
- **Response shape**: `{ status, timestamp, uptime, version, database }`

### WebSocket Handler Pattern
- **File**: `server/ws/ping.ts`
- **Pattern**: `defineWebSocketHandler` with `open`, `message`, `close` lifecycle. Messages are JSON-serialized strings. Uses `message.text` (crossws passes a Message object, not raw string).
- **Stub behavior**: Echoes messages back with `type: "echo"` wrapper.

### Shared Types Pattern
- **File**: `shared/types.ts`
- **Pattern**: Plain TypeScript interfaces, no runtime validation. Used by both server and client. No auto-import config needed (Nuxt auto-imports functions/constants, not types — types are imported explicitly).

## Vue Component Patterns

### App Shell Pattern
- **File**: `app.vue`
- **Pattern**: Minimal root — `<NuxtLayout>` wrapping `<NuxtPage>`. No theme CSS yet (deferred to Phase 9).

### Layout Pattern
- **File**: `app/layouts/default.vue`
- **Pattern**: Flex column, `min-height: 100vh`, scoped CSS with `.dashboard-shell` class.

### Page Pattern
- **File**: `app/pages/index.vue`
- **Pattern**: Semantic `<section>` elements, `data-testid` attributes for E2E testing, `useHead` for page title, scoped CSS.

## Test Patterns

### Vitest Configuration
- **File**: `vitest.config.ts`
- **Pattern**: Node environment, global test functions, alias resolution (`~` and `@` → project root), V8 coverage provider.
- **Excludes**: `node_modules`, `.nuxt`, `.data`, `.output`, `coverage`.

### Test Setup Pattern
- **File**: `test/setup.ts`
- **Pattern**: Silences console output by default, clears `globalThis.__db` before each test, restores console methods after each test (for spy compatibility).

### Fixtures Pattern
- **File**: `test/fixtures.ts`
- **Pattern**: Factory functions with `Partial<T>` overrides — `createPingSample()`, `createMonitor()`, `createClientIdentity()`, etc. Spread defaults, then overrides.

## Environment Configuration

### .env.example Pattern
- **File**: `.env.example`
- **Pattern**: 14 environment variables with section headers, inline comments, and sensible defaults. Categories: environment mode, HTTP server, SQLite, WebSocket, ingest, rate limiting, data retention, cache.

## Ping Ingest Patterns (M1-T6)

### Type-First Module Pattern
- **File**: `server/utils/ping-types.ts`
- **Pattern**: Dedicated type file for a feature domain. Co-located with implementation (`server/utils/`). Defines `PingSampleIngest`, `IngestPayload`, `IngestResponse`, `Rejection`, and `ValidationResult` interfaces. No runtime logic — pure TypeScript types. Imported by both the route handler and ingest engine.
- **Rationale**: Keeps types in one place, avoids scattering types across implementation files. Follows the existing `shared/types.ts` pattern but scoped to the ping ingest domain.

### Validation Rule Pattern
- **File**: `server/utils/ping-validation.ts`
- **Pattern**: Single `validateSample()` function returns `ValidationResult { valid, rejections[] }`. Each validation rule is a named block (Rule 1–6) that independently pushes rejections. Multiple rejections can accumulate on a single sample. Configurable thresholds via env vars (`INGEST_FUTURE_WINDOW_MS`).
- **Key rules**: targetHost required, timestamp positive integer + future window, status enum (success/timeout/error), conditional latencyMs (required for success only), conditional resolvedAddress (required for success only).
- **Helper**: `isValidPositiveInteger()` helper for type-safe number validation (handles NaN, Infinity, non-integer).

### Ingest Engine Pattern (3-Phase Pipeline)
- **File**: `server/utils/ping-ingest.ts`
- **Pattern**: `ingestPingBatch()` orchestrates 3 phases: (1) client lookup/auto-register, (2) sample validation (delegates to `validateSample`), (3) transactional ingest via `ingestSamples()`. Returns `IngestResponse` with accepted/duplicate/rejected counts and optional rejections array.
- **Key insight**: The function returns `null` for unknown clients — the route handler maps this to 401. This separation keeps the engine pure (no HTTP concerns).

### Transactional Ingest Pattern
- **File**: `server/utils/ping-ingest.ts` → `ingestSamples()`
- **Pattern**: `db.transaction()` wraps 4 phases: (1) resolve monitor IDs with `ensureMonitor()` (INSERT OR IGNORE + SELECT), (2) bulk insert samples with INSERT OR IGNORE tracking `changes`, (3) update monitor latest state per affected monitor, (4) update client `last_synced_at_ms`.
- **Dedup detection**: better-sqlite3 `stmt.run().changes` returns 0 for ignored rows (duplicates), 1 for inserted rows. This is how accepted vs duplicate is counted.
- **Monitor auto-creation**: `ensureMonitor()` uses `INSERT INTO monitors ... ON CONFLICT DO NOTHING` then `SELECT id` to get existing or new monitor ID.

### Route Handler Status Code Logic
- **File**: `server/api/ping/ingest.post.ts`
- **Pattern**: `sendResponse()` helper uses `setResponseStatus(event, statusCode)` to set HTTP status code without interfering with body return. Status code determined by result composition:
  - 201: all accepted (no dupes, no rejected)
  - 200: all dupes or all rejected
  - 207: mixed (some accepted + some duplicate/rejected)
- **Error shape**: `createError({ statusCode, statusMessage, data: { error, code } })` — consistent with F3 API contract.

### Mock DB Pattern for Tests
- **File**: `server/utils/ping-ingest.test.ts`
- **Pattern**: Mock `getDb()` to return an object with `prepare(sql)` dispatching based on SQL string matching. Uses `vi.fn((sql) => { if (sql.includes("INSERT INTO monitors")) ... })` to return the right mock statement. Transaction mock: `transaction: vi.fn((fn) => () => fn())` — runs the function synchronously without actual transaction wrapper.
- **Key**: This avoids the better-sqlite3 segfault in Vitest forked workers entirely.

## Quality Classifier Patterns (M1-T10)

### Quality State Constants Pattern
- **File**: `server/utils/quality-states.ts`
- **Pattern**: Dedicated constants module for classification thresholds. All magic numbers extracted to named constants (`QUALITY_WINDOW_MS`, `QUALITY_MIN_SAMPLES`, `QUALITY_VERY_HIGH_MAX_LATENCY`, etc.). Includes `mapQualityState()` function for safe string-to-typed conversion with legacy fallback. `QUALITY_COLORS` record maps each state to a Tailwind-compatible hex color.
- **Rationale**: Centralized configuration makes thresholds easy to tune. Single source of truth for both classifier and UI color mapping.

### Classification Engine Pattern (First-Match-Wins)
- **File**: `server/utils/quality-classifier.ts`
- **Pattern**: `classifyMonitor()` uses a single aggregate query (window stats + current quality_state) to compute metrics, then applies a deterministic first-match-wins decision chain: disconnected → warmingUp → unstable → veryHigh → high → medium → low. Two queries total: (1) aggregated window stats + current state, (2) last sample time for disconnected detection.
- **Metrics computed inline**: packet_loss, avg_latency, coefficient of variation (CV = stddev/mean) using the identity `variance = E[X²] - E[X]²`.
- **Persist**: Updates `quality_state`, `quality_state_updated_at`, and `updated_at` on the monitor row in a single UPDATE.
- **Key insight**: Reading `current_quality_state` in the same query as the aggregate stats avoids a redundant read when batching (classifyMonitorsBatch uses it to detect changes without re-querying).

### Batch Classification with Change Detection
- **File**: `server/utils/quality-classifier.ts` → `classifyMonitorsBatch()`
- **Pattern**: Iterates over monitor IDs, classifies each one, and returns a `Map<monitorId, QualityState>` of only monitors whose state actually changed. `ClassifyResultWithDiff` extends `ClassifyResult` with `previousState` and `stateChanged` flags.
- **Error handling**: Per-monitor try/catch ensures one failed classification doesn't stop the batch. Failed classifications are logged but don't propagate.
- **Logging**: `info()` for state changes (includes new/old state, metrics), `debug()` for unchanged states.

### Background Sweep Plugin Pattern
- **File**: `server/plugins/quality-sweep.ts`
- **Pattern**: `defineNitroPlugin` with `setInterval` for periodic background work. Reads `QUALITY_SWEEP_INTERVAL_MS` env var (default 60s). Queries for monitors with recent samples (last 10 min) to avoid classifying dead monitors. Uses `classifyMonitorsBatch()` and logs changes on completion.
- **Graceful shutdown**: Returns cleanup function that clears the interval timer.
- **Input validation**: Validates `Number.isFinite()` and `> 0` on interval value, skips plugin with info log if invalid.

### Post-Ingest Classification Trigger
- **File**: `server/utils/ping-ingest.ts`
- **Pattern**: After the transactional ingest commits, `classifyMonitorsBatch()` is called with the affected monitor IDs. Classification runs in a try/catch so failure never causes the ingest to fail (ingest is the critical path; classification is best-effort).
- **Key**: Classification runs AFTER the transaction commits (outside `db.transaction()`), so it sees the newly inserted samples.

### Quality State in WebSocket Broadcast (F12)
- **File**: `server/ws/ping.ts`
- **Pattern**: `SampleMessage` now includes `qualityState: QualityState` field. `broadcastSample()` accepts an optional `qualityState` parameter (defaults to `"warmingUp"`). Snapshot includes `qualityState` from monitor row via `mapQualityState()`.
- **Type safety**: `mapQualityState()` in `quality-states.ts` safely converts any string to a valid `QualityState`, mapping legacy values (`good`, `degraded`, `poor`) to `"warmingUp"`.
