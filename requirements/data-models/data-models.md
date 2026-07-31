---
type: data-models
version: "2.0"
---

# Data Models — LNPM Cloud Dashboard

## 1. Overview

This document defines the complete database schema, in-memory cache structures, indexes, relationships, migration order, and sample queries for the LNPM Cloud Dashboard.

**Storage engine:** SQLite via `better-sqlite3` with WAL mode.
**Database file:** `.data/lingering.db` (dev) / `/var/data/lingering.db` (prod), configurable via `DATABASE_PATH`.
**Cache:** In-memory LRU `Map` — no Redis.

---

## 2. ER Diagram

```
clients (1) ──── (M) monitors ──── (M) ping_samples
                      │
                      └─── (M) minute_rollups
```

- **clients** — LNPM desktop client installations.
- **monitors** — Ping targets per client.
- **ping_samples** — Raw individual ping probe results.
- **minute_rollups** — Pre-aggregated 1-minute buckets for efficient historical queries.

---

## 3. Tables

### 3.1. clients

Stores LNPM client installations. Each client is identified by an immutable slug derived from `username`, `hostname`, and `mac_address`.

```sql
CREATE TABLE clients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  username    TEXT    NOT NULL,
  hostname    TEXT    NOT NULL,
  mac_address TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,  -- UTC epoch milliseconds
  updated_at  INTEGER NOT NULL   -- UTC epoch milliseconds
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTOINCREMENT | Surrogate primary key |
| `slug` | TEXT | NOT NULL, UNIQUE | Immutable identifier: `<username>-<hostname>-<truncated-mac>` (e.g., `alice-desktop-aa00bb11cc22`) |
| `name` | TEXT | NOT NULL | Display name, defaults to `username@hostname`, editable via API |
| `username` | TEXT | NOT NULL | OS username of the client machine |
| `hostname` | TEXT | NOT NULL | Hostname of the client machine |
| `mac_address` | TEXT | NOT NULL | MAC address of the primary network interface (e.g., `aa:00:bb:11:cc:22`) |
| `created_at` | INTEGER | NOT NULL | UTC epoch milliseconds |
| `updated_at` | INTEGER | NOT NULL | UTC epoch milliseconds, refreshed on every ingest and name update |

**Indexes:**

```sql
CREATE INDEX idx_clients_slug ON clients(slug);
CREATE INDEX idx_clients_mac ON clients(mac_address);
```

**Slug generation rules:**
1. Concatenate `username`, `hostname`, and last 10 hex characters of `mac_address` (colons removed).
2. Lowercase all segments.
3. Replace spaces and underscores with hyphens.
4. Truncate to 64 characters.
5. Example: `username=alice, hostname=desktop, mac=aa:00:bb:11:cc:22` -> `alice-desktop-aa00bb11cc22`

**Sample data:**

```sql
INSERT INTO clients (slug, name, username, hostname, mac_address, created_at, updated_at)
VALUES
  ('alice-desktop-aa00bb11cc22', 'Alice''s Desktop', 'alice', 'desktop', 'aa:00:bb:11:cc:22', 1753852800000, 1753852800000),
  ('bob-laptop-112233445566', 'Bob''s Laptop', 'bob', 'laptop', '11:22:33:44:55:66', 1753900000000, 1753900000000);
```

---

### 3.2. monitors

Stores ping targets per client. Auto-created on first ingest for a new `(client_id, target_host)` combination.

```sql
CREATE TABLE monitors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  target_host     TEXT    NOT NULL,
  target_name     TEXT    DEFAULT NULL,
  quality_state   TEXT    DEFAULT 'warmingUp',
  state_since_ms  INTEGER DEFAULT NULL,
  last_seen_ms    INTEGER DEFAULT NULL,
  last_status     TEXT    DEFAULT NULL,
  last_latency_ms REAL    DEFAULT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE(client_id, target_host)
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTOINCREMENT | Surrogate primary key |
| `client_id` | INTEGER | NOT NULL, FK -> clients(id), CASCADE DELETE | Owning client |
| `target_host` | TEXT | NOT NULL | Ping target host or IP |
| `target_name` | TEXT | DEFAULT NULL | Optional display name (e.g., "Google DNS") |
| `quality_state` | TEXT | DEFAULT `'warmingUp'` | Current quality: `warmingUp`, `low`, `medium`, `high`, `veryHigh`, `unstable`, `disconnected` |
| `state_since_ms` | INTEGER | DEFAULT NULL | When `quality_state` last changed |
| `last_seen_ms` | INTEGER | DEFAULT NULL | Timestamp of the most recent sample |
| `last_status` | TEXT | DEFAULT NULL | Latest sample status: `success`, `timeout`, `error` |
| `last_latency_ms` | REAL | DEFAULT NULL | Latest sample latency |
| `created_at` | INTEGER | NOT NULL | UTC epoch milliseconds |
| `updated_at` | INTEGER | NOT NULL | UTC epoch milliseconds, refreshed on every ingest |

