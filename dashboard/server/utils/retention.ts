import type { Database } from "better-sqlite3";
import { getDb } from "./db";
import { info, warn } from "./logger";

/**
 * Configuration for data retention cleanup.
 * Read from environment variables with defaults.
 */
export interface RetentionConfig {
  enabled: boolean;
  sampleDays: number;
  rollupDays: number;
  intervalMin: number;
  vacuumThreshold: number;
}

/**
 * Result of a retention cleanup cycle.
 */
export interface RetentionCleanupResult {
  deletedSamples: number;
  deletedRollups: number;
  durationMs: number;
  vacuumed: boolean;
}

/**
 * Read retention configuration from environment variables.
 * Values are read lazily each time, so changing env vars and
 * restarting the server picks up new values.
 */
export function getRetentionConfig(): RetentionConfig {
  const enabledRaw = process.env.RETENTION_ENABLED ?? "true";
  const sampleDaysRaw = process.env.RETENTION_SAMPLE_DAYS ?? "30";
  const rollupDaysRaw = process.env.RETENTION_ROLLUP_DAYS ?? "90";
  const intervalMinRaw = process.env.RETENTION_INTERVAL_MIN ?? "60";
  const vacuumThresholdRaw =
    process.env.RETENTION_VACUUM_THRESHOLD ?? "10000";

  const sampleDays = Number(sampleDaysRaw);
  const rollupDays = Number(rollupDaysRaw);
  const intervalMin = Number(intervalMinRaw);
  const vacuumThreshold = Number(vacuumThresholdRaw);

  return {
    enabled: enabledRaw.toLowerCase() !== "false",
    sampleDays: Number.isFinite(sampleDays) && sampleDays > 0
      ? sampleDays
      : 30,
    rollupDays: Number.isFinite(rollupDays) && rollupDays > 0
      ? rollupDays
      : 90,
    intervalMin: Number.isFinite(intervalMin) && intervalMin > 0
      ? intervalMin
      : 60,
    vacuumThreshold:
      Number.isFinite(vacuumThreshold) && vacuumThreshold > 0
        ? vacuumThreshold
        : 10000,
  };
}

/**
 * Run the retention cleanup: delete old ping_samples and minute_rollups
 * within a single transaction.
 *
 * @param db - Optional database instance. If omitted, uses getDb().
 * @returns The cleanup result with counts and timing.
 */
export function runRetentionCleanup(
  db: Database = getDb(),
): RetentionCleanupResult {
  const config = getRetentionConfig();

  if (!config.enabled) {
    info("Retention cleanup skipped: RETENTION_ENABLED is false");
    return {
      deletedSamples: 0,
      deletedRollups: 0,
      durationMs: 0,
      vacuumed: false,
    };
  }

  const start = Date.now();

  // Calculate cutoff timestamps (milliseconds since epoch)
  const sampleCutoff = Date.now() - config.sampleDays * 24 * 60 * 60 * 1000;
  const rollupCutoff = Date.now() - config.rollupDays * 24 * 60 * 60 * 1000;

  // Wrap deletions in a single transaction for atomicity
  const transaction = db.transaction(() => {
    const samplesDeleted = db
      .prepare("DELETE FROM ping_samples WHERE timestamp_ms < ?")
      .run(sampleCutoff);

    const rollupsDeleted = db
      .prepare("DELETE FROM minute_rollups WHERE timestamp_ms < ?")
      .run(rollupCutoff);

    return {
      deletedSamples: samplesDeleted.changes,
      deletedRollups: rollupsDeleted.changes,
    };
  });

  const { deletedSamples, deletedRollups } = transaction();
  const durationMs = Date.now() - start;

  const totalDeleted = deletedSamples + deletedRollups;

  // Log statistics
  if (totalDeleted === 0) {
    info("Retention cleanup: nothing to purge", {
      deletedSamples,
      deletedRollups,
      durationMs,
    });
  } else {
    info("Retention cleanup completed", {
      deletedSamples,
      deletedRollups,
      durationMs,
    });
  }

  // Warn if cycle takes too long
  if (durationMs > 5000) {
    warn("Retention cleanup took longer than 5 seconds", {
      durationMs,
      deletedSamples,
      deletedRollups,
    });
  }

  // Optionally run VACUUM if total deleted rows exceed threshold
  let vacuumed = false;
  if (totalDeleted >= config.vacuumThreshold) {
    try {
      db.exec("VACUUM");
      vacuumed = true;
      info("VACUUM executed after large deletion", {
        totalDeleted,
      });
    } catch (err) {
      warn("VACUUM failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    deletedSamples,
    deletedRollups,
    durationMs,
    vacuumed,
  };
}
