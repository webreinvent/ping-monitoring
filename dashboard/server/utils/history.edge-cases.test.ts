import { describe, it, expect } from "vitest";
import {
  calculateBucketSize,
  computeQualityIntervals,
  computeRangeSummary,
  buildTarget,
} from "./history";
import type { HistoryPoint, MonitorRow, ClientRow } from "./history";

// ============================================================================
// calculateBucketSize — edge cases
// ============================================================================

describe("calculateBucketSize — edge cases", () => {
  it("returns largest bucket when range is extremely large", () => {
    // 100 years range, 10 maxPoints
    const fromMs = 0;
    const toMs = 100 * 365.25 * 24 * 3600 * 1000;
    const result = calculateBucketSize(fromMs, toMs, 10);
    expect(result).toBe(3600000); // Largest available
  });

  it("returns largest bucket when maxPoints is 0", () => {
    const result = calculateBucketSize(0, 3_600_000, 0);
    expect(result).toBe(3600000);
  });

  it("handles negative range (shouldn't happen but shouldn't crash)", () => {
    const result = calculateBucketSize(1000, 0, 2000);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });

  it("returns 1h bucket for 1h range with 1 maxPoint", () => {
    const result = calculateBucketSize(0, 3_600_000, 1);
    expect(result).toBe(3600000);
  });

  it("returns 1h bucket for 24h range with 24 maxPoints", () => {
    // 24h / 1h = 24 buckets = exactly maxPoints
    const result = calculateBucketSize(0, 24 * 3_600_000, 24);
    expect(result).toBe(3600000);
  });

  it("returns 30min bucket for 24h range with 50 maxPoints", () => {
    // 24h / 30min = 48 buckets <= 50
    const result = calculateBucketSize(0, 24 * 3_600_000, 50);
    expect(result).toBe(1800000);
  });

  it("handles exactly equal fromMs and toMs", () => {
    // Range of 0ms
    const result = calculateBucketSize(1000000, 1000000, 2000);
    expect(result).toBe(60000); // Default
  });

  it("sub-minute buckets are skipped even if they would fit", () => {
    // Small range where 1000ms bucket would give 100 points
    // but sub-minute buckets should be skipped
    const result = calculateBucketSize(0, 100_000, 200);
    // 100s range / 60s bucket = 2 points, which fits
    expect(result).toBe(60000);
  });
});

// ============================================================================
// computeQualityIntervals — state transitions
// ============================================================================

