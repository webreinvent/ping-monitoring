# AGENTS.md — LNPM Cloud Dashboard

AI context file for the LNPM Cloud Dashboard project. Contains conventions, patterns, and architectural decisions to guide AI-assisted development.

---

## Project Overview

**Project:** LNPM Cloud Dashboard
**Framework:** Nuxt 4 + Nitro v2 (persistent `node-server` runtime)
**Database:** SQLite via `better-sqlite3` with WAL mode
**Language:** TypeScript (strict mode)
**Package Manager:** pnpm (v10.4.1)

The dashboard lives in `./dashboard/` at the project root. The existing LNPM desktop app code (in `./src/` and `./src-tauri/`) is untouched.

---

## Directory Structure

```
dashboard/
├── app/                     # Vue 3 frontend
│   ├── app.vue             # Root shell (<NuxtLayout> + <NuxtPage>)
│   ├── layouts/            # Layout components (default.vue)
│   └── pages/              # File-based routes (index.vue)
├── server/                 # Nitro backend
│   ├── api/                # File-based API routes (health.get.ts, etc.)
│   ├── plugins/            # Nitro plugins (database.ts, quality-sweep.ts, retention.ts)
│   ├── utils/              # Server utilities (db.ts, logger.ts, retention.ts, etc.)
│   └── ws/                 # WebSocket handlers (ping.ts)
├── shared/                 # TypeScript types shared between server and client
│   └── types.ts            # Interfaces: PingSample, Monitor, WsMessage, etc.
├── schema/                 # SQLite migrations
│   ├── index.sql           # Assembled full-schema reference (documentation only)
│   └── migrations/         # Numbered migration files (001-005, execute in order)
├── test/                   # Test setup and fixtures
│   ├── setup.ts            # Vitest setup (console silence, DB cleanup)
│   └── fixtures.ts         # Factory functions for test data
├── nuxt.config.ts          # Nuxt configuration
├── vitest.config.ts        # Vitest configuration
├── playwright.config.ts    # Playwright E2E configuration
└── .env.example            # Environment variable template
```

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Backend** | Nuxt 4 + Nitro v2 (`node-server` preset) | Single codebase for API + UI, native WebSocket, file-based routing, persistent process |
| **Storage** | SQLite (`better-sqlite3`) with WAL mode | Single-file, zero ops, concurrent reads/writes via WAL |
| **Caching** | In-memory LRU cache | Hot monitor state in process memory; recoverable from SQLite |
| **Real-time** | WebSocket (`defineWebSocketHandler`) | Built-in via `server/ws/` routes, per-monitor topic subscriptions |
| **Charts** | uPlot | Canvas-based, fast, small bundle; already used in LNPM desktop |
| **Frontend** | Nuxt 4 + Vue 3 Composition API | Same framework as backend, mirrors desktop app design |
| **Testing** | Vitest (unit/integration), Playwright (E2E) | Vitest for server logic; Playwright for browser tests |
| **Language** | TypeScript (strict mode, ^5.7.0) | End-to-end type safety from ingest payload to chart data |

## Coding Conventions

### API Routes
- **File-based routing**: `server/api/health.get.ts` → `GET /api/health`
- Use `defineEventHandler` with async/await
- Return structured JSON (never raw strings)
- Always wrap in try/catch; return `{ status: "error", message }` on failure
- Cache module-level constants (e.g., `package.json` version) using IIFE — don't re-read files on every request

### Database
- **Singleton pattern**: `server/plugins/database.ts` initializes one `better-sqlite3` connection per process via module-level `let dbInstance` variable
- DB instance stored on `globalThis.__db` (typed via `declare global { var __db }` in `server/utils/db.ts`)
- Access via `getDb()` from `~/server/utils/db` — never import the plugin directly (circular dependency risk)
- **Recommended pragmas** (apply in this order on every connection):
  1. `journal_mode = WAL` — concurrent read/write
  2. `foreign_keys = ON` — enforce FK constraints
  3. `synchronous = NORMAL` — balance safety/performance
  4. `cache_size = -64000` — 64MB cache
  5. `temp_store = MEMORY` — temp tables in RAM
  6. `busy_timeout = 5000` — 5s busy timeout
  7. `wal_autocheckpoint = 1000` — WAL checkpoint threshold
- **Migrations**: Numbered files in `schema/migrations/` (e.g., `001_create_clients.sql`). The plugin auto-creates a `migrations` tracking table (not a migration file). Each migration is tracked by filename — the plugin skips already-applied ones.
- Wrap every migration in try/catch with structured `error()` logging + rethrow
- **Shutdown**: Return a cleanup function from `defineNitroPlugin` to close the DB on server shutdown (Nitro calls it automatically). Do NOT use `process.on('beforeExit')` or `SIGTERM` handlers.

### WebSocket
- Use `defineWebSocketHandler` with `open`, `message`, `close` lifecycle
- Messages are JSON-serialized strings; access via `message.text` (crossws passes a `Message` object)
- Store in `server/ws/` directory
- Enable via `nitro.experimental.websocket: true` in `nuxt.config.ts`

### Shared Types
- `shared/types.ts` holds plain TypeScript interfaces used by both server and client
- Import types explicitly — Nuxt auto-import does NOT work for type-only exports
- Do not use `imports.dirs` for shared types (it only picks up functions and constants)

### Logger
- Use the structured logger from `server/utils/logger.ts`
- Named exports: `debug`, `info`, `warn`, `error` (no default export)
- Respects `LOG_LEVEL` env var; falls back to `NODE_ENV` (production→info, development→debug)
- ISO 8601 timestamps, optional JSON meta argument

### Vue Components
- Use `<script setup lang="ts">` (Composition API)
- Use `useHead()` for page titles
- Use `data-testid` attributes for E2E test hooks
- Scoped CSS with semantic HTML elements (`<section>`, `<h2>`, etc.)

### Testing
- **Vitest** (unit/integration): Node environment, global test functions, V8 coverage
  - `globals: true` — `describe`, `it`, `expect`, `beforeEach`, `afterEach`, `vi` available without imports. Explicit imports are optional but may be needed for IDE/linter support.
  - `~` and `@` aliases resolve to `dashboard/` root — use `~/server/utils/db` for imports
  - Test setup (`test/setup.ts`) silences `console.*` by default and clears `globalThis.__db` before each test
  - Fixtures (`test/fixtures.ts`) use factory functions with `Partial<T>` overrides
  - **Native modules**: `better-sqlite3` is a native C++ addon — mock the `Database` interface instead of loading real connections in tests (Vitest forked workers may crash)
  - Mock minimal interface: `{ prepare(), exec(), pragma(), close() }`
- **Playwright** (E2E): Browser tests targeting `data-testid` attributes
- Use `nuxt typecheck` (not `nuxi typecheck`) in Nuxt 4

### Environment Variables
- Template in `dashboard/.env.example` — 19 variables across 9 categories
- Always validate env vars before using as numbers (`parseInt` silently produces `NaN`)
- Key variables: `DATABASE_PATH`, `LOG_LEVEL`, `PORT`, `WS_HEARTBEAT_INTERVAL_MS`, `INGEST_MAX_SAMPLES`
- Retention config: `RETENTION_ENABLED`, `RETENTION_SAMPLE_DAYS`, `RETENTION_ROLLUP_DAYS`, `RETENTION_INTERVAL_MIN`, `RETENTION_VACUUM_THRESHOLD`

## Nuxt 4 / Nitro Specifics

- `compatibilityVersion` is NOT needed in Nuxt 4 (removed from config)
- `nuxt typecheck` is the correct typecheck command (not `nuxi typecheck`)
- `nitro.preset: "node-server"` configures persistent runtime (not serverless)
- WebSocket support requires `nitro.experimental.websocket: true`
- CORS is configured via `routeRules` in `nuxt.config.ts`
- `ssr: true` is required for server routes to work

### Nitro Plugin Lifecycle
- Use `defineNitroPlugin(() => { ... })` for server startup logic
- Return a cleanup function from the plugin for graceful shutdown — Nitro calls it automatically on server stop
- The plugin runs before any API routes execute
- Store shared state on `globalThis` (with typed `declare global` augmentation) rather than module imports to avoid circular dependencies

### Vitest Configuration
- `globals: true` — test functions available without imports
- `~` and `@` aliases resolve to `dashboard/` root for import paths
- `environment: "node"` — Node.js environment for server tests
- `setupFiles: ["./test/setup.ts"]` — runs console suppression and global cleanup
- Coverage: V8 provider, outputs to `./coverage/`

## Schema and Migrations

### Migration Files
The project uses 5 numbered migration files that execute in order:

| File | Purpose |
|------|---------|
| `001_create_clients.sql` | `clients` table (device identity) |
| `002_create_monitors.sql` | `monitors` table (ping targets) |
| `003_create_ping_samples.sql` | `ping_samples` table (raw ping data) |
| `004_create_minute_rollups.sql` | `minute_rollups` table (aggregated metrics) |
| `005_create_indexes.sql` | Performance indexes on all tables |

The `schema/index.sql` file is a hand-assembled reference of the complete schema (documentation only, not executed).

### Migration Conventions
- Each file is a single SQL statement or a set of statements for one logical schema change
- Numbered with 3-digit zero-padded prefix for sort order
- The plugin reads `schema/migrations/*.sql`, sorts alphabetically, and executes missing files
- Use `CREATE TABLE IF NOT EXISTS` for idempotency (the tracking table ensures each runs once, but the SQL itself should be safe)
- `schema/index.sql` serves as a documentation reference — update it when migrations change
- **Feature ID annotations**: Each migration file includes a comment header with feature IDs (e.g., `-- F1: Backend project setup, F9: Client settings`) for traceability

### Schema Details

**4 tables, 39 total columns, 9 indexes.** All migrations are verified against `requirements/data-models/data-models.md`.

#### Table: `clients` (12 columns — 8 base + 4 F9)
- Primary key: `id INTEGER PRIMARY KEY AUTOINCREMENT`
- Unique: `slug TEXT NOT NULL UNIQUE`
- **CRUD entity**: has `created_at` AND `updated_at`
- **F9 sync columns**: `sync_enabled` (BOOLEAN DEFAULT 1), `sync_interval_min` (INTEGER DEFAULT 5), `backend_url` (TEXT DEFAULT ''), `last_synced_at_ms` (INTEGER)

#### Table: `monitors` (11 columns)
- Primary key: `id INTEGER PRIMARY KEY AUTOINCREMENT`
- FK: `client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE`
- Unique: `(client_id, target_host)`
- Quality state: `quality_state TEXT DEFAULT 'warmingUp'`, `state_since_ms INTEGER`
- **CRUD entity**: has `created_at` AND `updated_at`

#### Table: `ping_samples` (8 columns)
- Primary key: `id INTEGER PRIMARY KEY AUTOINCREMENT`
- FK: `monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE`
- Unique dedup: `(monitor_id, timestamp_ms, resolved_address)` — enables `INSERT OR IGNORE` for safe retries
- **Append-only time series**: has `created_at` only, no `updated_at`

#### Table: `minute_rollups` (10 columns)
- No surrogate `id` — uses composite UNIQUE `(monitor_id, timestamp_ms)` as effective primary key
- FK: `monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE`
- Aggregation columns: `sample_count`, `success_count`, `failure_count`, `avg_latency`, `min_latency`, `max_latency`, `p95_latency`
- **Append-only time series**: has `created_at` only, no `updated_at`

#### Indexes (9 total — 8 spec + 1 F9)
| Index | Table | Column(s) |
|-------|-------|-----------|
| `idx_clients_slug` | `clients` | `slug` |
| `idx_clients_mac` | `clients` | `mac_address` |
| `idx_clients_last_synced` | `clients` | `last_synced_at_ms` (F9) |
| `idx_monitors_client` | `monitors` | `client_id` |
| `idx_monitors_last_seen` | `monitors` | `last_seen_ms` |
| `idx_monitors_client_target` | `monitors` | `client_id, target_host` |
| `idx_ping_monitor_time` | `ping_samples` | `monitor_id, timestamp_ms` |
| `idx_ping_status` | `ping_samples` | `status` |
| `idx_rollup_monitor_time` | `minute_rollups` | `monitor_id, timestamp_ms` |

### Schema Testing Convention
- **SQL text validation**: Parse migration SQL files as text to verify columns, constraints, and index definitions — do not execute against a real database in tests (`better-sqlite3` crashes Vitest workers)
- **Schema reference tests**: `schema/full-schema.test.ts` verifies `schema/index.sql` matches all migration files — if a migration changes, the test fails until `index.sql` is updated
- **94 schema tests** across 2 test files (`migrations.test.ts`, `full-schema.test.ts`)
- **Distinguish CRUD from append-only**: Only `clients` and `monitors` have `updated_at`; `ping_samples` and `minute_rollups` are append-only time series with `created_at` only