**Indexes:**

```sql
CREATE INDEX idx_monitors_client ON monitors(client_id);
CREATE INDEX idx_monitors_last_seen ON monitors(last_seen_ms);
CREATE INDEX idx_monitors_client_target ON monitors(client_id, target_host);
```

**Auto-creation:** On `POST /api/ping/ingest`, if a sample references a `targetHost` not yet seen for this client, the backend inserts a new monitor row with `INSERT OR IGNORE` on the unique `(client_id, target_host)` constraint.

**Sample data:**

```sql
INSERT INTO monitors (client_id, target_host, target_name, quality_state, last_seen_ms, last_status, last_latency_ms, created_at, updated_at)
VALUES
  (1, '8.8.8.8', 'Google DNS', 'low', 1753939200000, 'success', 14.2, 1753852800000, 1753939200000),
  (1, '1.1.1.1', 'Cloudflare DNS', 'low', 1753939198000, 'success', 8.5, 1753852800000, 1753939198000),
  (2, '9.9.9.9', 'Quad9 DNS', 'medium', 1753939150000, 'success', 52.3, 1753900000000, 1753939150000);
```

---

### 3.3. ping_samples

Stores raw ping probe results. This is the source of truth — all computed metrics derive from these rows.

```sql
CREATE TABLE ping_samples (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id       INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  timestamp_ms     INTEGER NOT NULL,
  latency_ms       REAL    DEFAULT NULL,
  status           TEXT    NOT NULL,
  resolved_address TEXT    DEFAULT NULL,
  error            TEXT    DEFAULT NULL,
  created_at       INTEGER NOT NULL,
  UNIQUE(monitor_id, timestamp_ms, resolved_address)
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTOINCREMENT | Surrogate primary key |
| `monitor_id` | INTEGER | NOT NULL, FK -> monitors(id), CASCADE DELETE | Owning monitor |
| `timestamp_ms` | INTEGER | NOT NULL | Client-side epoch milliseconds of the ping event |
| `latency_ms` | REAL | DEFAULT NULL | Round-trip time in milliseconds; NULL on failure |
| `status` | TEXT | NOT NULL | `success`, `timeout`, or `error` |
| `resolved_address` | TEXT | DEFAULT NULL | Resolved IP address; NULL on failure |
| `error` | TEXT | DEFAULT NULL | Error message for `timeout`/`error` status |
| `created_at` | INTEGER | NOT NULL | Server-side UTC epoch milliseconds (ingest time) |

**Unique constraint:** `(monitor_id, timestamp_ms, resolved_address)` — enables `INSERT OR IGNORE` deduplication. Resending an already-ingested batch is a safe no-op.

**Indexes:**

```sql
CREATE INDEX idx_ping_monitor_time ON ping_samples(monitor_id, timestamp_ms);
CREATE INDEX idx_ping_status ON ping_samples(status);
```

**Validation rules (per sample, enforced by backend):**

| Rule | Error Code | Detail |
|------|-----------|--------|
| `timestamp_ms` must be a positive integer | `INVALID_TIMESTAMP` | Rejected sample |
| `timestamp_ms` exceeds 5-minute future window | `FUTURE_TIMESTAMP` | `now + INGEST_FUTURE_WINDOW_MS` |
| `latency_ms` required when `status` is `success` | `MISSING_LATENCY` | Rejected sample |
| `latency_ms` must be a positive number | `INVALID_LATENCY` | Rejected sample |
| `resolved_address` required when `status` is `success` | `MISSING_RESOLVED_ADDRESS` | Rejected sample |
| `status` must be `success`, `timeout`, or `error` | `INVALID_STATUS` | Rejected sample |
| `targetHost` is required and non-empty | `MISSING_TARGET_HOST` | Rejected sample |

**Sample data:**

```sql
INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, error, created_at)
VALUES
  (1, 1753939190000, 14.2, 'success', '8.8.8.8', NULL, 1753939190500),
  (1, 1753939191000, 13.8, 'success', '8.8.8.8', NULL, 1753939191500),
  (1, 1753939192000, NULL, 'timeout', NULL, 'Request timed out', 1753939192500),
  (2, 1753939190000, 8.5, 'success', '1.1.1.1', NULL, 1753939190500),
  (3, 1753939148000, 52.3, 'success', '9.9.9.9', NULL, 1753939148500);
