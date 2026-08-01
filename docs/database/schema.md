# Database — SQLite with better-sqlite3

**Files:** `server/plugins/database.ts`, `server/utils/db.ts`
**Database:** SQLite via `better-sqlite3` (synchronous)
**Default Path:** `.data/lingering.db` (configurable via `DATABASE_PATH`)

## Overview

The database plugin initializes a SQLite connection with WAL mode, foreign key constraints, and recommended performance pragmas. It then runs any pending migrations before the server accepts requests. The connection is stored on `globalThis.__db` for access from API routes and server utilities.

## Initialization Flow

```
1. Nitro starts → database plugin loads
2. getDatabase() creates/opens SQLite connection
3. Enable WAL mode (journal_mode = WAL)
4. Enable foreign keys (foreign_keys = ON)
5. Apply performance pragmas (synchronous, cache_size, temp_store, busy_timeout, wal_autocheckpoint)
6. runMigrations() — apply pending migrations in order
7. Store on globalThis.__db
8. Register cleanup function for graceful shutdown
```

## Database Plugin

**File:** `server/plugins/database.ts`

### Connection

```typescript
import Database from "better-sqlite3";
import { resolve } from "node:path";

// Default path, overridden by DATABASE_PATH env var
const dbPath = (process.env.DATABASE_PATH as string) || ".data/lingering.db";
const fullDbPath = resolve(dbPath);

// Ensure directory exists
const dbDir = fullDbPath.substring(0, fullDbPath.lastIndexOf("/"));
if (dbDir && !existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Open with WAL mode
const db = new Database(fullDbPath);
db.pragma("journal_mode = WAL");    // Concurrent reads during writes
db.pragma("foreign_keys = ON");     // Enforce FK constraints
```

### Pragma Settings

| Pragma | Value | Purpose |
|--------|-------|---------|
| `journal_mode` | `WAL` | Write-Ahead Logging — concurrent reads during writes |
| `foreign_keys` | `ON` | Enforce foreign key constraints |
| `synchronous` | `NORMAL` | Balance between safety and performance |
| `cache_size` | `-64000` | 64 MB page cache (negative = kilobytes) |
| `temp_store` | `MEMORY` | Store temporary tables and indexes in memory |
| `busy_timeout` | `5000` | Wait up to 5 seconds before returning `SQLITE_BUSY` |
| `wal_autocheckpoint` | `1000` | Auto-checkpoint after 1000 pages |

### `globalThis` Access Pattern

The database instance is stored on `globalThis` after initialization:

```typescript
export default defineNitroPlugin(() => {
  const db = getDatabase();
  (globalThis as any).__db = db;

  // Return cleanup function for graceful shutdown
  return () => {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
  };
});
```

### Graceful Shutdown

The plugin returns a cleanup function that Nitro calls on server shutdown:

- Closes the database connection with `dbInstance.close()`
- Logs the closure via `info("Database connection closed")`
- Handles errors gracefully — logs failures but doesn't throw
- Resets `dbInstance` to `null` in a `finally` block

## DB Helper

**File:** `server/utils/db.ts`

Provides a typed accessor for the database instance:

```typescript
import type { Database } from "better-sqlite3";

export function getDb(): Database {
  const db = globalThis.__db;
  if (!db) {
    throw new Error(
      "Database not initialized. Ensure database plugin is loaded.",
    );
  }
  return db;
}
```

### Usage

```typescript
import { getDb } from "~/server/utils/db";

// In an API route
export default defineEventHandler(() => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM monitors").all();
  return { monitors: rows };
});
```

## Migrations

### Migration Tracking Table

Created automatically by the database plugin (not a migration file):