## ADRs (Architectural Decision Records)

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-001 | Nuxt 4 + Nitro for Backend | Single full-stack framework, file-based routing, native WebSocket |
| ADR-002 | SQLite with WAL Mode | Single-file storage, concurrent reads/writes, zero ops |
| ADR-003 | In-memory LRU Cache | No Redis; hot data in process memory; recoverable from SQLite |
| ADR-004 | Client Identity via Username + Hostname + MAC | Human-readable slug, device-bound identity, immutable identifier |
| ADR-005 | Batched Ingest with Dedup | 10 samples or 5s buffer, `INSERT OR IGNORE` for safe retries |
| ADR-006 | Nitro Native WebSocket | No Socket.io; topic-based subscriptions via Map |
| ADR-007 | uPlot Charts | Canvas-based, fast rendering, already used in desktop |
| ADR-008 | Single-Node Deployment | One process, one SQLite file, PM2 or systemd |
| ADR-009 | Raw Samples with Backend Computed Metrics | Backend owns quality computation, `minute_rollups` for efficient queries |
| ADR-033 | Plugin + Utility Separation for Background Tasks | Business logic in `server/utils/`, Nitro plugin in `server/plugins/`; matches quality-sweep pattern |
| ADR-034 | Single Transaction for Retention Deletion | `db.transaction()` wraps both DELETE operations; `.changes` property provides counts |
| ADR-035 | VACUUM Outside Transaction with Threshold | SQLite restriction; configurable threshold prevents expensive VACUUM on every cycle |
| ADR-036 | Lazy Env Var Reading (No Cache) | `getRetentionConfig()` reads env vars fresh each call; no in-memory caching |
| ADR-037 | RETENTION_ENABLED Boolean Flag | Single env var for complete enable/disable; truthy by default |

## Quick Reference

### Commands
```bash
pnpm run dev          # Start dev server on port 3000
pnpm run build        # Build for production
pnpm run preview      # Preview production build
pnpm run test         # Run Vitest unit tests
pnpm run test:watch   # Vitest with file watcher
pnpm run test:e2e     # Run Playwright E2E tests
pnpm run typecheck    # TypeScript type checking
```

### Key Files
- `dashboard/nuxt.config.ts` — Nuxt configuration
- `dashboard/server/plugins/database.ts` — SQLite init + migration runner
- `dashboard/server/plugins/quality-sweep.ts` — Quality classifier background sweep
- `dashboard/server/plugins/retention.ts` — Data retention cleanup background task
- `dashboard/server/utils/db.ts` — Typed DB accessor (`getDb()`)
- `dashboard/server/utils/logger.ts` — Structured logger
- `dashboard/server/utils/retention.ts` — Retention config + cleanup logic
- `dashboard/shared/types.ts` — Shared TypeScript interfaces
- `dashboard/schema/migrations/` — Numbered SQL migration files

### Health Endpoint Pattern (F14 Extended Metrics)
- **Single endpoint** serving both basic health (F1) and extended metrics (F14): `GET /api/health`
- **Public access** — no authentication required (external monitoring services like Uptime Robot, Pingdom)
- **Extended metrics** gathered in a separate `getExtendedMetrics()` function: `statSync` for DB file size, `COUNT(*)` for monitors/samples, `MAX(timestamp_ms)` for last ingest time
- **Error response shape**: `{ status: "error", timestamp, message }` — structured JSON, not raw text. The absence of a successful response IS the failure signal.
- **`last_ingest_time`** is `null` (not empty string, not 0) when no samples exist — semantically correct mapping of "no ingest time"
- **Internal DB probe**: `SELECT 1` to verify connectivity; `dbStatus` is logged but not exposed in response (status is always `"ok"` if endpoint responds per spec)
- **Uptime** is rounded to 2 decimal places: `Math.round(process.uptime() * 100) / 100`

### Version Caching Pattern (IIFE at Module Level)
- Cache runtime-expensive reads (e.g., `package.json` version) using a module-level IIFE
- Runs once at module load time; safely handles missing/corrupt files with fallback defaults
- No need for `setTimeout` or lazy caching — module loads once per process
```typescript
const pkgVersion = (() => {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version?: string };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
```

### Shared Types — Health Response
- `HealthResponse`: success shape with `status`, `timestamp`, `uptime`, `version`, `db_path`, `db_size_bytes`, `monitor_count`, `sample_count`, `last_ingest_time`
- `HealthErrorResponse`: error shape with `status`, `timestamp`, `message`
- Both types are in `shared/types.ts` and imported explicitly (Nuxt auto-import does NOT work for type-only exports)

### Test Patterns — Health Endpoint
- **Error handler edge cases**: test that Error, string, null, number, and boolean thrown values all produce structured `{ status: "error", message }` responses
- **Version parsing tests**: verify fallback to `"0.0.0"` when `package.json` is missing or corrupt
- **Path resolution tests**: verify `DATABASE_PATH` env var is resolved to absolute path; test contract (absolute path, correct filename) rather than exact path format
- **COUNT query simulation**: mock `db.prepare().get()` to return `{ cnt: N }` for monitor/sample counts
- **Full integration test**: mock DB + handler flow to verify end-to-end response shape

### Lessons Learned
- **Type drift**: `shared/types.ts` fields can drift from the API design document. Always cross-reference against `requirements/api/api-design.md` before implementing endpoints. The `database` vs `db_path` mismatch was caught by code review.
- **Internal state vs. response fields**: `dbStatus` is an internal variable for logging only — never expose it in the response. The response status is determined by whether the endpoint completes or throws.
- **E2E test artifacts**: Playwright produces `.last-run.json`, error context files, and screenshots. Ensure `.gitignore` covers `test-results/`, `.last-run.json`, and screenshot directories.
- **Test the contract, not the format**: For path assertions, test `path.endsWith("expected.db")` and `path.startsWith("/")` rather than exact path strings that vary by environment.

---

*Last updated: 2026-08-03 (Agent 14 — M1-T8 monitor history API conventions appended)*

## Client Identity Pattern (M1-T5 / F2)

### Slug Generation
- **Pure function** `generateSlug(username, hostname, macAddress)` with no external dependencies
- **Format:** `<username>-<hostname>-<truncated-mac>` where truncated-mac is the last 10 hex characters of the MAC address
- **Steps:** strip non-hex from MAC → build raw string → replace non-alphanumeric with hyphens → collapse consecutive hyphens → trim leading/trailing hyphens
- **Throws** on empty inputs (fail-fast validation)
- **Deterministic:** same inputs always produce same slug
- **Example:** `alice`, `desktop`, `aa:00:bb:11:cc:22` → `alice-desktop-00bb11cc22`

### ClientRow vs ClientResponse Type Separation
- **`ClientRow`** — raw database row shape (snake_case, epoch-ms timestamps, includes internal fields like `sync_enabled`, `sync_interval_min`, `backend_url`, `last_synced_at_ms`)
- **`ClientResponse`** — API response shape (snake_case keys matching API contract, ISO 8601 string timestamps, excludes internal sync/backend fields)
- **`toClientResponse(row: ClientRow): ClientResponse`** — the sole serialization function; prevents leaking DB internals to API consumers
- **Pattern:** Always maintain separate interfaces for DB rows and API responses — never return raw DB rows from API handlers

### Upsert Pattern
- **SQL:** `INSERT ... ON CONFLICT(slug) DO UPDATE SET` — single SQL statement, no application-level existence checks
- **Default name** is `username@hostname` (auto-generated on first registration)
- **Idempotent** — safe to call multiple times with same inputs; no duplicate records
- **Returns** the upserted row by querying `getClientBySlug()` after insert
- **Pattern:** Use `ON CONFLICT` for all entity registration — avoids race conditions and N+1 queries

### Name Validation
- Trim whitespace, then validate: reject empty, whitespace-only, or >100 characters
- Returns HTTP 400 with descriptive error message on validation failure
- Pattern: Validate input in API handler before calling utility function; utility functions assume valid input

### Parameterized Routes (Nitro Dynamic Routes)
- **Pattern:** `server/api/clients/[slug].get.ts` — the `[slug]` segment is a dynamic parameter extracted from the URL
- **Nested routes:** `server/api/clients/[slug].name.put.ts` maps to `PUT /api/clients/:slug/name`
- **Access params:** Use `event.context.params.slug` or `getRouterParameter(event, 'slug')` to extract the parameter value
- **Convention:** Always validate parameter values (empty strings, invalid format) before processing

### Client API Endpoint Patterns
- `GET /api/clients/:slug` — Returns full client record or 404
- `PUT /api/clients/:slug/name` — Updates name with validation, returns updated record or 404
- Both follow: parse params → validate → call utility → return `toClientResponse()` or throw error
- Error codes: 400 for validation errors, 404 for missing resources

## Client Identity ADR

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-004 | Client Identity via Username + Hostname + MAC | Human-readable slug, device-bound identity, immutable identifier |

## Client-Specific Test Patterns

- **Slug generation tests:** Verify format, determinism, edge cases (special chars in hostname/username, MAC formats)
- **Upsert idempotency tests:** Call twice with same inputs, verify no duplicate records, verify `updated_at` changes
- **Name validation edge cases:** Empty string, whitespace-only, exactly 100 chars, 101 chars, null/undefined
- **404 tests:** Non-existent slug returns proper error shape, not internal error
- **Integration tests:** Mock DB + handler flow to verify end-to-end response shape (including `toClientResponse` conversion)

## LNPM Cloud Dashboard — New Conventions (2026-08-03)

### Ping Ingest Endpoint (M1-T6 / F3)

The `POST /api/ping/ingest` endpoint is the primary data ingestion path for all ping telemetry.

#### Type-First Module Pattern
- **File**: `server/utils/ping-types.ts`
- **Pattern**: Dedicated type file per feature domain, co-located with implementation in `server/utils/`
- **Defines**: `PingSampleIngest`, `IngestPayload`, `IngestResponse`, `Rejection`, `ValidationResult`
- **No runtime logic** — pure TypeScript interfaces. Imported by both the route handler and ingest engine.
- **Rationale**: Keeps types in one place without scattering across implementation files. `shared/types.ts` is reserved for client-server shared types; server-only types stay co-located.

#### 3-Phase Ingest Pipeline Pattern
- **File**: `server/utils/ping-ingest.ts` → `ingestPingBatch()`
- **Phase 1 — Client lookup**: `getClientBySlug()` or auto-register via `upsertClient()` when identity fields are provided
- **Phase 2 — Validation**: Per-sample validation delegating to `validateSample()`, accumulating rejections
- **Phase 3 — Transactional ingest**: `db.transaction()` wrapping monitor auto-create, `INSERT OR IGNORE` dedup, monitor state update, client `last_synced_at_ms` update
- **Returns**: `IngestResponse` with `accepted`, `duplicate`, `rejected` counts and optional `rejections[]` array
- **Key**: Returns `null` for unknown clients — the route handler maps to 401. Separates business logic from HTTP concerns.

#### Validation Rule Pattern
- **File**: `server/utils/ping-validation.ts` → `validateSample()`
- **Returns**: `ValidationResult { valid: boolean, rejections: Rejection[] }`
- **Pattern**: Each rule is a named block (Rule 1–7) that independently pushes rejections. Multiple rejections accumulate per sample.
- **Rules**:
  1. `targetHost` required (non-empty string)
  2. `timestampMs` must be positive integer, within future window (`INGEST_FUTURE_WINDOW_MS`)
  3. `status` must be enum: `success` | `timeout` | `error`
  4. `latencyMs` required when status is `success`; must be non-negative number
  5. `resolvedAddress` required when status is `success`; must be non-empty string
  6. `latencyMs` must be `undefined` when status is NOT `success`
  7. `resolvedAddress` must be `undefined` when status is NOT `success`
- **Helper**: `isValidPositiveInteger()` — handles NaN, Infinity, non-integer edge cases
- **Rejected count = unique sample indices**: A sample with 3 validation failures counts as 1 rejected sample (not 3). Uses `new Set(rejections.map(r => r.index)).size`.

#### Transactional Ingest Pattern
- **File**: `server/utils/ping-ingest.ts` → `ingestSamples()`
- **`db.transaction()`** wraps 4 phases:
  1. Resolve monitor IDs with `ensureMonitor()` (`INSERT OR IGNORE` + `SELECT`)
  2. Bulk insert samples with `INSERT OR IGNORE`, tracking `stmt.run().changes` (0 = duplicate, 1 = inserted)
  3. Update monitor latest state per affected monitor
  4. Update client `last_synced_at_ms`
- **Dedup**: `INSERT OR IGNORE` on unique index `(monitor_id, timestamp_ms, resolved_address)` — `stmt.run().changes` returns 0 for ignored (duplicate) rows, 1 for inserted rows.
- **Monitor auto-creation**: `ensureMonitor()` uses `INSERT INTO monitors ... ON CONFLICT DO NOTHING` then `SELECT id` to get existing or new monitor ID.

#### Route Handler Status Code Logic
- **File**: `server/api/ping/ingest.post.ts`
- **`sendResponse(event, statusCode, body)` helper**: Calls `setResponseStatus(event, statusCode)` then returns body. Separates status code setting from body return.
- **Status code determination**:
  - `201`: All accepted (no dupes, no rejected)
  - `200`: All dupes OR all rejected (request processed successfully)
  - `207`: Mixed (some accepted + some duplicate/rejected)
  - `400`: Empty batch or validation error
  - `401`: Unknown client slug (no identity provided)
  - `413`: Batch exceeds `INGEST_MAX_SAMPLES` (default 1000)
- **Error shape**: `createError({ statusCode, statusMessage, data: { error, code } })` — consistent with F3 API contract.

#### Batch Limits
- **`INGEST_MAX_SAMPLES`**: Read from env at function call time (not module load). Default 1000. Batches exceeding this limit return 413.
- **Empty batch**: Returns 400 immediately — no database access.

### Mock DB Pattern for Tests (M1-T6)

- **Pattern**: Mock `getDb()` to return an object with `prepare(sql)` that dispatches based on SQL string matching
- **Implementation**: `vi.fn((sql) => { if (sql.includes("INSERT INTO monitors")) ... })` to return the right mock statement
- **Transaction mock**: `transaction: vi.fn((fn) => () => fn())` — runs the function synchronously without actual transaction wrapper
- **Avoids**: The `better-sqlite3` segfault in Vitest forked workers entirely
- **Lesson**: SQL string matching is fragile — if SQL changes, mocks need updating. This is the tradeoff for avoiding real SQLite in tests.

