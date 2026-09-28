# Plugin: Retention Cleanup

**File:** `server/plugins/retention.ts`
**Feature:** F10 (Data retention cleanup)
**Type:** Nitro Plugin

## Purpose

Nitro plugin that schedules the data retention cleanup as a recurring background task. Runs the first cleanup cycle immediately on boot, then schedules recurring cycles at a configurable interval. Each cycle is wrapped in `try/catch` so a failure in one cycle never crashes the server.

## How It Works

The plugin uses `setInterval` to run `runRetentionCleanup()` on a schedule:

1. Reads retention config on initialization
2. Logs the active settings (enabled, interval, retention days)
3. If disabled, logs skip message and returns no-op cleanup
4. Runs the **first cleanup cycle immediately on boot**
5. Schedules **recurring cycles** via `setInterval`
6. Warns if interval is less than 60 minutes (dev safety guard)
7. Returns a cleanup function that clears the interval on graceful shutdown

### Execution Flow

```
Server Start
  └─ Nitro plugin loads
     └─ Read config via getRetentionConfig()
     └─ Log initialization (enabled, interval, retention days)
     └─ If disabled:
        └─ Log "Retention cleanup disabled"
        └─ Return no-op cleanup function
     └─ If enabled:
        └─ Run first cleanup cycle (runCycle)
        └─ Start setInterval timer (intervalMin * 60 * 1000 ms)
        └─ Warn if interval < 60 minutes
        └─ Return cleanup function (clearInterval)

Each Cycle (runCycle)
  ├─ Re-read config via getRetentionConfig()
  ├─ If disabled: log skip, return
  ├─ Call runRetentionCleanup()
  └─ On error: log at error level, continue next cycle

Server Shutdown
  └─ clearInterval(timer)
  └─ Log "Retention cleanup timer cleared"
```

## Configuration

The plugin reads these environment variables via `getRetentionConfig()`:

| Variable | Default | Description |
|----------|---------|-------------|
| `RETENTION_ENABLED` | `true` | Set to `false` to disable all cleanup |
| `RETENTION_SAMPLE_DAYS` | `30` | Delete raw samples older than N days |
| `RETENTION_ROLLUP_DAYS` | `90` | Delete rollups older than N days |
| `RETENTION_INTERVAL_MIN` | `60` | Cleanup interval in minutes |
| `RETENTION_VACUUM_THRESHOLD` | `10000` | Rows deleted before VACUUM triggers |

### Example: Adjust Interval

```bash
# Run cleanup every 15 minutes (warning emitted — interval < 60 min)
RETENTION_INTERVAL_MIN=15 pnpm run dev

# Run cleanup every 2 hours
RETENTION_INTERVAL_MIN=120 pnpm run dev

# Disable retention entirely
RETENTION_ENABLED=false pnpm run dev
```

## Logging

The plugin logs at different levels depending on the outcome:

```typescript
// On startup
info("Data retention cleanup plugin initialized", {
  enabled: true,
  intervalMinutes: 60,
  sampleRetentionDays: 30,
  rollupRetentionDays: 90
});

// When disabled
info("Retention cleanup disabled (RETENTION_ENABLED=false)");

// Short interval warning
warn("Retention cleanup interval is less than 60 minutes", {
  intervalMs: 900000
});

// On cycle failure
logError("Retention cleanup cycle failed", {
  error: "SQLITE_ERROR: no such table: ping_samples"
});

// On shutdown
info("Retention cleanup timer cleared");
```

## Error Handling

Each cycle runs inside `runCycle()` with a `try/catch`:

```typescript
function runCycle(): void {
  try {
    const currentConfig = getRetentionConfig();
    if (!currentConfig.enabled) {
      info("Retention cleanup skipped: RETENTION_ENABLED is false");
      return;
    }
    runRetentionCleanup();
  } catch (err) {
    logError("Retention cleanup cycle failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
```

- **Cycle failure does not crash the server:** Errors are caught, logged at `error` level, and the next cycle proceeds normally.
- **Re-reads config each cycle:** If the environment variables change (e.g., via server restart), the next cycle picks up the new values.
- **VACUUM failure is non-fatal:** The `runRetentionCleanup()` function catches VACUUM errors internally and logs at `warn` level.

## Edge Cases

- **Disabled at boot:** If `RETENTION_ENABLED=false` on startup, the plugin logs a skip message and returns a no-op cleanup. No timer is created.
- **Disabled mid-run:** If the env var changes between cycles (requires restart to take effect), the next cycle re-reads config and skips.
- **Interval shorter than 60 minutes:** A `warn` log is emitted but the timer still runs at the configured interval. This is a safety guard to prevent excessive database writes in production.
- **Database unavailable:** If the database is not initialized when the first cycle runs (should not happen — the database plugin loads before API routes), `getDb()` throws. The error is caught by `runCycle()` and logged.
- **Server shutdown during cycle:** The `setInterval` timer is cleared via the plugin's return function. If a cycle is in progress, it completes — the timer simply does not fire again.
- **Empty database:** Both `DELETE` queries return 0 rows — no error, fast completion.

## Integration with Other Plugins

- **Database Plugin (`server/plugins/database.ts`):** The retention plugin depends on the database being initialized. Nitro plugins load in alphabetical order by default; `database.ts` loads before `retention.ts`.
- **Quality Sweep (`server/plugins/quality-sweep.ts`):** Independent background task — no shared state or coordination needed.
- **Graceful Shutdown:** All Nitro plugins' return functions are called on server shutdown. The retention plugin's cleanup clears the interval and logs confirmation.

## Performance

- **First run on boot:** The first cleanup cycle runs synchronously during server startup. If a large backlog exists, this may add a few hundred milliseconds to startup time.
- **Interval tuning:** Default 60-minute interval is appropriate for most deployments. Shorter intervals (e.g., 15 minutes) are useful for development or high-ingest environments but trigger a warning.
- **VACUUM cost:** `VACUUM` is expensive (creates a full database copy). The threshold prevents it from running on every cycle — only triggered when 10,000+ rows are deleted in a single cycle.

## Related

- [Retention Utility](./retention.md) — `runRetentionCleanup()` and `getRetentionConfig()` called by this plugin
- [Database Plugin](../database/schema.md) — Database initialization dependency
- [Quality Sweep Plugin](./quality-sweep.md) — Similar pattern (scheduled background sweep)
- [Logger](./logger.md) — Structured logging for all plugin output
- [Feature F10 Specification](../../requirements/features/feature-00010-data-retention.md) — Original requirements
