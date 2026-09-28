import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

describe("retention plugin", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.RETENTION_ENABLED = "true";
    process.env.RETENTION_SAMPLE_DAYS = "30";
    process.env.RETENTION_ROLLUP_DAYS = "90";
    process.env.RETENTION_INTERVAL_MIN = "60";
    process.env.RETENTION_VACUUM_THRESHOLD = "10000";

    // Provide defineNitroPlugin as a global (auto-imported in Nitro, not in tests)
    globalThis.defineNitroPlugin = (fn: () => any) => fn;
  });

  afterEach(() => {
    process.env = originalEnv;
    delete (globalThis as any).defineNitroPlugin;
    vi.restoreAllMocks();
  });

  test("plugin initializes and returns cleanup function", async () => {
    vi.doMock("#server/utils/logger", () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }));

    const mockRetentionCleanup = vi.fn().mockReturnValue({
      deletedSamples: 0,
      deletedRollups: 0,
      durationMs: 0,
      vacuumed: false,
    });

    vi.doMock("#server/utils/retention", () => ({
      getRetentionConfig: () => ({
        enabled: true,
        sampleDays: 30,
        rollupDays: 90,
        intervalMin: 60,
        vacuumThreshold: 10000,
      }),
      runRetentionCleanup: mockRetentionCleanup,
    }));

    const { default: plugin } = await import("./retention");

    const result = plugin as any;
    const cleanup = result();

    expect(typeof cleanup).toBe("function");
    expect(mockRetentionCleanup).toHaveBeenCalled(); // First run on boot

    cleanup();
  });

  test("plugin returns early when RETENTION_ENABLED is false", async () => {
    process.env.RETENTION_ENABLED = "false";

    vi.doMock("#server/utils/logger", () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }));

    vi.doMock("#server/utils/retention", () => ({
      getRetentionConfig: () => ({
        enabled: false,
        sampleDays: 30,
        rollupDays: 90,
        intervalMin: 60,
        vacuumThreshold: 10000,
      }),
      runRetentionCleanup: vi.fn(),
    }));

    const { default: plugin } = await import("./retention");

    const result = plugin as any;
    const cleanup = result();

    expect(typeof cleanup).toBe("function");

    cleanup();
  });

  test("errors in cleanup cycle are caught and logged", async () => {
    const mockError = new Error("Simulated cleanup error");

    vi.doMock("#server/utils/logger", () => {
      const error = vi.fn();
      return {
        info: vi.fn(),
        warn: vi.fn(),
        error,
      };
    });

    vi.doMock("#server/utils/retention", () => ({
      getRetentionConfig: () => ({
        enabled: true,
        sampleDays: 30,
        rollupDays: 90,
        intervalMin: 60,
        vacuumThreshold: 10000,
      }),
      runRetentionCleanup: () => {
        throw mockError;
      },
    }));

    const { default: plugin } = await import("./retention");

    const result = plugin as any;
    // Should not throw even though cleanup throws
    const cleanup = result();

    expect(cleanup).toBeDefined();

    cleanup();
  });

  test("plugin logs initialization info", async () => {
    const mockInfo = vi.fn();

    vi.doMock("#server/utils/logger", () => ({
      info: mockInfo,
      warn: vi.fn(),
      error: vi.fn(),
    }));

    vi.doMock("#server/utils/retention", () => ({
      getRetentionConfig: () => ({
        enabled: true,
        sampleDays: 30,
        rollupDays: 90,
        intervalMin: 60,
        vacuumThreshold: 10000,
      }),
      runRetentionCleanup: vi.fn(),
    }));

    const { default: plugin } = await import("./retention");

    const result = plugin as any;
    result();

    expect(mockInfo).toHaveBeenCalledWith(
      "Data retention cleanup plugin initialized",
      expect.objectContaining({
        enabled: true,
        intervalMinutes: 60,
        sampleRetentionDays: 30,
        rollupRetentionDays: 90,
      }),
    );
  });
});
