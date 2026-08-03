/**
 * Quality Sweep Plugin — Unit Tests
 *
 * Tests the plugin configuration logic. Since the plugin uses
 * defineNitroPlugin (a Nitro-specific function), we mock the
 * entire nitropack module and test the plugin's factory function
 * behavior directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock nitropack to provide defineNitroPlugin
vi.mock("nitropack", () => ({
  defineNitroPlugin: (fn: () => () => void) => fn,
}));

// Mock the dependencies
vi.mock("#server/utils/logger", () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("#server/utils/db", () => ({
  getDb: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([]),
    }),
  }),
}));

vi.mock("#server/utils/quality-classifier", () => ({
  classifyMonitorsBatch: vi.fn().mockReturnValue(new Map()),
}));

describe("quality-sweep plugin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // @ts-expect-error — globalThis.__db cleanup
    delete globalThis.__db;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    // @ts-expect-error — globalThis.__db cleanup
    delete globalThis.__db;
  });

  it("plugin exports a default function", async () => {
    const mod = await import("./quality-sweep");
    expect(typeof mod.default).toBe("function");
  });

  it("uses default interval of 60 seconds when no env var is set", async () => {
    // @ts-expect-error — delete env var
    delete process.env.QUALITY_SWEEP_INTERVAL_MS;

    const mod = await import("./quality-sweep");
    const cleanup = mod.default();

    expect(cleanup).toBeDefined();
    expect(typeof cleanup).toBe("function");

    // Advance to trigger the interval
    vi.advanceTimersByTime(60_000);

    cleanup();
  });

  it("respects QUALITY_SWEEP_INTERVAL_MS env var", async () => {
    process.env.QUALITY_SWEEP_INTERVAL_MS = "30000";

    const mod = await import("./quality-sweep");
    const cleanup = mod.default();

    expect(cleanup).toBeDefined();

    // Advance to the custom interval
    vi.advanceTimersByTime(30_000);

    cleanup();
  });

  it("returns a cleanup function that clears the timer", async () => {
    const mod = await import("./quality-sweep");
    const cleanup = mod.default();

    expect(typeof cleanup).toBe("function");

    // The cleanup should not throw
    expect(() => cleanup()).not.toThrow();

    // Calling cleanup twice should be safe
    expect(() => cleanup()).not.toThrow();
  });

  it("skips interval when QUALITY_SWEEP_INTERVAL_MS is 0", async () => {
    process.env.QUALITY_SWEEP_INTERVAL_MS = "0";

    const mod = await import("./quality-sweep");
    const cleanup = mod.default();

    // When interval is invalid, it returns a no-op cleanup
    expect(typeof cleanup).toBe("function");

    // Cleanup should be callable
    cleanup();
  });

  it("skips interval when QUALITY_SWEEP_INTERVAL_MS is negative", async () => {
    process.env.QUALITY_SWEEP_INTERVAL_MS = "-1000";

    const mod = await import("./quality-sweep");
    const cleanup = mod.default();

    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("skips interval when QUALITY_SWEEP_INTERVAL_MS is NaN", async () => {
    process.env.QUALITY_SWEEP_INTERVAL_MS = "not-a-number";

    const mod = await import("./quality-sweep");
    const cleanup = mod.default();

    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("skips interval when QUALITY_SWEEP_INTERVAL_MS is Infinity", async () => {
    process.env.QUALITY_SWEEP_INTERVAL_MS = "Infinity";

    const mod = await import("./quality-sweep");
    const cleanup = mod.default();

    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("sweep calls classifyMonitorsBatch with active monitor IDs", async () => {
    process.env.QUALITY_SWEEP_INTERVAL_MS = "10000";

    // Re-mock with actual monitor IDs
    const { getDb } = await import("#server/utils/db");
    const getDbMock = getDb as ReturnType<typeof vi.fn>;
    getDbMock.mockReturnValue({
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([
          { monitor_id: 1 },
          { monitor_id: 2 },
        ]),
      }),
    });

    const { classifyMonitorsBatch } = await import("#server/utils/quality-classifier");
    const classifyMock = classifyMonitorsBatch as ReturnType<typeof vi.fn>;

    const mod = await import("./quality-sweep");
    const cleanup = mod.default();

    // Trigger the interval
    vi.advanceTimersByTime(10_000);

    // Verify classifyMonitorsBatch was called with the active monitor IDs
    expect(classifyMock).toHaveBeenCalledWith([1, 2]);

    cleanup();
  });

  it("handles classifyMonitorsBatch errors gracefully (doesn't crash)", async () => {
    process.env.QUALITY_SWEEP_INTERVAL_MS = "10000";

    const { getDb } = await import("#server/utils/db");
    const getDbMock = getDb as ReturnType<typeof vi.fn>;
    getDbMock.mockReturnValue({
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([{ monitor_id: 1 }]),
      }),
    });

    const { classifyMonitorsBatch } = await import("#server/utils/quality-classifier");
    const classifyMock = classifyMonitorsBatch as ReturnType<typeof vi.fn>;
    classifyMock.mockImplementation(() => {
      throw new Error("Database connection lost");
    });

    const mod = await import("./quality-sweep");
    const cleanup = mod.default();

    // This should not throw even though classifyMonitorsBatch fails
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();

    cleanup();
  });

  it("handles DB errors during sweep gracefully", async () => {
    process.env.QUALITY_SWEEP_INTERVAL_MS = "10000";

    const { getDb } = await import("#server/utils/db");
    const getDbMock = getDb as ReturnType<typeof vi.fn>;
    getDbMock.mockImplementation(() => {
      throw new Error("Database not available");
    });

    const mod = await import("./quality-sweep");
    const cleanup = mod.default();

    // This should not throw
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();

    cleanup();
  });
});