```

---

### 3.4. minute_rollups

Pre-aggregated 1-minute buckets for efficient historical queries and chart rendering. Computed by the backend on ingest or by a scheduled aggregation job.

```sql
CREATE TABLE minute_rollups (
  monitor_id     INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  timestamp_ms   INTEGER NOT NULL,
  sample_count   INTEGER NOT NULL DEFAULT 0,
  success_count  INTEGER NOT NULL DEFAULT 0,
  failure_count  INTEGER NOT NULL DEFAULT 0,
  avg_latency    REAL    DEFAULT NULL,
  min_latency    REAL    DEFAULT NULL,
  max_latency    REAL    DEFAULT NULL,
  p95_latency    REAL    DEFAULT NULL,
  created_at     INTEGER NOT NULL,
  UNIQUE(monitor_id, timestamp_ms)
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `monitor_id` | INTEGER | NOT NULL, FK -> monitors(id), CASCADE DELETE | Owning monitor |
| `timestamp_ms` | INTEGER | NOT NULL | Bucket start, aligned to 60-second boundary |
| `sample_count` | INTEGER | NOT NULL, DEFAULT 0 | Total samples in this bucket |
| `success_count` | INTEGER | NOT NULL, DEFAULT 0 | Samples with `status = 'success'` |
| `failure_count` | INTEGER | NOT NULL, DEFAULT 0 | Samples with `status IN ('timeout', 'error')` |
| `avg_latency` | REAL | DEFAULT NULL | Mean latency of successful samples |
| `min_latency` | REAL | DEFAULT NULL | Minimum latency of successful samples |
| `max_latency` | REAL | DEFAULT NULL | Maximum latency of successful samples |
| `p95_latency` | REAL | DEFAULT NULL | 95th percentile latency |
| `created_at` | INTEGER | NOT NULL | Server-side UTC epoch milliseconds |

**Bucket alignment:** `timestamp_ms` is the start of each 60-second bucket. Aligned as: `floor(timestamp_ms / 60000) * 60000`.

**Indexes:**

```sql
CREATE INDEX idx_rollup_monitor_time ON minute_rollups(monitor_id, timestamp_ms);
```

**Computed on ingest:** After each batch of `ping_samples` is inserted, the backend aggregates the new samples into their minute buckets, using `INSERT OR REPLACE` on the unique `(monitor_id, timestamp_ms)` constraint.

**Sample data:**

```sql
INSERT INTO minute_rollups (monitor_id, timestamp_ms, sample_count, success_count, failure_count, avg_latency, min_latency, max_latency, p95_latency, created_at)
VALUES
  (1, 1753939140000, 60, 58, 2, 14.5, 12.1, 22.4, 18.2, 1753939200000),
  (1, 1753939200000, 55, 55, 0, 13.9, 11.5, 17.8, 16.1, 1753939260000),
  (2, 1753939140000, 60, 60, 0, 8.6, 7.2, 10.1, 9.8, 1753939200000);
```

---

## 4. Indexes Summary

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_clients_slug` | clients | `(slug)` | Look up client by slug (ingest, API) |
| `idx_clients_mac` | clients | `(mac_address)` | Detect duplicate MAC across clients |
| `idx_monitors_client` | monitors | `(client_id)` | List monitors for a client |
| `idx_monitors_last_seen` | monitors | `(last_seen_ms)` | Order monitors by activity, detect inactivity |
| `idx_monitors_client_target` | monitors | `(client_id, target_host)` | Unique constraint + auto-create lookup |
| `idx_ping_monitor_time` | ping_samples | `(monitor_id, timestamp_ms)` | Range queries for history API |
| `idx_ping_status` | ping_samples | `(status)` | Filter by status, aggregate success/failure |
| `idx_rollup_monitor_time` | minute_rollups | `(monitor_id, timestamp_ms)` | Range queries for chart data |

---

## 5. Relationships

| Relationship | From | To | Cardinality | FK Constraint |
|-------------|------|-----|-------------|---------------|
| Client owns monitors | clients | monitors | 1:M | `monitors.client_id -> clients.id` ON DELETE CASCADE |
| Monitor has samples | monitors | ping_samples | 1:M | `ping_samples.monitor_id -> monitors.id` ON DELETE CASCADE |
| Monitor has rollups | monitors | minute_rollups | 1:M | `minute_rollups.monitor_id -> monitors.id` ON DELETE CASCADE |

---

## 6. In-Memory Cache

### 6.1. Latest Monitor State (LRU Cache)

An in-memory LRU `Map<string, MonitorState>` — replaces Redis for hot data.

```typescript
interface MonitorState {
  monitorId: number;
  qualityState: QualityState;
  latestLatencyMs: number | null;
  lastSeenMs: number;
  lastStatus: 'success' | 'timeout' | 'error' | null;
  stableMs: number;
  unstableMs: number;
  disconnectedMs: number;
}

type QualityState =
  | 'warmingUp'
  | 'low'
  | 'medium'
  | 'high'
  | 'veryHigh'
  | 'unstable'
  | 'disconnected';
```

**Behavior:**
- Updated on every `POST /api/ping/ingest` for affected monitors.
- Cleanup sweep every 60 seconds: removes entries with no data in > 5 minutes.
- Used for `GET /api/monitors` response and sidebar status dots.
- Max size: 10,000 entries (LRU eviction). Configurable via `LRU_CACHE_MAX`.

### 6.2. Quality Classifier State

Per-monitor sliding window state for quality classification (F12).

```typescript
interface ClassifierState {
  window: PingSample[];           // sliding window of recent samples
  state: QualityState;
  stateSinceMs: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}
```

**Behavior:**
- One instance per active monitor.
- Maintained in process memory during server runtime.
- Rebuilt on server restart from recent SQLite data (last 5 minutes of samples).
- Sliding window: last 300 seconds of samples per monitor.

**Quality state conditions:**

| State | Conditions |
|-------|-----------|
| `warmingUp` | First 30 seconds or fewer than 5 samples in window |
| `low` | packetLoss < 1%, avgLatency < 50ms |
| `medium` | packetLoss < 5%, avgLatency < 100ms |
| `high` | packetLoss < 10%, avgLatency < 200ms |
| `veryHigh` | packetLoss < 10%, avgLatency >= 200ms |
| `unstable` | packetLoss >= 10% or high jitter |
| `disconnected` | No samples in the window |

---

## 7. Migration Order

Migrations are applied sequentially on server startup via `schema/migrations/`:

```
schema/
  migrations/
    001_create_clients.sql
    002_create_monitors.sql
    003_create_ping_samples.sql
    004_create_minute_rollups.sql
    005_create_indexes.sql
```

### Migration 001: Create clients

```sql
CREATE TABLE IF NOT EXISTS clients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  username    TEXT    NOT NULL,
  hostname    TEXT    NOT NULL,
  mac_address TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
```

### Migration 002: Create monitors

```sql
CREATE TABLE IF NOT EXISTS monitors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  target_host     TEXT    NOT NULL,
  target_name     TEXT    DEFAULT NULL,
  quality_state   TEXT    DEFAULT 'warmingUp',
  state_since_ms  INTEGER DEFAULT NULL,
  last_seen_ms    INTEGER DEFAULT NULL,
  last_status     TEXT    DEFAULT NULL,
  last_latency_ms REAL    DEFAULT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE(client_id, target_host)
);
```

### Migration 003: Create ping_samples

```sql
CREATE TABLE IF NOT EXISTS ping_samples (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id       INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  timestamp_ms     INTEGER NOT NULL,
  latency_ms       REAL    DEFAULT NULL,
  status           TEXT    NOT NULL,
  resolved_address TEXT    DEFAULT NULL,
  error            TEXT    DEFAULT NULL,
  created_at       INTEGER NOT NULL,
  UNIQUE(monitor_id, timestamp_ms, resolved_address)
);
```

### Migration 004: Create minute_rollups

```sql
CREATE TABLE IF NOT EXISTS minute_rollups (
  monitor_id     INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  timestamp_ms   INTEGER NOT NULL,
  sample_count   INTEGER NOT NULL DEFAULT 0,
  success_count  INTEGER NOT NULL DEFAULT 0,
  failure_count  INTEGER NOT NULL DEFAULT 0,
  avg_latency    REAL    DEFAULT NULL,
  min_latency    REAL    DEFAULT NULL,
  max_latency    REAL    DEFAULT NULL,
  p95_latency    REAL    DEFAULT NULL,
  created_at     INTEGER NOT NULL,
  UNIQUE(monitor_id, timestamp_ms)
);
```

### Migration 005: Create indexes

```sql
CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_mac ON clients(mac_address);
CREATE INDEX IF NOT EXISTS idx_monitors_client ON monitors(client_id);
CREATE INDEX IF NOT EXISTS idx_monitors_last_seen ON monitors(last_seen_ms);
CREATE INDEX IF NOT EXISTS idx_monitors_client_target ON monitors(client_id, target_host);
CREATE INDEX IF NOT EXISTS idx_ping_monitor_time ON ping_samples(monitor_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_ping_status ON ping_samples(status);
CREATE INDEX IF NOT EXISTS idx_rollup_monitor_time ON minute_rollups(monitor_id, timestamp_ms);
```

---

## 8. Sample Queries

### 8.1. Client Registration (F2)

Upsert client on first ingest. `INSERT OR IGNORE` makes retries safe.

```sql
INSERT INTO clients (slug, name, username, hostname, mac_address, created_at, updated_at)
VALUES (:slug, :name, :username, :hostname, :mac_address, :now, :now)
ON CONFLICT(slug) DO UPDATE SET updated_at = :now;
```

### 8.2. Monitor Auto-Create (F3)

Auto-create a monitor for a new `(client_id, target_host)` pair.

```sql
INSERT INTO monitors (client_id, target_host, target_name, quality_state, created_at, updated_at)
VALUES (:client_id, :target_host, :target_name, 'warmingUp', :now, :now)
ON CONFLICT(client_id, target_host) DO NOTHING;
```

### 8.3. Ping Sample Batch Ingest (F3)

Dedup via `INSERT OR IGNORE`. Changeset returns the number of actually inserted rows.

```sql
INSERT OR IGNORE INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, error, created_at)
VALUES
  (:monitor_id, :ts1, :lat1, :status1, :addr1, :err1, :now),
  (:monitor_id, :ts2, :lat2, :status2, :addr2, :err2, :now),
  -- ... up to 1000 rows