### Environment Variable Reading Pattern (M1-T6)

- **Pattern**: Read env vars inside functions (not at module scope) when they need to be testable
- **Example**: `INGEST_MAX_SAMPLES` and `INGEST_FUTURE_WINDOW_MS` are read at function call time
- **Benefit**: Tests can stub env vars with `vi.stubEnv()` and the module picks up new values without re-import

### ADRs — Ping Ingest (M1-T6)

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-010 | Client Auto-Registration on First Ingest | First ping batch from unknown client registers it if identity fields provided; eliminates separate registration step |
| ADR-011 | INSERT OR IGNORE for Dedup | Uses unique index + `INSERT OR IGNORE` over two-phase SELECT-then-INSERT; eliminates race conditions, `stmt.run().changes` counts accepted vs duplicate |
| ADR-012 | Rejected Count = Unique Sample Indices | A sample with 3 validation failures counts as 1 rejected sample; `rejections[]` array contains all reasons for traceability |
| ADR-013 | Status Code 200 for All-Rejected | 200 indicates "request processed successfully" even when all samples rejected; 207 reserved for mixed outcomes only |
| ADR-014 | sendResponse Helper for Status Codes | `setResponseStatus(event, code)` + return body pattern; Nitro doesn't let you set custom status and return body in one expression |

### Ping Ingest — Test Patterns

- **Unit tests mock the DB entirely** — `vi.mock("./db", () => ({ getDb: vi.fn() }))` with SQL string dispatching
- **Integration tests use in-memory SQLite** — Limited by `better-sqlite3` segfault in forked workers; use `--pool=threads` flag
- **vi.mock() at top level** — `vi.doMock()` inside test blocks causes parse errors; always use top-level `vi.mock()`
- **Vitest include pattern**: `**/*.test.ts` — NOT `**/*.spec.ts` (which are Playwright tests). Naming convention prevents conflicts.
- **478 tests across 30+ files** — Agent 10 established comprehensive test coverage for the entire codebase

### Known Limitations (M1-T6)

- **F12 hook (quality classifier)** — Not implemented yet (deferred to M1-T7)
- **F7 hook (WebSocket broadcast)** — **Implemented** in M1-T9 via `broadcastSample()` export
- **Integration tests with better-sqlite3** — Segfault in Vitest forked workers; unit tests mock the DB, integration tests are limited to in-memory SQLite

## LNPM Cloud Dashboard — New Conventions (2026-08-03, M1-T7)

### Monitors List API (M1-T7 / F5)

The `GET /api/monitors` endpoint returns all monitors with their latest state, joined with client information. Primary data source for the dashboard sidebar and all-monitors view.

#### CTE + ROW_NUMBER() Latest-State Query Pattern
- **File**: `server/utils/monitors.ts` → `getAllMonitorsWithLatestState()`
- **Pattern**: Single SQL query using a CTE with `ROW_NUMBER() OVER (PARTITION BY monitor_id ORDER BY timestamp_ms DESC)` to fetch the latest ping sample per monitor, then LEFT JOIN to monitors and clients
- **No N+1**: All data fetched in one SQL call — eliminates N+1 query problem
- **LEFT JOIN**: Monitors with no samples still appear (null latest state fields)
- **COALESCE sort**: `COALESCE(ls.timestamp_ms, 0) DESC` — monitors with no samples sort to the end
- **Stable tiebreaker**: `m.id ASC` ensures deterministic order when timestamps match
- **Returns**: `MonitorListItem[]` with camelCase fields matching API contract

#### Status Mapping Convention
- **`mapSampleStatus()`** (private helper): Maps DB-level status to API-level status
  - `"success"` → `"up"`
  - `"timeout"` | `"error"` → `"down"`
  - `null` → `null` (monitor has no samples)
- **`mapQualityState()`** (private helper): Maps DB-level quality state to API quality state
  - `"warmingUp"` → `"unknown"`
  - `"good"` | `"degraded"` | `"poor"` → pass-through as-is
- **Rationale**: API consumers expect simple, human-readable status values; internal DB state names are not leaked

#### Field Mapping Convention
- **snake_case → camelCase**: DB rows (snake_case) mapped to API fields (camelCase) in `.map()` after query
- **targetName fallback**: `row.target_name ?? row.target_host` — ensures display name always has a value
- **createdAt conversion**: `new Date(row.created_at).toISOString()` — epoch ms to ISO 8601 string
- **Pattern**: The mapping `.map()` is the sole transformation layer — keeps SQL clean and API contract in one place

#### Monitors API Route Handler Pattern
- **File**: `server/api/monitors.get.ts`
- **Pattern**: Import utility → call in try/catch → log info with count → return `{ monitors }` on success → logError + throw 500 on failure
- **No authentication**: Public endpoint, no auth required
- **Response shape**: `{ monitors: MonitorListItem[] }` — array wrapped in object key
- **Empty result**: Returns `{ monitors: [] }` with 200 status when no monitors exist (not 404)

#### Shared Types — Monitors List
- **`MonitorListItem`**: Individual monitor entry with `id`, `clientSlug`, `clientName`, `targetHost`, `targetName`, `status` (`"up"` | `"down"` | `null`), `latencyMs`, `qualityState`, `lastSeenMs`, `createdAt` (ISO 8601 string)
- **`MonitorsListResponse`**: Response envelope `{ monitors: MonitorListItem[] }`
- **Location**: `shared/types.ts`, imported explicitly (Nuxt auto-import does NOT work for type-only exports)

#### Monitors List Test Patterns
- **Unit tests** (`monitors.get.test.ts`): Test route handler error handling (utility throws → 500 response), info logging, and response shape
- **Integration tests** (`monitors.get.integration.test.ts`): Mock DB with `vi.mock()` to test full pipeline: mock DB → query → mapping → API response shape
- **Mock DB for mapping validation**: Tests validate the mapping layer — given rows from the DB, does the code produce correct API response? SQL syntax is verified by typecheck and runtime
- **Test the mapping, not the SQL**: Mock DB approach validates field transformation (snake→camel, status mapping, null handling) without executing real SQL

### ADRs — Monitors List (M1-T7)

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-015 | CTE + ROW_NUMBER for Latest State | Single query with CTE eliminates N+1; ROW_NUMBER() OVER (PARTITION BY) fetches latest sample per monitor efficiently |
| ADR-016 | LEFT JOIN for Monitors Without Samples | Monitors appear immediately after creation; null state fields for monitors with zero ping samples |
| ADR-017 | COALESCE Sort for Null Timestamps | Monitors with no samples sort to the end using COALESCE(timestamp_ms, 0) DESC |
| ADR-018 | Status Mapping Layer | Private helper functions map DB status to API status; prevents internal state names leaking to API |

## LNPM Cloud Dashboard — New Conventions (2026-08-03, M1-T8)

### Monitor History API (M1-T8 / F6)

The `GET /api/monitors/:id` endpoint returns historical ping data as `HistoryResponse` formatted for uPlot charts. Supports time window queries, down-sampling via maxPoints, and computes quality intervals and range summaries.

#### SQL GROUP BY Bucket Aggregation Pattern
- **File**: `server/utils/history.ts` → `getMonitorHistoryPoints()`
- **Pattern**: SQL `GROUP BY` on `CAST(floor(timestamp_ms / :bucketMs) * :bucketMs AS INTEGER)` for time-bucketed aggregation
- **Single query, single pass** — no subqueries or window functions; uses `AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END)` for null-safe latency stats
- **Returns**: `HistoryPoint[]` with snake_case→camelCase field mapping (timestampMs, averageLatencyMs, minimumLatencyMs, maximumLatencyMs, sampleCount, failureCount)
- **Empty result**: Returns empty array when no data exists in range — still returns 200
- **Clean bucket sizes**: `[1000, 5000, 10000, 30000, 60000, 300000, 900000, 1800000, 3600000]` — sub-minute buckets skipped (minimum 60s)

#### Down-sampling via Bucket Size Adjustment
- **`calculateBucketSize(fromMs, toMs, maxPoints)`**: Starts at 1-minute default, tries CLEAN_BUCKET_SIZES until `Math.ceil(rangeMs / bucketMs) <= maxPoints`
- **Falls back** to largest bucket (3600000ms = 1h) if even max size doesn't fit
- **Not post-hoc sampling** — the SQL query itself returns the right number of buckets; no re-aggregation needed

#### Quality Classification
- **`classifyPoint(point, cumulativeSamples, index)`**: Pure function mapping a HistoryPoint to `QualityState` (`warmingUp` | `low` | `medium` | `high` | `veryHigh` | `unstable` | `disconnected`)
- **Thresholds**: warmingUp (<5 cumulative samples), low (<1% loss, <50ms avg), medium (<5% loss, <100ms avg), high (<10% loss, <200ms avg), veryHigh (<10% loss, >=200ms avg), unstable (>=10% loss or no latency)
- **`collectReasons()`**: Collects QualityReason tags (`packetLoss`, `highLatency`, `insufficientSamples`) based on point metrics
- **`computeQualityIntervals(points, bucketMs)`**: Linear scan merging consecutive same-state points into intervals (QualityIntervalRecord[]), with gap detection (gap > 2x bucket → disconnected interval)
- **Defensive copies**: Reasons arrays are spread (`[...currentReasons]`) to prevent external mutation
- **Final interval**: `endMs` is `null` (open-ended) for the last interval

#### Range Summary Computation
- **`computeRangeSummary(points, intervals?)`**: Accepts pre-computed intervals (avoids recomputation) or computes them
- **p95 approximation**: Uses per-bucket averages as proxy — acceptable for MVP, documented
- **Min/max from aggregated extremes**: `Math.min(...minLatencies)` across buckets gives true minimum; same for max
- **Stable/unstable from intervals**: low/medium/warmingUp → stable, high/veryHigh/unstable → unstable, disconnected → disconnected
- **Percentages**: Computed as `(stateMs / totalTimeMs) * 100` where `totalTimeMs = lastPoint - firstPoint`

#### History Route Handler Pattern
- **File**: `server/api/monitors/[id].get.ts`
- **Query params**: `fromMs` (default: 1 hour ago), `toMs` (default: now), `maxPoints` (default: 2000, capped at 5000)
- **Validation order**: Parse path param → parse query params → validate params (fromMs < toMs) → verify monitor exists → aggregate
- **Fail fast**: Monitor existence check (`SELECT * FROM monitors WHERE id = ?`) before expensive aggregation
- **Error codes**: 404 (monitor not found), 400 (invalid params), 500 (database error)
- **Error handling**: Re-throw Nitro `createError` errors as-is; catch-all for unexpected errors logs and throws 500
- **Logging**: `info()` with monitorId, time range, bucket size, and point count

#### HistoryResponse Shape
- **Structure**: `{ fromMs, toMs, bucketMs, series: HistorySeries[] }` — always an array of series (single element for single-monitor view)
- **HistorySeries**: `{ target, points, intervals, summary }` — complete data for uPlot chart rendering
- **Target**: Built from `MonitorRow` + `ClientRow` via `buildTarget()`, with default thresholds and address family detection (IPv6 heuristic: contains `:`)

#### F6 Types (shared/types.ts)
- **`QualityState`**: `"warmingUp" | "low" | "medium" | "high" | "veryHigh" | "unstable" | "disconnected"`
- **`QualityReason`**: `"packetLoss" | "highLatency" | "highJitter" | "insufficientSamples"`
- **`HistoryPoint`**: timestampMs, averageLatencyMs, minimumLatencyMs, maximumLatencyMs, sampleCount, failureCount
- **`QualityIntervalRecord`**: startMs, endMs (nullable), state, reasons[]
- **`RangeSummary`**: sampleCount, successCount, failureCount, packetLossPercent, average/min/max/p95LatencyMs, stable/unstable/disconnected (ms + percent)
- **`Target`**: id (string), name, host, enabled, addressFamily, intervalMs, timeoutMs, thresholds (object), createdAtMs, archivedAtMs
- **`HistorySeries`**: target, points, intervals, summary
- **`HistoryResponse`**: fromMs, toMs, bucketMs, series (HistorySeries[])

#### MonitorRow and ClientRow Export Pattern
- **Exported from `server/utils/history.ts`** — these DB row types are used by both the utility module and route handlers
- **`MonitorRow`**: 11 fields matching monitors table (id, client_id, target_host, target_name, quality_state, state_since_ms, last_seen_ms, last_status, last_latency_ms, created_at, updated_at)
- **`ClientRow`**: 12 fields matching clients table (id, slug, name, username, hostname, mac_address, sync_enabled, sync_interval_min, backend_url, last_synced_at_ms, created_at, updated_at)
- **Pattern**: When a type is used by multiple modules (utility + route handler), export it from the utility or move to `shared/types.ts`

#### Test Patterns — History
- **Unit tests** (`history.test.ts`): Test pure functions — `calculateBucketSize`, `computeQualityIntervals`, `computeRangeSummary`, `buildTarget`
- **Edge case tests** (`history.edge-cases.test.ts`): Empty arrays, single point, all failures, large gaps, maxPoints limits, defensive copy verification
- **API unit tests** (`[id].get.test.ts`): Test route handler param parsing, validation, 404/400 error paths
- **Integration tests** (`[id].get.integration.test.ts`): Mock DB + full handler flow — verify end-to-end response shape
- **Mock DB**: Returns pre-configured rows for `SELECT * FROM monitors` and `SELECT * FROM clients` queries