describe("computeQualityIntervals — state transitions", () => {
  it("transitions from warmingUp to low when cumulative samples >= 5", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 10,
        minimumLatencyMs: 8,
        maximumLatencyMs: 12,
        sampleCount: 3,
        failureCount: 0,
      },
      {
        timestampMs: 1060000,
        averageLatencyMs: 12,
        minimumLatencyMs: 10,
        maximumLatencyMs: 14,
        sampleCount: 5,
        failureCount: 0,
      },
    ];
    const intervals = computeQualityIntervals(points, 60000);
    expect(intervals).toHaveLength(2);
    expect(intervals[0].state).toBe("warmingUp");
    expect(intervals[1].state).toBe("low");
  });

  it("transitions from low to unstable on packet loss spike", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 14,
        minimumLatencyMs: 10,
        maximumLatencyMs: 20,
        sampleCount: 10,
        failureCount: 0,
      },
      {
        timestampMs: 1060000,
        averageLatencyMs: 50,
        minimumLatencyMs: 40,
        maximumLatencyMs: 60,
        sampleCount: 10,
        failureCount: 5, // 50% packet loss
      },
    ];
    const intervals = computeQualityIntervals(points, 60000);
    expect(intervals).toHaveLength(2);
    expect(intervals[0].state).toBe("low");
    expect(intervals[1].state).toBe("unstable");
  });

  it("transitions from unstable back to low", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 50,
        minimumLatencyMs: 40,
        maximumLatencyMs: 60,
        sampleCount: 10,
        failureCount: 5,
      },
      {
        timestampMs: 1060000,
        averageLatencyMs: 14,
        minimumLatencyMs: 10,
        maximumLatencyMs: 20,
        sampleCount: 10,
        failureCount: 0,
      },
    ];
    const intervals = computeQualityIntervals(points, 60000);
    expect(intervals).toHaveLength(2);
    expect(intervals[0].state).toBe("unstable");
    expect(intervals[1].state).toBe("low");
  });

  it("transitions through multiple states in sequence", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 1000000, averageLatencyMs: 10, minimumLatencyMs: 8, maximumLatencyMs: 12, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1060000, averageLatencyMs: 75, minimumLatencyMs: 50, maximumLatencyMs: 100, sampleCount: 100, failureCount: 3 },
      { timestampMs: 1120000, averageLatencyMs: 150, minimumLatencyMs: 100, maximumLatencyMs: 200, sampleCount: 100, failureCount: 5 },
      { timestampMs: 1180000, averageLatencyMs: 250, minimumLatencyMs: 200, maximumLatencyMs: 300, sampleCount: 100, failureCount: 3 },
      { timestampMs: 1240000, averageLatencyMs: 50, minimumLatencyMs: 40, maximumLatencyMs: 60, sampleCount: 10, failureCount: 5 },
    ];
    const intervals = computeQualityIntervals(points, 60000);

    // low -> medium -> high -> veryHigh -> unstable
    expect(intervals).toHaveLength(5);
    expect(intervals[0].state).toBe("low");
    expect(intervals[1].state).toBe("medium");
    expect(intervals[2].state).toBe("high");
    expect(intervals[3].state).toBe("veryHigh");
    expect(intervals[4].state).toBe("unstable");
  });

  it("consecutive points with same state are merged into one interval", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 1000000, averageLatencyMs: 10, minimumLatencyMs: 8, maximumLatencyMs: 12, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1060000, averageLatencyMs: 12, minimumLatencyMs: 10, maximumLatencyMs: 14, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1120000, averageLatencyMs: 11, minimumLatencyMs: 9, maximumLatencyMs: 13, sampleCount: 10, failureCount: 0 },
    ];
    const intervals = computeQualityIntervals(points, 60000);
    expect(intervals).toHaveLength(1);
    expect(intervals[0].state).toBe("low");
  });
});

// ============================================================================
// computeQualityIntervals — reason collection
// ============================================================================

describe("computeQualityIntervals — reason collection", () => {
  it("includes packetLoss reason for unstable intervals", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 50,
        minimumLatencyMs: 40,
        maximumLatencyMs: 60,
        sampleCount: 10,
        failureCount: 5, // 50% packet loss
      },
    ];
    const intervals = computeQualityIntervals(points);
    expect(intervals[0].reasons).toContain("packetLoss");
  });

  it("includes highLatency reason when avg >= 200ms", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 250,
        minimumLatencyMs: 200,
        maximumLatencyMs: 300,
        sampleCount: 100,
        failureCount: 3, // 3% loss
      },
    ];
    const intervals = computeQualityIntervals(points);
    expect(intervals[0].reasons).toContain("highLatency");
  });

  it("includes insufficientSamples reason for warmingUp with < 5 samples", () => {
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
    expect(intervals[0].reasons).toContain("insufficientSamples");
  });

  it("merged intervals combine reasons from all constituent points", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 250,
        minimumLatencyMs: 200,
        maximumLatencyMs: 300,
        sampleCount: 100,
        failureCount: 3, // 3% loss — veryHigh (loss < 10%, latency >= 200)
      },
      {
        timestampMs: 1060000,
        averageLatencyMs: 250,
        minimumLatencyMs: 200,
        maximumLatencyMs: 300,
        sampleCount: 100,
        failureCount: 3, // 3% loss — same state: veryHigh
      },
    ];
    const intervals = computeQualityIntervals(points, 60000);
    expect(intervals).toHaveLength(1);
    expect(intervals[0].state).toBe("veryHigh");
    // highLatency should appear
    expect(intervals[0].reasons).toContain("highLatency");
  });

  it("disconnected interval has no reasons", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 10,
        minimumLatencyMs: 8,
        maximumLatencyMs: 12,
        sampleCount: 10,
        failureCount: 0,
      },
      {
        timestampMs: 1000000 + 300000,
        averageLatencyMs: 15,
        minimumLatencyMs: 12,
        maximumLatencyMs: 20,
        sampleCount: 10,
        failureCount: 0,
      },
    ];
    const intervals = computeQualityIntervals(points, 60000);
    const disconnected = intervals.find(i => i.state === "disconnected");
    expect(disconnected).toBeDefined();
    expect(disconnected!.reasons).toEqual([]);
  });

  it("reasons array is a new copy (not shared reference)", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 50,
        minimumLatencyMs: 40,
        maximumLatencyMs: 60,
        sampleCount: 10,
        failureCount: 5,
      },
      {
        timestampMs: 1060000,
        averageLatencyMs: 14,
        minimumLatencyMs: 10,
        maximumLatencyMs: 20,
        sampleCount: 10,
        failureCount: 0,
      },
    ];
    const intervals = computeQualityIntervals(points);
    // Get reasons from first interval and mutate
    const reasonsFirst = intervals[0].reasons;
    reasonsFirst.push("highJitter" as any);
    // The mutation affects the returned array but should NOT affect
    // subsequent intervals' reasons (each interval has its own array)
    expect(intervals[1].reasons).not.toContain("highJitter");
  });
});

