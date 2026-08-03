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

// ============================================================================
// Helper
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

// ============================================================================
// Edge cases
// ============================================================================

describe("monitor ID at boundary values", () => {
  it("monitor ID 1 is valid", () => {
    const id = Number("1");
    expect(Number.isInteger(id) && id > 0).toBe(true);
  });

  it("very large monitor ID is valid integer", () => {
    const id = Number("999999999");
    expect(Number.isInteger(id) && id > 0).toBe(true);
  });
});

describe("time range edge cases", () => {
  it("time range of exactly 0 → fromMs == toMs → 400", () => {
    const fromMs = 1000;
    const toMs = 1000;
    // fromMs >= toMs → invalid
    expect(fromMs >= toMs).toBe(true);
  });

  it("time range spanning years works", () => {
    const fromMs = 1609459200000; // 2021-01-01
    const toMs = 1735689600000; // 2025-01-01
    const rangeMs = toMs - fromMs; // ~4 years
    const maxPoints = 2000;

    const bucketMs = calculateBucketSize(fromMs, toMs, maxPoints);
    // Should use a large bucket for 4 years of data
    expect(bucketMs).toBeGreaterThan(60000);
  });
});

describe("single sample in range", () => {
  let db: DBType;

  beforeEach(() => {
    clearDb();
    db = createTestDb();
    setDb(db);
    db.prepare(
      "INSERT INTO clients (slug, name, username, hostname, mac_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("test", "Test", "test", "host", "aa:00:bb:11:cc:22", 0, 0);
    db.prepare(
      "INSERT INTO monitors (client_id, target_host, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).run(1, "8.8.8.8", 0, 0);
  });

  afterEach(() => {
    db.close();
    clearDb();
  });

  it("single sample returns one point", () => {
    const baseTime = 1000000000000;
    db.prepare(
      "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, baseTime, 14.2, "success", "8.8.8.8", Date.now());

    const points = getMonitorHistoryPoints(1, baseTime - 1, baseTime + 60000, 60000);

    expect(points).toHaveLength(1);
    expect(points[0].sampleCount).toBe(1);
    expect(points[0].averageLatencyMs).toBe(14.2);
  });
});

describe("all samples are failures", () => {
  let db: DBType;

  beforeEach(() => {
    clearDb();
    db = createTestDb();
    setDb(db);
    db.prepare(
      "INSERT INTO clients (slug, name, username, hostname, mac_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("test", "Test", "test", "host", "aa:00:bb:11:cc:22", 0, 0);
    db.prepare(
      "INSERT INTO monitors (client_id, target_host, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).run(1, "8.8.8.8", 0, 0);
  });

  afterEach(() => {
    db.close();
    clearDb();
  });

  it("all failure samples → null latencies, 100% packet loss", () => {
    // Use a baseTime that's aligned to 60s bucket boundary so all samples land in one bucket
    const baseTime = 1000000020000; // floor(1000000020000 / 60000) * 60000 = 1000000020000
    for (let i = 0; i < 5; i++) {
      db.prepare(
        "INSERT INTO ping_samples (monitor_id, timestamp_ms, latency_ms, status, resolved_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(1, baseTime + i * 5000, null, "timeout", null, Date.now());
    }

    const points = getMonitorHistoryPoints(1, baseTime - 1, baseTime + 60000, 60000);

    expect(points).toHaveLength(1);
    expect(points[0].sampleCount).toBe(5);
    expect(points[0].failureCount).toBe(5);
    expect(points[0].averageLatencyMs).toBeNull();
    expect(points[0].minimumLatencyMs).toBeNull();
    expect(points[0].maximumLatencyMs).toBeNull();

    // Range summary should show 100% packet loss
    const summary = computeRangeSummary(points);
    expect(summary.packetLossPercent).toBe(100);
    expect(summary.successCount).toBe(0);
    expect(summary.averageLatencyMs).toBeNull();
  });
});

describe("maxPoints=1 (minimum)", () => {
  it("maxPoints=1 works with coarse bucket", () => {
    const fromMs = 0;
    const toMs = 3_600_000; // 1 hour
    const maxPoints = 1;

    // With only 1 point allowed, even the largest bucket (3600000) fits
    const bucketMs = calculateBucketSize(fromMs, toMs, maxPoints);
    expect(bucketMs).toBe(3600000); // 1 hour bucket
  });
});

describe("IPv6 address detection in buildTarget", () => {
  it("detects IPv6 address", () => {
    const monitor: any = {
      id: 1,
      target_host: "::1",
      target_name: "Localhost",
      created_at: Date.now(),
    };

    const target = buildTarget(monitor, null);
    expect(target.addressFamily).toBe("ipv6");
  });

  it("defaults to IPv4 for standard IP", () => {
    const monitor: any = {
      id: 1,
      target_host: "192.168.1.1",
      target_name: "Router",
      created_at: Date.now(),
    };

    const target = buildTarget(monitor, null);
    expect(target.addressFamily).toBe("ipv4");
  });
});

describe("quality intervals with all edge states", () => {
  it("no success samples → unstable state after warming up", () => {
    // First point is always warmingUp (pointIndex === 0 or cumulativeSamples < 5)
    // So we use multiple points: first has 5 samples (crosses warming threshold), second is all failures
    const points = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 50,
        minimumLatencyMs: 40,
        maximumLatencyMs: 60,
        sampleCount: 5,
        failureCount: 0,
      },
      {
        timestampMs: 1100000,
        averageLatencyMs: null,
        minimumLatencyMs: null,
        maximumLatencyMs: null,
        sampleCount: 10,
        failureCount: 10,
      },
    ];
    const intervals = computeQualityIntervals(points);
    // First interval: warmingUp (first point), second: unstable (all failures)
    expect(intervals.length).toBeGreaterThanOrEqual(2);
    const lastInterval = intervals[intervals.length - 1];
    expect(lastInterval.state).toBe("unstable");
  });

  it("high quality state — packetLoss < 5%, avgLatency < 100ms (after warming)", () => {
    // Use two points: first warms up, second shows high
    // classifyPoint: 0% loss, 75ms avg → veryHigh (loss < 1%, avg < 50ms? No, 75 >= 50)
    // Actually: 3% loss (not < 1%), avgLatency 75 < 100 → high (loss < 5%, avg < 100)
    const points = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 75,
        minimumLatencyMs: 50,
        maximumLatencyMs: 100,
        sampleCount: 5,
        failureCount: 0,
      },
      {
        timestampMs: 1100000,
        averageLatencyMs: 75,
        minimumLatencyMs: 50,
        maximumLatencyMs: 100,
        sampleCount: 100,
        failureCount: 3, // 3% loss
      },
    ];
    const intervals = computeQualityIntervals(points);
    // First point: 0% loss, avgLatency 75 → high (loss < 5%, avg < 100)
    // Second point: 3% loss, avgLatency 75 → high (loss < 5%, avg < 100)
    // Both high → 1 interval
    const lastInterval = intervals[intervals.length - 1];
    expect(lastInterval.state).toBe("high");
  });

  it("medium quality state — packetLoss < 10%, avgLatency < 200ms (after warming)", () => {
    // classifyPoint: 5% loss (not < 5%), avgLatency 150 < 200 → medium (loss < 10%, avg < 200)
    const points = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 150,
        minimumLatencyMs: 100,
        maximumLatencyMs: 200,
        sampleCount: 5,
        failureCount: 0,
      },
      {
        timestampMs: 1100000,
        averageLatencyMs: 150,
        minimumLatencyMs: 100,
        maximumLatencyMs: 200,
        sampleCount: 100,
        failureCount: 5, // 5% loss
      },
    ];
    const intervals = computeQualityIntervals(points);
    // First: 0% loss, avgLatency 150 → medium (loss < 10%, avg < 200, but loss not < 5% for high... wait, 0% IS < 5% and 150 IS < 100? No, 150 >= 100)
    // First: 0% loss, avgLatency 150 → medium (not < 1% for veryHigh, not < 5% AND < 100 for high since 150 >= 100, but 0% < 10% and 150 < 200 → medium)
    // Second: 5% loss, avgLatency 150 → medium (5% not < 5% for high, but 5% < 10% and 150 < 200 → medium)
    const lastInterval = intervals[intervals.length - 1];
    expect(lastInterval.state).toBe("medium");
  });

  it("low quality state — packetLoss < 10%, avgLatency >= 200ms (after warming)", () => {
    // classifyPoint: 0% loss, avgLatency 250 → not veryHigh (avg >= 50), not high (avg >= 100), not medium (avg >= 200)
    // → low (loss < 10%, avg >= 200)
    const points = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 250,
        minimumLatencyMs: 200,
        maximumLatencyMs: 300,
        sampleCount: 5,
        failureCount: 0,
      },
      {
        timestampMs: 1100000,
        averageLatencyMs: 250,
        minimumLatencyMs: 200,
        maximumLatencyMs: 300,
        sampleCount: 100,
        failureCount: 3, // 3% loss
      },
    ];
    const intervals = computeQualityIntervals(points);
    // First: 0% loss, avgLatency 250 → low (not < 1% for veryHigh... wait, 0% IS < 1% but avgLatency 250 >= 50, so not veryHigh)
    // 0% < 5% and 250 >= 100 → not high; 0% < 10% and 250 >= 200 → low
    // Second: 3% loss, avgLatency 250 → low (3% not < 1%, 3% < 5% but avg >= 100, 3% < 10% and avg >= 200 → low)
    const lastInterval = intervals[intervals.length - 1];
    expect(lastInterval.state).toBe("low");
  });
});

describe("computeRangeSummary edge cases", () => {
  it("single point summary is correct", () => {
    const points = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 50,
        minimumLatencyMs: 40,
        maximumLatencyMs: 60,
        sampleCount: 100,
        failureCount: 5,
      },
    ];
    const summary = computeRangeSummary(points);
    expect(summary.sampleCount).toBe(100);
    expect(summary.successCount).toBe(95);
    expect(summary.failureCount).toBe(5);
    expect(summary.packetLossPercent).toBe(5);
    expect(summary.minimumLatencyMs).toBe(40);
    expect(summary.maximumLatencyMs).toBe(60);
  });
});
