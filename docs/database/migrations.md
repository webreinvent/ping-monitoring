# Migration Runner

**File:** `server/plugins/database.ts` (embedded within the database plugin)
**Migrations Directory:** `schema/migrations/`

## Purpose

Automatically applies SQL migration files on server startup, tracking which migrations have been applied to avoid re-execution. This is the primary mechanism for schema evolution.

## How It Works

### Tracking Table

The migration runner creates a tracking table on first run (not stored in a migration file):

```sql
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Execution Flow

```
1. Create migrations tracking table (if not exists)
2. Query applied migration names from the table
3. Read schema/migrations/ directory, filter .sql files, sort alphabetically
4. For each file:
   a. Skip if already in applied list
   b. Read SQL file contents
   c. Execute with db.exec(sql)
   d. Insert filename into migrations table
   e. Log success with info()
5. If any step fails, log error and throw (server won't start)
6. Log summary: applied count, skipped count, total
```

### Code

```typescript
function runMigrations(db: Database.Database): void {
  const migrationsDir = resolve("schema/migrations");
  if (!existsSync(migrationsDir)) {
    warn("Migrations directory not found, skipping migrations");
    return;
  }

  // Ensure tracking table exists
  db.exec(
    `CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  );

  // Get already-applied migrations
  const applied: string[] = db
    .prepare("SELECT name FROM migrations ORDER BY name")
    .all()
    .map((r: { name: string }) => r.name);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (applied.includes(file)) {
      skippedCount++;
      continue;
    }

    try {
      const sql = readFileSync(resolve(migrationsDir, file), "utf-8");
      db.exec(sql);
      db.prepare("INSERT INTO migrations (name) VALUES (?)").run(file);
      appliedCount++;
      info(`Migration applied: ${file}`);
    } catch (err) {
      error(`Migration failed: ${file}`, {
        error: err instanceof Error ? err.message : String(err),
        file,
      });
      throw err;
    }
  }

  info(`Migrations complete: ${appliedCount} applied, ${skippedCount} already applied`, {
    applied: appliedCount,
    skipped: skippedCount,
    total: files.length,
  });
}
```

## Creating a Migration

1. Create a numbered SQL file in `schema/migrations/`:

```sql
-- schema/migrations/006_add_notifications.sql
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
```

2. Naming convention: `{NNN}_{description}.sql` where `NNN` is a zero-padded sequence number.
3. The migration will be automatically applied on the next server restart.

## Current Migrations

| File | Description | Tables |
|------|-------------|--------|
| `001_create_clients.sql` | Client identity + F9 sync | `clients` |
| `002_create_monitors.sql` | Ping targets | `monitors` |
| `003_create_ping_samples.sql` | Raw ping data | `ping_samples` |
| `004_create_minute_rollups.sql` | Aggregated stats | `minute_rollups` |
| `005_create_indexes.sql` | Query indexes | (9 indexes) |

## Checking Applied Migrations

Query the tracking table directly:

```sql
SELECT name, applied_at FROM migrations ORDER BY name;
```

## Limitations

- **No rollback:** Migrations are applied forward only. To roll back, you must write a new migration that reverses the change.
- **No transaction wrapping:** Each migration file runs with `db.exec()`, which executes all statements in the file atomically. However, multi-file migrations are not wrapped in a single transaction.
- **File naming matters:** Only `*.sql` files are considered. Other files (`.md`, `.js`, etc.) are ignored.
- **Alphabetical order:** Files are sorted alphabetically, so naming determines execution order.

## Edge Cases

- **Missing migrations directory:** The runner logs a warning and skips gracefully.
- **Empty migrations directory:** The runner logs `0 applied, 0 already applied` and returns.
- **Duplicate migration file:** If a file was already applied (exists in the tracking table), it's skipped.
- **SQL syntax error:** The runner logs the error with `error()` and throws — the server won't start until the migration is fixed.
- **Partial migration failure:** If a migration fails midway through its SQL, `db.exec()` rolls back the statements in that file (SQLite treats `exec` as atomic). The tracking table is not updated, so the migration will be retried on the next restart.

## Related

- [Database Schema](./schema.md) — Full schema reference
- [Assembled Schema](../../schema/index.sql) — Full SQL schema assembled from migrations
