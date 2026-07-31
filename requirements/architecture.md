# LNPM Cloud Dashboard — Architecture

## 1. Project Structure

Dashboard files live in `./dashboard/` at the project root. The existing LNPM desktop app remains untouched.

```
ping-monitoring/
├── ...                    # existing LNPM desktop app (unchanged)
├── dashboard/             # cloud dashboard (Nuxt + Nitro server)
│   ├── server/            # API routes, WebSocket, database
│   ├── app/               # web dashboard UI (pages, components)
│   └── shared/            # shared types and utilities
├── requirements/          # requirements documentation
└── docs/                  # design specs
```

## 2. System Architecture

```
+---------------------+       POST /api/ping/ingest       +-------------------------+
|                     |  (batched, retry w/ backoff)      |                       |
|  LNPM Desktop Client|---------------------------------->|  Nuxt + Nitro Backend  |
|                     |                                    |                       |
|  +-----------------+|                                    |  +------------------+ |
|  | Local SQLite    ||                                    |  | SQLite (WAL)     | |
|  | (ping_samples)  ||                                    |  | .data/lingering.db| |
|  +-----------------+|                                    |  +------------------+ |
|                     |                                    |                       |
|  - BatchBuffer      |                                    |  - /api/ping/ingest   |
|    (10 samples | 5s)|                                    |  - /api/monitors      |
|  - SyncService      |                                    |  - /api/monitors/:id  |
|  - Retry (3x exp)   |                                    |  - /ws/ping           |
|  - Startup recovery |                                    |  - /api/health        |
|                     |<-----------------------------------|                       |
+---------------------+   WebSocket /ws/ping (live)       +-------------------------+
                           (per-monitor broadcast)
                                    |
                           +-------------------------+
                           |                         |
                           |  Web Dashboard (Browser)|
                           |                         |
                           |  - Sidebar (by client)  |
                           |  - All Monitors Chart   |
                           |  - Per-Monitor View     |
                           |  - uPlot charts         |
                           |  - Live WS updates      |
                           |                         |
                           +-------------------------+
```

### Data flow

1. **LNPM Desktop Client** runs ICMP pings locally, stores raw `PingSample` rows in its own SQLite database with `cloud_synced_at_ms = NULL`.
2. **BatchBuffer** flushes when 10 samples accumulate OR 5 seconds elapse (whichever first).
3. **SyncService** POSTs the batch to `POST /api/ping/ingest` on the cloud backend.
4. **Backend** validates, deduplicates via `INSERT OR IGNORE`, auto-creates monitors for new target hosts, and persists to SQLite.
5. **WebSocket** server broadcasts the new sample to all connected dashboard clients subscribed to that monitor.
6. **Web Dashboard** receives WS events and updates the uPlot chart in real time.
7. On client **startup**, SyncService sends all unsynced samples from the last hour before entering normal buffered sync.

---

## 2. Tech Stack Justification

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Framework** | Nuxt + Nitro | Single codebase for API and UI. Nitro provides native WebSocket support, persistent Node.js runtime (`node-server` preset), and built-in HTTP server — no separate Express/Fastify needed. |
| **Runtime** | Node.js (persistent) | WebSocket requires long-lived connections. Nitro's `node-server` preset runs as a persistent process, not serverless. |
| **Database** | SQLite (`better-sqlite3`) | Single-file storage with zero ops. WAL mode supports concurrent reads/writes. Sufficient for a monitoring dashboard with bounded data (retention cleanup). No Redis needed — in-memory LRU cache covers hot data. |
| **Caching** | In-memory LRU | No external cache service. Recent monitor state and rollups stay in process memory. Eviction on max size. Keeps the deployment simple — one process, one file. |
| **Real-time** | Nitro native WebSocket | Built into Nitro via `server/ws/` routes. No Socket.io or separate WS server needed. Per-monitor subscriptions via topic-based fan-out. |
| **Charts** | uPlot | Already used in the LNPM desktop client. Extremely fast (WebAssembly-free, Canvas-based), small bundle. Mirrors the desktop UI exactly. |
| **Frontend** | Nuxt + Vue | Same framework as backend. Dashboard UI mirrors the LNPM desktop app design. Shared types and components between server and client via Nuxt's full-stack model. |
| **Language** | TypeScript | End-to-end type safety from ingest payload to chart data. Already used in the desktop client (`src/types.ts`). |
| **Package Manager** | pnpm | Already configured (`packageManager: pnpm@11.9.0` in `package.json`). |

