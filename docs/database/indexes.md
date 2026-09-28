# Database: Indexes

**Migration:** `005_create_indexes.sql`
**Features:** F1 (Backend setup), F3 (Ping ingest), F9 (Client settings)

## Purpose

Indexes optimize query performance for the most common access patterns: client lookup, monitor listing, time-series queries, and status filtering. All indexes are created in a single migration file (`005_create_indexes.sql`) and are idempotent (`IF NOT EXISTS`).

## Index Definitions

### `clients` Table

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_clients_slug` | `slug` | Fast client lookup by slug (primary access pattern for ingest and client APIs) |
| `idx_clients_mac` | `mac_address` | MAC-based lookups (used for client identity verification) |
| `idx_clients_last_synced` | `last_synced_at_ms` | Sync tracking queries (finding stale clients, last active) |

### `monitors` Table

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_monitors_client` | `client_id` | List monitors for a specific client (sidebar, dashboard) |
| `idx_monitors_last_seen` | `last_seen_ms` | Freshness queries (find stale monitors, sort by last seen) |
| `idx_monitors_client_target` | `(client_id, target_host)` | Composite index for monitor auto-creation uniqueness check |

### `ping_samples` Table

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_ping_monitor_time` | `(monitor_id, timestamp_ms)` | Time-series queries — fetching samples for a monitor in chronological order |
| `idx_ping_status` | `status` | Filtering by status (e.g., "show all failures") |

### `minute_rollups` Table

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_rollup_monitor_time` | `(monitor_id, timestamp_ms)` | Time-series queries on pre-aggregated data |

## SQL

```sql
CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_mac ON clients(mac_address);
CREATE INDEX IF NOT EXISTS idx_clients_last_synced ON clients(last_synced_at_ms);
CREATE INDEX IF NOT EXISTS idx_monitors_client ON monitors(client_id);
CREATE INDEX IF NOT EXISTS idx_monitors_last_seen ON monitors(last_seen_ms);
CREATE INDEX IF NOT EXISTS idx_monitors_client_target ON monitors(client_id, target_host);
CREATE INDEX IF NOT EXISTS idx_ping_monitor_time ON ping_samples(monitor_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_ping_status ON ping_samples(status);
CREATE INDEX IF NOT EXISTS idx_rollup_monitor_time ON minute_rollups(monitor_id, timestamp_ms);
```

## Index vs. Unique Constraints

The following unique constraints also serve as indexes (SQLite automatically creates an index for each `UNIQUE` constraint):

| Table | Constraint | Serves As |
|-------|-----------|-----------|
| `clients` | `UNIQUE(slug)` | Client lookup (covered by `idx_clients_slug` — redundant but explicit) |
| `monitors` | `UNIQUE(client_id, target_host)` | Monitor auto-creation dedup (covered by `idx_monitors_client_target`) |
| `ping_samples` | `UNIQUE(monitor_id, timestamp_ms, resolved_address)` | Sample dedup (NOT covered by an explicit index — the constraint's implicit index is used) |
| `minute_rollups` | `UNIQUE(monitor_id, timestamp_ms)` | Rollup dedup (covered by `idx_rollup_monitor_time`) |

## Creating New Indexes

When adding a new index:

1. **Do not modify `005_create_indexes.sql`** — existing migrations should never be changed.
2. Create a new migration file (e.g., `006_add_index_foo.sql`):

```sql
CREATE INDEX IF NOT EXISTS idx_foo_bar ON foo(bar);
```

3. The migration runner will automatically detect and apply it on the next server restart.

## Performance Considerations

- **Write overhead:** Each index adds write cost during `INSERT`/`UPDATE`. The current set is conservative — only indexes for actual query patterns.
- **Time-series indexes:** `idx_ping_monitor_time` is the most critical index — it supports the primary query pattern (fetch samples for a monitor in time order).
- **Composite indexes:** `(client_id, target_host)` and `(monitor_id, timestamp_ms)` are composite indexes that cover both single-column and two-column queries.
- **SQLite WAL mode:** With WAL mode enabled (see [Database Schema](../database/schema.md)), indexes are updated in the write-ahead log, allowing concurrent reads during index maintenance.

## Related

- [Database Schema](../database/schema.md) — Full schema reference
- [Database Plugin](../database/schema.md) — Migration runner, pragma settings
- [Feature F3 Specification](../../requirements/features/feature-0003-ping-ingest.md) — Query patterns that drive index design