### ADRs — Monitor History (M1-T8)

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-019 | Raw Aggregation (No Materialized Rollups) | Direct SQL GROUP BY on ping_samples; simpler (no migration, no sync job), deferred to materialized rollups in F12/M2 |
| ADR-020 | Server-side Quality Classification | Backend classifies quality state per bucket; frontend receives pre-classified data for chart coloring |
| ADR-021 | Down-sampling via Bucket Size (Not Post-hoc) | calculateBucketSize() adjusts SQL bucket granularity; query returns optimal count — no re-aggregation |
| ADR-022 | p95 from Bucket Averages (Approximation) | Uses per-bucket averages as p95 proxy; acceptable for MVP, can be improved with individual-sample percentile queries |
| ADR-023 | Default 1-Hour Time Window | fromMs defaults to 1 hour ago, toMs to now; balanced default for recent, meaningful data |

## LNPM Cloud Dashboard — New Conventions (2026-08-03, M1-T9)

### WebSocket Live Broadcast (M1-T9 / F7)

The WebSocket endpoint at `/ws/ping` provides real-time ping data broadcast with subscription management. Implemented using Nitro's native `defineWebSocketHandler` with a per-monitor subscription map.

#### Subscription Map Pattern
- **File**: `server/ws/ping.ts`
- **Structure**: `Map<number, Set<WebSocketType>>` — key is `monitorId`, values are raw WebSocket objects
- **`getSubscribers(monitorId)`**: Get or create subscriber set (lazy initialization)
- **`cleanupEmptyMonitor(monitorId)`**: Remove empty sets to prevent memory leaks
- **Rationale**: Map + Set provides O(1) lookup and O(1) add/delete; raw WebSocket stored (not Nitro peer) for external broadcast capability

#### Raw WebSocket Extraction Pattern
- **Pattern**: `const ws: WebSocketType = (peer as any).ws` — extract raw WebSocket from Nitro peer
- **Why**: Nitro's `peer` object is a `Peer<AdapterInternal>` wrapper; the underlying WebSocket is needed for:
  - Broadcasting from outside the handler (ingest endpoint)
  - Checking `readyState` before sending
  - Direct `ws.send()` calls for broadcast (more efficient than peer.send)
- **Storage**: Store the raw `ws` in the subscription Set, not the peer
- **Caveat**: Use `as any` cast — Nitro doesn't expose a typed accessor for the underlying WebSocket

#### Message Protocol (F7 Spec)
- **Client → Server (inbound)**:
  - `subscribe` — `{ type: "subscribe", monitorId: number }`
  - `unsubscribe` — `{ type: "unsubscribe", monitorId: number }`
- **Server → Client (outbound)**:
  - `subscribed` — `{ type: "subscribed", monitorId }` — acknowledgment
  - `unsubscribed` — `{ type: "unsubscribed", monitorId }` — acknowledgment
  - `snapshot` — `{ type: "snapshot", monitorId, data: { monitor, samples[] } }` — last 100 samples
  - `sample` — `{ type: "sample", monitorId, data: { timestampMs, latencyMs, status, resolvedAddress } }` — new sample
  - `error` — `{ type: "error", message: string }` — error message
- **All messages are JSON** with a `type` discriminator field
- **Connected acknowledgment**: On `open`, send `{ type: "connected", timestamp: ISO string }` (backward compat)

#### Snapshot on Subscribe
- **`SNAPSHOT_SIZE`** constant: 100 (configurable)
- **Two queries on subscribe**: (1) monitor state (`SELECT ... FROM monitors WHERE id = ?`), (2) last 100 samples (`SELECT ... FROM ping_samples WHERE monitor_id = ? ORDER BY timestamp_ms DESC LIMIT ?`)
- **Reversed to oldest-first**: `rawSamples.reverse()` for chart consumption
- **Monitor existence check**: `SELECT id FROM monitors WHERE id = ?` before subscribing — returns `error` if not found
- **Mapping functions**: `mapMonitorStatus()` and `mapQualityState()` — same logic as monitors list API

#### Broadcast from Ingest Integration
- **`broadcastSample(monitorId, sample)`**: Exported function called from `server/api/ping/ingest.post.ts` after successful DB insert
- **Non-blocking**: Broadcast doesn't affect ingest response time (fire-and-forget)
- **Early return**: If no subscribers (`!subSet || subSet.size === 0`), return immediately
- **Safe iteration**: `for (const ws of [...subSet])` — iterate a copy to avoid issues if set changes during broadcast
- **ReadyState check**: `ws.readyState === 1` (OPEN) before sending; catch send errors per-peer
- **Pattern**: Broadcast is a cross-cutting concern — exported from the WebSocket module, imported by the ingest endpoint

#### Cleanup on Disconnect
- **`close` handler**: Iterates over `[...subscriptions.keys()]` (copy of keys) to remove the disconnected WebSocket from all subscription sets
- **Why copy**: The Map may change during iteration (deleting empty sets); iterating over a copy avoids `ConcurrentModification` issues
- **Double cleanup**: After deleting from set, check `subSet.size === 0` and `subscriptions.delete(monitorId)` to remove the empty entry
- **Error handling**: Nitro emits `close` on error — no separate error handler needed for cleanup
- **Logging**: `info()` on connect and disconnect for observability

#### SendJSON Helper Pattern
- **Function**: `sendJSON(peer, message)` — wraps `peer.send(JSON.stringify(message))` in try/catch
- **Error handling**: Catches send errors, logs with `warn()` including message type and error details
- **Used for**: All peer-to-client sends (acknowledgments, errors) — NOT for broadcast (which uses `ws.send()` directly)

#### WebSocket-Handler-Scoped Types
- **Inbound types**: `SubscribeMessage`, `UnsubscribeMessage`, `InboundMessage` (union)
- **Outbound types**: `SubscribedMessage`, `UnsubscribedMessage`, `SnapshotMessage`, `SampleMessage`, `ErrorMessage`, `OutboundMessage` (union)
- **Location**: Defined locally in `server/ws/ping.ts` — not in `shared/types.ts` (WebSocket protocol is server-internal)
- **Rationale**: These types are implementation details of the WebSocket handler; `shared/types.ts` defines the contract

#### Shared Types — F7 WebSocket (shared/types.ts)
- **`WsInboundType`**: `"subscribe" | "unsubscribe"` — client-to-server message types
- **`WsOutboundType`**: `"subscribed" | "unsubscribed" | "snapshot" | "sample"` — server-to-client message types
- **`WsPingSample`**: `timestampMs`, `latencyMs`, `status`, `resolvedAddress` — single sample in broadcast
- **`WsMonitorState`**: `id`, `targetHost`, `targetName`, `status`, `latencyMs`, `qualityState`, `lastSeenMs` — monitor state in snapshot
- **Pattern**: Shared types are minimal — the full message shapes are in the handler; `shared/types.ts` defines the contract

#### WebSocket Test Patterns
- **Mock `nitropack`**: `vi.mock("nitropack", () => ({ defineWebSocketHandler: (h) => h }), { virtual: true })` — virtual module mock
- **Global `defineWebSocketHandler`**: Set on `globalThis` since Nitro auto-imports it (not explicitly imported)
- **Dual import path mocking**: Mock both `../utils/db` and `#server/utils/db` since the file may use either path format
- **Peer mock**: `{ send: vi.fn(), ws: { readyState: 1 } }` — minimal peer with send capability
- **Message mock**: `{ text: () => JSON.stringify({ type, monitorId }) }` — simulates the message object from Nitro
- **Dynamic import for isolation**: `await import("./ping")` inside each test to get a fresh module instance (subscription map resets)
- **10 unit tests** covering: open (connected), message validation (invalid JSON, missing fields, unknown type), subscribe error (non-existent monitor), unsubscribe ack, close, and broadcastSample exports

#### Ingest → WebSocket Broadcast Integration (server/api/ping/ingest.post.ts)
- **Import**: `import { broadcastSample } from "~/server/ws/ping"`
- **Placement**: Called after successful DB insert within the transaction, for each accepted sample
- **Non-blocking**: Broadcast is fire-and-forget — failures are logged but don't affect ingest response
- **Only accepted samples**: Duplicate and rejected samples are not broadcast
- **Pattern**: Cross-module import for event-driven broadcast — the WebSocket handler exposes `broadcastSample`, the ingest endpoint consumes it

### ADRs — WebSocket Live Broadcast (M1-T9)

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-024 | Subscription-per-Monitor Model | Each client subscribes to specific monitor IDs; no global broadcast. Scales with client interest, matches F7 spec |
| ADR-025 | Snapshot on Subscribe (Last 100 Samples) | UI receives historical context immediately; eliminates separate API call for initial chart data. SNAPSHOT_SIZE=100 is configurable |
| ADR-026 | Broadcast from Ingest Endpoint | Ingest triggers WebSocket broadcast after DB insert; tight coupling, no polling. Fire-and-forget — broadcast failures don't affect ingest |
| ADR-027 | JSON Message Protocol with Type Discriminator | All WebSocket messages are JSON with `type` field; simple, extensible, human-readable. 7 message types (subscribe, unsubscribe, subscribed, unsubscribed, snapshot, sample, error) |

*Last updated: 2026-08-03 (Agent 14 — M1-T10 quality classifier conventions appended)**

## LNPM Cloud Dashboard — New Conventions (2026-08-03, M1-T10)

### Quality Classifier (M1-T10 / F12)

The quality classifier analyzes raw ping samples in a 5-minute sliding window and computes a quality state (`veryHigh`, `high`, `medium`, `low`, `unstable`, `disconnected`, `warmingUp`) for each monitor. Runs post-ingest and as a background sweep every 60 seconds.

#### Constants-Only Module Pattern (`quality-states.ts`)
- **File**: `server/utils/quality-states.ts`
- **Pattern**: Dedicated module exporting ONLY configuration constants — no runtime logic
- **Exports**: `QUALITY_WINDOW_MS`, `QUALITY_MIN_SAMPLES`, `QUALITY_VERY_HIGH_MAX_LATENCY`, `QUALITY_HIGH_MAX_LATENCY`, `QUALITY_MEDIUM_MAX_LATENCY`, `QUALITY_MEDIUM_MAX_PACKET_LOSS`, `QUALITY_UNSTABLE_CV`, `QUALITY_UNSTABLE_MAX_PACKET_LOSS`, `QUALITY_DISCONNECTED_NO_SAMPLES_WINDOW_MS`, `QUALITY_DISCONNECTED_RECENT_MS`, `QUALITY_COLORS`, `mapQualityState`
- **Rationale**: Centralizes thresholds in one place; classifier, tests, and UI all import from the same source. Changing a threshold requires editing exactly one file.
- **`mapQualityState(state: string): QualityState`**: Handles both F12 values (pass-through) and legacy values (`good` → `veryHigh`, `degraded` → `medium`, `poor` → `low`) with fallback to `warmingUp`. Extracted from monitors.ts and ping.ts to eliminate duplicates.
- **`QUALITY_COLORS`**: Record mapping `QualityState` → CSS color string (Tailwind-compatible hex values). Used by frontend for chart coloring and UI indicators.

#### Classification Algorithm — Ordered Priority (First Match Wins)
- **File**: `server/utils/quality-classifier.ts` → `classifyMonitor(monitorId)`
- **Algorithm** (evaluated in priority order — first match wins):
  1. **Disconnected**: No samples in window AND (no samples ever OR last sample > 5 min ago). BUT if last sample > 1 hour ago → `warmingUp`.
  2. **WarmingUp**: Fewer than 10 samples in window (insufficient data).
  3. **Unstable**: Coefficient of variation (CV) > 0.5 AND packet_loss < 10% — catches high-jitter connections before other rules.
  4. **VeryHigh**: packet_loss == 0% AND avg_latency < 50ms.
  5. **High**: packet_loss == 0% AND avg_latency < 150ms.
  6. **Medium**: packet_loss <= 10% AND avg_latency <= 300ms.
  7. **Low**: Everything else (catch-all fallback).
- **Key insight**: Unstable is checked before VeryHigh/High/Medium — a connection with zero packet loss but wild jitter (CV > 0.5) is `unstable`, not `veryHigh`. This is a **priority-based** algorithm, not a threshold ranking.

#### Single-Query Aggregation Pattern
- **Query**: LEFT JOIN `monitors` + `ping_samples` with aggregated stats (COUNT, SUM latency, SUM latency², COUNT success) in a single query
- **CV computation**: `sqrt(E[X²] - E[X]²)` / mean — computed client-side from aggregated sums. No need to fetch individual samples.
- **Two queries total**: (1) aggregated stats + current state, (2) `MAX(timestamp_ms)` for disconnected detection
- **Efficiency**: O(1) queries per monitor regardless of sample count; window is time-bounded (5 min), not row-count bounded

#### Batch Classification Pattern
- **`classifyMonitorsBatch(monitorIds[])`**: Iterates over monitor IDs, calling `classifyMonitor()` for each
- **Returns**: `Map<monitorId, QualityState>` — only monitors whose state **changed** are included
- **Per-monitor error isolation**: Each classification is wrapped in try/catch; one failure doesn't stop the batch
- **Logging**: `info()` for state changes (with full metrics), `debug()` for unchanged states — keeps logs signal-rich

#### Persist Quality State
- **`persistQualityState(db, monitorId, qualityState, now)`**: Updates `quality_state`, `quality_state_updated_at`, and `updated_at` in a single UPDATE
- **Always writes**: Even if state didn't change, `quality_state_updated_at` is refreshed (proves liveness)
- **Atomic**: Single UPDATE statement — no transaction needed (single row, single table)