;
```

### 8.4. Update Monitor Latest State (F3, F5)

After ingesting samples, update the monitor's cached latest state.

```sql
UPDATE monitors
SET
  last_seen_ms    = :latest_timestamp_ms,
  last_status     = :latest_status,
  last_latency_ms = :latest_latency_ms,
  quality_state   = :quality_state,
  updated_at      = :now
WHERE id = :monitor_id;
```

### 8.5. Get All Monitors with Latest State (F5)

Returns monitors with client info, ordered by recency.

```sql
SELECT
  m.id,
  c.slug AS client_slug,
  c.name AS client_name,
  m.target_host,
  m.target_name,
  m.last_status AS status,
  m.last_latency_ms AS latency_ms,
  m.quality_state,
  m.last_seen_ms,
  m.created_at
FROM monitors m
JOIN clients c ON m.client_id = c.id
ORDER BY m.last_seen_ms DESC, m.id ASC;
```

### 8.6. Get Latest Sample Per Monitor (F5 — alternative)

When the latest state is not cached on the monitor row, compute it from samples.

```sql
SELECT
  m.id,
  c.slug AS client_slug,
  c.name AS client_name,
  m.target_host,
  m.target_name,
  ps.status,
  ps.latency_ms,
  m.quality_state,
  ps.timestamp_ms AS last_seen_ms,
  m.created_at