// ============================================================================
// computeQualityIntervals — gaps and disconnected intervals
// ============================================================================

describe("computeQualityIntervals — gaps and disconnected", () => {
  it("small gap (1x bucket) does NOT create disconnected interval", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 10,
        minimumLatencyMs: 8,
        maximumLatencyMs: 12,
        sampleCount: 10,
        failureCount: 0,
      },
      {
        timestampMs: 1000000 + 60000, // Exactly 1 bucket apart
        averageLatencyMs: 15,
        minimumLatencyMs: 12,
        maximumLatencyMs: 20,
        sampleCount: 10,
        failureCount: 0,
      },
    ];
    const intervals = computeQualityIntervals(points, 60000);
    // Gap = 60000ms, threshold = 2 * 60000 = 120000ms → not disconnected
    expect(intervals).toHaveLength(1);
    expect(intervals[0].state).toBe("low");
  });

  it("exact 2x bucket gap does NOT create disconnected interval", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 10,
        minimumLatencyMs: 8,
        maximumLatencyMs: 12,
        sampleCount: 10,
        failureCount: 0,
      },
      {
        timestampMs: 1000000 + 120000, // Exactly 2 buckets
        averageLatencyMs: 15,
        minimumLatencyMs: 12,
        maximumLatencyMs: 20,
        sampleCount: 10,
        failureCount: 0,
      },
    ];
    const intervals = computeQualityIntervals(points, 60000);
    // Gap = 120000ms, threshold = 2 * 60000 = 120000ms → gapMs > bucketMs * 2 is false
    expect(intervals).toHaveLength(1);
  });

  it("gap just above 2x bucket creates disconnected interval", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 10,
        minimumLatencyMs: 8,
        maximumLatencyMs: 12,
        sampleCount: 10,
        failureCount: 0,
      },
      {
        timestampMs: 1000000 + 120001, // Just above 2x bucket
        averageLatencyMs: 15,
        minimumLatencyMs: 12,
        maximumLatencyMs: 20,
        sampleCount: 10,
        failureCount: 0,
      },
    ];
    const intervals = computeQualityIntervals(points, 60000);
    expect(intervals).toHaveLength(3);
    expect(intervals[0].state).toBe("low");
    expect(intervals[1].state).toBe("disconnected");
    expect(intervals[2].state).toBe("low");
  });

  it("multiple disconnected gaps produce multiple disconnected intervals", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 1000000, averageLatencyMs: 10, minimumLatencyMs: 8, maximumLatencyMs: 12, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1000000 + 300000, averageLatencyMs: 10, minimumLatencyMs: 8, maximumLatencyMs: 12, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1000000 + 600000, averageLatencyMs: 10, minimumLatencyMs: 8, maximumLatencyMs: 12, sampleCount: 10, failureCount: 0 },
    ];
    const intervals = computeQualityIntervals(points, 60000);
    expect(intervals).toHaveLength(5); // low, disconnected, low, disconnected, low
    const disconnected = intervals.filter(i => i.state === "disconnected");
    expect(disconnected).toHaveLength(2);
  });
});

