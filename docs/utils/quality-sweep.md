# Plugin: Quality Classifier Background Sweep

**File:** `server/plugins/quality-sweep.ts`
**Feature:** F12 (Backend quality classifier)
**Type:** Nitro Plugin

## Purpose

Nitro plugin that runs a background sweep to re-evaluate the quality state of all active monitors at a configurable interval. This ensures that stale quality states are refreshed even when no ingest traffic arrives (e.g., a monitor becomes disconnected but no new samples are ingested).

## How It Works

The plugin uses a `setInterval` timer that:

1. Queries the database for all monitor IDs that have samples in the last 10 minutes
2. Passes those IDs to `classifyMonitorsBatch()` for bulk classification
3. Logs the results (number of monitors checked, states changed)
4. Handles errors gracefully (logs and continues)

### Execution Flow

```
Server Start
  └─ Nitro plugin loads
     └─ Read QUALITY_SWEEP_INTERVAL_MS from env (default: 60000ms)
     └─ Validate interval (must be positive finite number)
     └─ Start setInterval timer
        └─ Every N seconds:
           1. Query: SELECT DISTINCT monitor_id FROM ping_samples
                     WHERE timestamp_ms >= (now - 10 minutes)
           2. Call classifyMonitorsBatch(monitorIds)
           3. Log results (info level if changes occurred)
        └─ On error: log at error level, continue next iteration

Server Shutdown
  └─ clearInterval(timer)
  └─ Log "Quality sweep timer cleared"
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `QUALITY_SWEEP_INTERVAL_MS` | `60000` (60 seconds) | Interval between sweep runs in milliseconds |

### Example: Set Custom Interval

```bash
# Run sweep every 30 seconds
QUALITY_SWEEP_INTERVAL_MS=30000 node server

# Run sweep every 5 minutes
QUALITY_SWEEP_INTERVAL_MS=300000 node server
```

## SQL Query

The sweep uses this query to find active monitors:

```sql
SELECT DISTINCT ps.monitor_id
FROM ping_samples ps
WHERE ps.timestamp_ms >= ?
```

The parameter is `Date.now() - 10 * 60 * 1000` (10 minutes ago). Only monitors with recent samples are re-evaluated — monitors with no activity in the last 10 minutes are skipped (they are likely already `disconnected` or `warmingUp`).

## Logging

The plugin logs at different levels depending on the outcome:

```typescript
// On startup
info("Quality classifier sweep starting", { intervalMs: 60000 });

// On invalid interval (sweep skipped)
info("Quality classifier sweep skipped due to invalid interval", {
  reason: "Invalid value: abc",
  defaultIntervalMs: 60000
});

// After each sweep with changes
info("Quality sweep completed with changes", {
  monitorsChecked: 5,
  statesChanged: 2,
  changedMonitors: [[42, "veryHigh"], [100, "disconnected"]]
});

// On error
logError("Quality sweep failed", {
  error: "SQLITE_ERROR: no such table: ping_samples"
});

// On shutdown
info("Quality sweep timer cleared");
```

## Edge Cases

- **Invalid interval value:** If `QUALITY_SWEEP_INTERVAL_MS` is not a valid positive number (e.g., `"abc"`, `0`, `-1`), the sweep is skipped and a log message is emitted. The server continues to start normally.
- **Empty database:** The query returns no rows — `classifyMonitorsBatch([])` is called, which returns an empty `Map`. No error.
- **Database error during sweep:** Caught and logged at `error` level. The next sweep iteration proceeds normally.
- **Monitor deleted between queries:** If a monitor has samples in the last 10 minutes but was deleted from the `monitors` table, `classifyMonitor()` will fail on that monitor. The error is caught in `classifyMonitorsBatch` and logged individually — the batch continues for other monitors.
- **Server shutdown:** The timer is cleared via the Nitro plugin's cleanup function (returned from `defineNitroPlugin`).

## Performance

- **Query efficiency:** The `SELECT DISTINCT` query uses the `idx_ping_samples_monitor_timestamp` index. Only monitors with recent samples are returned.
- **Batch classification:** `classifyMonitorsBatch` efficiently processes all monitors, detecting changes and only logging state changes.
- **Sweep interval:** 60-second default means at most 60 seconds of stale quality state. Adjust based on your refresh requirements.

## Related

- [Quality Classifier](./quality-classifier.md) — `classifyMonitorsBatch()` called by the sweep
- [Quality States Constants](./quality-states.md) — Threshold values used during classification
- [Database Schema](../database/schema.md) — `monitors` table with `quality_state` column
- [Feature F12 Specification](../../requirements/features/feature-00012-quality-classifier.md) — Original requirements
