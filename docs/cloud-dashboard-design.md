# LNPM Cloud Dashboard — Design Spec

**Date:** 2026-07-31
**Status:** Approved

## Overview

Extend LNPM with a cloud dashboard feature. Each LNPM desktop client optionally sends ping data to a centralized Nuxt + Nitro server. The server stores data and broadcasts it live to a public web dashboard. No authentication is required; monitors are identified by `user@hostname`.

## Architecture

```
┌──────────────────────────┐       ┌──────────────────────────┐
│   LNPM Desktop Client     │       │   Nuxt + Nitro Server    │
│                          │  POST  │                          │
│  Monitor Service ──────────► /api/ping/ingest       │
│  (each ping sample)      │       │  → SQLite + Redis pub/sub│
│                          │       │                          │
│  Historical Sync ──────────► /api/ping/ingest      │
│  (every N minutes)       │       │                          │
│                          │  WS   │  WS /ws/ping (broadcast) │
│  Settings UI:            │◄──────│                          │
│  - Backend URL           │       │  SQLite (history)        │
│  - Sync interval (min)   │       │  Redis  (real-time)      │
│  - Username / Hostname   │       └──────────────────────────┘
└──────────────────────────┘                ┌──────────────────────────┐
                                            │   Web Dashboard (public)  │
                                            │   /dashboard              │
                                            │   - Sidebar (monitors)    │
                                            │   - All monitors chart    │
                                            │   - Per-monitor view      │
                                            │   WS ← live updates       │
                                            └──────────────────────────┘
```

## Components

### 1. LNPM Client Changes

**Settings fields:**
- `backendUrl` — optional string (e.g., `https://dashboard.example.com`). Blank = sync disabled.
- `syncIntervalMin` — integer, default 1. How often to sync historical data.
- `syncUsername` — auto-filled from system username, editable.
- `syncHostname` — auto-filled from system hostname, editable.

**Data sync behavior:**
- **Real-time:** Each new ping sample is immediately POSTed to `{backendUrl}/api/ping/ingest`.
- **Historical:** Every `syncIntervalMin` minutes, query local SQLite for samples from the last interval and POST them in batches.
- **Startup:** On app boot (if backendUrl is set), send all unsynced local samples from the last hour.
- **Retry:** Failed POSTs retry up to 3 times with exponential backoff (1s, 2s, 4s), then discard. Data remains in local DB for next historical sync.

**No changes to core monitoring** — the app works exactly the same without a backend configured.

### 2. Backend API (Nuxt Nitro)

**Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/ping/ingest` | Accept ping data (single or batch). Store to SQLite, push to Redis. |
| GET | `/api/monitors` | List all active monitors with latest status. |
| GET | `/api/monitors/:id` | Monitor history (chart data, metrics, rollups). |
| WS | `/ws/ping` | WebSocket — broadcast real-time ping data to connected dashboard clients. |

**Monitor identity:** `{username}@{hostname}:{targetId}` — composite key uniquely identifying each monitor.

### 3. Data Storage

**SQLite (persistent history):**
- `monitors` — monitor metadata (username, hostname, target_host, target_id, created_at, updated_at)
- `ping_samples` — raw samples (monitor_id, timestamp_ms, latency_ms, status, packet_loss, rtt_avg, rtt_min, rtt_max, quality_state)
- `minute_rollups` — aggregated rollups for efficient history queries

**Redis (real-time):**
- Pub/sub channel `ping:live` — broadcasts incoming samples to WebSocket clients
- `monitor:{id}:latest` — latest state per monitor (TTL ~5 min) for sidebar status

### 4. Web Dashboard (Nuxt Frontend)

**UI mirrors LNPM desktop app:**

- **Sidebar:** "All Monitors" at top, followed by monitor list grouped by `user@hostname`. Each shows target name, status dot (green/yellow/red), latest latency.
- **All Monitors view:** Combined line chart (same uPlot design as LNPM) with all monitors.
- **Per-Monitor view:** Click monitor → detailed chart, quality state, metrics.
- **Live updates:** WebSocket (`/ws/ping`) for real-time data.
- **No auth** — public dashboard.

### 5. Data Model

**Ingest request:**
```typescript
interface PingIngest {
  username: string;
  hostname: string;
  targetId: string;
  targetHost: string;
  samples: Array<{
    timestampMs: number;
    latencyMs: number | null;
    status: 'success' | 'failure';
    packetLoss: number;
    rttAvg: number;
    rttMin: number;
    rttMax: number;
    qualityState: 'Low' | 'Medium' | 'High' | 'VeryHigh' | 'Unstable' | 'Disconnected' | 'Paused' | 'WarmingUp';
  }>;
}
```

## Error Handling

- **Backend unreachable:** Client silently retries, falls back to local-only mode.
- **Malformed data:** Backend returns 400, client logs and discards.
- **WebSocket disconnect:** Dashboard reconnected automatically (exponential backoff).

## Out of Scope

- Authentication / user accounts
- Target management from web dashboard (targets are managed on each LNPM client)
- Mobile-specific UI
- Alerting / notifications