FROM monitors m
JOIN clients c ON m.client_id = c.id
LEFT JOIN LATERAL (
  SELECT status, latency_ms, timestamp_ms
  FROM ping_samples
  WHERE monitor_id = m.id
  ORDER BY timestamp_ms DESC
  LIMIT 1
) ps ON TRUE
ORDER BY ps.timestamp_ms DESC, m.id ASC;
```

### 8.7. Get Monitor History — Raw Samples (F6)

Fetch raw samples for a monitor within a time range.

```sql
SELECT
  timestamp_ms,
  latency_ms,
  status,
  resolved_address,
  error
FROM ping_samples
WHERE monitor_id = :monitor_id
  AND timestamp_ms > :from_ms
  AND timestamp_ms <= :to_ms
ORDER BY timestamp_ms ASC;
```

### 8.8. Get Monitor History — Minute Rollups (F6)

Fetch pre-aggregated rollups for a monitor within a time range.

```sql
SELECT
  timestamp_ms,
  sample_count,
  success_count,
  failure_count,
  avg_latency,
  min_latency,
  max_latency,
  p95_latency
FROM minute_rollups
WHERE monitor_id = :monitor_id
  AND timestamp_ms >= :from_ms
  AND timestamp_ms < :to_ms
ORDER BY timestamp_ms ASC;
```

### 8.9. Compute Rollup from Raw Samples (F6)

Aggregate raw samples into a minute bucket. Used when rollup row does not yet exist.

```sql
SELECT
  :bucket_start AS timestamp_ms,
  COUNT(*)                                    AS sample_count,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
  SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failure_count,
  AVG(CASE WHEN status = 'success' THEN latency_ms END) AS avg_latency,
  MIN(CASE WHEN status = 'success' THEN latency_ms END) AS min_latency,
  MAX(CASE WHEN status = 'success' THEN latency_ms END) AS max_latency,
  -- p95 requires a subquery or application-side computation
  NULL AS p95_latency
