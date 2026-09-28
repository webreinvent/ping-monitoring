# Retention Cleanup Utility

**File:** `server/utils/retention.ts`
**Feature:** F10 (Data retention cleanup)
**Type:** Server Utility

## Purpose

Core logic for purging old ping samples and rollup data from the SQLite database. Provides typed interfaces, configuration parsing from environment variables, and the actual cleanup execution within a single SQLite transaction.

## API

### Interfaces

#### `RetentionConfig`

```typescript
interface RetentionConfig {
  enabled: boolean;
  sampleDays: number;
  rollupDays: number;
  intervalMin: number;
  vacuumThreshold: number;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | `boolean` | Whether retention cleanup is active (`true`) or disabled (`false`) |
| `sampleDays` | `number` | Delete raw ping samples older than N days (default: 30) |
| `rollupDays` | `number` | Delete minute rollups older than N days (default: 90) |
| `intervalMin` | `number` | How often the cleanup runs, in minutes (default: 60) |
| `vacuumThreshold` | `number` | Minimum rows deleted before triggering a `VACUUM` (default: 10000) |

#### `RetentionCleanupResult`

```typescript
interface RetentionCleanupResult {
  deletedSamples: number;
  deletedRollups: number;
  durationMs: number;
  vacuumed: boolean;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `deletedSamples` | `number` | Number of rows deleted from `ping_samples` |
| `deletedRollups` | `number` | Number of rows deleted from `minute_rollups` |
| `durationMs` | `number` | Total cleanup duration in milliseconds |
| `vacuumed` | `boolean` | Whether a `VACUUM` was executed after the deletion |

### Functions

#### `getRetentionConfig(): RetentionConfig`

Read retention settings from environment variables with validation and sensible defaults.

```typescript
import { getRetentionConfig } from "~/server/utils/retention";

const config = getRetentionConfig();
console.log(config);
// { enabled: true, sampleDays: 30, rollupDays: 90, intervalMin: 60, vacuumThreshold: 10000 }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| *(none)* | — | Reads from `process.env` |

| Return | Type | Description |
|--------|------|-------------|
| `RetentionConfig` | `RetentionConfig` | Parsed and validated configuration |

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `RETENTION_ENABLED` | `"true"` | `"false"` (case-insensitive) disables cleanup |
| `RETENTION_SAMPLE_DAYS` | `"30"` | Days to keep raw samples (must be positive finite number) |
| `RETENTION_ROLLUP_DAYS` | `"90"` | Days to keep rollups (must be positive finite number) |
| `RETENTION_INTERVAL_MIN` | `"60"` | Cleanup interval in minutes (must be positive finite number) |
| `RETENTION_VACUUM_THRESHOLD` | `"10000"` | Rows deleted before VACUUM triggers (must be positive finite number) |

**Validation rules:**
- `RETENTION_ENABLED`: Any value other than `"false"` (case-insensitive) is treated as `true`.
- Numeric values: If the parsed number is not a positive finite number, the default is used.
- Values are read lazily each time `getRetentionConfig()` is called — no caching.

#### `runRetentionCleanup(db?): RetentionCleanupResult`

Execute the retention cleanup: delete old rows from `ping_samples` and `minute_rollups` within a single transaction.

```typescript
import { runRetentionCleanup } from "~/server/utils/retention";

// Use default database
const result = runRetentionCleanup();
console.log(result);
// { deletedSamples: 12453, deletedRollups: 842, durationMs: 234, vacuumed: false }

// Use test database (for unit tests)
import { Database } from "better-sqlite3";
const testDb = new Database(":memory:");
const result = runRetentionCleanup(testDb);
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `db` | `Database` | `getDb()` | SQLite database instance. If omitted, uses the global database from `getDb()`. |

| Return | Type | Description |
|--------|------|-------------|
| `RetentionCleanupResult` | `RetentionCleanupResult` | Counts, timing, and vacuum status |

## How It Works

### Cleanup Flow

```
runRetentionCleanup()
  ├─ Read config via getRetentionConfig()
  ├─ If disabled: log skip message, return zero-result
  ├─ Calculate cutoff timestamps:
  │   ├─ sampleCutoff = Date.now() - (sampleDays * 24 * 60 * 60 * 1000)
  │   └─ rollupCutoff = Date.now() - (rollupDays * 24 * 60 * 60 * 1000)
  ├─ Execute transaction:
  │   ├─ DELETE FROM ping_samples WHERE timestamp_ms < sampleCutoff
  │   └─ DELETE FROM minute_rollups WHERE timestamp_ms < rollupCutoff
  ├─ Log results (info level):
  │   ├─ "nothing to purge" if 0 rows deleted
  │   └─ "Retention cleanup completed" with counts
  ├─ Warn if duration > 5 seconds
  └─ VACUUM if totalDeleted >= vacuumThreshold:
      ├─ Run VACUUM (outside transaction — SQLite restriction)
      └─ Catch & log if VACUUM fails
```

### SQL Operations

```sql
-- Delete old raw ping samples
DELETE FROM ping_samples
WHERE timestamp_ms < ?

-- Delete old minute rollups
DELETE FROM minute_rollups
WHERE timestamp_ms < ?
```

The `?` parameter is a millisecond epoch timestamp calculated as `Date.now() - days * 86400000`. Both deletes run inside a single `db.transaction()` call for atomicity — if either fails, the transaction rolls back and no data is partially deleted.

### VACUUM Behavior

After the transaction completes, if the total rows deleted (`deletedSamples + deletedRollups`) meets or exceeds `vacuumThreshold`, a `VACUUM` is executed to reclaim disk space. `VACUUM` runs **outside** the transaction because SQLite does not allow `VACUUM` inside a transaction.

If `VACUUM` fails (e.g., concurrent access), the error is caught and logged at `warn` level. The cleanup is still considered successful — `VACUUM` failure only means disk space is not immediately reclaimed.

## Logging

```typescript
// When disabled
info("Retention cleanup skipped: RETENTION_ENABLED is false");

// When nothing to purge
info("Retention cleanup: nothing to purge", {
  deletedSamples: 0,
  deletedRollups: 0,
  durationMs: 12
});

// Normal completion
info("Retention cleanup completed", {
  deletedSamples: 12453,
  deletedRollups: 842,
  durationMs: 234
});

// Slow cycle warning
warn("Retention cleanup took longer than 5 seconds", {
  durationMs: 6200,
  deletedSamples: 50000,
  deletedRollups: 3000
});

// VACUUM execution
info("VACUUM executed after large deletion", { totalDeleted: 15000 });

// VACUUM failure
warn("VACUUM failed", { error: "database is locked" });
```

## Edge Cases

- **Empty database:** Both `DELETE` queries return 0 rows — safe and fast. Returns zero-result with no error.
- **Disabled retention:** Returns immediately with zero-result after logging skip. No database access.
- **Partial transaction failure:** If sample delete succeeds but rollup delete fails, the transaction rolls back entirely. No partial deletion — the error propagates to the caller (the plugin catches it).
- **VACUUM outside transaction:** `VACUUM` cannot run inside a SQLite transaction. It is called after `transaction()` completes, so there is no risk of interfering with the atomic delete.
- **Large first run:** On first server start after a long period, the cutoff may delete a large backlog. The 5-second warning helps identify this. The `vacuumThreshold` prevents expensive `VACUUM` on every small cleanup.
- **Invalid env values:** Non-numeric or non-positive values fall back to defaults. A value like `RETENTION_SAMPLE_DAYS=abc` results in `sampleDays: 30`.
- **Time drift:** Cutoff uses server-side `Date.now()` — not affected by client-supplied timestamps or timezone settings.

## Testing

The `retention.ts` module is unit tested in `server/utils/retention.test.ts` with an in-memory SQLite database. Tests cover:

- Enabled/disabled state
- Correct cutoff calculation
- Row deletion from both tables
- VACUUM threshold behavior
- Empty database handling
- Invalid env value fallback

## Related

- [Retention Plugin](./retention-plugin.md) — Nitro plugin that schedules this cleanup
- [Database Schema](../database/schema.md) — `ping_samples` and `minute_rollups` tables
- [DB Helper](./db.md) — `getDb()` used to access the database
- [Logger](./logger.md) — Structured logging used for cleanup output
- [Feature F10 Specification](../../requirements/features/feature-00010-data-retention.md) — Original requirements
