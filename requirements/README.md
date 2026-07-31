# LNPM Cloud Dashboard — Requirements

## Overview

Extend the LNPM desktop ping monitoring app with a centralized cloud dashboard. LNPM clients optionally send collected ping data to a Nuxt + Nitro backend server. The server stores data in SQLite and broadcasts it live via WebSocket to a public web dashboard that mirrors the LNPM desktop UI.

**Key principles:**
- No authentication required — public dashboard
- Monitors identified by `username + hostname + MAC address` (auto-generated slug + editable name)
- Mirrors LNPM desktop app UI design
- Optional sync — LNPM works normally without a backend configured

## Project Structure

Dashboard-related files live in `./dashboard/` at the project root. The existing LNPM desktop app code remains untouched.

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

### Core Documentation
- [Architecture](./architecture.md) — System design, data flow, tech stack justification, directory structure, environment configuration, and ADRs (001–009)
- [API Design](./api/api-design.md) — Complete REST and WebSocket API contract: endpoints, request/response shapes, error handling, client sync protocol, and shared TypeScript types
- [Data Models](./data-models/data-models.md) — Full SQLite schema: ER diagram, table definitions, indexes, migrations, sample queries, in-memory cache, and retention policy
- [Deployment](./deployment/deployment.md) — Deployment strategies (VPS+PM2, systemd, Docker, managed hosting), database management, backups, security, and troubleshooting