FROM ping_samples
WHERE monitor_id = :monitor_id
  AND timestamp_ms >= :bucket_start
  AND timestamp_ms < :bucket_end;
```

### 8.10. Get Client by Slug (F2)

```sql
SELECT id, slug, name, username, hostname, mac_address, created_at, updated_at
FROM clients
WHERE slug = :slug
LIMIT 1;
```

### 8.11. Update Client Name (F11)

```sql
UPDATE clients
SET name = :name, updated_at = :now
WHERE slug = :slug;
```

### 8.12. Get Latest 100 Samples for WebSocket Snapshot (F7)

```sql
SELECT timestamp_ms, latency_ms, status, resolved_address, error
FROM ping_samples
WHERE monitor_id = :monitor_id
ORDER BY timestamp_ms DESC
LIMIT 100;
```

### 8.13. Data Retention — Delete Old Samples (F10)

```sql
DELETE FROM ping_samples
WHERE timestamp_ms < (strftime('%s', 'now', '-' || :retention_days || ' days') * 1000);
```

### 8.14. Data Retention — Delete Old Rollups (F10)

```sql
DELETE FROM minute_rollups
WHERE timestamp_ms < (strftime('%s', 'now', '-' || :retention_days || ' days') * 1000);
```

### 8.15. Find Inactive Monitors (F10)

Monitors with no data in > `MONITOR_INACTIVE_DAYS` days.

```sql
SELECT m.id, m.client_id, m.target_host, m.last_seen_ms
FROM monitors m
WHERE m.last_seen_ms < (strftime('%s', 'now', '-' || :inactive_days || ' days') * 1000)
   OR m.last_seen_ms IS NULL;
```

### 8.16. Health Endpoint — Server Metrics (F14)

```sql
-- Monitor count
SELECT COUNT(*) FROM monitors;

-- Total sample count
SELECT COUNT(*) FROM ping_samples;

-- Last ingest time
SELECT MAX(timestamp_ms) FROM ping_samples;
```

### 8.17. Rebuild Classifier State on Server Restart

Load the last 5 minutes of samples per monitor to reconstruct quality state.

```sql
SELECT m.id AS monitor_id, ps.*
FROM monitors m
LEFT JOIN ping_samples ps ON ps.monitor_id = m.id
  AND ps.timestamp_ms >= (strftime('%s', 'now', '-5 minutes') * 1000)
WHERE m.last_seen_ms IS NOT NULL
  AND m.last_seen_ms >= (strftime('%s', 'now', '-1 hour') * 1000)
