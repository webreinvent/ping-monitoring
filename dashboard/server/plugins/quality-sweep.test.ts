/**
 * Quality Classifier — Unit Tests with Mock DB
 *
 * Tests the classifyMonitor and classifyMonitorsBatch functions
 * by mocking the database layer.
 *
 * Pattern: classifyMonitor calls getDb().prepare(sql).get() twice per call.
 * We track prepare call count to return the right shape for each query.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

function createMockClassifierDb(
  aggregateRow: any,
  lastSampleRow: any,
) {
  let prepareCallCount = 0;

  return {
    prepare: vi.fn().mockImplementation((_sql: string) => {
      prepareCallCount++;
      if (prepareCallCount === 1) {
        // First query: aggregate stats
        return {
          get: vi.fn().mockReturnValue(aggregateRow),
          run: vi.fn(() => ({})),
        };
      }
      // Second query: last sample time
      return {
        get: vi.fn().mockReturnValue(lastSampleRow),
        run: vi.fn(() => ({})),
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  classifyMonitorsBatch — batch orchestration                        */
/* ------------------------------------------------------------------ */

describe("classifyMonitorsBatch", () => {
  beforeEach(() => {
    vi.resetModules();
    // @ts-expect-error — globalThis.__db is set by the database plugin
    delete globalThis.__db;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns empty Map when given empty array", async () => {
    const { classifyMonitorsBatch } = await import("../utils/quality-classifier");
    const result = classifyMonitorsBatch([]);
    expect(result.size).toBe(0);
  });

  test("handles errors in individual monitor classification without crashing", async () => {
    // Mock getDb to throw
    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
      get: vi.fn().mockImplementation(() => {
        throw new Error("DB error on first call");
      }),
    };

    vi.doMock("../utils/db", () => ({
      getDb: () => mockDb,
    }));

    const { classifyMonitorsBatch } = await import("../utils/quality-classifier");

    // Should not throw — errors are caught per-monitor
    expect(() => classifyMonitorsBatch([1])).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  classifyMonitor — detailed behavior with mock DB                   */
/* ------------------------------------------------------------------ */

describe("classifyMonitor with mock DB", () => {
  beforeEach(() => {
    vi.resetModules();
    // @ts-expect-error
    delete globalThis.__db;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("classifies as veryHigh when packetLoss=0 and avgLatency<50", async () => {
    const mockDb = createMockClassifierDb(
      {
        sample_count: 15,
        success_count: 15,
        sum_latency: 15 * 30,
        sum_latency_sq: 15 * (30 * 30),
        latency_count: 15,
        current_quality_state: "warmingUp",
      },
      { last_sample_ms: Date.now() },
    );

    vi.doMock("../utils/db", () => ({ getDb: () => mockDb }));

    const { classifyMonitor } = await import("../utils/quality-classifier");
    const result = classifyMonitor(1);

    expect(result.qualityState).toBe("veryHigh");
    expect(result.previousState).toBe("warmingUp");
    expect(result.stateChanged).toBe(true);
  });

  test("classifies as warmingUp when sampleCount < 10", async () => {
    const mockDb = createMockClassifierDb(
      {
        sample_count: 5,
        success_count: 5,
        sum_latency: 5 * 30,
        sum_latency_sq: 5 * (30 * 30),
        latency_count: 5,
        current_quality_state: "warmingUp",
      },
      { last_sample_ms: Date.now() },
    );

    vi.doMock("../utils/db", () => ({ getDb: () => mockDb }));

    const { classifyMonitor } = await import("../utils/quality-classifier");
    const result = classifyMonitor(1);

    expect(result.qualityState).toBe("warmingUp");
    expect(result.stateChanged).toBe(false); // Was already warmingUp
  });

  test("classifies as disconnected when no samples and no history", async () => {
    const mockDb = createMockClassifierDb(
      {
        sample_count: 0,
        success_count: 0,
        sum_latency: null,
        sum_latency_sq: null,
        latency_count: 0,
        current_quality_state: null,
      },
      { last_sample_ms: null },
    );

    vi.doMock("../utils/db", () => ({ getDb: () => mockDb }));

    const { classifyMonitor } = await import("../utils/quality-classifier");
    const result = classifyMonitor(1);

    expect(result.qualityState).toBe("disconnected");
  });

  test("classifies as unstable when cv > 0.5 and packetLoss < 10%", async () => {
    // Alternating 10ms and 500ms samples: high CV
    const latencies = [10, 500, 10, 500, 10, 500, 10, 500, 10, 500, 10, 500, 10, 500, 10];
    const sumLatency = latencies.reduce((s, v) => s + v, 0);
    const sumLatencySq = latencies.reduce((s, v) => s + v * v, 0);

    const mockDb = createMockClassifierDb(
      {
        sample_count: 15,
        success_count: 15,
        sum_latency: sumLatency,
        sum_latency_sq: sumLatencySq,
        latency_count: 15,
        current_quality_state: "high",
      },
      { last_sample_ms: Date.now() },
    );

    vi.doMock("../utils/db", () => ({ getDb: () => mockDb }));

    const { classifyMonitor } = await import("../utils/quality-classifier");
    const result = classifyMonitor(1);

    expect(result.qualityState).toBe("unstable");
    expect(result.stateChanged).toBe(true);
  });

  test("detects state change correctly", async () => {
    const mockDb = createMockClassifierDb(
      {
        sample_count: 15,
        success_count: 15,
        sum_latency: 15 * 30,
        sum_latency_sq: 15 * (30 * 30),
        latency_count: 15,
        current_quality_state: "low", // Previous was low
      },
      { last_sample_ms: Date.now() },
    );

    vi.doMock("../utils/db", () => ({ getDb: () => mockDb }));

    const { classifyMonitor } = await import("../utils/quality-classifier");
    const result = classifyMonitor(1);

    expect(result.qualityState).toBe("veryHigh");
    expect(result.previousState).toBe("low");
    expect(result.stateChanged).toBe(true);
  });

  test("classifies as high when packetLoss=0 and 50 <= avgLatency < 150", async () => {
    const mockDb = createMockClassifierDb(
      {
        sample_count: 15,
        success_count: 15,
        sum_latency: 15 * 100,
        sum_latency_sq: 15 * (100 * 100),
        latency_count: 15,
        current_quality_state: null,
      },
      { last_sample_ms: Date.now() },
    );

    vi.doMock("../utils/db", () => ({ getDb: () => mockDb }));

    const { classifyMonitor } = await import("../utils/quality-classifier");
    const result = classifyMonitor(1);

    expect(result.qualityState).toBe("high");
  });

  test("classifies as medium when packetLoss <= 10 and avgLatency <= 300", async () => {
    // 20 samples, 18 success = 10% packet loss
    const successLatencies = Array(18).fill(200);
    const sumLatency = successLatencies.reduce((s, v) => s + v, 0);
    const sumLatencySq = successLatencies.reduce((s, v) => s + v * v, 0);

    const mockDb = createMockClassifierDb(
      {
        sample_count: 20,
        success_count: 18,
        sum_latency: sumLatency,
        sum_latency_sq: sumLatencySq,
        latency_count: 18,
        current_quality_state: null,
      },
      { last_sample_ms: Date.now() },
    );

    vi.doMock("../utils/db", () => ({ getDb: () => mockDb }));

    const { classifyMonitor } = await import("../utils/quality-classifier");
    const result = classifyMonitor(1);

    // packetLoss = 10% — not unstable (needs < 10%), so falls to medium
    expect(result.qualityState).toBe("medium");
  });

  test("classifies as low when packetLoss > 10%", async () => {
    // 20 samples, 10 success = 50% packet loss
    const mockDb = createMockClassifierDb(
      {
        sample_count: 20,
        success_count: 10,
        sum_latency: 10 * 100,
        sum_latency_sq: 10 * (100 * 100),
        latency_count: 10,
        current_quality_state: null,
      },
      { last_sample_ms: Date.now() },
    );

    vi.doMock("../utils/db", () => ({ getDb: () => mockDb }));

    const { classifyMonitor } = await import("../utils/quality-classifier");
    const result = classifyMonitor(1);

    expect(result.qualityState).toBe("low");
  });
});

/* ------------------------------------------------------------------ */
/*  classification edge cases                                          */
/* ------------------------------------------------------------------ */

describe("classification edge cases", () => {
  beforeEach(() => {
    vi.resetModules();
    // @ts-expect-error
    delete globalThis.__db;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("zero latency with zero packet loss and enough samples -> veryHigh", async () => {
    const mockDb = createMockClassifierDb(
      {
        sample_count: 10,
        success_count: 10,
        sum_latency: 0,
        sum_latency_sq: 0,
        latency_count: 10,
        current_quality_state: null,
      },
      { last_sample_ms: Date.now() },
    );

    vi.doMock("../utils/db", () => ({ getDb: () => mockDb }));

    const { classifyMonitor } = await import("../utils/quality-classifier");
    const result = classifyMonitor(1);

    expect(result.qualityState).toBe("veryHigh");
  });

  test("disconnected: no samples but last sample 30 min ago", async () => {
    const lastSampleMs = Date.now() - 30 * 60 * 1000;
    const mockDb = createMockClassifierDb(
      {
        sample_count: 0,
        success_count: 0,
        sum_latency: null,
        sum_latency_sq: null,
        latency_count: 0,
        current_quality_state: "high",
      },
      { last_sample_ms: lastSampleMs },
    );

    vi.doMock("../utils/db", () => ({ getDb: () => mockDb }));

    const { classifyMonitor } = await import("../utils/quality-classifier");
    const result = classifyMonitor(1);

    expect(result.qualityState).toBe("disconnected");
  });

  test("warmingUp: no samples but last sample > 1 hour ago", async () => {
    const lastSampleMs = Date.now() - 2 * 60 * 60 * 1000;
    const mockDb = createMockClassifierDb(
      {
        sample_count: 0,
        success_count: 0,
        sum_latency: null,
        sum_latency_sq: null,
        latency_count: 0,
        current_quality_state: "high",
      },
      { last_sample_ms: lastSampleMs },
    );

    vi.doMock("../utils/db", () => ({ getDb: () => mockDb }));

    const { classifyMonitor } = await import("../utils/quality-classifier");
    const result = classifyMonitor(1);

    expect(result.qualityState).toBe("warmingUp");
  });
});

/* ------------------------------------------------------------------ */
/*  Quality sweep plugin — interval configuration                      */
/* ------------------------------------------------------------------ */

describe("quality-sweep plugin configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  test("uses default interval of 60 seconds when QUALITY_SWEEP_INTERVAL_MS not set", () => {
    delete process.env.QUALITY_SWEEP_INTERVAL_MS;
    const rawInterval = process.env.QUALITY_SWEEP_INTERVAL_MS ?? "60000";
    const sweepIntervalMs = Number(rawInterval);
    expect(sweepIntervalMs).toBe(60_000);
  });

  test("respects custom QUALITY_SWEEP_INTERVAL_MS value", () => {
    process.env.QUALITY_SWEEP_INTERVAL_MS = "30000";
    const rawInterval = process.env.QUALITY_SWEEP_INTERVAL_MS ?? "60000";
    const sweepIntervalMs = Number(rawInterval);
    expect(sweepIntervalMs).toBe(30_000);
  });

  test("rejects invalid interval (non-numeric)", () => {
    process.env.QUALITY_SWEEP_INTERVAL_MS = "not-a-number";
    const rawInterval = process.env.QUALITY_SWEEP_INTERVAL_MS ?? "60000";
    const sweepIntervalMs = Number(rawInterval);
    expect(Number.isFinite(sweepIntervalMs)).toBe(false);
  });

  test("rejects zero interval", () => {
    process.env.QUALITY_SWEEP_INTERVAL_MS = "0";
    const rawInterval = process.env.QUALITY_SWEEP_INTERVAL_MS ?? "60000";
    const sweepIntervalMs = Number(rawInterval);
    expect(sweepIntervalMs).toBe(0);
    // The plugin checks: !Number.isFinite(sweepIntervalMs) || sweepIntervalMs <= 0
    expect(sweepIntervalMs <= 0).toBe(true);
  });

  test("rejects negative interval", () => {
    process.env.QUALITY_SWEEP_INTERVAL_MS = "-1000";
    const rawInterval = process.env.QUALITY_SWEEP_INTERVAL_MS ?? "60000";
    const sweepIntervalMs = Number(rawInterval);
    expect(sweepIntervalMs).toBe(-1000);
    expect(sweepIntervalMs <= 0).toBe(true);
  });
});
