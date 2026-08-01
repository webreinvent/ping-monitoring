import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { getDb } from "../utils/db";
import { info, warn } from "../utils/logger";

// Cache the version — package.json doesn't change at runtime
const packageJsonPath = resolve(process.cwd(), "package.json");
const pkgVersion = (() => {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      version?: string;
    };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

/**
 * Gather extended F14 metrics from the database and filesystem.
 */
function getExtendedMetrics(): {
  db_path: string;
  db_size_bytes: number;
  monitor_count: number;
  sample_count: number;
  last_ingest_time: string | null;
} {
  const dbPath =
    (process.env.DATABASE_PATH as string) || ".data/lingering.db";
  const fullDbPath = resolve(dbPath);

  // File size via statSync — cheap for infrequent health checks
  let dbSizeBytes = 0;
  try {
    dbSizeBytes = statSync(fullDbPath).size;
  } catch {
    warn("Could not stat database file for health check", { path: fullDbPath });
  }

  // Simple aggregate queries — negligible cost
  const db = getDb();

  const monitorCount = db
    .prepare("SELECT COUNT(*) as cnt FROM monitors")
    .get() as { cnt: number };

  const sampleCount = db
    .prepare("SELECT COUNT(*) as cnt FROM ping_samples")
    .get() as { cnt: number };

  const lastIngestRow = db
    .prepare("SELECT MAX(timestamp_ms) as max_ts FROM ping_samples")
    .get() as { max_ts: number | null };

  const lastIngestTime =
    lastIngestRow.max_ts != null
      ? new Date(lastIngestRow.max_ts).toISOString()
      : null;

  return {
    db_path: fullDbPath,
    db_size_bytes: dbSizeBytes,
    monitor_count: monitorCount.cnt,
    sample_count: sampleCount.cnt,
    last_ingest_time: lastIngestTime,
  };
}

export default defineEventHandler(async () => {
  try {
    // Check basic database connectivity
    let dbStatus: "ok" | "error" = "ok";
    try {
      const db = getDb();
      db.prepare("SELECT 1").get();
    } catch {
      dbStatus = "error";
    }

    // Gather extended F14 metrics
    const extended = getExtendedMetrics();

    info("Health check requested", {
      dbStatus,
      monitorCount: extended.monitor_count,
      sampleCount: extended.sample_count,
    });

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime() * 100) / 100,
      version: pkgVersion,
      db_path: extended.db_path,
      db_size_bytes: extended.db_size_bytes,
      monitor_count: extended.monitor_count,
      sample_count: extended.sample_count,
      last_ingest_time: extended.last_ingest_time,
    };
  } catch (err) {
    return {
      status: "error",
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
});