// ============================================================================
// computeRangeSummary — edge cases
// ============================================================================

describe("computeRangeSummary — edge cases", () => {
  it("all failure → 100% packet loss, null latencies", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: null,
        minimumLatencyMs: null,
        maximumLatencyMs: null,
        sampleCount: 100,
        failureCount: 100,
      },
    ];
    const summary = computeRangeSummary(points);
    expect(summary.packetLossPercent).toBe(100);
    expect(summary.successCount).toBe(0);
    expect(summary.averageLatencyMs).toBeNull();
    expect(summary.minimumLatencyMs).toBeNull();
    expect(summary.maximumLatencyMs).toBeNull();
    expect(summary.p95LatencyMs).toBeNull();
  });

  it("zero sample count is handled", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: null,
        minimumLatencyMs: null,
        maximumLatencyMs: null,
        sampleCount: 0,
        failureCount: 0,
      },
    ];
    const summary = computeRangeSummary(points);
    expect(summary.sampleCount).toBe(0);
    expect(summary.packetLossPercent).toBe(0);
  });

  it("summary with pre-computed intervals uses provided intervals", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 14,
        minimumLatencyMs: 10,
        maximumLatencyMs: 20,
        sampleCount: 10,
        failureCount: 0,
      },
    ];
    const intervals = [
      {
        startMs: 1000000,
        endMs: null,
        state: "low" as const,
        reasons: [],
      },
    ];
    const summary = computeRangeSummary(points, intervals);
    expect(summary.stableMs).toBe(0); // endMs is null, but lastPoint.timestampMs = startMs
    expect(summary.unstableMs).toBe(0);
  });

  it("stablePercent + unstablePercent + disconnectedPercent approximately equals 100", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 1000000, averageLatencyMs: 10, minimumLatencyMs: 8, maximumLatencyMs: 12, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1060000, averageLatencyMs: 10, minimumLatencyMs: 8, maximumLatencyMs: 12, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1120000, averageLatencyMs: 10, minimumLatencyMs: 8, maximumLatencyMs: 12, sampleCount: 10, failureCount: 0 },
    ];
    const summary = computeRangeSummary(points);
    const totalPercent =
      summary.stablePercent + summary.unstablePercent + summary.disconnectedPercent;
    // Should be close to 100%
    expect(totalPercent).toBeGreaterThan(99);
    expect(totalPercent).toBeLessThanOrEqual(100);
  });

  it("single point → 0 totalTimeMs → 0% for all categories", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 10,
        minimumLatencyMs: 8,
        maximumLatencyMs: 12,
        sampleCount: 10,
        failureCount: 0,
      },
    ];
    const summary = computeRangeSummary(points);
    expect(summary.stablePercent).toBe(0);
    expect(summary.unstablePercent).toBe(0);
    expect(summary.disconnectedPercent).toBe(0);
  });

  it("handles mixed null and non-null latencies across buckets", () => {
    const points: HistoryPoint[] = [
      {
        timestampMs: 1000000,
        averageLatencyMs: 14,
        minimumLatencyMs: 10,
        maximumLatencyMs: 20,
        sampleCount: 10,
        failureCount: 0,
      },
      {
        timestampMs: 1060000,
        averageLatencyMs: null,
        minimumLatencyMs: null,
        maximumLatencyMs: null,
        sampleCount: 5,
        failureCount: 5,
      },
      {
        timestampMs: 1120000,
        averageLatencyMs: 16,
        minimumLatencyMs: 12,
        maximumLatencyMs: 22,
        sampleCount: 10,
        failureCount: 0,
      },
    ];
    const summary = computeRangeSummary(points);
    expect(summary.sampleCount).toBe(25);
    expect(summary.failureCount).toBe(5);
    expect(summary.packetLossPercent).toBe(20);
    expect(summary.minimumLatencyMs).toBe(10);
    expect(summary.maximumLatencyMs).toBe(22);
    // Only 2 buckets have success latency → average of [14, 16] = 15
    expect(summary.averageLatencyMs).toBe(15);
  });
});

