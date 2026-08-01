# DB Helper Utility

**File:** `server/utils/db.ts`

## Purpose

Provides a typed accessor for the SQLite database instance. The database is initialized by the database plugin (`server/plugins/database.ts`) and stored on `globalThis.__db`. This utility abstracts the `globalThis` access behind a type-safe function with a proper global declaration.

## API

```typescript
import { getDb } from "~/server/utils/db";

// Get the database instance
const db = getDb();

// Use with better-sqlite3 API
const rows = db.prepare("SELECT * FROM monitors").all();
const row = db.prepare("SELECT * FROM monitors WHERE id = ?").get(1);

// Transactions
db.transaction(() => {
  db.prepare("INSERT INTO monitors (name) VALUES (?)").run("test");
  db.prepare("UPDATE monitors SET updated_at = ? WHERE id = ?").run(Date.now(), 1);
})();
```

### Function Signature

```typescript
function getDb(): Database;
```

| Return | Type | Description |
|--------|------|-------------|
| `Database` | `better-sqlite3.Database` | The SQLite database instance |

## How It Works

```typescript
import type { Database } from "better-sqlite3";

// Extend globalThis with the typed database instance
declare global {
  var __db: Database | undefined;
}

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

- Declares `globalThis.__db` as `Database | undefined` so TypeScript knows the type.
- Retrieves the instance from `globalThis.__db`.
- Throws if the database plugin hasn't run yet (should never happen in normal operation since Nitro plugins run before API routes).

## Usage Pattern

Use `getDb()` in API routes and server utilities:

```typescript
// server/api/monitors.get.ts
import { getDb } from "~/server/utils/db";

export default defineEventHandler(() => {
  const db = getDb();
  const monitors = db.prepare("SELECT * FROM monitors ORDER BY last_seen_ms DESC").all();
  return { monitors };
});
```

## Edge Cases

- **Called before plugin loads:** Throws `Error: Database not initialized`. This would only happen if the server is misconfigured (e.g., the database plugin was removed from the plugins directory).
- **Multiple calls:** Returns the same instance — no connection pooling or re-initialization. The `better-sqlite3` instance is thread-safe for a single process.
- **Connection closed:** If the database is closed externally, subsequent queries throw. The server should handle these as fatal errors.

## Testing Notes

Tests cannot use `getDb()` directly in Vitest because `better-sqlite3` crashes forked workers. Instead, tests create their own `Database` instances pointing to temporary files. The `globals: true` option in `vitest.config.ts` avoids the worker fork entirely.

## Related

- [Database Documentation](../database/schema.md) — Full database architecture and schema
- [Logger Documentation](./logger.md) — Used for database error logging
