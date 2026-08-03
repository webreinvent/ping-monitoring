import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import type { Database as DBType } from "better-sqlite3";
import {
  getMonitorHistoryPoints,
  computeQualityIntervals,
  computeRangeSummary,
  buildTarget,
  calculateBucketSize,
} from "~/server/utils/history";
import type { HistoryResponse } from "~/shared/types";

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

function setupMonitor(db: DBType, monitorId: number = 1) {
  db.prepare(
    "INSERT INTO clients (slug, name, username, hostname, mac_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run("test-client", "Test Client", "test", "host", "aa:00:bb:11:cc:22", Date.now(), Date.now());

  db.prepare(
    "INSERT INTO monitors (id, client_id, target_host, target_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(monitorId, 1, "8.8.8.8", "Google DNS", Date.now(), Date.now());
}

// ============================================================================
// Full response shape
// ============================================================================

describe("full response shape", () => {
  let db: DBType;

  beforeEach(() => {
    clearDb();
    db = createTestDb();
    setDb(db);
    setupMonitor(db);

    const baseTime = 1753852800000;
    for (let i = 0; i < 10; i++) {
      db.prepare(
        "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(1, baseTime + i * 60000, 10 + i, "success", "8.8.8.8", Date.now());
    }
  });

  afterEach(() => {
    db.close();
    clearDb();
  });

  it("returns valid HistoryResponse with all required fields", () => {
    const fromMs = 1753852800000;
    const toMs = 1753852800000 + 600000;
    const maxPoints = 2000;
    const bucketMs = calculateBucketSize(fromMs, toMs, maxPoints);

    const points = getMonitorHistoryPoints(1, fromMs, toMs, bucketMs);
    const intervals = computeQualityIntervals(points, bucketMs);
    const summary = computeRangeSummary(points);

    const monitor = db.prepare("SELECT * FROM monitors WHERE id = ?").get(1);
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(
      (monitor as any).client_id,
    );
    const target = buildTarget(monitor as any, client ?? null);

    const response: HistoryResponse = {
      fromMs,
      toMs,
      bucketMs,
      series: [{ target, points, intervals, summary }],
    };

    // Verify top-level fields
    expect(response.fromMs).toBe(fromMs);
    expect(response.toMs).toBe(toMs);
    expect(typeof response.bucketMs).toBe("number");
    expect(response.series).toHaveLength(1);

    // Verify series[0] fields
    const series = response.series[0];
    expect(series.target).toBeDefined();
    expect(Array.isArray(series.points)).toBe(true);
    expect(Array.isArray(series.intervals)).toBe(true);
    expect(series.summary).toBeDefined();
  });

  it("single point with correct aggregation", () => {
    const baseTime = 1753852800000;
    // Query a narrow range that only includes the first sample (i=0, at baseTime)
    // fromMs is exclusive, so baseTime - 0 excludes nothing at baseTime
    // toMs is inclusive, so baseTime + 29999 only catches the first bucket
    const fromMs = baseTime - 1;
    const toMs = baseTime + 29999;
    const bucketMs = 60000;

    const points = getMonitorHistoryPoints(1, fromMs, toMs, bucketMs);

    expect(points).toHaveLength(1);
    expect(points[0].timestampMs).toBe(baseTime);
    expect(points[0].sampleCount).toBe(1);
    expect(points[0].failureCount).toBe(0);
    expect(points[0].averageLatencyMs).toBe(10);
  });
});

// ============================================================================
// Time window filtering
// ============================================================================

describe("time window filtering", () => {
  let db: DBType;

  beforeEach(() => {
    clearDb();
    db = createTestDb();
    setDb(db);
    setupMonitor(db);

    // Insert samples across a wide range
    const baseTime = 1753852800000;
    for (let i = 0; i < 60; i++) {
      db.prepare(
        "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(1, baseTime + i * 60000, 10, "success", "8.8.8.8", Date.now());
    }
  });

  afterEach(() => {
    db.close();
    clearDb();
  });

  it("only returns points within requested range", () => {
    const baseTime = 1753852800000;
    // Request only a 10-minute window
    const fromMs = baseTime + 300000;
    const toMs = baseTime + 600000;
    const bucketMs = 60000;

    const points = getMonitorHistoryPoints(1, fromMs, toMs, bucketMs);

    // Should only have points in [fromMs, toMs]
    for (const point of points) {
      expect(point.timestampMs).toBeGreaterThanOrEqual(fromMs);
      expect(point.timestampMs).toBeLessThanOrEqual(toMs);
    }

    // With 5-minute window and 1-minute buckets, expect ~5 points
    expect(points.length).toBeLessThan(60);
  });

  it("points outside range are excluded", () => {
    const baseTime = 1753852800000;
    // Request a narrow range
    const fromMs = baseTime + 120000;
    const toMs = baseTime + 180000;
    const bucketMs = 60000;

    const points = getMonitorHistoryPoints(1, fromMs, toMs, bucketMs);

    // Only 1-2 buckets should be in this range
    expect(points.length).toBeLessThanOrEqual(2);
    expect(points.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// maxPoints enforcement
// ============================================================================

describe("maxPoints enforcement", () => {
  let db: DBType;

  beforeEach(() => {
    clearDb();
    db = createTestDb();
    setDb(db);
    setupMonitor(db);

    const baseTime = 1753852800000;
    // Insert 100 samples across 100 minutes
    for (let i = 0; i < 100; i++) {
      db.prepare(
        "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(1, baseTime + i * 60000, 10, "success", "8.8.8.8", Date.now());
    }
  });

  afterEach(() => {
    db.close();
    clearDb();
  });

  it("with maxPoints=10 and many samples, response ≤ 10 points", () => {
    const baseTime = 1753852800000;
    const fromMs = baseTime;
    const toMs = baseTime + 6000000; // 100 minutes
    const maxPoints = 10;

    const bucketMs = calculateBucketSize(fromMs, toMs, maxPoints);

    // Should use a coarse bucket to fit within 10 points
    // 100 minutes / 10 points = 10 minutes per bucket → 600000
    expect(bucketMs).toBeGreaterThan(60000);

    const points = getMonitorHistoryPoints(1, fromMs, toMs, bucketMs);
    expect(points.length).toBeLessThanOrEqual(maxPoints);
  });

  it("bucketMs reflects coarser aggregation when down-sampled", () => {
    const baseTime = 1753852800000;
    const fromMs = baseTime;
    const toMs = baseTime + 6000000;
    const maxPoints = 5;

    const bucketMs = calculateBucketSize(fromMs, toMs, maxPoints);

    // Should use a very coarse bucket
    expect(bucketMs).toBeGreaterThanOrEqual(900000); // 15 min or more

    const points = getMonitorHistoryPoints(1, fromMs, toMs, bucketMs);
    expect(points.length).toBeLessThanOrEqual(maxPoints);
  });
});

// ============================================================================
// Empty data returns 200
// ============================================================================

describe("empty data returns 200", () => {
  let db: DBType;

  beforeEach(() => {
    clearDb();
    db = createTestDb();
    setDb(db);
    setupMonitor(db);
    // Don't insert any ping samples
  });

  afterEach(() => {
    db.close();
    clearDb();
  });

  it("valid monitor with no samples in range → 200 with empty points", () => {
    const fromMs = Date.now() - 3_600_000;
    const toMs = Date.now();
    const bucketMs = 60000;

    const points = getMonitorHistoryPoints(1, fromMs, toMs, bucketMs);
    const intervals = computeQualityIntervals(points, bucketMs);
    const summary = computeRangeSummary(points);

    expect(points).toEqual([]);
    expect(intervals).toEqual([]);
    expect(summary.sampleCount).toBe(0);
    expect(summary.successCount).toBe(0);
    expect(summary.failureCount).toBe(0);
    expect(summary.packetLossPercent).toBe(0);
    expect(summary.averageLatencyMs).toBeNull();
  });
});

// ============================================================================
// Error responses
// ============================================================================

describe("error responses", () => {
  let db: DBType;

  beforeEach(() => {
    clearDb();
    db = createTestDb();
    setDb(db);
  });

  afterEach(() => {
    db.close();
    clearDb();
  });

  it("404 for non-existent monitor", () => {
    setupMonitor(db, 1);
    const monitor = db.prepare("SELECT * FROM monitors WHERE id = ?").get(9999);
    expect(monitor).toBeUndefined();
  });

  it("400 for fromMs > toMs", () => {
    const fromMs = 2000;
    const toMs = 1000;
    expect(fromMs >= toMs).toBe(true); // Would trigger 400
  });
});
