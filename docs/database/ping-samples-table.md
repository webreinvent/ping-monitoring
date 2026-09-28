# Database: `ping_samples` Table

**Migration:** `003_create_ping_samples.sql`
**Feature:** F3 (Ping data ingest)

## Purpose

Stores raw individual ping probe results. Each row represents a single ping event from a specific monitor at a specific timestamp. The table is the primary data source for:

- Real-time monitoring dashboards
- Historical trend analysis
- Anomaly detection
- Quality classification (F12 — planned)
- Pre-aggregated rollups (F13 — planned)

## Schema

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

## Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Auto-incrementing row ID |
| `monitor_id` | `INTEGER` | `NOT NULL`, `REFERENCES monitors(id) ON DELETE CASCADE` | Foreign key to the owning monitor |
| `timestamp_ms` | `INTEGER` | `NOT NULL` | Unix epoch milliseconds when the ping was sent |
| `latency_ms` | `REAL` | `DEFAULT NULL` | Round-trip latency in milliseconds. `NULL` for timeout/error status. |
| `status` | `TEXT` | `NOT NULL` | Ping result: `"success"`, `"timeout"`, or `"error"` |
| `resolved_address` | `TEXT` | `DEFAULT NULL` | Resolved IP address. `NULL` for timeout/error status. |
| `error` | `TEXT` | `DEFAULT NULL` | Error message (if any) for timeout/error status. |
| `created_at` | `INTEGER` | `NOT NULL` | Unix epoch milliseconds when the row was created (server-side, not client timestamp). |

## Unique Constraint

```sql
UNIQUE(monitor_id, timestamp_ms, resolved_address)
```

This constraint powers the **deduplication** mechanism:

- **Purpose:** Ensures the same ping sample cannot be inserted twice.
- **Mechanism:** `INSERT OR IGNORE` silently skips rows that would violate this constraint.
- **Dedup key:** The combination of `(monitor_id, timestamp_ms, resolved_address)` uniquely identifies a sample. Two samples with the same timestamp but different resolved addresses are considered distinct (e.g., a target that changed IP).
- **Implementation:** The `better-sqlite3` `changes` property returns `0` when a row is ignored, enabling the ingest engine to count duplicates.

## Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_ping_monitor_time` | `(monitor_id, timestamp_ms)` | Time-series queries — fetching samples for a monitor in chronological order |
| `idx_ping_status` | `(status)` | Filtering by status (e.g., "show all failures") |

## Relationships

```
monitors (1) ──┬── (N) ping_samples
               │
               └── ON DELETE CASCADE: deleting a monitor removes all its samples
```

## Data Flow

```
Client → POST /api/ping/ingest
  → validateSample() (per sample)
    → INSERT OR IGNORE INTO ping_samples
      → Dedup via UNIQUE(monitor_id, timestamp_ms, resolved_address)
        → changes > 0 → accepted
        → changes = 0 → duplicate
```

## Query Patterns

### Fetch samples for a monitor within a time range

```sql
SELECT timestamp_ms, latency_ms, status, resolved_address, error
FROM ping_samples
WHERE monitor_id = ?
  AND timestamp_ms BETWEEN ? AND ?
ORDER BY timestamp_ms ASC;
```

### Count samples by status for a monitor

```sql
SELECT status, COUNT(*) as cnt
FROM ping_samples
WHERE monitor_id = ?
  AND timestamp_ms BETWEEN ? AND ?
GROUP BY status;
```

### Latest sample for a monitor

```sql
SELECT timestamp_ms, latency_ms, status, resolved_address, error
FROM ping_samples
WHERE monitor_id = ?
ORDER BY timestamp_ms DESC
LIMIT 1;
```

## Edge Cases

- **NULL `latency_ms`:** Allowed for timeout/error status. The unique constraint still applies — two error samples at the same timestamp for the same monitor are deduplicated.
- **NULL `resolved_address`:** Allowed for timeout/error status. When `resolved_address` is `NULL`, the unique constraint treats all `NULL` values as equal (SQLite `UNIQUE` constraint behavior), so duplicate error samples at the same timestamp are correctly deduplicated.
- **Large timestamps:** `INTEGER` stores up to 64-bit signed integers. Unix epoch milliseconds are ~13 digits, well within range.
- **Cascade delete:** When a monitor is deleted, all its ping samples are automatically removed via `ON DELETE CASCADE`.

## Retention

No automatic retention policy is currently implemented. The table grows indefinitely. Planned future features:

- **F13 (Minute rollups):** Pre-aggregated data reduces the need to query raw samples
- **TTL-based cleanup:** Periodic removal of samples older than a configurable window (e.g., 30 days)

## Related

- [Database Schema](../database/schema.md) — Full schema reference
- [Monitors Table](monitors-table.md) — Parent table
- [Ping Ingest Engine](../utils/ping-ingest.md) — Insert pipeline
- [Indexes](indexes.md) — All index definitions
- [Feature F3 Specification](../../requirements/features/feature-0003-ping-ingest.md) — Original requirements