#### Post-Ingest Classification Trigger
- **File**: `server/utils/ping-ingest.ts` → called after successful sample insertion
- **Pattern**: After `ingestSamples()` completes, extract affected `monitorId` values and call `classifyMonitorsBatch()` for each
- **Non-blocking**: Classification runs synchronously within the ingest flow — latency budget is acceptable (single query per monitor)
- **Only affected monitors**: Post-ingest only reclassifies monitors that received new samples, not all monitors

#### Background Sweep Plugin (`quality-sweep.ts`)
- **File**: `server/plugins/quality-sweep.ts`
- **Pattern**: Nitro plugin with `setInterval` — re-evaluates all active monitors every 60 seconds
- **Active monitor filter**: `SELECT DISTINCT monitor_id FROM ping_samples WHERE timestamp_ms >= ?` (last 10 minutes) — skips dormant monitors
- **Configurable interval**: `QUALITY_SWEEP_INTERVAL_MS` env var (default 60000ms), validated at startup
- **Env var validation**: `Number.isFinite(sweepIntervalMs) && sweepIntervalMs > 0` — prevents `NaN` from causing tight-loop CPU exhaustion
- **Graceful shutdown**: Returns cleanup function from `defineNitroPlugin` to clear interval on server stop
- **Logging**: `info()` on startup with interval, `info()` on sweep completion with change count, `error()` on failures

#### Migration 006 — Data Migration Pattern
- **File**: `schema/migrations/006_add_quality_state_updated_at.sql`
- **ALTER TABLE**: `ADD COLUMN quality_state_updated_at INTEGER` — nullable, no default
- **Data migration**: `UPDATE monitors SET quality_state = 'X' WHERE quality_state = 'legacy_Y'` — migrates existing legacy values to F12 equivalents
- **Legacy mapping**: `warmingUp` → `disconnected`, `good` → `veryHigh`, `degraded` → `medium`, `poor` → `low`
- **Pattern**: When changing enum values, migration must both alter schema AND transform existing data
- **Feature ID annotation**: `-- M1-T10: Backend quality classifier — F12` in migration header

#### ClassifyResult Shared Type (shared/types.ts)
- **`ClassifyResult`**: `{ qualityState, qualityStateUpdatedAtMs, sampleCount, packetLoss, avgLatency, cv }` — returned by `classifyMonitor()`
- **Used by**: Classifier module, tests, and potentially API responses
- **Internal extension**: `ClassifyResultWithDiff` extends with `previousState` and `stateChanged` — internal to classifier module, not exported to shared types

#### Quality State in API Responses
- **`MonitorListItem.qualityState`**: F12 value (`veryHigh`, `high`, `medium`, `low`, `unstable`, `disconnected`, `warmingUp`) — no longer maps to `unknown`
- **`WsMonitorState.qualityState`**: Same F12 values — WebSocket broadcast includes quality state
- **`Target.thresholds`**: Updated with `qualityState` field for chart configuration
- **`mapQualityState()` consolidation**: Previously duplicated in `monitors.ts` and `ping.ts`; now extracted to `quality-states.ts` with a single source of truth

#### Coefficient of Variation (CV) for Jitter Detection
- **Formula**: `cv = stddev / mean` where `stddev = sqrt(E[X²] - E[X]²)`
- **Threshold**: `QUALITY_UNSTABLE_CV = 0.5` — if CV exceeds this, the connection is "unstable" regardless of average latency
- **Why CV, not raw stddev**: Normalizes across different latency ranges. A stddev of 50ms is normal for a 500ms connection but catastrophic for a 10ms connection.
- **Computation**: Uses `sum_latency_sq` (sum of squares) from the aggregate query — avoids fetching individual samples
- **Defensive**: `Math.max(0, variance)` prevents NaN from floating-point rounding errors

#### Quality Classifier Test Patterns
- **Metrics computation tests**: Verify packet loss, CV, and avg latency math independently of the DB
- **Decision logic tests**: Pure function tests with a `classify(packetLoss, avgLatency, cv, sampleCount, lastSampleMs, now)` helper — no DB dependency
- **Boundary tests**: Verify edge cases at exact threshold values (50ms, 150ms, 300ms, CV=0.5, 10% packet loss)
- **Priority tests**: Verify that unstable takes precedence over veryHigh (zero loss + low avg but high CV → unstable, not veryHigh)
- **Disconnected edge cases**: No samples ever, last sample > 1 hour ago, between-ping gap scenarios

#### Env Var Validation Pattern (for Plugins)
- **Pattern**: Validate env var at startup; return early with no-op cleanup if invalid
- **Implementation**: `Number.isFinite(value) && value > 0` — catches NaN, Infinity, negative, and zero
- **Fallback**: Default value used when env var is missing/empty (`process.env.X ?? String(DEFAULT)`)
- **Rationale**: `setInterval(NaN)` fires immediately in a tight loop; `setInterval(0)` fires on every tick. Validation prevents CPU exhaustion from misconfiguration.

### ADRs — Quality Classifier (M1-T10)

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-028 | Quality State Classification via Ordered Priority | First-match-wins algorithm with 7 states; unstable checked before latency-based states to catch high-jitter connections |
| ADR-029 | Single-Query Aggregation for Classification | SQL aggregates (COUNT, SUM, SUM²) + client-side CV computation; O(1) queries per monitor, no sample fetch |
| ADR-030 | Post-Ingest + Background Sweep Hybrid | Immediate classification after ingest for freshness; 60s sweep catches state drift (e.g., monitor goes silent between ingests) |
| ADR-031 | Coefficient of Variation for Jitter | CV = stddev/mean normalizes across latency ranges; threshold 0.5 catches unstable connections regardless of average |
| ADR-032 | Quality State Persisted on Monitor Row | Single UPDATE per classification; `quality_state_updated_at` proves liveness even when state doesn't change |

*Last updated: 2026-08-03 (Agent 14 — M1-T12 rate limiting conventions appended)*

## LNPM Cloud Dashboard — New Conventions (2026-08-03, M1-T12)

### Rate Limiting Middleware (M1-T12 / F13)

The rate limiting middleware protects all API endpoints from excessive requests using an in-memory sliding window with LRU eviction. Runs automatically via Nitro's file-based middleware in `server/middleware/`.

#### Nitro Middleware Pattern
- **File**: `server/middleware/rate-limit.ts`
- **Pattern**: Files in `server/middleware/` automatically run before every server route handler — no registration needed
- **Path filtering**: Only applies to `/api/` paths — skips static assets, WebSocket, and frontend routes
- **IP resolution**: `getRequestIP(event, { xForwardedFor: true })` — proper IP behind reverse proxies (Nginx, Cloudflare)
- **Graceful degradation**: If IP cannot be determined (no header, no socket), the request is allowed through (not blocked)
- **Early return**: Returns a 429 response to short-circuit the request; returns nothing to let the request continue

#### Sliding Window Rate Limiter Utility
- **File**: `server/utils/rate-limiter.ts`
- **Pattern**: Pure functions (`checkRateLimit`, `getRateLimitConfig`) with no HTTP context — testable in isolation
- **Data structure**: `Map<string, RateLimitEntry>` keyed by IP address
- **RateLimitEntry**: `{ timestamps: number[], lastAccess: number }` — timestamps within the window + LRU access time
- **Sliding window**: Filters out timestamps older than `now - windowMs` on each check — not a fixed window
- **LRU eviction**: When map exceeds `MAX_ENTRIES` (10,000), evicts entries with `lastAccess > 2× window` to bound memory
- **Env var config**: `RATE_LIMIT_WINDOW_MS` (default: 60000ms) and `RATE_LIMIT_MAX_REQUESTS` (default: varies by endpoint)

#### Rate Limit Tiers
- **Ingest endpoint** (`/api/ping/ingest`): 100 requests/minute — high-frequency ping data from LNPM clients
- **All other API endpoints**: 60 requests/minute — dashboard UI calls, lower frequency
- **`getRateLimitConfig(isIngest)`**: Selects appropriate limit based on URL path prefix

#### 429 Response Shape (F13 Spec)
- **Body**: `{ error: "rate_limit_exceeded", retryAfter: N }` — machine-readable `error` string, not human-readable
- **Header**: `Retry-After: N` (seconds) — standard RFC 6585 header
- **Status**: 429 Too Many Requests
- **Logging**: `warn()` with structured JSON (IP, path, retryAfter, limit) — signal-rich logs for observability
- **No `code` field**: The F13 spec does not include a `code` field — only `error` and `retryAfter`

#### Test Isolation
- **`resetRateLimitState()`**: Exported function to clear the rate limit map between tests
- **Pattern**: Call `resetRateLimitState()` in `beforeEach` — same as `delete globalThis.__db` for DB tests
- **Mock dates**: Use `vi.useFakeTimers()` to control time in sliding window tests
- **24 tests** across 2 files: `rate-limiter.test.ts` (utility) and `rate-limit.test.ts` (middleware)

#### Middleware Test Patterns
- **Mock h3 event**: Construct minimal event objects with `path` and simulated `socket.remoteAddress`
- **`getRequestIP` mock**: `vi.mock("h3", ...)` to control IP resolution
- **Verify response shape**: Assert `{ error: "rate_limit_exceeded", retryAfter: N }` — not human-readable strings
- **Verify headers**: Check `Retry-After` header is set correctly
- **Path filtering**: Verify middleware skips non-`/api/` paths (returns early without rate limiting)

### ADRs — Rate Limiting (M1-T12)

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-033 | In-memory LRU Sliding Window (No Redis) | Single-instance deployment (SQLite backend) doesn't need distributed rate limiting; in-memory Map with LRU eviction bounds memory. Documented as known limitation for multi-process deployments |
| ADR-034 | Separate Utility + Middleware Layers | Pure functions in `server/utils/rate-limiter.ts` for testability; HTTP integration in `server/middleware/rate-limit.ts`. Clean separation of concerns |
| ADR-035 | Per-IP Tracking with xForwardedFor | `getRequestIP(event, { xForwardedFor: true })` for correct client IP behind reverse proxies. Graceful degradation — allows through if IP unknown |
| ADR-036 | Different Limits for Ingest vs Other Endpoints | Ingest: 100 req/min (high-frequency ping data). Others: 60 req/min (dashboard UI). Selected by URL path prefix in `getRateLimitConfig()` |

*Last updated: 2026-08-03 (Agent 14 — M2 frontend conventions appended)*

## LNPM Cloud Dashboard — New Conventions (2026-08-03, M2)

### Frontend Component Architecture (M2)

The dashboard frontend follows a composable-driven architecture. Charts, state management, and transforms are split into single-responsibility composables that are testable in isolation.

#### uPlot Chart Pattern (M2-T3)
- **File**: `app/components/charts/LatencyChart.vue`
- **Pattern**: uPlot chart wrapped in Vue component with reactive props. `onMounted` creates chart, `onUnmounted` destroys it. `watch` on data props triggers `uPlot.setData()`.
- **Quality bands**: Rendered via uPlot's `Qual` plugin — background bands colored by quality state. Path data generated by `app/utils/quality-bands.ts` utility.
- **Threshold line**: Rendered via `Point` plugin (horizontal line at configured threshold value).
- **Key**: Chart lifecycle MUST use `onMounted` (not `onBeforeMount`) — DOM element is not available before mount. Code review (Agent 08) caught this bug.

#### All-Monitors Chart Pattern (M2-T3)
- **File**: `app/components/charts/AllMonitorsChart.vue`
- **Pattern**: Multi-series uPlot chart showing all monitors on a single canvas. Each monitor is a series with a distinct color from `useDashboardPalette()`.
- **Toggle**: Each monitor has a checkbox to toggle visibility. Uses uPlot's `setSeries(index, 'show', boolean)` API.
- **Color cycling**: `useDashboardPalette()` returns a fixed 12-color palette — deterministic (same monitor always gets same color).

#### Chart Composable Architecture (M2-T3)
- **`useTimeWindow()`** — Manages time range selection (fromMs, toMs). Provides preset ranges (1h, 6h, 24h, 7d, 30d) and reactive `fromMs`/`toMs` values.
- **`useMonitorHistory()`** — Fetches `HistoryResponse` from `GET /api/monitors/:id`. Handles time window params and `maxPoints` down-sampling.
- **`useChartSeries()`** — Pure function composable. Transforms `HistoryPoint[]` into uPlot-compatible `[[timestamps], [values], ...]` arrays. No DOM, no effects — testable as pure functions.
- **`useDashboardPalette()`** — Generates 12-color palette for multi-monitor charts. Deterministic: same monitor index always maps to same color.

#### Quality Bands Utility (M2-T3)
- **File**: `app/utils/quality-bands.ts`
- **Pattern**: Pure function that converts `QualityIntervalRecord[]` into uPlot `Qual` plugin path data. Maps `qualityState` → color via `QUALITY_COLORS` constants from `server/utils/quality-states.ts`.
- **No Vue dependencies** — can be imported by both components and tests.

#### Monitor Detail View Components (M2-T4)
- **`MonitorHeader.vue`** — Monitor title bar with status dot, latest latency, last seen time
- **`MonitorSummary.vue`** — RangeSummary metrics grid (9 stat cards: sample count, packet loss, p50/p95/min/max latency, stable/unstable/disconnected percentages)
- **`QualityIntervals.vue`** — Quality state timeline (visual representation of quality intervals)
- **`ChartThreshold.vue`** — Configurable threshold line on charts