// ============================================================================
// buildTarget — edge cases
// ============================================================================

describe("buildTarget — edge cases", () => {
  it("handles IPv6 address in host", () => {
    const monitor: MonitorRow = {
      id: 1,
      client_id: 1,
      target_host: "2001:db8::1",
      target_name: "IPv6 Host",
      quality_state: "good",
      state_since_ms: null,
      last_seen_ms: null,
      last_status: null,
      last_latency_ms: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const target = buildTarget(monitor, null);
    expect(target.addressFamily).toBe("ipv6");
    expect(target.host).toBe("2001:db8::1");
  });

  it("handles localhost IPv6 ::1", () => {
    const monitor: MonitorRow = {
      id: 1,
      client_id: 1,
      target_host: "::1",
      target_name: null,
      quality_state: "good",
      state_since_ms: null,
      last_seen_ms: null,
      last_status: null,
      last_latency_ms: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const target = buildTarget(monitor, null);
    expect(target.addressFamily).toBe("ipv6");
    expect(target.name).toBe("::1"); // Falls back to target_host
  });

  it("handles hostname that looks like IPv6 but isn't", () => {
    const monitor: MonitorRow = {
      id: 1,
      client_id: 1,
      target_host: "example:8080",
      target_name: "Web Server",
      quality_state: "good",
      state_since_ms: null,
      last_seen_ms: null,
      last_status: null,
      last_latency_ms: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const target = buildTarget(monitor, null);
    // Contains ':' so detected as ipv6
    expect(target.addressFamily).toBe("ipv6");
  });

  it("creates deep copy of thresholds (not shared reference)", () => {
    const monitor: MonitorRow = {
      id: 1,
      client_id: 1,
      target_host: "8.8.8.8",
      target_name: "DNS",
      quality_state: "good",
      state_since_ms: null,
      last_seen_ms: null,
      last_status: null,
      last_latency_ms: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const t1 = buildTarget(monitor, null);
    const t2 = buildTarget(monitor, null);
    t1.thresholds.windowSeconds = 999;
    expect(t2.thresholds.windowSeconds).toBe(300); // Not modified
  });

  it("handles monitor with all null optional fields", () => {
    const monitor: MonitorRow = {
      id: 1,
      client_id: 1,
      target_host: "1.1.1.1",
      target_name: null,
      quality_state: "warmingUp",
      state_since_ms: null,
      last_seen_ms: null,
      last_status: null,
      last_latency_ms: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const target = buildTarget(monitor, null);
    expect(target.name).toBe("1.1.1.1");
    expect(target.enabled).toBe(true);
    expect(target.archivedAtMs).toBeNull();
  });
});

// ============================================================================
// computeQualityIntervals — custom bucket sizes
// ============================================================================

describe("computeQualityIntervals — custom bucket sizes", () => {
  it("uses custom bucket size for gap detection", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 1000000, averageLatencyMs: 10, minimumLatencyMs: 8, maximumLatencyMs: 12, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1000000 + 200000, averageLatencyMs: 15, minimumLatencyMs: 12, maximumLatencyMs: 20, sampleCount: 10, failureCount: 0 },
    ];
    // With 60s bucket: gap 200000 > 120000 → disconnected
    // With 120s bucket: gap 200000 > 240000 → not disconnected
    const intervals60s = computeQualityIntervals(points, 60000);
    const intervals120s = computeQualityIntervals(points, 120000);

    expect(intervals60s.some(i => i.state === "disconnected")).toBe(true);
    expect(intervals120s.some(i => i.state === "disconnected")).toBe(false);
  });

  it("5-minute bucket (300000ms) requires gap > 600000ms to disconnect", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 1000000, averageLatencyMs: 10, minimumLatencyMs: 8, maximumLatencyMs: 12, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1000000 + 500000, averageLatencyMs: 15, minimumLatencyMs: 12, maximumLatencyMs: 20, sampleCount: 10, failureCount: 0 },
    ];
    // Gap = 500000ms, threshold = 2 * 300000 = 600000ms → not disconnected
    const intervals = computeQualityIntervals(points, 300000);
    expect(intervals).toHaveLength(1);
  });
});
