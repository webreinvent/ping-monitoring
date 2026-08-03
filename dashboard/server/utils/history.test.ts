import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  calculateBucketSize,
  getMonitorHistoryPoints,
  computeQualityIntervals,
  computeRangeSummary,
  buildTarget,
} from "./history";
import type {
  HistoryPoint,
  MonitorRow,
  ClientRow,
} from "./history";
import type { Database as DBType } from "better-sqlite3";

// ============================================================================
// Helper: Create in-memory test database
// ============================================================================

function createTestDb(): DBType {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      username TEXT NOT NULL,
      hostname TEXT NOT NULL,
      mac_address TEXT NOT NULL,
      sync_enabled BOOLEAN NOT NULL DEFAULT 1,
      sync_interval_min INTEGER NOT NULL DEFAULT 5,
      backend_url TEXT NOT NULL DEFAULT '',
      last_synced_at_ms INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      target_host TEXT NOT NULL,
      target_name TEXT DEFAULT NULL,
      quality_state TEXT DEFAULT 'warmingUp',
      state_since_ms INTEGER DEFAULT NULL,
      last_seen_ms INTEGER DEFAULT NULL,
      last_status TEXT DEFAULT NULL,
      last_latency_ms REAL DEFAULT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(client_id, target_host)
    );

    CREATE TABLE ping_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      timestamp_ms INTEGER NOT NULL,
      latency_ms REAL DEFAULT NULL,
      status TEXT NOT NULL,
      resolved_address TEXT DEFAULT NULL,
      error TEXT DEFAULT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(monitor_id, timestamp_ms, resolved_address)
    );

    CREATE INDEX IF NOT EXISTS idx_ping_monitor_time
      ON ping_samples(monitor_id, timestamp_ms);
  `);
  return db;
}

function setDb(db: DBType) {
  // @ts-expect-error — test isolation
  globalThis.__db = db;
}

function clearDb() {
  // @ts-expect-error — test isolation
  delete globalThis.__db;
}

// ============================================================================
// calculateBucketSize
// ============================================================================

describe("calculateBucketSize", () => {
  it("returns 1-minute bucket for small ranges", () => {
    // 1 hour range, 2000 maxPoints → 60 minutes < 2000 → 60s bucket
    const result = calculateBucketSize(0, 3_600_000, 2000);
    expect(result).toBe(60000);
  });

  it("returns 5-minute bucket when 1-minute exceeds maxPoints", () => {
    // 1 hour range, 10 maxPoints → 60 minutes > 10, 12 five-min buckets > 10
    // Actually: 60000 → 60 buckets > 10, 300000 → 12 buckets > 10, 900000 → 4 ≤ 10
    const result = calculateBucketSize(0, 3_600_000, 10);
    expect(result).toBe(900000);
  });

  it("returns 15-minute bucket for large ranges with moderate maxPoints", () => {
    // 24 hours, 100 maxPoints → 144 min-buckets > 100, 288 five-min > 100, 96 15-min ≤ 100
    const result = calculateBucketSize(0, 86_400_000, 100);
    expect(result).toBe(900000);
  });

  it("returns 60-minute bucket for very large ranges", () => {
    // 7 days, 50 maxPoints → 1008 min-buckets > 50, ... → 3600000 → 168 > 50, still too big
    // 1800000 → 336 > 50, 3600000 → 168 > 50
    // All clean sizes too small for 7 days in 50 buckets
    // Returns largest: 3600000
    const result = calculateBucketSize(0, 7 * 86_400_000, 50);
    expect(result).toBe(3600000);
  });

  it("returns default bucket for 0 range edge case", () => {
    const result = calculateBucketSize(0, 0, 2000);
    expect(result).toBe(60000); // Default 1-minute bucket (skips sub-minute)
  });
});

// ============================================================================
// getMonitorHistoryPoints
// ============================================================================

describe("getMonitorHistoryPoints", () => {
  let db: DBType;

  beforeEach(() => {
    clearDb();
    db = createTestDb();
    setDb(db);

    // Insert a client and monitor
    db.prepare(
      "INSERT INTO clients (slug, name, username, hostname, mac_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("test-client", "Test Client", "test", "host", "aa:00:bb:11:cc:22", Date.now(), Date.now());

    db.prepare(
      "INSERT INTO monitors (client_id, target_host, target_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(1, "8.8.8.8", "Google DNS", Date.now(), Date.now());
  });

  afterEach(() => {
    db.close();
    clearDb();
  });

  it("returns empty array when no data in range", () => {
    const points = getMonitorHistoryPoints(1, 0, 99999, 60000);
    expect(points).toEqual([]);
  });

  it("aggregates single-minute bucket correctly", () => {
    // Use baseTime aligned to 60s bucket boundary
    const baseTime = 1000000020000; // Multiple of 60000
    // Insert 3 samples in the same minute
    db.prepare(
      "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, baseTime + 1, 10.0, "success", "8.8.8.8", Date.now());
    db.prepare(
      "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, baseTime + 10000, 20.0, "success", "8.8.8.8", Date.now());
    db.prepare(
      "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, baseTime + 20000, 30.0, "success", "8.8.8.8", Date.now());

    const points = getMonitorHistoryPoints(
      1,
      baseTime,
      baseTime + 60000,
      60000,
    );

    expect(points).toHaveLength(1);
    expect(points[0].sampleCount).toBe(3);
    expect(points[0].failureCount).toBe(0);
    expect(points[0].averageLatencyMs).toBeCloseTo(20, 10);
    expect(points[0].minimumLatencyMs).toBe(10.0);
    expect(points[0].maximumLatencyMs).toBe(30.0);
  });

  it("handles multiple buckets with mixed statuses", () => {
    const baseTime = 1000000000000;
    // First bucket: all success
    db.prepare(
      "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, baseTime, 10.0, "success", "8.8.8.8", Date.now());
    // Second bucket: mixed
    db.prepare(
      "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, baseTime + 60000, 15.0, "success", "8.8.8.8", Date.now());
    db.prepare(
      "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, baseTime + 60001, null, "timeout", null, Date.now());

    const points = getMonitorHistoryPoints(
      1,
      baseTime - 1,
      baseTime + 120000,
      60000,
    );

    expect(points).toHaveLength(2);
    expect(points[0].sampleCount).toBe(1);
    expect(points[0].failureCount).toBe(0);
    expect(points[1].sampleCount).toBe(2);
    expect(points[1].failureCount).toBe(1);
  });

  it("failure-only bucket has null latencies", () => {
    const baseTime = 1000000000000;
    db.prepare(
      "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, baseTime, null, "timeout", null, Date.now());
    db.prepare(
      "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, baseTime + 5000, null, "error", null, Date.now());

    const points = getMonitorHistoryPoints(
      1,
      baseTime - 1,
      baseTime + 60000,
      60000,
    );

    expect(points).toHaveLength(1);
    expect(points[0].averageLatencyMs).toBeNull();
    expect(points[0].minimumLatencyMs).toBeNull();
    expect(points[0].maximumLatencyMs).toBeNull();
    expect(points[0].failureCount).toBe(2);
  });

  it("time range boundaries are exclusive/inclusive as specified", () => {
    // Use a baseTime aligned to 60s bucket to ensure samples land in same bucket
    const baseTime = 1000000020000; // Multiple of 60000
    // Exactly at fromMs boundary (exclusive — should NOT be included)
    db.prepare(
      "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, baseTime, 10.0, "success", "8.8.8.8", Date.now());
    // After fromMs (should be included)
    db.prepare(
      "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, baseTime + 1, 20.0, "success", "8.8.8.8", Date.now());
    // Well before toMs (should be included) — within same bucket
    db.prepare(
      "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, baseTime + 30000, 30.0, "success", "8.8.8.8", Date.now());

    // fromMs = baseTime (exclusive), toMs = baseTime + 60000
    // Sample at baseTime excluded, at baseTime+1 and baseTime+30000 included (same bucket)
    const points = getMonitorHistoryPoints(1, baseTime, baseTime + 60000, 60000);

    expect(points).toHaveLength(1);
    expect(points[0].sampleCount).toBe(2);
  });

  it("coarse bucket aggregates multiple minutes", () => {
    // Use baseTime aligned to 300s (5-min) bucket boundary
    const baseTime = 1000000020000; // 1000000020000 % 300000 = 20000, need aligned
    // Actually use baseTime = 1000000200000 (divisible by 300000)
    const alignedBase = 1000000200000;
    // 5 samples spread across 5 minutes, all within one 5-minute bucket
    for (let i = 0; i < 5; i++) {
      db.prepare(
        "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(1, alignedBase + 1 + i * 60000, 10 + i, "success", "8.8.8.8", Date.now());
    }

    // Use 5-minute bucket — all 5 samples should be in one bucket
    const points = getMonitorHistoryPoints(
      1,
      alignedBase,
      alignedBase + 300000,
      300000,
    );

    expect(points).toHaveLength(1);
    expect(points[0].sampleCount).toBe(5);
    expect(points[0].failureCount).toBe(0);
  });
});

// ============================================================================
// computeQualityIntervals
// ============================================================================

describe("computeQualityIntervals", () => {
  it("returns empty intervals for empty points", () => {
    const intervals = computeQualityIntervals([]);
    expect(intervals).toEqual([]);
  });

  it("single point with good latency → low (when cumulative >= 5 samples)", () => {
    // Add a preceding point to bypass warmingUp on first index
    // First point is warmingUp (index 0), second transitions to low
    const points: HistoryPoint[] = [
      {
        timestampMs: 940000,
        averageLatencyMs: 14,
        minimumLatencyMs: 10,
        maximumLatencyMs: 20,
        sampleCount: 10,
        failureCount: 0,
      },
      {
        timestampMs: 1000000,
        averageLatencyMs: 14,
        minimumLatencyMs: 10,
        maximumLatencyMs: 20,
        sampleCount: 10,
        failureCount: 0,
      },
    ];
    const intervals = computeQualityIntervals(points);
    // Both points have >= 5 cumulative samples and good latency → both low → 1 interval
    expect(intervals).toHaveLength(1);
    expect(intervals[0].state).toBe("low");
  });

  it("points with high packet loss → unstable", () => {
    // Add a preceding point to bypass warmingUp on first index
    const points: HistoryPoint[] = [
      {
        timestampMs: 940000,
        averageLatencyMs: 50,
        minimumLatencyMs: 40,
        maximumLatencyMs: 60,
        sampleCount: 10,
        failureCount: 5, // 50% loss
      },
      {
        timestampMs: 1000000,
        averageLatencyMs: 50,
        minimumLatencyMs: 40,
        maximumLatencyMs: 60,
        sampleCount: 10,
        failureCount: 5, // 50% loss
      },
    ];
    const intervals = computeQualityIntervals(points);
    // Both points have high packet loss → both unstable → 1 interval
    expect(intervals).toHaveLength(1);
    expect(intervals[0].state).toBe("unstable");
  });

  it("first point with fewer than 5 samples → warmingUp", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 10,
        minimumLatencyMs: 8,
        maximumLatencyMs: 12,
        sampleCount: 3,
        failureCount: 0,
      },
    ];
    const intervals = computeQualityIntervals(points);
    expect(intervals).toHaveLength(1);
    expect(intervals[0].state).toBe("warmingUp");
  });

  it("gap between points → disconnected interval", () => {
    // Need 3 points: first warms up, second establishes low quality, then gap, then low again
    const points: HistoryPoint[] = [
      {
        timestampMs: 880000,
        averageLatencyMs: 10,
        minimumLatencyMs: 8,
        maximumLatencyMs: 12,
        sampleCount: 10,
        failureCount: 0,
      },
      {
        timestampMs: 1000000,
        averageLatencyMs: 10,
        minimumLatencyMs: 8,
        maximumLatencyMs: 12,
        sampleCount: 10,
        failureCount: 0,
      },
      {
        timestampMs: 1000000 + 300000, // 5 minutes later (5x 60s bucket → gap > 2x bucket)
        averageLatencyMs: 15,
        minimumLatencyMs: 12,
        maximumLatencyMs: 20,
        sampleCount: 10,
        failureCount: 0,
      },
    ];
    const intervals = computeQualityIntervals(points, 60000);
    // low → disconnected → low (first two points merge into one interval since gap=120000 which is NOT > 2x60000)
    expect(intervals).toHaveLength(3);
    expect(intervals[0].state).toBe("low");
    expect(intervals[1].state).toBe("disconnected");
    expect(intervals[2].state).toBe("low");
  });

  it("mixed states produce multiple intervals", () => {
    // Need 3 points: first warms up, second is low quality, third is veryHigh
    const points: HistoryPoint[] = [
      {
        timestampMs: 880000,
        averageLatencyMs: 10,
        minimumLatencyMs: 8,
        maximumLatencyMs: 12,
        sampleCount: 10,
        failureCount: 0,
      },
      {
        timestampMs: 1000000,
        averageLatencyMs: 10,
        minimumLatencyMs: 8,
        maximumLatencyMs: 12,
        sampleCount: 10,
        failureCount: 0,
      },
      {
        timestampMs: 1060000,
        averageLatencyMs: 250,
        minimumLatencyMs: 200,
        maximumLatencyMs: 300,
        sampleCount: 10,
        failureCount: 0,
      },
    ];
    const intervals = computeQualityIntervals(points, 60000);
    // low → veryHigh (first two points merge since both are low, third is veryHigh)
    expect(intervals).toHaveLength(2);
    expect(intervals[0].state).toBe("low");
    expect(intervals[1].state).toBe("veryHigh");
  });
});

// ============================================================================
// computeRangeSummary
// ============================================================================

describe("computeRangeSummary", () => {
  it("returns zero/null summary for empty points", () => {
    const summary = computeRangeSummary([]);
    expect(summary.sampleCount).toBe(0);
    expect(summary.successCount).toBe(0);
    expect(summary.failureCount).toBe(0);
    expect(summary.packetLossPercent).toBe(0);
    expect(summary.averageLatencyMs).toBeNull();
    expect(summary.minimumLatencyMs).toBeNull();
    expect(summary.maximumLatencyMs).toBeNull();
    expect(summary.p95LatencyMs).toBeNull();
    expect(summary.stableMs).toBe(0);
    expect(summary.unstableMs).toBe(0);
    expect(summary.disconnectedMs).toBe(0);
  });

  it("all success → 0% packet loss", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 14.2,
        minimumLatencyMs: 10,
        maximumLatencyMs: 20,
        sampleCount: 100,
        failureCount: 0,
      },
      {
        timestampMs: 1060000,
        averageLatencyMs: 15.0,
        minimumLatencyMs: 11,
        maximumLatencyMs: 22,
        sampleCount: 100,
        failureCount: 0,
      },
    ];
    const summary = computeRangeSummary(points);
    expect(summary.sampleCount).toBe(200);
    expect(summary.successCount).toBe(200);
    expect(summary.failureCount).toBe(0);
    expect(summary.packetLossPercent).toBe(0);
    expect(summary.minimumLatencyMs).toBe(10);
    expect(summary.maximumLatencyMs).toBe(22);
  });

  it("mixed success/failure → correct packet loss", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 14.2,
        minimumLatencyMs: 10,
        maximumLatencyMs: 20,
        sampleCount: 100,
        failureCount: 5,
      },
    ];
    const summary = computeRangeSummary(points);
    expect(summary.sampleCount).toBe(100);
    expect(summary.successCount).toBe(95);
    expect(summary.failureCount).toBe(5);
    expect(summary.packetLossPercent).toBe(5);
  });

  it("p95 calculation correct for known dataset", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 1000000, averageLatencyMs: 10, minimumLatencyMs: 10, maximumLatencyMs: 10, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1060000, averageLatencyMs: 20, minimumLatencyMs: 20, maximumLatencyMs: 20, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1120000, averageLatencyMs: 30, minimumLatencyMs: 30, maximumLatencyMs: 30, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1180000, averageLatencyMs: 40, minimumLatencyMs: 40, maximumLatencyMs: 40, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1240000, averageLatencyMs: 50, minimumLatencyMs: 50, maximumLatencyMs: 50, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1300000, averageLatencyMs: 60, minimumLatencyMs: 60, maximumLatencyMs: 60, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1360000, averageLatencyMs: 70, minimumLatencyMs: 70, maximumLatencyMs: 70, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1420000, averageLatencyMs: 80, minimumLatencyMs: 80, maximumLatencyMs: 80, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1480000, averageLatencyMs: 90, minimumLatencyMs: 90, maximumLatencyMs: 90, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1540000, averageLatencyMs: 100, minimumLatencyMs: 100, maximumLatencyMs: 100, sampleCount: 10, failureCount: 0 },
    ];
    const summary = computeRangeSummary(points);
    // p95Index = Math.ceil(10 * 0.95) - 1 = Math.ceil(9.5) - 1 = 10 - 1 = 9
    // sorted[9] = 100
    expect(summary.p95LatencyMs).toBe(100);
  });
});

// ============================================================================
// buildTarget
// ============================================================================

describe("buildTarget", () => {
  it("correctly maps DB row to Target shape", () => {
    const monitor: any = {
      id: 42,
      target_host: "8.8.8.8",
      target_name: "Google DNS",
      created_at: 1753000000000,
    };
    const client: any = {
      id: 1,
      slug: "test-client",
      name: "Test Client",
    };

    const target = buildTarget(monitor, client);

    expect(target.id).toBe("42");
    expect(target.name).toBe("Google DNS");
    expect(target.host).toBe("8.8.8.8");
    expect(target.enabled).toBe(true);
    expect(target.addressFamily).toBe("ipv4");
    expect(target.intervalMs).toBe(1000);
    expect(target.timeoutMs).toBe(5000);
    expect(target.createdAtMs).toBe(1753000000000);
    expect(target.archivedAtMs).toBeNull();
    expect(target.thresholds).toBeDefined();
    expect(target.thresholds.windowSeconds).toBe(300);
  });

  it("defaults for missing fields", () => {
    const monitor: any = {
      id: 1,
      target_host: "1.1.1.1",
      target_name: null,
      created_at: 1700000000000,
    };

    const target = buildTarget(monitor, null);

    expect(target.name).toBe("1.1.1.1"); // Falls back to target_host
    expect(target.enabled).toBe(true);
    expect(target.addressFamily).toBe("ipv4");
    expect(target.thresholds).toEqual({
      windowSeconds: 300,
      minimumSamples: 10,
      packetLossPercent: 1,
      jitterMs: 20,
      p95LatencyMs: 100,
      unstableForSeconds: 60,
      stableForSeconds: 30,
      outageFailures: 5,
      recoverySuccesses: 3,
    });
  });
});