#### Time Range Selector (M2-T3)
- **File**: `app/components/shared/TimeRangeSelector.vue`
- **Pattern**: Button-group component with preset time ranges. Emits `select` event with `{ fromMs, toMs }` payload. Uses `useTimeWindow()` composable for computation.

### WebSocket Frontend Composable (M2-T5)
- **File**: `app/composables/useWebSocket.ts`
- **Pattern**: Reactive WebSocket connection manager with auto-reconnect. Returns `isConnected`, `isReconnecting`, `connectionState` reactive refs.
- **Auto-reconnect**: Exponential backoff (1s, 2s, 4s, 8s, max 30s). Resets on successful reconnect.
- **Subscription**: `subscribe(monitorId)` / `unsubscribe(monitorId)` methods. Re-subscribes on reconnect.
- **Lifecycle**: Uses `onMounted` for initial connect, `onBeforeUnmount` for cleanup. **NOT** `onBeforeMount` — DOM must be ready.
- **Connection indicator**: `DashboardHeader` shows connection status (green/yellow/red dot) based on `connectionState`.

### Client Page Patterns (M2-T6)
- **Client overview**: `app/pages/clients/[slug]/index.vue` — displays client identity, monitors list, sync status
- **Client settings**: `app/pages/clients/[slug]/settings.vue` — sync configuration form with PUT endpoint
- **Components**: `ClientInfo`, `ClientMonitors`, `SyncStatusIndicator`, `SyncSettingsForm` — all composable, reusable
- **Settings form**: Validates inputs before PUT request. Optimistic UI update with rollback on error.

### Client Settings API (M2-T6)
- **Endpoint**: `PUT /api/clients/[slug]/settings`
- **File**: `server/api/clients/[slug].settings.put.ts`
- **Pattern**: Parse slug param → validate input (sync_enabled boolean, sync_interval_min 1-60, backend_url valid URL) → update client row → return response
- **Validation**: Server-side validation with 400 error on invalid input. `backend_url` must be valid URL or empty string.

### Inline Name Editing (M2-T7)
- **File**: `app/components/sidebars/ClientGroup.vue`
- **Pattern**: Click-to-edit inline name field. Blur/Enter to save, Escape to cancel. Optimistic update with rollback on error.
- **API**: `PUT /api/clients/[slug]/name` — validates name (1-100 chars after trim), returns updated client.

### Frontend CSS Conventions (M2)
- **`app/assets/css/dashboard.css`** — Design tokens (CSS custom properties) for the entire dashboard. Colors, spacing, typography, shadows.
- **`app/assets/css/charts.css`** — Chart-specific styles (uPlot overrides, tooltip styling, quality band colors). Imported separately.
- **Scoped CSS**: All Vue components use `<style scoped>` with semantic class names.

### Frontend Testing Patterns (M2)
- **Composable tests**: Test composables with pure function assertions (no DOM). `useChartSeries`, `useDashboardPalette`, `useTimeWindow` are all testable as pure transforms.
- **Utility tests**: `quality-bands.test.ts` verifies path generation for uPlot Qual plugin.
- **API endpoint tests**: `clients/[slug].settings.put.test.ts` — mock DB + handler flow pattern.
- **Test fixtures**: Use `test/fixtures.ts` factory functions for consistent test data across frontend and backend tests.
- **Mock DB factory**: `test/mock-db-factory.ts` — creates Database stubs dispatching on SQL string matching. Handles `UPDATE` with parameterized queries correctly (fixed by Agent 10).

### ADRs — M2 Frontend

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-038 | uPlot with Qual Plugin for Charts | Canvas-based rendering for high-performance time-series. Qual plugin handles quality state bands. ~14KB gzipped bundle. |
| ADR-039 | Composable-Driven Chart Architecture | Separate composables for data fetching (useMonitorHistory), transforms (useChartSeries), time ranges (useTimeWindow), and colors (useDashboardPalette). Each testable in isolation. |
| ADR-040 | WebSocket Auto-Reconnect with Exponential Backoff | Frontend composable (`useWebSocket`) manages connection lifecycle with automatic reconnect. Exponential backoff prevents rapid reconnection attempts. |
| ADR-041 | Deterministic Color Palette for Multi-Monitor Charts | Fixed 12-color palette from `useDashboardPalette()` — same monitor always gets same color across sessions. |
| ADR-042 | Client Overview + Settings as Separate Pages | Clear separation of read-only overview (`/clients/[slug]`) from editable settings (`/clients/[slug]/settings`). Follows established routing pattern. |
| ADR-043 | Optimistic UI Updates with Rollback | Inline name editing and settings form use optimistic updates — show change immediately, rollback on error. Improves perceived responsiveness. |

*Last updated: 2026-08-03 (Agent 14 — M2 frontend conventions appended)*

## LNPM Cloud Dashboard — New Conventions (2026-08-05, M2-T2)

### Sidebar Component Architecture (M2-T2)

The sidebar is composed of two layers: a responsive wrapper (`DashboardSidebar`) and shared content (`SidebarContent`). This separation eliminates code duplication between desktop and mobile layouts.

#### DashboardSidebar — Responsive Wrapper
- **File**: `app/components/DashboardSidebar.vue`
- **Pattern**: Thin wrapper that renders `SidebarContent` in two layouts:
  - **Desktop**: Persistent `.sidebar-panel` with `v-show="!isMobile"`
  - **Mobile**: Fixed `.sidebar-mobile` overlay with `translateX` transition + backdrop `.sidebar-overlay`
- **Responsive state**: Uses `useResponsiveSidebar()` for `isMobile`/`isOpen`/`close` — delegates all content logic to `SidebarContent`
- **Rationale**: Avoids duplicating the sidebar content (monitor list, client groups, empty state) in two template blocks

#### SidebarContent — Shared Content
- **File**: `app/components/shared/SidebarContent.vue`
- **Pattern**: Owns the sidebar content: "All Monitors" row + ClientGroup list + EmptyState fallback
- **Data source**: Uses `useMonitors()` for `monitors`, `groupedByClient`, `isVisible`, `toggleMonitor`
- **Event handling**: Receives `toggle` and `rename` events from ClientGroup; handles API calls internally
- **Rename flow**: Calls `PUT /api/clients/:slug/name` → updates local `groupedByClient` state on success → rollback on failure

### useMonitors Composable — Data + Toggle State
- **File**: `app/composables/useMonitors.ts`
- **Dual responsibility**: Fetches monitor data (via `useAsyncData`) AND manages toggle visibility state
- **Toggle API**: Returns `toggleMonitor(id)`, `isVisible(id)`, `showMonitor(id)`, `hideMonitor(id)` — imperative functions for child components
- **localStorage persistence**: Toggle state persisted to `localStorage` under key `"lnpm-visible-monitors"`
- **Auto-initialization**: First load auto-shows all monitors (if localStorage is empty, `watch` with `immediate: true` populates the set)
- **SSR-safe**: localStorage guarded with `typeof window !== "undefined"` — no crashes during server render

### ClientGroup — Inline Name Editing
- **File**: `app/components/sidebars/ClientGroup.vue`
- **Props**: `clientName`, `clientSlug`, `monitors`, `isVisible`
- **Events**: `toggle(monitorId)`, `rename(slug, newName)`
- **Inline edit pattern**: Click pencil icon → input field with save/cancel → auto-focus + select text → Enter/save to submit, Escape/cancel to revert
- **Optimistic UI**: Emits `rename` event with new name; parent (`SidebarContent`) calls API. On failure, component re-renders with original name
- **Validation**: Trims whitespace, rejects empty/whitespace-only or >100 chars
- **Header click during edit**: No-op — `handleHeaderClick()` returns early if editing

### MonitorRow — Toggle + Navigation
- **File**: `app/components/sidebars/MonitorRow.vue`
- **Props**: `monitor`, `visible?` (default: `true`)
- **Events**: `toggle` (no payload)
- **Toggle button**: Checkbox-like `.monitor-toggle` with `@click.stop` — prevents navigation when clicking the toggle
- **Dimmed state**: `.dimmed` class on wrapper with `opacity: 0.35` when `visible` is `false`
- **Navigation**: Clicking the row (not the toggle) navigates to `/monitors/:id` via `<NuxtLink>`
- **Selected state**: Computed from `route.path.startsWith(/monitors/${monitor.id})`
- **Accessibility**: `aria-label` ("Show/Hide in chart") and `aria-pressed` on toggle button

### StatusDot — Quality State Colors
- **File**: `app/components/shared/StatusDot.vue`
- **Props**: `qualityState?` (optional, nullable)
- **Pattern**: Single `<span>` with dynamic class `state-{qualityState}` — CSS in `dashboard.css` handles color and glow
- **Color mapping**: low/medium → teal (accent), high → orange, veryHigh → red, unstable → purple, disconnected → pink-red, warmingUp → blue, null → gray
- **No events/slots**: Pure presentational component

### useResponsiveSidebar Composable
- **File**: `app/composables/useResponsiveSidebar.ts`
- **Breakpoint**: 980px (matches CSS `@media (max-width: 980px)`)
- **Resize detection**: `window.addEventListener("resize")` with `requestAnimationFrame` throttling
- **Cleanup**: `onScopeDispose()` removes listener and cancels pending rAF
- **Auto-close on navigation**: `router.afterEach()` closes sidebar on mobile
- **SSR**: `isMobile` defaults to `false` on server; client hydration updates to correct value

### EmptyState Component
- **File**: `app/components/shared/EmptyState.vue`
- **Pattern**: Presentational-only component — no script setup, no interactivity
- **Visual**: Radar animation (72×72px circle with spinning sweep line) + text
- **Animation**: CSS `@keyframes radar-spin` (2.8s linear infinite)
- **Reduced motion**: Disabled by `prefers-reduced-motion: reduce` media query in `dashboard.css`

### Dashboard CSS Conventions (M2-T2 additions)
- **Status dot states**: `.status-dot.state-{qualityState}` — 7 quality states + default gray
- **Client group**: `.client-group`, `.client-group-header`, `.client-count-badge`, `.chevron-icon`
- **Monitor row**: `.monitor-row-wrapper`, `.monitor-row`, `.monitor-row.dimmed`, `.monitor-row.selected`
- **Empty state**: `.empty-state`, `.empty-radar` with `@keyframes radar-spin`
- **Mobile sidebar**: `.sidebar-overlay`, `.sidebar-mobile`, `.sidebar-mobile.open`, `.sidebar-mobile-close`
- **Mobile breakpoint**: `@media (max-width: 980px)` — hides desktop sidebar, shows hamburger button

### ADRs — M2-T2 Sidebar

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-044 | DashboardSidebar + SidebarContent Split | Responsive wrapper (DashboardSidebar) delegates content to shared SidebarContent component; eliminates layout duplication between desktop and mobile |
| ADR-045 | localStorage for Monitor Toggle State | Monitor visibility preferences persisted to localStorage with SSR-safe guards; auto-shows-all on first load |
| ADR-046 | Inline Name Editing via Events | ClientGroup emits rename events; SidebarContent owns the API call; optimistic update with rollback on failure |
| ADR-047 | Toggle Button with Click Isolation | MonitorRow toggle uses @click.stop to prevent navigation; dimmed visual state (opacity 0.35) for hidden monitors |

*Last updated: 2026-08-05 (Agent 04 — M2-T2 sidebar conventions appended)*

## LNPM Cloud Dashboard — New Conventions (2026-08-05, M2-T3)

### Multi-Threshold Lines in uPlot Charts (M2-T3)

`LatencyChart.vue` now supports both single and multi-threshold rendering via uPlot's `drawClear` hook.

#### Threshold Prop Pattern
- **`thresholdValue`** (single, backward compat): Optional `number | null` prop. When set and `thresholdValues` is empty, draws one dashed red line.
- **`thresholdValues`** (multi, takes precedence): Optional `number[]` prop. When non-empty, overrides `thresholdValue`. Each value draws a separate dashed horizontal line.
- **Resolution logic**: `thresholdValues.length > 0` → use `thresholdValues`; else if `thresholdValue != null` → wrap in `[thresholdValue]`; else → no thresholds.
- **Implementation**: `drawClear` hook iterates over thresholds, drawing each as a dashed horizontal line at the Y coordinate.

#### Threshold Color Mapping
Hard-coded `THRESHOLD_COLORS` record in `LatencyChart.vue`:

| Value (ms) | Color (rgba) | Design Token | Meaning |
|------------|-------------|--------------|---------|
| 50 | `rgba(69, 223, 194, 0.45)` | `--accent` (teal) | Good |
| 100 | `rgba(246, 169, 74, 0.45)` | `--warning` (yellow) | Caution |
| 150 | `rgba(249, 115, 22, 0.45)` | Orange | Elevated |
| 200 | `rgba(255, 107, 120, 0.45)` | `--danger` (red) | Bad |

**Style**: Dashed `[8, 4]` pattern, `lineWidth: 1`, 0.45 alpha for all known thresholds. Unknown values use fallback `rgba(239, 68, 68, 0.6)` (red).

### Legend Toggle Interaction (M2-T3)

`AllMonitorsChart` legend items are now clickable to toggle monitor visibility, wired to `useMonitors()` composable.

#### Toggle Integration Pattern
- **`useMonitors()`** returns `toggleMonitor(id)`, `isVisible(id)` — shared singleton composable with localStorage persistence
- **Visibility filtering**: `seriesConfig` computed filters by `isVisible(m.id)`; `chartData` computed filters entries by `isVisible(id)` before merging
- **Color stability**: Uses `props.monitors.indexOf(m)` (original array index) for `getPaletteColor()` — prevents colors from shifting when monitors are toggled. **Critical:** Never use the filtered index — always use the original monitor array position.
- **Empty handling**: When all monitors are hidden, `chartData` returns `[new Float64Array(0)]` — uPlot handles gracefully

