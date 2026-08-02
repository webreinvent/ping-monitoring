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
│   ├── plugins/            # Nitro plugins (database.ts)
│   ├── utils/              # Server utilities (db.ts, logger.ts)
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
- Template in `dashboard/.env.example` — 14 variables across 8 categories
- Always validate env vars before using as numbers (`parseInt` silently produces `NaN`)
- Key variables: `DATABASE_PATH`, `LOG_LEVEL`, `PORT`, `WS_HEARTBEAT_INTERVAL_MS`, `INGEST_MAX_SAMPLES`

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
- `dashboard/server/utils/db.ts` — Typed DB accessor (`getDb()`)
- `dashboard/server/utils/logger.ts` — Structured logger
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

*Last updated: 2026-08-02 (Agent 14 — M1-T4 health endpoint conventions, F14 extended metrics, version caching IIFE, health test patterns, lessons learned)*
