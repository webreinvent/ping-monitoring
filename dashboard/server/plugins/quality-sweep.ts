import { defineNitroPlugin } from "#imports";
import { info, error as logError } from "#server/utils/logger";
import { getDb } from "#server/utils/db";
import { classifyMonitorsBatch } from "#server/utils/quality-classifier";

/** Default sweep interval: 60 seconds */
const DEFAULT_SWEEP_INTERVAL_MS = 60_000;

export default defineNitroPlugin(() => {
  const rawInterval = process.env.QUALITY_SWEEP_INTERVAL_MS ?? String(DEFAULT_SWEEP_INTERVAL_MS);
  const sweepIntervalMs = Number(rawInterval);

  if (!Number.isFinite(sweepIntervalMs) || sweepIntervalMs <= 0) {
    info("Quality classifier sweep skipped due to invalid interval", {
      reason: `Invalid value: ${rawInterval}`,
      defaultIntervalMs: DEFAULT_SWEEP_INTERVAL_MS,
    });
    return () => {};
  }

  info("Quality classifier sweep starting", {
    intervalMs: sweepIntervalMs,
  });

  const timer = setInterval(() => {
    try {
      const db = getDb();

      // Get monitors that have samples in the last 10 minutes
      const rows = db
        .prepare(`
          SELECT DISTINCT ps.monitor_id
          FROM ping_samples ps
          WHERE ps.timestamp_ms >= ?
        `)
        .all(Date.now() - 10 * 60 * 1000) as Array<{
        monitor_id: number;
      }>;

      const monitorIds = rows.map((r) => r.monitor_id);

      if (monitorIds.length > 0) {
        const changes = classifyMonitorsBatch(monitorIds);

        if (changes.size > 0) {
          info("Quality sweep completed with changes", {
            monitorsChecked: monitorIds.length,
            statesChanged: changes.size,
            changedMonitors: Array.from(changes.entries()),
          });
        }
      }
    } catch (err) {
      logError("Quality sweep failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, sweepIntervalMs);

  // Graceful shutdown
  return () => {
    clearInterval(timer);
    info("Quality sweep timer cleared");
  };
});
