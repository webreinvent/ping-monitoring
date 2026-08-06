# Sync Storage — Database Schema Changes (M2-T9 / F4)

## Purpose

Schema migration from v1 to v2 adds `cloud_synced_at_ms` column to `ping_samples` table and creates an index for efficient unsynced sample queries. Supports the cloud sync feature (F4) by tracking which samples have been forwarded to the dashboard.

## File

`src-tauri/src/storage.rs`

## Schema Changes

### Version Bump
- `SCHEMA_VERSION` constant: `1` → `2`

### New Column
- **Table**: `ping_samples`
- **Column**: `cloud_synced_at_ms INTEGER` (nullable)
- **Migration**: `ALTER TABLE ping_samples ADD COLUMN cloud_synced_at_ms INTEGER`
- **Idempotent**: Uses `PRAGMA table_info('ping_samples')` to detect if column exists; `ALTER TABLE` only runs when column is missing

### New Index
```sql
CREATE INDEX idx_ping_samples_unsynced ON ping_samples(cloud_synced_at_ms, timestamp_ms)
```

This composite index enables efficient queries for unsynced samples:
- `cloud_synced_at_ms IS NULL` — finds unsynced rows without full table scan
- `timestamp_ms >= ?` — filters by time window (last hour on batch timer, all on periodic sweep)

## New Methods

### `Database::unsynced_samples(since_ms: i64) → StorageResult<Vec<PingSample>>`

```sql
SELECT target_id, timestamp_ms, latency_ms, status, resolved_address, error
FROM ping_samples
WHERE cloud_synced_at_ms IS NULL AND timestamp_ms >= ?
ORDER BY timestamp_ms
```

- **Parameters**: `since_ms` — only return samples newer than this timestamp
- **Usage**: Pass `0` for all unsynced, or `(now - 3600000)` for last hour
- **Returns**: Ordered by timestamp ascending (oldest first)

### `Database::mark_samples_synced(target_ids, from_ms, to_ms, synced_at_ms) → StorageResult<()>`

```sql
UPDATE ping_samples SET cloud_synced_at_ms = ?1
WHERE target_id = ?2 AND timestamp_ms >= ?3 AND timestamp_ms <= ?4
AND cloud_synced_at_ms IS NULL
```

- **Parameters**:
  - `target_ids`: List of target IDs to mark
  - `from_ms`, `to_ms`: Time range of the batch
  - `synced_at_ms`: Epoch ms timestamp of the successful sync
- **Pattern**: Loops over each `target_id`, running one UPDATE per target
- **Guard**: Only marks rows where `cloud_synced_at_ms IS NULL` — prevents re-marking

## Migration Flow

```
initialize()
  ├─ CREATE TABLE IF NOT EXISTS ... (all base tables)
  ├─ SELECT version FROM schema_info
  │   ├─ None → INSERT version = 2 (new database)
  │   ├─ version > 2 → Error (unsupported future schema)
  │   ├─ version < 2 → Run migration:
  │   │   ├─ ALTER TABLE ping_samples ADD COLUMN cloud_synced_at_ms INTEGER
  │   │   ├─ CREATE INDEX idx_ping_samples_unsynced (...)
  │   │   └─ UPDATE schema_info SET version = 2
  │   └─ version == 2 → No-op (already at current version)
```

## Write Behavior

- **`write_sample()`**: Leaves `cloud_synced_at_ms` as `NULL` on insert (the column is nullable; no value in INSERT statement means NULL)
- New samples are automatically "unsynced" — no change to existing write logic

## Backward Compatibility

- Existing databases with schema v1: Migration runs automatically on next `initialize()` call
- The `ALTER TABLE` adds the column with all existing rows having `NULL` for `cloud_synced_at_ms` — meaning all existing data is "unsynced" (correct: it hasn't been synced to any dashboard)
- The index is created after the column — no data migration needed

## Test Coverage

- **`deserializes_settings_saved_before_cloud_sync`** (`domain.rs`): Verifies old AppSettings JSON loads with default sync values
- **Migration idempotency**: `initialize()` can be called multiple times without error
