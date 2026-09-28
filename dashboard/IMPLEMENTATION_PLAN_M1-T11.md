# M1-T11 — Data Retention Cleanup: Implementation Plan

## Summary

Create a scheduled background task (`server/plugins/retention.ts`) that periodically purges old `ping_samples` and `minute_rollups` rows from SQLite based on configurable retention periods. Follows the established `quality-sweep.ts` plugin pattern.

## Approach Rationale

**Selected:** Separate `server/plugins/retention.ts` plugin + `server/utils/retention.ts` utility.

**Why not extend `quality-sweep.ts`:** Quality sweep (60s interval, monitor classification) and data retention (60min interval, row deletion) have different schedules, configs, and failure modes. Single-responsibility principle favors separation.

**Why not Nitro hooks:** Nitro v2 has no native cron scheduler. The existing codebase (`quality-sweep.ts`) already uses `setInterval` in a Nitro plugin — this is the established pattern.

## Implementation Sequence (Ordered)

### Step 1: Utility — `server/utils/retention.ts`

**File:** `dashboard/server/utils/retention.ts` (CREATE)

Core business logic for a single cleanup cycle:

```typescript
// Exports:
// - interface RetentionConfig
// - interface RetentionResult
// - function getRetentionConfig(): RetentionConfig
// - function runRetentionCleanup(): RetentionResult
```

**`getRetentionConfig()`** reads env vars with defaults:
- `RETENTION_ENABLED` (default: `"true"`) — boolean toggle
- `RETENTION_SAMPLE_DAYS` (default: `30`) — days to keep raw samples
- `RETENTION_ROLLUP_DAYS` (default: `90`) — days to keep rollups
- `RETENTION_INTERVAL_MIN` (default: `60`) — minutes between cycles
- `RETENTION_VACUUM_THRESHOLD` (default: `10000`) — rows before VACUUM

**`runRetentionCleanup()`** performs the actual deletion:
1. Reads config via `getRetentionConfig()`
2. If `RETENTION_ENABLED` is falsy, return `{ skipped: true }`
3. Computes cutoff timestamps: `Date.now() - days * 24 * 60 * 60 * 1000`
4. Opens a single transaction: `db.transaction(...)`
5. Within transaction:
   - `DELETE FROM ping_samples WHERE timestamp_ms < ?`
   - `DELETE FROM minute_rollups WHERE timestamp_ms < ?`
   - Capture `info.changes` from each statement
6. Commits transaction
7. If total deleted >= `RETENTION_VACUUM_THRESHOLD`, run `VACUUM`
8. Returns `{ skipped: false, deletedSamples: N, deletedRollups: N, durationMs: N, vacuumed: boolean }`
9. All wrapped in try/catch — errors are logged, not thrown

**Key design decisions:**
- Uses `db.transaction()` from `better-sqlite3` for atomicity
- Reads env vars lazily each cycle (no caching) so config changes are picked up
- Uses `info.changes` property of better-sqlite3 Statement for row count (avoids separate COUNT query)
- VACUUM runs outside the transaction (SQLite restriction: cannot VACUUM inside transaction)

### Step 2: Plugin — `server/plugins/retention.ts`

**File:** `dashboard/server/plugins/retention.ts` (CREATE)

Nitro plugin that starts the scheduled cleanup timer:

```typescript
import { defineNitroPlugin } from "nitropack";
import { info, warn, error as logError } from "#server/utils/logger";
import { getRetentionConfig, runRetentionCleanup } from "#server/utils/retention";

export default defineNitroPlugin(() => {
  const config = getRetentionConfig();

  if (!config.enabled) {
    info("Retention cleanup disabled", { reason: "RETENTION_ENABLED is false" });
    return () => {};
  }

  const intervalMs = config.intervalMinutes * 60 * 1000;
  info("Retention cleanup starting", { intervalMinutes: config.intervalMinutes });

  // Run immediately on boot, then on interval
  runCycle();

  const timer = setInterval(runCycle, intervalMs);

  function runCycle() {
    try {
      const result = runRetentionCleanup();
      if (result.skipped) {
        info("Retention cleanup skipped", { reason: "RETENTION_ENABLED is false" });
        return;
      }
      const total = result.deletedSamples + result.deletedRollups;
      if (total > 0) {
        info("Retention cleanup completed", {
          deletedSamples: result.deletedSamples,
          deletedRollups: result.deletedRollups,
          durationMs: result.durationMs,
          vacuumed: result.vacuumed,
        });
      } else {
        info("Retention cleanup: nothing to purge", {
          durationMs: result.durationMs,
        });
      }
      // Warn if cycle takes too long
      if (result.durationMs > 5000) {
        warn("Retention cleanup exceeded 5s threshold", { durationMs: result.durationMs });
      }
    } catch (err) {
      logError("Retention cleanup failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return () => {
    clearInterval(timer);
    info("Retention cleanup timer cleared");
  };
});
```

**Key design decisions:**
- Follows exact same pattern as `quality-sweep.ts` (setInterval, try/catch, cleanup return)
- Runs first cycle immediately on boot (not after first interval) — catches backlog on restart
- Warns if cycle exceeds 5s (first-run backlog detection)
- Returns cleanup function for graceful shutdown

### Step 3: Update `.env.example`

**File:** `dashboard/.env.example` (MODIFY)

Add retention-specific environment variables (replace existing generic `RETENTION_DAYS`):