ORDER BY m.id, ps.timestamp_ms;
```

### 8.18. Count Samples by Client (Dashboard aggregate)

```sql
SELECT
  c.slug,
  c.name,
  COUNT(DISTINCT m.id) AS monitor_count,
  COUNT(ps.id)          AS total_samples,
  MAX(ps.timestamp_ms)  AS last_sample_ms
FROM clients c
LEFT JOIN monitors m ON m.client_id = c.id
LEFT JOIN ping_samples ps ON ps.monitor_id = m.id
GROUP BY c.id
ORDER BY c.name;
```

---

## 9. Data Retention Policy

| Data | Default Retention | Cleanup Method |
|------|-------------------|---------------|
| `ping_samples` | 30 days (dev) / 7 days (prod) | `DELETE` rows older than retention, configurable via `RETENTION_DAYS` |
| `minute_rollups` | 90 days (dev) / 30 days (prod) | `DELETE` rows older than retention, configurable via `ROLLUP_RETENTION_DAYS` |
| `monitors` | Forever (remove if inactive > 30 days) | Detect via `last_seen_ms`, configurable via `MONITOR_INACTIVE_DAYS` |
| `clients` | Forever | Manual deletion only |

After cleanup, `VACUUM` is called periodically to reclaim disk space.

**Configuration via environment variables:**

| Variable | Dev Default | Prod Default | Description |
|----------|-----------|-------------|-------------|
| `RETENTION_DAYS` | 30 | 7 | Sample and rollup retention in days |
| `ROLLUP_RETENTION_DAYS` | 90 | 30 | Rollup retention in days |
| `MONITOR_INACTIVE_DAYS` | 30 | 30 | Days of inactivity before monitor removal |

---

## 10. SQLite Configuration

### WAL Mode

```sql
PRAGMA journal_mode = WAL;
```

WAL mode enables concurrent reads while writes occur, critical for the ingest + dashboard read pattern.

### Recommended pragmas

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;       -- Good balance of safety and speed
PRAGMA cache_size = -64000;        -- 64 MB cache (negative = KB)
PRAGMA temp_store = MEMORY;        -- Temp tables in memory
PRAGMA foreign_keys = ON;          -- Enforce FK constraints
PRAGMA busy_timeout = 5000;        -- 5s busy timeout for concurrent access
PRAGMA wal_autocheckpoint = 1000;  -- Auto-checkpoint every 1000 pages
```

### Database file locations

| Environment | Path | Config Variable |
|------------|------|----------------|
| Development | `.data/lingering.db` | `DATABASE_PATH` |
| Production | `/var/data/lingering.db` | `DATABASE_PATH` |

---

## 11. Ingest Payload Schema

The backend `POST /api/ping/ingest` accepts:

```typescript
interface IngestPayload {
  clientSlug: string;
  username?: string;
  hostname?: string;
  mac_address?: string;
  samples: PingSampleIngest[];
}

interface PingSampleIngest {
  targetHost: string;
  timestampMs: number;
  latencyMs: number | null;
  status: 'success' | 'timeout' | 'error';
  resolvedAddress: string | null;
  error: string | null;
}
```

**Constraints:**
- `samples` array: 1 to 1000 items (configurable via `INGEST_MAX_SAMPLES`).
- `timestampMs` must be within 5 minutes of the future (configurable via `INGEST_FUTURE_WINDOW_MS`).
- Raw ping fields only — no `qualityState`, `packetLoss`, `rttAvg`, or `jitter`. Backend computes these.

---

## 12. WebSocket Message Schema

### Client-to-Server

```typescript
// Subscribe to a monitor
interface SubscribeMessage {
  type: 'subscribe';
  monitorId: number;
}

// Unsubscribe from a monitor
interface UnsubscribeMessage {
  type: 'unsubscribe';
  monitorId: number;
}
```

### Server-to-Client

```typescript
// Subscription acknowledged
interface SubscribedMessage {
  type: 'subscribed';
  monitorId: number;
}

// Unsubscription acknowledged
interface UnsubscribedMessage {
  type: 'unsubscribed';
  monitorId: number;
}

// Initial data on subscribe (last 100 samples)
interface SnapshotMessage {
  type: 'snapshot';
  monitorId: number;
  data: {
    monitor: MonitorListItem;
    samples: PingSampleIngest[];  // last 100, oldest first
  };
}

// Real-time sample push
interface SampleMessage {
  type: 'sample';
  monitorId: number;
  data: PingSampleIngest;
}

// Client name change broadcast
interface ClientNameUpdatedMessage {
  type: 'client_name_updated';
  client_slug: string;
  client_name: string;
}
```