#### Legend Accessibility Pattern
- **Interactive elements**: Each legend item has `role="button"`, `tabindex="0"`, `aria-pressed="true/false"`, and `aria-label="Toggle {name}"`
- **Keyboard support**: `@keydown.enter.prevent` and `@keydown.space.prevent` handlers toggle the monitor
- **Visual state**: `.chart-legend-item--hidden` class applies `opacity: 0.4` + `text-decoration: line-through` for hidden monitors
- **CSS transitions**: `transition: opacity 140ms ease` on `.chart-legend-item` for smooth toggle state changes

### Multi-Series Data Merging with NaN Gaps (M2-T3)

When combining multiple monitor time series into a single uPlot dataset:

1. **Filter by visibility** — only include monitors where `isVisible(id)` is true
2. **Collect all unique timestamps** into a `Set`, then sort numerically
3. **Build merged time column** — `Float64Array` from sorted timestamps
4. **Build value columns per monitor** — use `Map<number, number>` (timestamp → index) for O(1) lookup; fill with `NaN` for missing timestamps
5. **Return** — `[mergedTime, ...seriesColumns]`

**NaN handling**: uPlot treats `NaN` as a gap — breaks the line at that point (spanGaps behavior). This allows monitors with different data points to share a unified X-axis.

### Contract Testing for uPlot Components (M2-T3)

uPlot components require a canvas DOM context — testing rendering directly in Vitest's node environment is complex. Instead, test the **logic contracts**:

- **Threshold tests** (`LatencyChart.test.ts`): Test the color mapping constants and threshold resolution logic as pure functions
- **Visibility tests** (`AllMonitorsChart.test.ts`): Test visibility filtering, palette stability, and data merging logic without mounting components
- **Pattern**: Extract or duplicate the logic (threshold colors, resolution function) and test the contract — not the rendering

### ADRs — M2-T3 All-Monitors Chart

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-048 | Multi-Threshold via drawClear Hook | uPlot's drawClear hook draws dashed horizontal lines for arbitrary Y-values; color-mapped to design tokens with 0.45 alpha |
| ADR-049 | Original Index for Palette Color Stability | `props.monitors.indexOf(m)` for `getPaletteColor()` — same monitor always gets same color regardless of which other monitors are visible |
| ADR-050 | NaN Gaps for Multi-Series Alignment | Shared X-axis with NaN values for missing timestamps per monitor; uPlot handles gaps natively via spanGaps |
| ADR-051 | Legend Toggle via useMonitors Integration | AllMonitorsChart wires into useMonitors() composable for toggle state; clickable legend items with full accessibility (role, aria-pressed, keyboard) |

*Last updated: 2026-08-05 (Agent 04 — M2-T3 chart conventions appended)*

## LNPM Cloud Dashboard — New Conventions (2026-08-06, M2-T4)

### Detail View Pattern — useAsyncData with Reactive Key (M2-T4)

The monitor detail view (`app/pages/monitors/[id].vue`) demonstrates the reactive `useAsyncData` pattern for time-windowed data.

#### Reactive Key Pattern

```typescript
const route = useRoute();
const monitorId = computed(() => Number(route.params.id));
const { selectedPreset: timeWindow, fromMs, toMs } = useTimeWindow();

const { data: historyData, status } = useAsyncData<HistoryResponse>(
  () => `monitor-detail-${monitorId.value}-${timeWindow.value}`,
  async () => {
    return await $fetch<HistoryResponse>(`/api/monitors/${monitorId.value}`, {
      query: { fromMs: fromMs.value, toMs: toMs.value, maxPoints: 2000 },
    });
  },
);
```

**Key insight:** The async data key uses the **time window preset name** (e.g., `"1h"`, `"24h"`) — NOT `fromMs`/`toMs` values. This is critical because:
- `fromMs` and `toMs` are computed from `Date.now()` — they change on every reactive update, which would invalidate the cache and cause constant re-fetches
- The preset name is stable — it only changes when the user explicitly selects a different time range
- This pattern is essential for any page that fetches time-windowed data

#### Data Extraction via Computed Properties

```typescript
const targetName = computed(() => {
  const seriesArr = historyData.value?.series ?? [];
  return seriesArr[0]?.target?.name ?? "Unknown";
});

const defaultSummary: RangeSummary = {
  sampleCount: 0, successCount: 0, failureCount: 0, packetLossPercent: 0,
  averageLatencyMs: null, minimumLatencyMs: null, maximumLatencyMs: null, p95LatencyMs: null,
  stableMs: 0, unstableMs: 0, disconnectedMs: 0,
  stablePercent: 0, unstablePercent: 0, disconnectedPercent: 0,
};

const summary = computed<RangeSummary>(() => {
  const seriesArr = historyData.value?.series ?? [];
  return seriesArr[0]?.summary ?? defaultSummary;
});
```

**Key patterns:**
- All derived values are **computed properties** — cached, reactive, null-safe
- **Default fallback values** prevent child component errors when data is loading or empty
- The `defaultSummary` object is defined inline (not imported) to avoid circular dependencies
- **Defensive optional chaining**: `historyData.value?.series ?? []` — never access `.series[0]` directly on a potentially null object

#### 404 Redirect Pattern

```typescript
if (monitorId.value <= 0) {
  navigateTo("/");
}
```

**Pattern:** Validate the route parameter in the script setup block and redirect to the home page if invalid. This guards against malformed URLs (non-numeric IDs, negative numbers) before the API is called.

### MonitorHeader Component Pattern (M2-T4)

- **File**: `app/components/charts/MonitorHeader.vue`
- **Props**: `targetName`, `targetHost`, `qualityState`, `latestLatency`, `lastSeenMs`
- **Computed**: `qualityStateLabel` (human-readable), `latencyColor` (accent/warning/danger), `lastSeenRelative` (relative time string)
- **Pattern**: Presentational component — no events, no slots, no interactivity. Takes raw data and formats it for display.
- **Relative time**: Computed `lastSeenRelative` converts epoch-ms to human-readable relative time (`"5s ago"`, `"3m ago"`, `"2h ago"`)
- **Latency color thresholds**: `< 50ms` → accent, `< 150ms` → warning, `≥ 150ms` → danger

### MonitorSummary Component Pattern (M2-T4)

- **File**: `app/components/charts/MonitorSummary.vue`
- **Props**: `summary: RangeSummary` — single prop containing all metrics
- **Pattern**: 9-card grid layout with color-coded values based on metric thresholds
- **Color coding**:
  - Packet loss: 0% → accent, ≤5% → warning, >5% → danger
  - P95 latency: <150ms → accent, <300ms → warning, ≥300ms → danger
  - Max latency: >300ms → danger
  - Stable: always accent (green)
  - Unstable: warning when >0%, Disconnected: danger when >0%
- **Null-safe**: Shows "—" for null values (latency fields are nullable)
- **Data attributes**: `data-testid="monitor-summary"` for E2E testing

### Shared Types — RangeSummary (M2-T4)

- **`RangeSummary`**: `sampleCount`, `successCount`, `failureCount`, `packetLossPercent`, `averageLatencyMs` (nullable), `minimumLatencyMs` (nullable), `maximumLatencyMs` (nullable), `p95LatencyMs` (nullable), `stableMs`, `unstableMs`, `disconnectedMs`, `stablePercent`, `unstablePercent`, `disconnectedPercent`
- Nullable latency fields (avg, min, max, p95) — the API returns `null` when no successful samples exist in the range
- Percentages are always numbers (0 default) — never null
- **Location**: `shared/types.ts`

### ADRs — M2-T4 Detail View

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-052 | useAsyncData Key with Time Preset | Key uses the preset name (e.g., "1h") not Date.now()-based values — prevents constant re-fetches on every render |
| ADR-053 | Computed Properties with Default Values | All data extraction uses computed properties with fallback defaults — prevents null errors in child components |
| ADR-054 | navigateTo() for Invalid Monitor IDs | Invalid IDs (≤0) redirect to home in the script setup block — simple, declarative, pre-API validation |
| ADR-055 | Monitor Summary as 9-Card Grid | Range summary metrics displayed as 9 color-coded stat cards; matches desktop app's summary panel layout |

*Last updated: 2026-08-06 (Agent 04 — M2-T4 detail view conventions appended)*

## LNPM Cloud Dashboard — New Conventions (2026-08-06, M2-T5)

### Live Chart Bridge — useLiveChart (M2-T5)

The `useLiveChart` composable (`app/composables/useLiveChart.ts`) is the centralized bridge between WebSocket live data and chart components. It consumes `useWebSocket()` internally and exposes reactive per-monitor time series data.

#### Architecture

- **Single bridge**: One composable instance manages all WebSocket-to-chart data flow — DRY across all chart components
- **Internal `useWebSocket()`**: `useLiveChart` calls `useWebSocket()` and registers `onSample()` / `onSnapshot()` callbacks
- **Per-monitor data store**: `Map<monitorId, { timestamps: Float64Array; values: Float64Array }>` — `Float64Array` for zero-copy uPlot integration
- **Bounded at 2000 points**: `MAX_POINTS_PER_MONITOR = 2000` — oldest points dropped when exceeded
- **rAF-debounced updates**: `scheduleUpdate()` uses `requestAnimationFrame` with a `pendingUpdate` flag — only one update call per frame

#### API

```typescript
const {
  liveData,              // Ref<Map<number, { timestamps: Float64Array; values: Float64Array }>>
  subscribedMonitorIds,  // Ref<Set<number>>
  subscribe(monitorId),  // Subscribe to live feed
  unsubscribe(monitorId), // Unsubscribe
  isSubscribed(monitorId), // Check subscription
  onUpdate(callback),     // Register rAF update callback
  offUpdate(callback),    // Remove update callback
  connectionState,        // Delegated from useWebSocket
} = useLiveChart();
```

#### Integration Pattern

**AllMonitorsChart** (multi-monitor):
- Auto-subscribe to visible monitors on monitor list changes
- `chartData` computed: prefers `liveData` over HTTP-fetched data
- `onUpdate(() => chartRef.value?.updateChart())` for rAF-debounced chart updates
- `onBeforeUnmount(() => offUpdate(...))` for cleanup

**Single monitor page** (`monitors/[id].vue`):
- Subscribe on `monitorId` watch (immediate)
- `chartData` computed: `liveData` if available, else `transformToUPlotData(historyData)`
- `onUpdate(() => chartRef.value?.updateChart())` for rAF-debounced chart updates

#### Key Design Decisions

- **rAF callbacks over reactive watch**: `onUpdate(callback)` with `requestAnimationFrame` is used instead of `watch(liveData, ..., { deep: true })`. This batches updates to one per frame and avoids Vue reactivity overhead on high-frequency data.
- **Float64Array for chart data**: Typed arrays match uPlot's expected format — zero-copy on `setData()`, better memory efficiency.
- **Live data preference**: Chart computed properties check `liveData` first, then fall back to HTTP data. This provides seamless transition from initial load (HTTP) to live updates (WebSocket).
- **Centralized bridge**: All chart components consume `useLiveChart()` — no direct `useWebSocket()` usage in chart components. This avoids duplicate connections and subscription management.

### Sidebar Live Name Updates (M2-T5)

`SidebarContent` listens for `client_name_updated` WebSocket messages to update sidebar client names in real time:

```typescript
const { onClientNameUpdated } = useWebSocket();
onClientNameUpdated((clientSlug, newName) => {
  const group = groupedByClient.value.find(g => g.clientSlug === clientSlug);
  if (group) group.clientName = newName;
});
```

- **Direct mutation**: Updates `groupedByClient` array directly — Vue's reactivity propagates the change
- **No API call needed**: WebSocket message is the source of truth; server broadcasts to all connected clients
- **Cross-tab sync**: All open browser tabs receive the update simultaneously

### ADRs — M2-T5 Live Chart Updates

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-056 | Centralized useLiveChart Bridge | Single composable bridges WebSocket to all chart components; avoids duplicate connections and subscription management |
| ADR-057 | rAF-Debounced Update Callbacks | requestAnimationFrame batches chart updates to one per frame; prevents Vue reactivity overhead on high-frequency data |
| ADR-058 | Bounded Live Data (2000 points) | Memory-safe accumulation with oldest-point eviction on capacity; matches history API's maxPoints |
| ADR-059 | Live-over-HTTP Data Priority | Computed properties check liveData first; HTTP data provides initial load only; seamless transition |

*Last updated: 2026-08-06 (Agent 04 — M2-T5 live chart conventions appended)*

## LNPM Cloud Dashboard — New Conventions (2026-08-06, M2-T6)

### Client Settings API — GET Endpoint (M2-T6 / F9)

The `GET /api/clients/:slug/settings` endpoint returns the full `ClientSettings` object with identity fields, sync configuration, and a computed `sync_status`.

#### GET Settings Endpoint Pattern
- **File**: `server/api/clients/[slug].settings.get.ts`
- **Pattern**: Parse slug → `getClientBySlug()` → compute `sync_status` → return `ClientSettings` object
- **`computeSyncStatus(syncEnabled, lastSyncedAtMs, syncIntervalMin)`**: Pure function returning one of `"connected"`, `"disconnected"`, `"syncing"`, `"disabled"`, `"not_configured"`
- **Threshold**: `2 * sync_interval_min * 60000` ms — if `now - lastSyncedAtMs > threshold`, status is `"disconnected"`
- **Status computation logic**: `disabled` (if not enabled) → `not_configured` (if never synced) → `disconnected` (if beyond threshold) → `connected` (default)
- **Returns**: Full `ClientSettings` interface with all identity fields, sync config, computed status, and ISO 8601 timestamps (`created_at`, `updated_at`)
- **404 handling**: Returns 404 if client not found (via `getClientBySlug()` returning null)