---

## 3. Directory Structure

```
ping-monitoring/
├── requirements/                      # Requirements documentation
│   ├── architecture.md                # This file
│   ├── api/                           # API contracts (future)
│   ├── data-models/                   # Data model specs (future)
│   ├── deployment/                    # Deployment docs (future)
│   ├── features/                      # Feature specs (F1–F14)
│   ├── integrations/                  # Integration specs (future)
│   └── testing/                       # Test plans (future)
│
├── src/                               # LNPM desktop client (existing, Tauri)
│   ├── main.ts
│   ├── types.ts                       # Shared types (Target, PingSample, HistoryResponse)
│   ├── chart.ts
│   ├── chart-tooltip.ts
│   ├── dashboard-selection.ts
│   ├── i18n.ts
│   ├── update-state.ts
│   ├── locales/
│   ├── assets/
│   └── styles.css
│
├── server/                            # Nitro backend server
│   ├── api/                           # API route handlers (file-based routing)
│   │   ├── health.get.ts              # GET /api/health (F1)
│   │   ├── ping/
│   │   │   └── ingest.post.ts         # POST /api/ping/ingest (F3)
│   │   ├── monitors.get.ts            # GET /api/monitors (F5)
│   │   ├── monitors/[id].get.ts       # GET /api/monitors/:id (F6)
│   │   └── clients/
│   │       ├── [slug].get.ts          # GET /api/clients/:slug (F2)
│   │       └── [slug].name.put.ts     # PUT /api/clients/:slug/name (F11)
│   │
│   ├── ws/                            # WebSocket routes
│   │   └── ping.ts                    # WS /ws/ping (F7)
│   │
│   ├── plugins/
│   │   ├── database.ts                # SQLite init with WAL mode (F1)
│   │   └── websocket.ts               # WebSocket server setup (F1)
│   │
│   ├── utils/
│   │   ├── db.ts                      # Database connection helper, migration runner
│   │   ├── client.ts                  # Slug generation, name default, upsert
│   │   ├── ping-validation.ts         # Sample validation rules
│   │   ├── ping-ingest.ts             # Core ingest engine (dedup, upsert, monitor auto-create)
│   │   ├── ping-types.ts              # Ingest payload/response TypeScript types
│   │   ├── quality-classifier.ts      # Sliding window quality state (F12)
│   │   ├── rate-limiter.ts            # Per-IP rate limiting (F13)
│   │   └── cache.ts                   # In-memory LRU cache
│   │
│   └── middleware/
│       └── rate-limit.ts              # Rate limiting middleware (F13)
│
├── schema/                            # Database schema
│   ├── index.sql                      # Full schema (assembled from migrations)
│   └── migrations/
│       ├── 001_create_clients.sql     # F2
│       ├── 002_create_monitors.sql    # F5
│       ├── 003_create_ping_samples.sql # F3
│       ├── 004_create_minute_rollups.sql # F6
│       └── 005_create_indexes.sql     # Performance indexes
│
├── nuxt.config.ts                     # Nuxt/Nitro config
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 4. Environment Configuration

### 4.1 Development

```bash
# .env (development)
NODE_ENV=development
PORT=3000
DATABASE_PATH=.data/lingering.db
LOG_LEVEL=debug

# WebSocket config
WS_HEARTBEAT_INTERVAL_MS=30000
WS_MAX_CLIENTS=1000

# Ingest config
INGEST_MAX_SAMPLES=1000
INGEST_FUTURE_WINDOW_MS=300000    # 5 minutes

# Rate limiting (generous for dev)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# Data retention
RETENTION_DAYS=30

# Cache
LRU_CACHE_MAX=10000
```

### 4.2 Production

```bash
# .env (production)
NODE_ENV=production
PORT=3000
DATABASE_PATH=/var/data/lingering.db
LOG_LEVEL=info

# WebSocket config
WS_HEARTBEAT_INTERVAL_MS=30000
WS_MAX_CLIENTS=10000