### Feature Specifications (14 total)
[Jump to MVP features](#mvp-9-features) | [Jump to Enhancements](#enhancement-4-features) | [Jump to Growth](#growth-1-feature)

### Quick Reference
- [Tech Stack](#tech-stack)
- [API Endpoints](#api-endpoints)
- [Data Model Summary](#data-model-summary)
- [Client Identity](#client-identity)
- [Dependency Order](#dependency-order)
- [Environment Variables](#environment-variables)

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Backend** | Nuxt + Nitro (persistent `node-server` runtime) | Single codebase for API and UI. Native WebSocket, persistent process (not serverless). |
| **Storage** | SQLite (`better-sqlite3`) with WAL mode | Single-file storage, zero ops. WAL supports concurrent reads/writes. |
| **Caching** | In-memory LRU cache (no Redis) | Hot monitor state in process memory. Eviction on max size. |
| **Real-time** | WebSocket (Nitro native) | Built-in via `server/ws/` routes. Per-monitor topic subscriptions. |
| **Charts** | uPlot | Already used in LNPM desktop. Canvas-based, fast, small bundle. |
| **Frontend** | Nuxt + Vue 3 | Same framework as backend. Mirrors desktop app design. |
| **Language** | TypeScript | End-to-end type safety from ingest payload to chart data. |
| **Package Manager** | pnpm (v11) | Already configured in the project. |

---

## API Endpoints

| Method | Path | Feature | Description |
|--------|------|---------|-------------|
| `GET` | `/api/health` | F1, F14 | Server health and operational metrics |
| `POST` | `/api/ping/ingest` | F3 | Batch ingest ping samples (up to 1000) |
| `GET` | `/api/monitors` | F5 | List all monitors with latest state |
| `GET` | `/api/monitors/:id` | F6 | Monitor history (HistoryResponse format) |
| `GET` | `/api/clients/:slug` | F2 | Get client by immutable slug |
| `PUT` | `/api/clients/:slug/name` | F11 | Update client display name |
| `WS` | `/ws/ping` | F7 | Real-time ping broadcast (subscribe/unsubscribe) |

---

## Data Model Summary

```
clients (1) ──── (M) monitors ──── (M) ping_samples
                      │
                      └─── (M) minute_rollups
```

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `clients` | LNPM client installations | `id`, `slug` (UNIQUE), `name`, `username`, `hostname`, `mac_address` |
| `monitors` | Ping targets per client | `id`, `client_id` (FK), `target_host`, `quality_state`, `last_seen_ms` |
| `ping_samples` | Raw individual ping results | `id`, `monitor_id` (FK), `timestamp_ms`, `latency_ms`, `status`, `resolved_address` |
| `minute_rollups` | Pre-aggregated 1-minute buckets | `monitor_id` (FK), `timestamp_ms`, `sample_count`, `avg_latency`, `p95_latency` |

Unique dedup index: `(monitor_id, timestamp_ms, resolved_address)` on `ping_samples` — enables safe `INSERT OR IGNORE` retries.

---

## Client Identity

- **Identity source:** `username` + `hostname` + `mac_address` combination
- **Auto-generated slug:** `<username>-<hostname>-<truncated-mac>` (e.g., `alice-desktop-aa00bb11cc22`)
- **Slug is immutable** — used for API paths, database keys, and URLs
- **Display name** defaults to `username@hostname`, editable on the dashboard via `PUT /api/clients/:slug/name`
- **MAC address** ties identity to a physical device, preventing impersonation

---

## Client Sync Protocol

LNPM desktop clients sync local ping data to the cloud backend:

1. **Batch buffer:** Flushes when 10 samples accumulate OR 5 seconds elapse (whichever first)
2. **POST batch** to `POST /api/ping/ingest`
3. **On success:** Marks `cloud_synced_at_ms` on all samples in the batch
4. **On failure:** Retries 3x with exponential backoff (1s, 2s, 4s)
5. **Startup sync:** Sends all samples where `cloud_synced_at_ms IS NULL` from the last hour
6. **Periodic sweep:** Every `syncIntervalMin` (default 5 min), sends remaining unsynced samples
7. **Idempotent:** Backend `INSERT OR IGNORE` makes resending safe — duplicates return as no-op

---

## Features (14 total)

### MVP (9 features)

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F1 | [Backend project setup](./features/feature-0001-backend-setup.md) | Critical | Planned |
| F2 | [Client registration & identity](./features/feature-0002-client-identity.md) | Critical | Planned |
| F3 | [Ping data ingest endpoint](./features/feature-0003-ping-ingest.md) | Critical | Planned |
| F4 | [LNPM client sync service](./features/feature-0004-client-sync.md) | Critical | Planned |
| F5 | [Monitors list API](./features/feature-0005-monitors-list.md) | Critical | Planned |
| F6 | [Monitor history API](./features/feature-0006-monitor-history.md) | Critical | Planned |
| F7 | [WebSocket live broadcast](./features/feature-0007-websocket-broadcast.md) | High | Planned |
| F8 | [Web dashboard UI](./features/feature-0008-web-dashboard.md) | High | Planned |
| F9 | [Client settings UI](./features/feature-0009-client-settings.md) | High | Planned |

### Enhancement (4 features)

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F10 | [Data retention cleanup](./features/feature-00010-data-retention.md) | Medium | Planned |
| F11 | [Dashboard client name editing](./features/feature-00011-edit-client-name.md) | Medium | Planned |
| F12 | [Backend quality classifier](./features/feature-00012-quality-classifier.md) | Medium | Planned |
| F13 | [Rate limiting](./features/feature-00013-rate-limiting.md) | Medium | Planned |

### Growth (1 feature)

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F14 | [Health check endpoint](./features/feature-00014-health-check.md) | Low | Planned |

---

## Dependency Order

```
F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8
```

Features F9–F14 are parallelizable once their dependencies are complete:
- F9 (Client Settings UI) depends on F2 (Client Identity)
- F10 (Data Retention) depends on F3 (Ping Ingest)
- F11 (Edit Client Name) depends on F2 (Client Identity)
- F12 (Quality Classifier) depends on F5 (Monitors List)
- F13 (Rate Limiting) can be added at any API endpoint
- F14 (Health Check) depends on F1 (Backend Setup)

---

## Environment Variables

| Variable | Dev Default | Prod Default | Description |
|----------|-----------|-------------|-------------|
| `NODE_ENV` | `development` | `production` | Environment mode |
| `PORT` | `3000` | `3000` | HTTP server port |
| `DATABASE_PATH` | `.data/lingering.db` | `/var/data/lnpm/lingering.db` | SQLite database path |
| `LOG_LEVEL` | `debug` | `info` | Logging verbosity |
| `WS_HEARTBEAT_INTERVAL_MS` | `30000` | `30000` | WebSocket ping/pong interval |
| `WS_MAX_CLIENTS` | `1000` | `10000` | Max concurrent WS connections |
| `INGEST_MAX_SAMPLES` | `1000` | `1000` | Max samples per batch POST |
| `INGEST_FUTURE_WINDOW_MS` | `300000` | `300000` | Max future timestamp (5 min) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | `60000` | Rate limit time window |
| `RATE_LIMIT_MAX_REQUESTS` | `1000` | `100` | Max requests per window per IP |
| `RETENTION_DAYS` | `30` | `7` | Sample retention period |
| `ROLLUP_RETENTION_DAYS` | `90` | `30` | Rollup retention period |
| `MONITOR_INACTIVE_DAYS` | `30` | `30` | Inactivity threshold for monitors |
| `LRU_CACHE_MAX` | `10000` | `50000` | Max LRU cache entries |

---

## Key Architectural Decisions (ADRs)

| ADR | Decision | Summary |
|-----|----------|---------|
| [ADR-001](./architecture.md) | Nuxt + Nitro for Backend | Single full-stack framework. File-based routing. Native WebSocket. |
| [ADR-002](./architecture.md) | SQLite with WAL Mode | Single-file storage. WAL enables concurrent reads/writes. Zero ops. |
| [ADR-003](./architecture.md) | In-memory LRU Cache | No Redis. Hot data in process memory. Recoverable from SQLite. |
| [ADR-004](./architecture.md) | Client Identity via Username + Hostname + MAC | Human-readable slug. Device-bound identity. Immutable identifier. |
| [ADR-005](./architecture.md) | Batched Ingest with Dedup | 10 samples or 5s buffer. `INSERT OR IGNORE` makes retries safe. |
| [ADR-006](./architecture.md) | Nitro Native WebSocket | No Socket.io. Topic-based subscriptions via Map. |
| [ADR-007](./architecture.md) | uPlot Charts | Already in desktop. Canvas-based. Fast rendering. |
| [ADR-008](./architecture.md) | Single-Node Deployment | One process, one SQLite file. Simple backups. PM2 or systemd. |
| [ADR-009](./architecture.md) | Raw Samples with Backend Computed Metrics | Backend owns quality computation. `minute_rollups` for efficient queries. |

---

## Dashboard UI

The web dashboard mirrors the LNPM desktop app design:

- **Sidebar:** Grouped by client (name), monitors listed under each client
- **All Monitors view:** Combined line chart with all monitors, threshold lines, sidebar toggles
- **Per-Monitor view:** Detailed chart + metrics + quality state intervals
- **Live WS updates:** Real-time sample pushes via WebSocket subscription
- **uPlot charts:** Canvas-based rendering, 60fps with thousands of data points
- **Status dots:** Green (good/low), Yellow (medium/high), Red (unstable/disconnected)

---

## Generated

- **Methodology:** User Story Mapping + Specification by Example
- **Generated at:** 2026-07-31
- **Total features:** 14 (9 MVP, 4 Enhancement, 1 Growth)
- **Pipeline handoff:** Ready for `2-plan-generator-optional.md`