---

## 13. HistoryResponse Format (F6)

The `GET /api/monitors/:id` endpoint returns data formatted to match the LNPM desktop client's `HistoryResponse` type, consumed by uPlot charts.

```typescript
interface HistoryResponse {
  fromMs: number;
  toMs: number;
  bucketMs: number;
  series: HistorySeries[];
}

interface HistorySeries {
  target: Target;
  points: HistoryPoint[];
  intervals: QualityIntervalRecord[];
  summary: RangeSummary;
}

interface HistoryPoint {
  timestampMs: number;
  averageLatencyMs: number | null;
  minimumLatencyMs: number | null;
  maximumLatencyMs: number | null;
  sampleCount: number;
  failureCount: number;
}

interface QualityIntervalRecord {
  startMs: number;
  endMs: number | null;
  state: QualityState;
  reasons: QualityReason[];
}

type QualityState =
  | 'warmingUp'
  | 'low'
  | 'medium'
  | 'high'
  | 'veryHigh'
  | 'unstable'
  | 'disconnected';

type QualityReason =
  | 'packetLoss'
  | 'highLatency'
  | 'highJitter'
  | 'insufficientSamples';

interface RangeSummary {
  sampleCount: number;
  successCount: number;
  failureCount: number;
  packetLossPercent: number;
  averageLatencyMs: number | null;
  minimumLatencyMs: number | null;
  maximumLatencyMs: number | null;
  p95LatencyMs: number | null;
  stableMs: number;
  unstableMs: number;
  disconnectedMs: number;
  stablePercent: number;
  unstablePercent: number;
  disconnectedPercent: number;
}

interface Target {
  id: string;
  name: string;
  host: string;
  enabled: boolean;
  addressFamily: 'ipv4' | 'ipv6';
  intervalMs: number;
  timeoutMs: number;
  thresholds: {
    windowSeconds: number;
    minimumSamples: number;
    packetLossPercent: number;
    jitterMs: number;
    p95LatencyMs: number;
    unstableForSeconds: number;
    stableForSeconds: number;
    outageFailures: number;
    recoverySuccesses: number;
  };
  createdAtMs: number;
  archivedAtMs: number | null;
}
```

**Aggregation rules:**
- Default bucket size: 60,000 ms (1 minute).
- When raw bucket count exceeds `maxPoints` (default 2000, max 5000), server increases bucket size using: `[1000, 5000, 10000, 30000, 60000, 300000, 900000, 1800000, 3600000]`.
- `bucketMs` in the response tells the frontend which granularity was used.

---

## 14. Client Sync Protocol (F4)

The LNPM desktop client uses the ingest endpoint to sync local samples to the cloud backend.

**Sync flow:**
1. Client collects ping samples in its local SQLite with `cloud_synced_at_ms = NULL`.
2. **BatchBuffer** flushes when count >= 10 OR 5 seconds elapse (whichever first).
3. **SyncService** POSTs the batch to `POST /api/ping/ingest`.
4. On HTTP 2xx success, client sets `cloud_synced_at_ms = now()` for all samples in the batch.
5. On failure (network error, 5xx, timeout), client retries with exponential backoff: 3 attempts at 1s, 2s, 4s.
6. On startup, client sends all samples where `cloud_synced_at_ms IS NULL` from the last hour.
7. Every `syncIntervalMin` (default 5 minutes), client sweeps for remaining unsynced samples.

**Idempotency:** The backend's `INSERT OR IGNORE` on `(monitor_id, timestamp_ms, resolved_address)` ensures resending an already-ingested batch is a safe no-op.

**Configuration:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `batchThreshold` | 10 | Samples that trigger immediate flush |
| `batchTimeoutMs` | 5000 | Time that triggers flush regardless of count |
| `maxBatchSize` | 1000 | Maximum samples per POST (matches server limit) |
| `retryAttempts` | 3 | Number of retry attempts |
| `retryBaseDelayMs` | 1000 | Base delay for exponential backoff |
| `syncIntervalMin` | 5 | Periodic sync sweep interval in minutes |