#### SyncStatus Type (shared/types.ts)
- **`SyncStatus`**: `"connected" | "disconnected" | "syncing" | "disabled" | "not_configured"`
- **`ClientSettings`**: Full settings interface with `clientId`, `slug`, `name`, `username`, `hostname`, `mac_address`, `sync_enabled`, `sync_interval_min`, `backend_url`, `last_synced_at_ms` (nullable), `sync_status`, `created_at`, `updated_at`
- **Location**: `shared/types.ts` — shared between server and client

#### PUT Settings Endpoint — WebSocket Broadcast
- **File**: `server/api/clients/[slug].settings.put.ts`
- **After successful update**: Calls `broadcastSettingsUpdate(slug, settings)` to notify all connected WebSocket peers
- **Fixed allowed intervals**: `[1, 5, 10, 15, 30, 60]` — per F9 spec (no `2` minute option)
- **Localhost HTTP exception**: `backend_url` validation allows HTTP for `localhost`, `127.0.0.1`, `::1`, `[::1]` — development convenience

#### WebSocket Settings Broadcast
- **File**: `server/ws/ping.ts` → `export function broadcastSettingsUpdate(slug, settings)`
- **Message shape**: `{ type: "client_settings_updated", slug, sync_enabled, sync_interval_min, backend_url }`
- **Broadcast scope**: Global — iterates ALL monitor subscription sets (not just one monitor)
- **Safe iteration**: `[...subscriptions.keys()]` (copy of keys) and `[...subSet]` (copy of set) to avoid concurrent modification
- **Pattern**: Exported function for cross-module import — same pattern as `broadcastSample()`

### useClientSettings Composable (M2-T6)
- **File**: `app/composables/useClientSettings.ts`
- **API**: Returns `{ settings, loading, error, fetchSettings, updateSettings }`
- **`fetchSettings(slug)`**: GET endpoint call with `loading`/`error` state management
- **`updateSettings(slug, data)`**: PUT with **optimistic update** → server response merge → **rollback on error**
- **Optimistic update**: Sets `sync_status` to `"syncing"` immediately, resets to `"connected"`/`"disabled"` after 2s delay
- **Error handling**: If `settings` is null (not loaded), returns `false` with error message "Settings not loaded. Call fetchSettings first."
- **Pattern**: Centralized composable — parent components bind to reactive refs and call methods

### ClientIdentity Component (M2-T6)
- **File**: `app/components/clients/ClientIdentity.vue`
- **Props**: `client: { slug, name, username, hostname, mac_address }`
- **Pattern**: Read-only display, no events/slots, pure presentational component
- **Uses existing CSS**: `.client-info-card` and `.client-info-field` classes from `dashboard.css`
- **data-testid**: `data-testid="client-identity"` for E2E testing

### SyncStatusIndicator — 5-State Pattern (M2-T6)
- **File**: `app/components/clients/SyncStatusIndicator.vue`
- **5 states**: `connected` (green), `disconnected` (red), `syncing` (yellow, pulsing), `disabled` (gray), `not_configured` (gray)
- **Uses shared `SyncStatus` type** from `shared/types.ts`
- **Computed**: `statusText` (human-readable label), `statusClass` (CSS class)
- **Pulsing animation**: `.pulsing` class on dot only for `syncing` state

### SyncSettingsForm — URL Validation with Localhost Exception (M2-T6)
- **File**: `app/components/clients/SyncSettingsForm.vue`
- **URL validation**: `new URL(url)` parse → protocol check → localhost exception for HTTP
- **Localhost hosts**: `localhost`, `127.0.0.1`, `::1`, `[::1]` — these allow HTTP URLs
- **Allowed intervals**: `[1, 5, 10, 15, 30, 60]` (F9 spec)
- **Emit pattern**: Emits `saved` event on successful form submission for parent to refresh data
- **Validation matches backend**: Frontend and backend use identical validation logic for URL and intervals

### Settings Page — Data Flow Pattern (M2-T6)
- **File**: `app/pages/clients/[slug]/settings.vue`
- **Data source**: `useAsyncData` fetches from `GET /api/clients/:slug` (not the dedicated GET settings endpoint)
- **syncStatus computed**: Derives 5-state status inline (same logic as the GET endpoint)
- **identityData computed**: Extracts read-only identity fields for `ClientIdentity` component
- **initialSettings computed**: Transforms API response into form-friendly values
- **Refresh on save**: `handleSettingsSaved()` calls `refreshNuxtData()` to re-fetch data
- **Key pattern**: `` `client-settings-${slug.value}` `` — stable key for `useAsyncData`/`refreshNuxtData`

### ADRs — M2-T6 Client Settings Page

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-060 | GET Settings Endpoint with Computed sync_status | Dedicated endpoint returns full ClientSettings with server-side status computation; status is consistent across all clients and tabs |
| ADR-061 | 5-State Sync Status Enum | connected/disconnected/syncing/disabled/not_configured — comprehensive state coverage per F9 spec |
| ADR-062 | computeSyncStatus as Pure Function | Standalone function with no side effects; threshold-based disconnect detection (2× interval); testable in isolation |
| ADR-063 | Global WebSocket Settings Broadcast | Settings changes broadcast to ALL connected peers (not per-monitor); settings updates are cross-cutting concerns |
| ADR-064 | Optimistic Updates with Rollback | useClientSettings composable applies changes immediately; rollback on error ensures data consistency |
| ADR-065 | ClientIdentity as Read-Only Display | Dedicated component for identity fields; reuses existing CSS classes; no interactivity |
| ADR-066 | HTTP Allowed for Localhost URLs | Pragmatic exception for development; identical validation in frontend and backend |

*Last updated: 2026-08-06 (Agent 04 — M2-T6 client settings conventions appended)*

## LNPM Cloud Dashboard — New Conventions (2026-08-06, M2-T7)

### Global WebSocket Peer Tracking — allPeers Set (F11)

The WebSocket handler (`server/ws/ping.ts`) now maintains two peer tracking structures:

1. **Per-monitor subscription map** (`Map<number, Set<WebSocket>>`) — for monitor-scoped broadcasts (`broadcastSample`)
2. **Global peer set** (`Set<WebSocket>` as `allPeers`) — for global broadcasts (`broadcastClientNameUpdated`, `broadcastSettingsUpdate`)

```typescript
// Global peer set — tracks ALL connected WebSocket peers
const allPeers = new Set<WebSocketType>();

// In open():
const ws: WebSocketType = (peer as any).ws;
allPeers.add(ws);

// In close():
allPeers.delete(ws);
```

- **Populated on `open()`**: Same WebSocket extraction (`(peer as any).ws`) as the monitor subscription map
- **Cleaned up on `close()`**: Same cleanup path — `allPeers.delete(ws)` before iterating subscription sets
- **Broadcast function**: `broadcastClientNameUpdated(clientSlug, newName)` iterates `[...allPeers]` (copy) to send to every connected peer
- **Why separate from subscription map**: Client name changes are globally relevant — every connected dashboard tab should reflect the change, not just tabs subscribed to specific monitors. The per-monitor subscription map cannot iterate "all unique peers" without de-duplication.

### Global Broadcast Pattern

```typescript
export function broadcastClientNameUpdated(clientSlug: string, newName: string): void {
  const message = { type: "client_name_updated", clientSlug, newName };
  const payload = JSON.stringify(message);

  // Iterate a copy — the set may change during iteration
  for (const ws of [...allPeers]) {
    try {
      if (ws.readyState === 1) { // OPEN
        ws.send(payload);
      }
    } catch (err) {
      warn(`Broadcast client_name_updated failed: ${errMessage}`);
    }
  }
}
```

- **Exported function**: Same pattern as `broadcastSample()` — exported from `server/ws/ping.ts`, imported by API endpoints
- **Safe iteration**: `[...allPeers]` copy avoids concurrent modification if a peer disconnects mid-broadcast
- **ReadyState check**: `ws.readyState === 1` (OPEN) before sending
- **Error handling**: Per-peer try/catch — one failure doesn't stop the broadcast

### New WebSocket Message Type: client_name_updated

- **`WsOutboundType`** now includes `"client_name_updated"` in `shared/types.ts`
- **Message shape**: `{ type: "client_name_updated", clientSlug: string, newName: string }`
- **Frontend handler**: `useWebSocket()` exposes `onClientNameUpdated(callback)` — called by `SidebarContent.vue` to update sidebar names reactively
- **Cross-tab sync**: All open browser tabs receive the update simultaneously via WebSocket

### Endpoint Broadcast Integration Pattern

```typescript
// server/api/clients/[slug].name.put.ts
import { broadcastClientNameUpdated } from "../../ws/ping";

// ... after successful update:
const row = updateClientName(slug, trimmed);
if (!row) throw createError({ statusCode: 404, message: "Client not found" });

broadcastClientNameUpdated(row.slug, row.name);

return toClientResponse(row);
```

- **Direct import**: `import { broadcastClientNameUpdated } from "../../ws/ping"` — no dynamic import needed (unlike `broadcastSample` which uses dynamic import to avoid circular dependencies)
- **After DB update**: Broadcast only fires after `updateClientName()` succeeds — no broadcast for failed operations
- **Non-blocking**: Broadcast is fire-and-forget; failure doesn't affect API response
- **Uses updated row**: Passes `row.slug` and `row.name` from the database — the source of truth

### ADRs — M2-T7

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-067 | Global allPeers Set for Non-Monitor Broadcasts | Separate `Set<WebSocket>` tracks all connected peers; enables global broadcasts (name updates, settings) independent of monitor subscriptions |
| ADR-068 | client_name_updated WebSocket Message Type | New message type in `WsOutboundType` union; `{ clientSlug, newName }` shape; enables real-time sidebar name updates across all tabs |

*Last updated: 2026-08-06 (Agent 04 — M2-T7 inline client name edit conventions appended)*

## LNPM Cloud Dashboard — New Conventions (2026-08-06, M2-T8)

### API Endpoint Display in Dashboard Header (M2-T8)

The dashboard header now displays the Nitro ingest endpoint URL (`POST /api/ping/ingest`) with a one-click copy-to-clipboard button. This surfaces the URL operators need to configure LNPM Tauri clients on remote computers.

#### useRequestURL() for Dynamic URL Construction

- **File**: `app/components/layout/DashboardHeader.vue`
- **Pattern**: `useRequestURL()` returns `{ protocol, host, path }` of the current request — use it to construct endpoint URLs that work across any deployment without env vars or runtime config
- **Usage**: `const u = useRequestURL(); return \`${u.protocol}//${u.host}/api/ping/ingest\`;`
- **Works on**: localhost (`http://localhost:3000`), LAN IP (`http://192.168.1.50:3000`), reverse-proxy domain (`https://dashboard.example.com`) — no configuration needed
- **Safe in computed**: `useRequestURL()` returns immediately — safe inside `computed()` without async wrapping

#### Clipboard API with Fallback Pattern

- **Primary**: `navigator.clipboard.writeText(url)` — works in secure contexts (HTTPS, localhost)
- **Fallback**: `textarea + document.execCommand("copy")` — for non-secure contexts where Clipboard API throws
- **Pattern**: `try { clipboard API } catch { textarea fallback } catch { console.warn + return }`
- **Important**: On localhost without HTTPS, `navigator.clipboard.writeText()` throws — the fallback path is essential for local development

#### ClientOnly with Static Fallback for Dynamic URLs

- **Pattern**: Same as connection-status pill — wrap client-side-only content in `<ClientOnly>` with a `#fallback` slot containing static HTML
- **Why**: The URL is request-dependent — SSR output doesn't know the client's request URL. Without `<ClientOnly>`, Vue hydration mismatches occur
- **Fallback**: Static "API endpoint" label only — no URL, no button. Matches the SSR output structure

#### Visual Feedback with Auto-Reset

- **Pattern**: `ref(false)` + `setTimeout(() => ref.value = false, 1500)` for temporary visual feedback states
- **Usage**: Copy button icon changes 📋 → ✓ for 1.5s, then resets
- **Screen reader**: `aria-live="polite"` region announces "Copied!" text, resets after same delay

#### CSS Conventions

- **`.api-endpoint`**: Pill-shaped container (border, rounded corners, subtle background) with `max-width: 480px`
- **`.api-endpoint-url`**: Monospace `<code>` with `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` for long URL truncation
- **`.copy-btn`**: 30×30px button with `aria-pressed` state styling, hover/focus transitions
- **`.sr-only`**: Standard screen-reader-only utility class (1px × 1px, clip, overflow hidden)
- **Mobile breakpoint**: `@media (max-width: 767px)` hides `.api-endpoint-label` (keep URL + button visible)

### ADRs — M2-T8 API Endpoint Display

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-069 | useRequestURL() for Endpoint URL | Auto-detects protocol/host from current request — no env vars or runtime config needed; works on any deployment |
| ADR-070 | Clipboard API with execCommand Fallback | navigator.clipboard.writeText() for secure contexts; textarea fallback for non-secure; two-layer error handling |
| ADR-071 | ClientOnly with Static Fallback for URLs | Prevents hydration mismatch — SSR doesn't know the client request URL; static fallback matches SSR output structure |

*Last updated: 2026-08-06 (Agent 04 — M2-T8 API endpoint display conventions appended)*