```sql
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Migration Directory

- **Location:** `schema/migrations/`
- **Format:** Numbered `.sql` files (e.g., `001_create_clients.sql`)
- **Execution:** Alphabetical (sorted) order, skipping already-applied migrations
- **Error handling:** Failing migrations are logged with `error()` and re-thrown (server won't start)

### Migration Runner Logic

```typescript
function runMigrations(db: Database): void {
  const migrationsDir = resolve("schema/migrations");

  // Create tracking table if it doesn't exist
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (...)`);

  // Get already-applied migration names
  const applied = db
    .prepare("SELECT name FROM migrations ORDER BY name")
    .all()
    .map((r) => r.name);

  // Read and sort SQL files
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Execute each pending migration
  for (const file of files) {
    if (applied.includes(file)) continue; // Already applied
    const sql = readFileSync(resolve(migrationsDir, file), "utf-8");
    db.exec(sql);
    db.prepare("INSERT INTO migrations (name) VALUES (?)").run(file);
    info(`Migration applied: ${file}`);
  }
}
```

### Running Migrations

Migrations run automatically on server start. To manually check applied migrations:

```sql
SELECT name, applied_at FROM migrations ORDER BY name;
```

### Creating a Migration

1. Create a new numbered file in `schema/migrations/`:

```sql
-- schema/migrations/006_add_columns.sql
ALTER TABLE monitors ADD COLUMN new_column TEXT DEFAULT 'value';
```

2. The migration tracking system will automatically detect and apply it on the next server restart.

### Current Migration Files

| File | Table | Description |
|------|-------|-------------|
| `001_create_clients.sql` | `clients` | LNPM desktop client installations |
| `002_create_monitors.sql` | `monitors` | Ping targets per client |
| `003_create_ping_samples.sql` | `ping_samples` | Raw individual ping probe results |
| `004_create_minute_rollups.sql` | `minute_rollups` | Pre-aggregated 1-minute statistics |
| `005_create_indexes.sql` | (indexes) | Query performance indexes |

## Schema

### Schema Summary

An assembled reference of the full schema is available in `schema/index.sql` (created from migrations 001-005).

### `clients`

Stores LNPM desktop client installations.

**Migration:** `001_create_clients.sql`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` |
| `slug` | `TEXT` | `NOT NULL UNIQUE` |
| `name` | `TEXT` | `NOT NULL` |
| `username` | `TEXT` | `NOT NULL` |
| `hostname` | `TEXT` | `NOT NULL` |
| `mac_address` | `TEXT` | `NOT NULL` |
| `created_at` | `INTEGER` | `NOT NULL` (Unix milliseconds) |
| `updated_at` | `INTEGER` | `NOT NULL` (Unix milliseconds) |

**Indexes:**
- `idx_clients_slug` on `slug`
- `idx_clients_mac` on `mac_address`

### `monitors`

Stores ping targets per client with status tracking.

**Migration:** `002_create_monitors.sql`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` |
| `client_id` | `INTEGER` | `NOT NULL REFERENCES clients(id) ON DELETE CASCADE` |
| `target_host` | `TEXT` | `NOT NULL` |
| `target_name` | `TEXT` | `DEFAULT NULL` |
| `quality_state` | `TEXT` | `DEFAULT 'warmingUp'` |
| `state_since_ms` | `INTEGER` | `DEFAULT NULL` |
| `last_seen_ms` | `INTEGER` | `DEFAULT NULL` |
| `last_status` | `TEXT` | `DEFAULT NULL` |
| `last_latency_ms` | `REAL` | `DEFAULT NULL` |
| `created_at` | `INTEGER` | `NOT NULL` |
| `updated_at` | `INTEGER` | `NOT NULL` |

**Constraints:**
- `UNIQUE(client_id, target_host)`

**Indexes:**
- `idx_monitors_client` on `client_id`
- `idx_monitors_last_seen` on `last_seen_ms`
- `idx_monitors_client_target` on `(client_id, target_host)`

### `ping_samples`

Stores raw individual ping probe results.

**Migration:** `003_create_ping_samples.sql`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` |
| `monitor_id` | `INTEGER` | `NOT NULL REFERENCES monitors(id) ON DELETE CASCADE` |
| `timestamp_ms` | `INTEGER` | `NOT NULL` |
| `latency_ms` | `REAL` | `DEFAULT NULL` |
| `status` | `TEXT` | `NOT NULL` |
| `resolved_address` | `TEXT` | `DEFAULT NULL` |
| `error` | `TEXT` | `DEFAULT NULL` |
| `created_at` | `INTEGER` | `NOT NULL` |

**Constraints:**
- `UNIQUE(monitor_id, timestamp_ms, resolved_address)`

**Indexes:**
- `idx_ping_monitor_time` on `(monitor_id, timestamp_ms)`
- `idx_ping_status` on `status`

### `minute_rollups`

Stores pre-aggregated 1-minute statistics for charts and dashboards.

**Migration:** `004_create_minute_rollups.sql`

| Column | Type | Constraints |
|--------|------|-------------|
| `monitor_id` | `INTEGER` | `NOT NULL REFERENCES monitors(id) ON DELETE CASCADE` |
| `timestamp_ms` | `INTEGER` | `NOT NULL` |
| `sample_count` | `INTEGER` | `NOT NULL DEFAULT 0` |
| `success_count` | `INTEGER` | `NOT NULL DEFAULT 0` |
| `failure_count` | `INTEGER` | `NOT NULL DEFAULT 0` |
| `avg_latency` | `REAL` | `DEFAULT NULL` |
| `min_latency` | `REAL` | `DEFAULT NULL` |
| `max_latency` | `REAL` | `DEFAULT NULL` |
| `p95_latency` | `REAL` | `DEFAULT NULL` |
| `created_at` | `INTEGER` | `NOT NULL` |

**Constraints:**
- `UNIQUE(monitor_id, timestamp_ms)`

**Indexes:**
- `idx_rollup_monitor_time` on `(monitor_id, timestamp_ms)`

### Entity Relationships

```
clients (1) ──┬── (N) monitors (1) ──┬── (N) ping_samples
              │                        └── (N) minute_rollups
              └── slug (unique), mac_address (indexed)
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `DATABASE_PATH` | `.data/lingering.db` | Path to the SQLite database file |

## Edge Cases

- **Missing directory:** The plugin creates the database directory with `mkdirSync({ recursive: true })` before opening the connection.
- **Corrupt database:** `better-sqlite3` throws on open if the file is corrupt. The server will fail to start — check `DATABASE_PATH` and the file's integrity.
- **Concurrent writes:** WAL mode allows concurrent reads during writes. Since this is a single-process server, concurrent writes are not an issue (better-sqlite3 is synchronous).
- **Migration failures:** The server logs the error and throws, preventing startup with a partially-migrated schema.
- **Missing migrations directory:** The runner logs a warning and skips migrations if `schema/migrations/` doesn't exist.
- **Graceful shutdown:** The Nitro plugin returns a cleanup function that closes the database connection. If `close()` throws, the error is logged but doesn't prevent shutdown.

## Testing

Database tests use the `globals: true` option in `vitest.config.ts` because `better-sqlite3` crashes Vitest workers (it depends on native bindings that don't work in forked processes). Tests interact directly with the SQLite file rather than mocking the database.

## Related

- [Architecture Overview](../architecture/overview.md) — ADR-001 and technology choices
- [DB Helper Utility](../utils/db.md) — `getDb()` typed accessor
- [Logger Documentation](../utils/logger.md) — Used for migration logging
- [Environment Configuration](../configuration/env.md) — `DATABASE_PATH` and other settings
