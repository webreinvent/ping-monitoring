---
id: F10
name: Data retention cleanup
phase: Enhancement
priority: Medium
effort: Medium
dependencies: [F1, F3]
---

# F10: Data retention cleanup

## Description

Implement a scheduled background task that periodically purges old ping samples and rollup data beyond configurable retention periods. This prevents unbounded growth of the SQLite database while preserving recent data needed for active monitoring charts and dashboards. The cleanup runs on a timer, logs statistics about what was removed, and respects configurable policies per data tier.

## Acceptance Criteria

### Given/When/Then

- **Given** the server is running with default retention settings, **when** the scheduled cleanup runs, **then** raw ping samples older than 30 days and minute rollups older than 90 days are deleted.
- **Given** a client has no monitors or samples, **when** cleanup runs, **then** no rows are affected and the log reports zero deletions.
- **Given** the retention period is configured to a shorter value (e.g., 7 days), **when** cleanup runs, **then** only samples newer than the configured period remain.
- **Given** the cleanup deletes rows, **when** it completes, **then** the server log records the number of deleted samples, rollups, and the time taken in milliseconds.
- **Given** the cleanup interval is configured, **when** that interval elapses, **then** the cleanup task executes automatically without external triggers.
- **Given** the database is under heavy write load from ingest, **when** cleanup runs, **then** it does not block or stall active ingest requests (uses a separate transaction).
- **Given** the retention settings are changed at runtime, **when** the next cleanup runs, **then** it uses the new values without requiring a server restart.
- **Given** the retention cleanup is disabled via configuration, **when** the scheduled interval fires, **then** no deletion occurs and a log message confirms the skip.

## Implementation Notes

### Background task

- Use a Node.js `setInterval` timer started in a Nitro plugin (`server/plugins/retention.ts`) on server boot.
- Run inside a `try/catch` so a failure in one cycle does not crash the server.
- Each cycle wraps deletions in a single SQLite transaction (`BEGIN ... COMMIT`) for atomicity and performance.
- After deletions, optionally run `VACUUM` on a less frequent schedule (e.g., weekly) to reclaim disk space — but only if the total rows deleted exceed a threshold (e.g., 10,000), since `VACUUM` is expensive.

### Configuration

Exposed via environment variables with sensible defaults:

| Variable | Default | Description |
|---|---|---|
| `RETENTION_ENABLED` | `true` | Enable/disable cleanup entirely |
| `RETENTION_SAMPLE_DAYS` | `30` | Delete raw ping samples older than N days |
| `RETENTION_ROLLUP_DAYS` | `90` | Delete minute rollups older than N days |
| `RETENTION_INTERVAL_MIN` | `60` | How often (in minutes) the cleanup runs |
| `RETENTION_VACUUM_THRESHOLD` | `10000` | Minimum rows deleted before triggering a VACUUM |

Values are read lazily at the start of each cleanup cycle, so changing environment variables and restarting the server picks up new values. For true runtime reload without restart, add a `GET /api/admin/retention/config` endpoint later.

### SQL operations

```sql
-- Delete old raw ping samples
DELETE FROM ping_samples
WHERE timestamp_ms < strftime('%s', 'now', '-' || ? || ' days') * 1000
RETURNING count(*)

-- Delete old minute rollups
DELETE FROM minute_rollups
WHERE timestamp_ms < strftime('%s', 'now', '-' || ? || ' days') * 1000
RETURNING count(*)
```

Note: `RETURNING` is supported by SQLite 3.35+. If the target SQLite version does not support it, run a `COUNT(*)` with the same `WHERE` clause before the `DELETE`.

### Logging

Each cleanup cycle produces a structured log entry:

```
[retention] cleanup cycle: deleted 12453 ping_samples, 842 minute_rollups in 234ms
```

If nothing was deleted:

```
[retention] cleanup cycle: nothing to purge (0 samples, 0 rollups) in 12ms
```

If disabled:

```
[retention] cleanup skipped: RETENTION_ENABLED is false
```

### Files

```
src/
  server/
    plugins/
      retention.ts              # Scheduled cleanup task, timer setup
    utils/
      retention.ts               # Core delete logic (transaction, queries, logging)
```

### Edge cases

- **Empty database**: No error when `ping_samples` or `minute_rollups` are empty — `DELETE` with zero matches is safe.
- **Time drift**: Use server-side `Date.now()` (or `new Date()`), not client-supplied timestamps, for the cutoff calculation.
- **Partial failures**: If the sample deletion succeeds but the rollup deletion fails, the transaction rolls back. Log the error and retry on the next cycle.
- **First run**: On the very first server start, there is no backfill or migration — only data past the cutoff is removed. If a large backlog exists, the first cycle may take longer; log a warning if the cycle exceeds 5 seconds.

## Data Model Changes

No new tables or columns. Reuses existing schema:

- `ping_samples` — rows deleted based on `timestamp_ms` cutoff
- `minute_rollups` — rows deleted based on `timestamp_ms` cutoff

No schema migration is needed. The cleanup operates on existing columns.

## API Contract

No new public API endpoints are introduced by this feature. Cleanup is driven entirely by a scheduled background task.

An optional admin endpoint can be added later for manual triggering and configuration inspection:

### Optional: GET /api/admin/retention/status

**Request**

```
GET /api/admin/retention/status
```

**Response (200 OK)**

```json
{
  "enabled": true,
  "sampleRetentionDays": 30,
  "rollupRetentionDays": 90,
  "intervalMinutes": 60,
  "lastRun": "2026-07-31T10:30:00.000Z",
  "lastRunDurationMs": 234,
  "lastRunDeleted": {
    "pingSamples": 12453,
    "minuteRollups": 842
  },
  "nextRun": "2026-07-31T11:30:00.000Z"
}
```

### Optional: POST /api/admin/retention/run

**Request**

```
POST /api/admin/retention/run
```

**Response (200 OK)**

```json
{
  "success": true,
  "deletedPingSamples": 12453,
  "deletedMinuteRollups": 842,
  "durationMs": 234
}
```

These endpoints are marked optional and deferred — they require authentication middleware not yet in scope. The core cleanup functionality works without them.