```
# ------------------------------------------------------------------
# Data retention
# ------------------------------------------------------------------

# Enable/disable retention cleanup
RETENTION_ENABLED=true

# How long to keep raw ping samples (days)
RETENTION_SAMPLE_DAYS=30

# How long to keep minute rollups (days)
RETENTION_ROLLUP_DAYS=90

# Cleanup interval in minutes
RETENTION_INTERVAL_MIN=60

# Minimum rows deleted before triggering VACUUM
RETENTION_VACUUM_THRESHOLD=10000
```

### Step 4: Tests — `server/utils/retention.test.ts`

**File:** `dashboard/server/utils/retention.test.ts` (CREATE)

Unit tests following the existing pattern (e.g., `db.test.ts`, `quality-classifier.test.ts`):

```typescript
// Test cases:
// 1. getRetentionConfig returns defaults when no env vars set
// 2. getRetentionConfig reads custom env vars
// 3. runRetentionCleanup deletes old samples, keeps recent ones
// 4. runRetentionCleanup deletes old rollups, keeps recent ones
// 5. runRetentionCleanup returns skipped=true when RETENTION_ENABLED=false
// 6. runRetentionCleanup uses single transaction (atomicity)
// 7. runRetentionCleanup handles empty tables (no error)
// 8. runRetentionCleanup handles large backlog without crash
// 9. runRetentionCleanup logs correct statistics
```

### Step 5: Tests — `server/plugins/retention.test.ts`

**File:** `dashboard/server/plugins/retention.test.ts` (CREATE)

Plugin-level tests:

```typescript
// Test cases:
// 1. Plugin starts timer when RETENTION_ENABLED=true
// 2. Plugin skips timer when RETENTION_ENABLED=false
// 3. Cleanup function is returned and clears timer on shutdown
// 4. Error in one cycle does not crash subsequent cycles
```

### Step 6: Verify

Run `npx nuxi typecheck` and `npx nuxi dev` to ensure no regressions.

---

## File Inventory

### Files to CREATE (3):

| File | Layer | Description |
|------|-------|-------------|
| `dashboard/server/utils/retention.ts` | Business Logic | Core cleanup logic, config reader, transaction execution |
| `dashboard/server/utils/retention.test.ts` | Tests | Unit tests for utility functions |
| `dashboard/server/plugins/retention.ts` | Plugin | Nitro plugin with scheduled timer |
| `dashboard/server/plugins/retention.integration.test.ts` | Tests | Integration tests for plugin lifecycle |

### Files to MODIFY (1):

| File | Layer | Description |
|------|-------|-------------|
| `dashboard/.env.example` | Config | Add RETENTION_ENABLED, RETENTION_SAMPLE_DAYS, RETENTION_ROLLUP_DAYS, RETENTION_INTERVAL_MIN, RETENTION_VACUUM_THRESHOLD |

**Total: Create 4 | Modify 1**

---

## Dependency Graph

```
retention.ts (plugin)
  └── requires: server/utils/logger.ts (exists)
  └── requires: server/utils/db.ts (exists, via getDb())
  └── requires: server/utils/retention.ts (utility)
        └── requires: server/utils/logger.ts (exists)
        └── requires: server/utils/db.ts (exists, via getDb())
        └── requires: ping_samples table (exists, migration 003)
        └── requires: minute_rollups table (exists, migration 004)

plugins/retention.ts
  └── requires: database.ts plugin runs first (auto-ordered by Nitro alphabetically)
```

**Parallelizable work:**
- `server/utils/retention.ts` and `server/utils/retention.test.ts` can be written in parallel once the utility API is defined
- `server/plugins/retention.ts` and `server/plugins/retention.integration.test.ts` can be written in parallel

**Sequential dependencies:**
- Utility must exist before plugin can import it
- `.env.example` update can happen anytime (independent)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| VACUUM locks database during heavy ingest | Medium | Only trigger VACUUM when rows exceed threshold; VACUUM runs outside transaction; better-sqlite3's sync nature means brief lock |
| First run on large backlog takes too long | Low | Log warning if >5s; the interval timer continues; no blocking of API routes (separate event loop tick) |
| Env var config inconsistency with existing `.env` | Low | `.env.example` documents new vars; existing `RETENTION_DAYS` and `ROLLUP_RETENTION_DAYS` in .env.example are superseded by new naming |
| SQLite version doesn't support needed features | Low | Uses only basic DELETE + transaction, supported by all SQLite versions |
| Plugin load order with database.ts | Low | Nitro loads plugins in filesystem order; `database.ts` (d) loads before `retention.ts` (r) alphabetically. No explicit ordering needed. |

---

## Complexity: Low

This is a straightforward addition following established patterns. The code mirrors `quality-sweep.ts` exactly in structure, reuses existing `getDb()` and `logger` utilities, and operates on existing tables. No schema changes, no new API endpoints, no frontend work.

**Estimated effort: 2-3 hours** (matches task estimate)

---

## Acceptance Criteria Checklist

- [x] Cleanup runs on configurable interval (default 60 minutes) → `RETENTION_INTERVAL_MIN=60`
- [x] Deletes raw samples older than `RETENTION_SAMPLE_DAYS` (default 30) → SQL DELETE with cutoff
- [x] Deletes rollups older than `RETENTION_ROLLUP_DAYS` (default 90) → SQL DELETE with cutoff
- [x] Logs deletion counts and duration → Structured logging via `logger.info()`
- [x] `RETENTION_ENABLED=false` skips cleanup → Checked at both plugin and utility level
- [x] Failure in one cycle doesn't crash server → try/catch around each cycle
- [x] Uses single transaction for atomicity → `db.transaction()` wrapper
