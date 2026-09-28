---
name: M1-T3-code-analysis
description: Code analysis for M1-T3 database schema migrations — existing files, gaps, patterns
metadata:
  type: project
---

# M1-T3 Code Analysis — Database Schema Migrations

## Related Files

### Migration files (already exist, created during M1-T2)
- `dashboard/schema/migrations/001_create_clients.sql` — clients table (8 columns, missing F9 sync columns)
- `dashboard/schema/migrations/002_create_monitors.sql` — monitors with FK to clients, UNIQUE(client_id, target_host)
- `dashboard/schema/migrations/003_create_ping_samples.sql` — ping_samples with FK to monitors, UNIQUE dedup
- `dashboard/schema/migrations/004_create_minute_rollups.sql` — minute_rollups with FK to monitors
- `dashboard/schema/migrations/005_create_indexes.sql` — all 8 indexes

### Schema reference
- `dashboard/schema/index.sql` — assembled full schema (matches migrations 001-005)

### Database plugin (existing, do not modify)
- `dashboard/server/plugins/database.ts` — SQLite plugin with WAL mode, migration runner, globalThis assignment

### Tests (existing, do not modify)
- `dashboard/server/plugins/database.test.ts` — unit tests for singleton, migrations, pragmas
- `dashboard/server/plugins/database.integration.test.ts` — integration tests with mock DB

### Specification documents
- `requirements/data-models/data-models.md` — authoritative schema spec (4 tables, 8 indexes, migration order)
- `requirements/features/feature-0002-client-identity.md` — F2 client identity (slug generation)
- `requirements/features/feature-0003-ping-ingest.md` — F3 ping ingest (dedup strategy)
- `requirements/features/feature-0009-client-settings.md` — F9 client settings (sync columns)
- `requirements/features/feature-00012-quality-classifier.md` — F12 quality classifier (quality_state)
- `requirements/architecture.md` — ADR-001 through ADR-009

## Reusable Code

### Migration runner (already complete)
The `runMigrations()` function in `database.ts` handles:
- Reading `schema/migrations/` directory
- Filtering `.sql` files and sorting by name
- Tracking applied migrations in a `migrations` table
- Executing via `db.exec(sql)` and recording via `INSERT INTO migrations`
- Error handling with `try/catch` and re-throw on failure

No changes needed — it already supports any number of migrations.

### Pragma configuration (already complete)
All 7 recommended pragmas are applied in `getDatabase()`:
- `journal_mode = WAL`
- `foreign_keys = ON`
- `synchronous = NORMAL`
- `cache_size = -64000`
- `temp_store = MEMORY`
- `busy_timeout = 5000`
- `wal_autocheckpoint = 1000`

## Gap Analysis

### F9 Sync columns missing from `clients` table
The `001_create_clients.sql` migration does NOT include the F9 sync columns specified in `feature-0009-client-settings.md`:

```sql
-- Missing columns:
sync_enabled          BOOLEAN NOT NULL DEFAULT 1;
sync_interval_min     INTEGER NOT NULL DEFAULT 5;
backend_url           TEXT    NOT NULL DEFAULT '';
last_synced_at_ms     INTEGER NULL;
```

**Resolution options:**
1. **Add to 001 directly** — modify the CREATE TABLE to include these columns. Cleanest approach since no data exists yet.
2. **Add as migration 006** — separate ALTER TABLE migration. More aligned with migration best practices but unnecessary since this is a fresh schema.

**Recommendation:** Add directly to migration 001 since the schema is fresh (no production data). Simpler than a separate migration.

### `idx_clients_last_synced` index missing
F9 specifies `CREATE INDEX IF NOT EXISTS idx_clients_last_synced ON clients(last_synced_at_ms);` which is not in the current migration 005.

**Resolution:** Add to migration 005 alongside the existing 8 indexes (becomes 9 total).

## Patterns to Follow

### SQL conventions
- `CREATE TABLE IF NOT EXISTS` for idempotency
- `CREATE INDEX IF NOT EXISTS` for idempotency
- `INTEGER PRIMARY KEY AUTOINCREMENT` for surrogate keys
- `REFERENCES ... ON DELETE CASCADE` for foreign keys
- `TEXT NOT NULL UNIQUE` for unique constraints (inline on column for `slug`, table-level for compound keys)
- `INTEGER NOT NULL` for timestamp columns (UTC epoch milliseconds)
- `REAL DEFAULT NULL` for nullable numeric columns
- `TEXT DEFAULT 'warmingUp'` for enum-like text columns
- Comment headers: `-- 00X_name.sql` + `-- F#: Feature description`

### Migration file structure
```sql
-- 00X_name.sql
-- F#: Feature reference
-- Description of what this migration does.

CREATE TABLE IF NOT EXISTS ...;
```

### Naming conventions
- Table names: snake_case plural (`clients`, `ping_samples`, `minute_rollups`)
- Column names: snake_case (`target_host`, `quality_state`, `created_at`)
- Index names: `idx_<table>_<columns>` (`idx_clients_slug`, `idx_ping_monitor_time`)
- Migration files: `00X_description.sql` (3-digit zero-padded prefix)

## Code to Avoid Modifying

- `src/` — desktop app code, must not be modified
- `src-tauri/` — Rust backend, must not be modified
- `dashboard/server/plugins/database.ts` — migration runner, do not modify
- `dashboard/server/plugins/database.test.ts` — existing tests, do not modify
- `dashboard/server/plugins/database.integration.test.ts` — existing tests, do not modify

## Architectural Decisions

- **ADR-002**: SQLite with WAL mode — storage engine choice, already implemented
- **Migration order**: clients → monitors → ping_samples → minute_rollups → indexes (FK dependency order)
- **F9 sync columns**: Adding to 001_create_clients.sql directly (fresh schema, no data)
- **F9 index**: Adding `idx_clients_last_synced` to 005_create_indexes.sql

## Verification Checklist

- [ ] All 5 migration files match the data models spec
- [ ] F9 sync columns added to clients table (migration 001)
- [ ] F9 `idx_clients_last_synced` index added (migration 005)
- [ ] All 8 indexes present (now 9 with F9)
- [ ] Foreign keys with CASCADE DELETE correct
- [ ] UNIQUE constraints correct
- [ ] Default values match spec
- [ ] Migrations execute on fresh database
- [ ] `npx nuxi typecheck` passes
- [ ] `dashboard/schema/index.sql` updated to reflect changes

[[M1-T3-session-context]] — task context
[[decisions-made]] — M1-T2 decisions for reference
[[patterns-established]] — M1-T2 patterns (Nitro plugin, SQLite singleton, migration runner)
