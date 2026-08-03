import { info, warn, error as logError } from "#server/utils/logger";
import { getRetentionConfig, runRetentionCleanup } from "#server/utils/retention";

/**
 * Nitro plugin that schedules the data retention cleanup task.
 *
 * - Runs immediately on boot (first cycle).
 * - Then runs on a configurable interval (default 60 minutes).
 * - Each cycle is wrapped in try/catch so a failure does not crash the server.
 * - Reads env vars lazily each cycle, so runtime config changes are picked up
 *   on the next cycle (after a server restart).
 */
export default defineNitroPlugin(() => {
  const config = getRetentionConfig();

  const intervalMs = config.intervalMin * 60 * 1000;

  info("Data retention cleanup plugin initialized", {
    enabled: config.enabled,
    intervalMinutes: config.intervalMin,
    sampleRetentionDays: config.sampleDays,
    rollupRetentionDays: config.rollupDays,
  });

  /** Run one cleanup cycle, catching errors so they don't crash the server. */
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

  if (!config.enabled) {
    info("Retention cleanup disabled (RETENTION_ENABLED=false)");
    return () => {};
  }

  // Run first cycle immediately on boot
  runCycle();

  // Schedule recurring cycles
  const timer = setInterval(runCycle, intervalMs);

  // Warn if interval is suspiciously short (dev safety)
  if (intervalMs < 60_000) {
    warn("Retention cleanup interval is less than 60 minutes", {
      intervalMs,
    });
  }

  // Graceful shutdown
  return () => {
    clearInterval(timer);
    info("Retention cleanup timer cleared");
  };
});
