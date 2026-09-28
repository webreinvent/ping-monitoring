# Migration 006: Add quality_state_updated_at Column

**File:** `schema/migrations/006_add_quality_state_updated_at.sql`
**Feature:** F12 (Backend quality classifier)
**Task:** M1-T10

## Purpose

Adds the `quality_state_updated_at` column to the `monitors` table to track when the last quality classification was computed. Also migrates existing legacy quality state values to F12 equivalents.

## Schema Changes

### New Column

```sql
ALTER TABLE monitors ADD COLUMN quality_state_updated_at INTEGER;
```

- **Type:** `INTEGER` (nullable, epoch milliseconds)
- **Nullable:** Yes — existing rows will have `NULL` until the first classification run
- **Purpose:** Tracks the timestamp of the last quality state computation, enabling the UI and API to know how fresh a quality state is

### Legacy State Migration

```sql
-- Migrate existing quality states to F12 equivalents
UPDATE monitors SET quality_state = 'disconnected' WHERE quality_state = 'warmingUp';
UPDATE monitors SET quality_state = 'veryHigh' WHERE quality_state = 'good';
UPDATE monitors SET quality_state = 'medium' WHERE quality_state = 'degraded';
UPDATE monitors SET quality_state = 'low' WHERE quality_state = 'poor';
```

### Migration Map

| Legacy Value | F12 Equivalent | Rationale |
|-------------|---------------|-----------|
| `warmingUp` | `disconnected` | Monitors with no sufficient data are treated as disconnected |
| `good` | `veryHigh` | Closest F12 equivalent (good = very good connectivity) |
| `degraded` | `medium` | Direct mapping |
| `poor` | `low` | Direct mapping |

## Resulting `monitors` Table Schema

After this migration, the `monitors` table has these columns:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `INTEGER` | No | Auto-increment | Primary key |
| `client_id` | `INTEGER` | No | — | Foreign key to `clients.id` |
| `target_host` | `TEXT` | No | — | Target hostname or IP |
| `target_name` | `TEXT` | Yes | — | Human-readable name |
| `quality_state` | `TEXT` | No | `'warmingUp'` | F12 quality classification |
| `quality_state_updated_at` | `INTEGER` | Yes | — | Epoch ms of last classification |
| `last_seen_ms` | `INTEGER` | Yes | — | Epoch ms of latest sample |
| `last_status` | `TEXT` | Yes | — | Latest ping status |
| `last_latency_ms` | `REAL` | Yes | — | Latest latency in ms |
| `created_at` | `INTEGER` | No | — | Row creation timestamp |
| `updated_at` | `INTEGER` | No | — | Last update timestamp |

## Rollback

To reverse this migration, you would need:

```sql
-- Note: SQLite does not support DROP COLUMN in all versions
-- Alternative: create new table without the column and copy data
```

**Note:** SQLite does not support `DROP COLUMN` in older versions. To roll back, you would need to create a new table without the column, copy data, and rename tables.

## Related

- [Quality Classifier](../utils/quality-classifier.md) — Writes to `quality_state_updated_at` during classification
- [Monitors Table Schema](./schema.md) — Full schema reference
- [Migration Runner](./migrations.md) — How migrations are applied
- [Feature F12 Specification](../../requirements/features/feature-00012-quality-classifier.md) — Original requirements
