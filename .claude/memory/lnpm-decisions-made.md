# LNPM Cloud Dashboard — Decisions Made

> Saved: 2026-08-02
> Task: M1-T4 — Build health check endpoint with server metrics

## Technology Stack Decisions

### Nuxt 4 with Nitro Server (M1-T1)
- **Decision:** Use Nuxt 4 + Nitro server for the cloud dashboard backend
- **Rationale:** Leverages existing Vue 3 frontend skills, provides built-in API routing, WebSocket support, and server plugins
- **Key config:** `nitro.serverAssets` for server-only files, `@nuxt/nitro-server` preset for persistent Node.js runtime (not serverless)
- **Impact:** All API routes follow Nitro conventions (`server/api/*.get.ts`)

### SQLite with better-sqlite3 (M1-T2)
- **Decision:** Use SQLite via `better-sqlite3` (synchronous Node.js binding)
- **Rationale:** Simple deployment (single file database), WAL mode for concurrent reads, no external database server needed
- **Key config:** WAL mode enabled, database path configurable via `DATABASE_PATH` env var (default: `.data/lingering.db`)
- **Impact:** Database plugin runs migrations on startup, singleton pattern for connection management

## Architecture Decisions

### Health Check Endpoint Design (M1-T4 / F1 + F14)
- **Decision:** Single endpoint serving both basic health (F1) and extended metrics (F14)
- **Rationale:** External monitoring services (Uptime Robot, Pingdom) need a simple status check; internal dashboards need detailed metrics. One endpoint serves both.
- **Design:** Public access (no authentication), returns 200 with JSON containing both basic and extended fields
- **Error handling:** Returns `{ status: "error", message }` on any failure — the absence of a response IS the failure signal

### Database Connectivity Probe
- **Decision:** Include `SELECT 1` probe in health check to verify database connectivity before gathering metrics
- **Rationale:** Distinguishes between "server is up but DB is down" vs "server is up and healthy"
- **Implementation:** Internal `dbStatus` variable logged but not exposed in response (status is always "ok" if endpoint responds per spec)

### Version Caching at Module Load
- **Decision:** Cache `package.json` version at module load time using IIFE
- **Rationale:** `package.json` doesn't change at runtime; reading file on every request is wasteful
- **Impact:** Eliminates filesystem I/O on every health check call

### Separate getExtendedMetrics() Function
- **Decision:** Extract extended metrics (F14) into a separate `getExtendedMetrics()` function
- **Rationale:** Separation of concerns — basic health probe is lightweight, extended metrics are more expensive but still negligible
- **Impact:** Clean structure, easy to extend or optimize independently

### Uptime Rounding to 2 Decimal Places
- **Decision:** Round `process.uptime()` to 2 decimal places using `Math.round(uptime * 100) / 100`
- **Rationale:** Spec requires 2 decimal places; avoids floating point precision noise in responses

### No Authentication for Health Endpoint
- **Decision:** Health endpoint is publicly accessible with no authentication
- **Rationale:** External monitoring services need to reach the endpoint without credentials; health check responses contain no sensitive data (counts and timestamps only)

## Implementation Decisions

### Error Response Shape
- **Decision:** Error responses return `{ status: "error", timestamp, message }` — a minimal structured response
- **Rationale:** Consistent with success response shape (always contains `status` and `timestamp`), allows callers to distinguish error from success programmatically

### statSync for File Size (Synchronous)
- **Decision:** Use synchronous `fs.statSync()` for database file size
- **Rationale:** Health checks are infrequent (1-5 minutes by external monitors); synchronous call is simpler and negligible overhead
- **Trade-off:** Accepts minor blocking on single-file stat for simplicity

### Database Path Resolution
- **Decision:** Resolve relative `DATABASE_PATH` to absolute path using `path.resolve()`
- **Rationale:** External monitors and dashboards need the full path; relative paths are ambiguous in responses
- **Default:** `.data/lingering.db` when `DATABASE_PATH` is not set

## API Contract Decisions

### last_ingest_time as null for empty database
- **Decision:** Return `null` (not empty string, not 0) when no samples exist
- **Rationale:** Semantically correct — "no ingest time" maps to `null`; callers can distinguish between "never ingested" and "ingested at epoch"

### Response field types
- **Decision:** All counts are numbers (0 for empty), `last_ingest_time` is `string | null`, `uptime` is number (2 decimal places)
- **Rationale:** Matches F14 API contract exactly; consistent with TypeScript interface `HealthResponse`