# Ingest config
INGEST_MAX_SAMPLES=1000
INGEST_FUTURE_WINDOW_MS=300000    # 5 minutes

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Data retention
RETENTION_DAYS=7

# Cache
LRU_CACHE_MAX=50000
```

### 4.3 Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | HTTP server port |
| `DATABASE_PATH` | `.data/lingering.db` | SQLite database file path |
| `LOG_LEVEL` | `debug` / `info` | Logging verbosity |
| `WS_HEARTBEAT_INTERVAL_MS` | `30000` | WebSocket ping/pong interval |
| `WS_MAX_CLIENTS` | `1000` / `10000` | Max concurrent WS connections |
| `INGEST_MAX_SAMPLES` | `1000` | Max samples per ingest POST |
| `INGEST_FUTURE_WINDOW_MS` | `300000` | Max allowed future timestamp (ms) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit time window |
| `RATE_LIMIT_MAX_REQUESTS` | `100` / `1000` | Max requests per window |
| `RETENTION_DAYS` | `7` / `30` | Data retention period |
| `LRU_CACHE_MAX` | `10000` / `50000` | Max LRU cache entries |

---

## 5. Key Architectural Decision Records (ADRs)

### ADR-001: Nuxt + Nitro for Backend (not Express/Fastify)

**Status:** Accepted
**Date:** 2026-07-31

**Context:** We need a backend for API endpoints, WebSocket broadcasting, and a web dashboard. The team is already using Nuxt + Vue for the dashboard frontend.

**Decision:** Use Nuxt with Nitro as the single full-stack framework. Nitro runs as a persistent `node-server` process (not serverless), providing both the API layer and the dashboard frontend from one codebase.

**Consequences:**
- Single deployment artifact. No separate backend and frontend repos.
- File-based routing (`server/api/`) gives convention-based API handlers.
- Native WebSocket support via `server/ws/` routes.
- Shared TypeScript types between server and client via Nuxt's auto-import.
- Trade-off: Less control over low-level HTTP than a bare Express app, but sufficient for this scope.

### ADR-002: SQLite with WAL Mode (not PostgreSQL/MySQL)

**Status:** Accepted
**Date:** 2026-07-31

**Context:** We need persistent storage for ping samples, monitors, and client records. The system is a single-node deployment (not distributed).

**Decision:** Use SQLite via `better-sqlite3` with WAL (Write-Ahead Logging) mode. Single-file database, zero external dependencies.

**Consequences:**
- Zero ops — no database server to manage, back up, or scale.
- WAL mode allows concurrent reads while writes happen, suitable for ingest + dashboard reads.
- `better-sqlite3` is synchronous, which aligns with Node.js single-threaded model — no connection pool needed.
- Trade-off: Not suitable for multi-node horizontal scaling. Acceptable because this is a single-tenant monitoring dashboard.
- If multi-node is needed later, migration path to PostgreSQL is straightforward (same SQL, different driver).

### ADR-003: In-memory LRU Cache (not Redis)

**Status:** Accepted
**Date:** 2026-07-31

**Context:** Hot data — recent monitor state, rollup aggregates, and WebSocket subscription state — needs fast access. Redis would add an external dependency.

**Decision:** Use an in-memory LRU cache within the Nitro process. Subscription state lives in process memory as a Map of WebSocket connections per monitor topic.

**Consequences:**
- No external service to deploy or manage.
- Cache survives only as long as the process lives — acceptable because dashboard state is recoverable from SQLite.
- Subscription state is lost on restart — clients auto-reconnect and re-subscribe.
- Trade-off: Cannot share cache across multiple processes. Acceptable for single-node deployment.

### ADR-004: Client Identity via Username + Hostname + MAC (not UUID/device token)

**Status:** Accepted
**Date:** 2026-07-31

**Context:** Each LNPM desktop client needs a stable, human-readable identifier for the dashboard. The client runs under a specific user on a specific machine.

**Decision:** Generate an immutable slug from `username`, `hostname`, and the last 10 hex characters of `mac_address`. Format: `<username>-<hostname>-<truncated-mac>` (e.g., `alice-desktop-aa00bb11cc22`). Display name defaults to `username@hostname` and is editable on the dashboard.

**Consequences:**
- Human-readable URLs and API responses.
- MAC address ties identity to a physical device, preventing impersonation.
- Slug is immutable — used for API paths and database foreign keys.
- Trade-off: MAC address changes (virtual NICs, VMs) would create a new client identity. Acceptable for this use case.

### ADR-005: Batched Ingest with Dedup (not streaming/individual samples)

**Status:** Accepted
**Date:** 2026-07-31

**Context:** LNPM clients generate ping samples at a configurable interval (e.g., every 1-5 seconds). Sending each sample individually would create excessive HTTP overhead and database writes.

**Decision:** Client buffers up to 10 samples or 5 seconds (whichever first), then POSTs a batch to `POST /api/ping/ingest`. Backend uses `INSERT OR IGNORE` with a unique compound index on `(monitor_id, timestamp_ms, resolved_address)` for deduplication.

**Consequences:**
- Reduces HTTP round-trips by 10x compared to per-sample posting.
- `INSERT OR IGNORE` makes retries safe — resending an already-ingested batch is a no-op.
- Compound unique index ensures the same ping event is never stored twice.
- Trade-off: 5-second delay from sample generation to dashboard visibility. Acceptable for monitoring.

### ADR-006: Nitro Native WebSocket (not Socket.io/WebSockets package)

**Status:** Accepted
**Date:** 2026-07-31

**Context:** Real-time ping data needs to reach the dashboard without polling.

**Decision:** Use Nitro's native WebSocket support via `server/ws/` routes. Per-monitor subscriptions via topic-based fan-out (Map of monitorId -> Set of connections).

**Consequences:**
- No additional dependency. Built into Nitro.
- Simple topic-based model: each WS client subscribes to specific monitor IDs.
- Client auto-reconnects with exponential backoff on disconnect.
- Trade-off: No built-in room management like Socket.io. Implemented manually via Map-based subscriptions. Sufficient for this scope.

### ADR-007: uPlot Charts (not Chart.js/Recharts/D3)

**Status:** Accepted
**Date:** 2026-07-31

**Context:** Dashboard needs high-performance line charts for real-time ping data with multiple series. The LNPM desktop client already uses uPlot.

**Decision:** Use uPlot for all dashboard charts. Same library as the desktop app ensures visual consistency and code reuse.

**Consequences:**
- Already in the dependency tree (`uplot: ^1.6.32`).
- Canvas-based rendering handles thousands of data points at 60fps.
- Small bundle size (~40KB gzipped).
- Trade-off: Less opinionated than Chart.js — requires more manual configuration. Acceptable given the desktop client already has chart code.

### ADR-008: Single-Node Deployment (not containerized/distributed)

**Status:** Accepted
**Date:** 2026-07-31

**Context:** This is a personal/small-team monitoring tool. Infrastructure complexity should be minimized.

**Decision:** Deploy as a single Node.js process on a VPS or cloud instance (e.g., DigitalOcean Droplet, AWS EC2, or Vercel persistent runtime). No Docker, no Kubernetes, no orchestration.

**Consequences:**
- One process, one SQLite file, one WebSocket server.
- Simple backups: copy the SQLite file.
- Process manager (pm2 or systemd) for auto-restart.
- Trade-off: No horizontal scaling. Acceptable because ping ingest volume is bounded (single user's monitors).

### ADR-009: Raw Samples with Backend Computed Metrics (not client-side aggregation)

**Status:** Accepted
**Date:** 2026-07-31

**Context:** Ping samples contain raw fields only: `timestampMs`, `latencyMs`, `status`, `resolvedAddress`, `error`. Quality metrics (packet loss, p95 latency, jitter) are computed by the backend from stored samples.

**Decision:** Store raw samples only. Backend computes `QualityMetrics`, `QualityState`, and `minute_rollups` from stored data. Client does NOT pre-compute or send aggregated metrics.

**Consequences:**
- Single source of truth — backend owns the computation logic.
- `minute_rollups` table stores pre-computed aggregates for efficient chart queries.
- Quality classifier (F12) uses a sliding window over raw samples.
- Trade-off: Backend must compute rollups on ingest (or via scheduled job). Acceptable for the data volume.
