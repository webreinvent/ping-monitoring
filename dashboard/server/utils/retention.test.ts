import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

describe("getRetentionConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Delete retention-specific env vars to start clean
    delete process.env.RETENTION_ENABLED;
    delete process.env.RETENTION_SAMPLE_DAYS;
    delete process.env.RETENTION_ROLLUP_DAYS;
    delete process.env.RETENTION_INTERVAL_MIN;
    delete process.env.RETENTION_VACUUM_THRESHOLD;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  test("returns defaults when no env vars are set", async () => {
    const { getRetentionConfig } = await import("./retention");
    const config = getRetentionConfig();

    expect(config.enabled).toBe(true);
    expect(config.sampleDays).toBe(30);
    expect(config.rollupDays).toBe(90);
    expect(config.intervalMin).toBe(60);
    expect(config.vacuumThreshold).toBe(10000);
  });

  test("respects custom env var values", async () => {
    process.env.RETENTION_ENABLED = "true";
    process.env.RETENTION_SAMPLE_DAYS = "7";
    process.env.RETENTION_ROLLUP_DAYS = "14";
    process.env.RETENTION_INTERVAL_MIN = "15";
    process.env.RETENTION_VACUUM_THRESHOLD = "500";

    const { getRetentionConfig } = await import("./retention");
    const config = getRetentionConfig();

    expect(config.enabled).toBe(true);
    expect(config.sampleDays).toBe(7);
    expect(config.rollupDays).toBe(14);
    expect(config.intervalMin).toBe(15);
    expect(config.vacuumThreshold).toBe(500);
  });

  test("returns enabled=false when RETENTION_ENABLED is false", async () => {
    process.env.RETENTION_ENABLED = "false";

    const { getRetentionConfig } = await import("./retention");
    const config = getRetentionConfig();

    expect(config.enabled).toBe(false);
  });

  test("returns enabled=false when RETENTION_ENABLED is FALSE (uppercase)", async () => {
    process.env.RETENTION_ENABLED = "FALSE";

    const { getRetentionConfig } = await import("./retention");
    const config = getRetentionConfig();

    expect(config.enabled).toBe(false);
  });

  test("falls back to defaults for invalid sample days", async () => {
    process.env.RETENTION_SAMPLE_DAYS = "invalid";

    const { getRetentionConfig } = await import("./retention");
    const config = getRetentionConfig();

    expect(config.sampleDays).toBe(30);
  });

  test("falls back to defaults for zero sample days", async () => {
    process.env.RETENTION_SAMPLE_DAYS = "0";

    const { getRetentionConfig } = await import("./retention");
    const config = getRetentionConfig();

    expect(config.sampleDays).toBe(30);
  });

  test("falls back to defaults for negative sample days", async () => {
    process.env.RETENTION_SAMPLE_DAYS = "-5";

    const { getRetentionConfig } = await import("./retention");
    const config = getRetentionConfig();

    expect(config.sampleDays).toBe(30);
  });
});

describe("runRetentionCleanup with mocked database", () => {
  const originalEnv = process.env;

  function createMockDb(options: {
    sampleChanges?: number;
    rollupChanges?: number;
  } = {}): any {
    const sampleDelete = { run: vi.fn(() => ({ changes: options.sampleChanges ?? 0 })) };
    const rollupDelete = { run: vi.fn(() => ({ changes: options.rollupChanges ?? 0 })) };

    const prepareSpy = vi.fn((sql: string) => {
      if (sql.includes("ping_samples")) return sampleDelete;
      if (sql.includes("minute_rollups")) return rollupDelete;
      return { run: () => ({ changes: 0 }) };
    });

    const transactionSpy = vi.fn((fn: () => any) => () => fn());
    const execSpy = vi.fn();

    return {
      db: {
        prepare: prepareSpy,
        transaction: transactionSpy,
        exec: execSpy,
      },
      prepareSpy,
      transactionSpy,
      execSpy,
    };
  }

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.RETENTION_ENABLED;
    delete process.env.RETENTION_SAMPLE_DAYS;
    delete process.env.RETENTION_ROLLUP_DAYS;
    delete process.env.RETENTION_INTERVAL_MIN;
    delete process.env.RETENTION_VACUUM_THRESHOLD;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  test("skips deletion when RETENTION_ENABLED is false", async () => {
    process.env.RETENTION_ENABLED = "false";
    const { db } = createMockDb();

    vi.doMock("./db", () => ({
      getDb: () => db,
    }));

    const { runRetentionCleanup } = await import("./retention");
    const result = runRetentionCleanup();

    expect(result.deletedSamples).toBe(0);
    expect(result.deletedRollups).toBe(0);
    expect(result.durationMs).toBe(0);
  });

  test("deletes old data and returns correct counts", async () => {
    const { db } = createMockDb({ sampleChanges: 5, rollupChanges: 3 });

    vi.doMock("./db", () => ({
      getDb: () => db,
    }));

    const { runRetentionCleanup } = await import("./retention");
    const result = runRetentionCleanup();

    expect(result.deletedSamples).toBe(5);
    expect(result.deletedRollups).toBe(3);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("returns zero when no data is deleted", async () => {
    const { db } = createMockDb({ sampleChanges: 0, rollupChanges: 0 });

    vi.doMock("./db", () => ({
      getDb: () => db,
    }));

    const { runRetentionCleanup } = await import("./retention");
    const result = runRetentionCleanup();

    expect(result.deletedSamples).toBe(0);
    expect(result.deletedRollups).toBe(0);
  });

  test("triggers VACUUM when total deleted exceeds threshold", async () => {
    process.env.RETENTION_VACUUM_THRESHOLD = "5";
    const { db } = createMockDb({ sampleChanges: 10, rollupChanges: 0 });

    vi.doMock("./db", () => ({
      getDb: () => db,
    }));

    const { runRetentionCleanup } = await import("./retention");
    const result = runRetentionCleanup();

    expect(result.vacuumed).toBe(true);
  });

  test("does not trigger VACUUM when total deleted is below threshold", async () => {
    const { db } = createMockDb({ sampleChanges: 2, rollupChanges: 1 });

    vi.doMock("./db", () => ({
      getDb: () => db,
    }));

    const { runRetentionCleanup } = await import("./retention");
    const result = runRetentionCleanup();

    expect(result.vacuumed).toBe(false);
  });
});
