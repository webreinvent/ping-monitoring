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

*Last updated: 2026-08-03 (Agent 14 — M1-T10 quality classifier conventions appended)*

## LNPM Cloud Dashboard — New Conventions (2026-08-03, M1-T11)

### Data Retention Cleanup (M1-T11 / F10)

The data retention cleanup task periodically purges old `ping_samples` and `minute_rollups` rows beyond configurable retention periods, preventing unbounded SQLite growth. Implemented as a Nitro plugin scheduling a background task with configurable interval.

#### Background Task Plugin Pattern

- **File**: `server/plugins/retention.ts`
- **Structure**: Nitro plugin (`defineNitroPlugin`) with `setInterval` for recurring execution
- **Lifecycle**:
  1. Read config from env vars on boot
  2. Log initialization info with config values
  3. If `RETENTION_ENABLED=false`, return early with no-op cleanup
  4. Run first cycle immediately on boot (don't wait for first interval)
  5. Schedule recurring cycles via `setInterval(runCycle, intervalMs)`
  6. Return cleanup function to clear interval on shutdown
- **Error resilience**: Each cycle is wrapped in try/catch — a single failure logs an error and continues on the next cycle
- **Pattern**: Background tasks follow the **plugin + utility** separation — business logic in `server/utils/`, Nitro plugin in `server/plugins/`. This matches the `quality-sweep.ts` pattern.

#### Retention Config Interface and Lazy Env Reading

- **File**: `server/utils/retention.ts` → `getRetentionConfig()`
- **Interface**: `RetentionConfig { enabled: boolean, sampleDays: number, rollupDays: number, intervalMin: number, vacuumThreshold: number }`
- **Lazy reading**: Env vars are read fresh each call (no caching) — config changes after server restart are picked up on the next cycle
- **Boolean parsing**: `enabledRaw.toLowerCase() !== "false"` — truthy by default, handles both `"false"` and `"FALSE"`
- **Number validation**: `Number.isFinite(value) && value > 0` with fallback to default — prevents `NaN`, `0`, and negative values
- **Returns**: `RetentionCleanupResult { deletedSamples, deletedRollups, durationMs, vacuumed }`

#### Retention Env Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RETENTION_ENABLED` | `true` | Enable/disable retention cleanup entirely |
| `RETENTION_SAMPLE_DAYS` | `30` | Days to keep raw ping samples |
| `RETENTION_ROLLUP_DAYS` | `90` | Days to keep minute rollups |
| `RETENTION_INTERVAL_MIN` | `60` | Minutes between cleanup cycles |
| `RETENTION_VACUUM_THRESHOLD` | `10000` | Min rows deleted before triggering VACUUM |

#### Transactional Deletion with .changes Counting

- **File**: `server/utils/retention.ts` → `runRetentionCleanup()`
- **Single transaction**: `db.transaction()` wrapping both `DELETE FROM ping_samples` and `DELETE FROM minute_rollups` — atomic, all-or-nothing
- **`.changes` property**: `better-sqlite3` `RunResult.changes` gives deleted row count — no separate COUNT queries needed
- **Cutoff calculation**: `Date.now() - days * 24 * 60 * 60 * 1000` — simple epoch-ms arithmetic
- **VACUUM outside transaction**: SQLite does not allow VACUUM inside a transaction; it runs after, only when `totalDeleted >= vacuumThreshold`
- **VACUUM error handling**: Wrapped in try/catch — VACUUM failure is `warn()` logged but doesn't fail the cycle
- **Duration tracking**: `Date.now() - start` measured across the full cycle; `warn()` if > 5 seconds

#### Plugin Integration Test Pattern

- **File**: `server/plugins/retention.integration.test.ts`
- **Mock `defineNitroPlugin`**: Set `globalThis.defineNitroPlugin = (fn) => fn` in `beforeEach` — Nitro auto-imports this, not available in tests
- **Mock utilities**: `vi.doMock("#server/utils/logger", ...)` and `vi.doMock("#server/utils/retention", ...)` — mock both logger and business logic
- **Test structure**: Import plugin default, invoke it (`plugin()`), verify cleanup function is returned, verify first cycle runs on boot
- **Error handling test**: Mock `runRetentionCleanup` to throw, verify the plugin catches and logs the error without crashing
- **Disabled test**: Set `RETENTION_ENABLED=false`, verify the plugin returns early without scheduling a timer

#### Retention Unit Test Pattern

- **File**: `server/utils/retention.test.ts`
- **`createMockDb(options)`**: Factory function creating a mock `better-sqlite3` Database with configurable `.changes` values
- **`vi.resetModules()` + `await import("./retention")`**: Fresh module import per test group to avoid cached env vars
- **`vi.doMock("./db", () => ({ getDb: () => db }))`**: Mock the DB accessor within each test
- **Config validation tests**: Verify defaults, custom values, invalid values (string, zero, negative), and boolean edge cases (uppercase "FALSE")
- **VACUUM threshold tests**: Set low threshold to trigger VACUUM, verify `exec()` was called; set high threshold to skip, verify it wasn't

### ADRs — Data Retention (M1-T11 / F10)

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-033 | Plugin + Utility Separation for Background Tasks | Business logic in `server/utils/retention.ts`, Nitro plugin in `server/plugins/retention.ts`; matches quality-sweep pattern; enables unit testing without Nitro runtime |
| ADR-034 | Single Transaction for Retention Deletion | `db.transaction()` wraps both DELETE operations; atomic cleanup ensures consistent state; `.changes` property provides counts without extra queries |
| ADR-035 | VACUUM Outside Transaction with Threshold | SQLite restricts VACUUM outside transactions; configurable `RETENTION_VACUUM_THRESHOLD` (default 10000) prevents expensive VACUUM on every cycle; wrapped in try/catch |
| ADR-036 | Lazy Env Var Reading (No Cache) | `getRetentionConfig()` reads env vars fresh each call; no in-memory caching; config changes after restart are picked up immediately |
| ADR-037 | RETENTION_ENABLED Boolean Flag | Single env var for complete enable/disable; truthy by default; prevents tight-loop CPU exhaustion from misconfiguration |
