---
id: F14
name: Health check endpoint
phase: Growth
priority: Low
effort: Small
dependencies: [F1, F2, F3]
---

# F14: Health check endpoint

## Description
Extend the existing `GET /api/health` endpoint (initially created in F1 with basic `status`, `timestamp`, `uptime`, and `version`) to return comprehensive server health metrics including database size, monitor count, and last ingest time. This endpoint is used by external monitoring services (Uptime Robot, Pingdom, Cloudflare Health Checks) and internal dashboards to verify the backend is operating correctly and accepting data.

## Acceptance Criteria

### Given/When/Then

- **Given** the server is running, **when** a GET request is made to `/api/health`, **then** it returns a 200 OK with JSON containing `status: "ok"`, `timestamp`, `uptime`, `version`, `db_size_bytes`, `monitor_count`, `sample_count`, and `last_ingest_time`.
- **Given** the server has been running for some time with ingested data, **when** a health check is performed, **then** `db_size_bytes` reflects the actual SQLite file size on disk, `monitor_count` reflects the total number of monitors in the database, `sample_count` reflects the total number of ping samples, and `last_ingest_time` is an ISO 8601 timestamp of the most recent ping sample.
- **Given** no ping samples have been ingested yet, **when** a health check is performed, **then** `last_ingest_time` is `null`, `monitor_count` is `0`, and `sample_count` is `0`.
- **Given** the server is running, **when** the health check endpoint is called, **then** the response time is under 100ms (no heavy queries — all metrics use simple COUNT or file system stats).
- **Given** the database file exists, **when** a health check is performed, **then** `db_size_bytes` includes the main database file size (not WAL or journal files).
- **Given** the endpoint is called repeatedly, **when** comparing responses, **then** `uptime` increases while other metrics remain stable unless new data is ingested.
- **Given** no authentication is provided, **when** a health check is performed, **then** it still returns a successful response — the endpoint must be publicly accessible for external monitoring.

## Implementation Notes

### Extending the existing endpoint
The health endpoint was initially scaffolded in F1 (`src/server/api/health.get.ts`). This feature enhances it with database and filesystem metrics without changing the route path or response contract structure (only adding fields).

### Metric sources
- **`status`** — Always `"ok"` if the endpoint responds. A failure to respond (crash, DB corruption) is the failure scenario.
- **`timestamp`** — `new Date().toISOString()` at response time.
- **`uptime`** — `process.uptime()` in seconds, rounded to 2 decimal places.
- **`version`** — Read from `package.json` `version` field (cached at server start).
- **`db_size_bytes`** — Use `fs.statSync(DATABASE_PATH).size` to get the SQLite main file size. Also return `db_path` for reference.
- **`monitor_count`** — `SELECT COUNT(*) FROM monitors` — a simple COUNT, negligible cost.
- **`sample_count`** — `SELECT COUNT(*) FROM ping_samples` — a simple COUNT. For large tables, consider `PRAGMA table_info` or an approximate row count, but better-sqlite3 handles COUNT efficiently on indexes.
- **`last_ingest_time`** — `SELECT MAX(timestamp_ms) FROM ping_samples` converted to ISO 8601. Returns `null` if no samples exist.

### Performance considerations
- All database queries are simple aggregates (COUNT, MAX) — no full table scans required.
- The `ping_samples` table has an implicit index via its primary key; consider adding an explicit index on `timestamp_ms` if COUNT/MAX becomes slow with millions of rows (defer to profiling).
- File system stat is synchronous but cheap — `fs.statSync` is acceptable for a health check called infrequently (e.g., every 1–5 minutes by external monitors).
- No caching needed — the endpoint is not a hot path.

### Environment variables
- `DATABASE_PATH` — Already configured in F1. Used to resolve the SQLite file path for size calculation.

### Files to modify
```
src/
  server/
    api/
      health.get.ts              # Extend with db_size, monitor_count, sample_count, last_ingest_time
    utils/
      db.ts                      # Already exists, may add helper queries if needed
```

## Data Model Changes

No schema changes. This feature reads from existing tables (`monitors`, `ping_samples`) and the SQLite file on disk.

## API Contract

### GET /api/health

**Request:**
```
GET /api/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-07-31T12:00:00.000Z",
  "uptime": 3600.42,
  "version": "0.1.0",
  "db_path": "/Users/pk/Projects/ping-monitoring/.data/lingering.db",
  "db_size_bytes": 524288,
  "monitor_count": 42,
  "sample_count": 158734,
  "last_ingest_time": "2026-07-31T11:59:58.000Z"
}
```

**Response (200 OK) — No data ingested yet:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-31T12:00:00.000Z",
  "uptime": 10.5,
  "version": "0.1.0",
  "db_path": "/Users/pk/Projects/ping-monitoring/.data/lingering.db",
  "db_size_bytes": 8192,
  "monitor_count": 0,
  "sample_count": 0,
  "last_ingest_time": null
}
```

**No authentication required. No request body. No query parameters.**

### Response field types

| Field | Type | Description |
|---|---|---|
| `status` | string | Always `"ok"` if endpoint responds |
| `timestamp` | string | ISO 8601 server time |
| `uptime` | number | Server uptime in seconds (2 decimal places) |
| `version` | string | Backend version from package.json |
| `db_path` | string | Absolute path to SQLite database file |
| `db_size_bytes` | number | Size of the main SQLite file in bytes |
| `monitor_count` | number | Total monitors in database |
| `sample_count` | number | Total ping samples in database |
| `last_ingest_time` | string or null | ISO 8601 timestamp of most recent sample, or `null` |
