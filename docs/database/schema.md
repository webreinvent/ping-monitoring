# Database — SQLite with better-sqlite3

**File:** `server/plugins/database.ts`, `server/utils/db.ts`
**Database:** SQLite via `better-sqlite3` (synchronous)
**Default Path:** `.data/lingering.db` (configurable via `DATABASE_PATH`)

## Overview

The database plugin initializes a SQLite connection with WAL mode and foreign key constraints, then runs any pending migrations before the server accepts requests. The connection is stored on `globalThis.__db` for access from API routes and server utilities.

## Initialization Flow

```
1. Nitro starts → database plugin loads
2. getDatabase() creates/opens SQLite connection
3. Enable WAL mode (journal_mode = WAL)
4. Enable foreign keys (foreign_keys = ON)
5. runMigrations() — apply pending migrations in order
6. Store on globalThis.__db
```

## Database Plugin

**File:** `server/plugins/database.ts`

### Connection

```typescript
import Database from "better-sqlite3";
import { resolve } from "node:path";

// Default path, overridden by DATABASE_PATH env var
const dbPath = process.env.DATABASE_PATH || ".data/lingering.db";
const fullDbPath = resolve(dbPath);

// Ensure directory exists
const dbDir = fullDbPath.substring(0, fullDbPath.lastIndexOf("/"));
if (dbDir && !existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Open with WAL mode
const db = new Database(fullDbPath);
db.pragma("journal_mode = WAL");   // Concurrent reads during writes
db.pragma("foreign_keys = ON");    // Enforce FK constraints
```

### `globalThis` Access Pattern

The database instance is stored on `globalThis` after initialization:

```typescript
export default defineNitroPlugin(() => {
  const db = getDatabase();
  (globalThis as any).__db = db;
});
```

## DB Helper

**File:** `server/utils/db.ts`

Provides a typed accessor for the database instance:

```typescript
import type { Database } from "better-sqlite3";

export function getDb(): Database {
  const db = (globalThis as any).__db as Database | undefined;
  if (!db) {
    throw new Error("Database not initialized. Ensure database plugin is loaded.");
  }
  return db;
}
```

### Usage

```typescript
import { getDb } from "../utils/db";

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

### Migration Files

- **Location:** `schema/migrations/`
- **Format:** Numbered `.sql` files (e.g., `001_initial_setup.sql`)
- **Execution:** Alphabetical order, skipping already-applied migrations
- **Error handling:** Failing migrations are logged and re-thrown (server won't start)

### Running Migrations

Migrations run automatically on server start. To manually check applied migrations:

```sql
SELECT name, applied_at FROM migrations ORDER BY name;
```

### Creating a Migration

```sql
-- schema/migrations/002_create_clients.sql
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- ... columns
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

The migration tracking system will automatically detect and apply it on the next server restart.

## Schema

### Current Tables (M1-T1)

| Table | Purpose | Status |
|-------|---------|--------|
| `migrations` | Migration tracking | Active |

### Planned Tables (Future Phases)

| Table | Purpose | Phase |
|-------|---------|-------|
| `clients` | Client identity (slug, name, hostname) | Phase 2 |
| `monitors` | Monitor metadata (target, status, last_seen) | Phase 2 |
| `ping_samples` | Raw ping data (latency, status, timestamp) | Phase 2 |
| `minute_rollups` | Aggregated per-minute statistics | Phase 2 |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `DATABASE_PATH` | `.data/lingering.db` | Path to the SQLite database file |

## Edge Cases

- **Missing directory:** The plugin creates the database directory with `mkdirSync({ recursive: true })` before opening the connection.
- **Corrupt database:** `better-sqlite3` throws on open if the file is corrupt. The server will fail to start — check `DATABASE_PATH` and the file's integrity.
- **Concurrent writes:** WAL mode allows concurrent reads during writes. Since this is a single-process server, concurrent writes are not an issue (better-sqlite3 is synchronous).
- **Migration failures:** The server logs the error and throws, preventing startup with a partially-migrated schema.

## Related

- [Architecture Overview](../architecture/overview.md) — ADR-001 and technology choices
- [Logger Documentation](../utils/logger.md) — Used for migration error logging
