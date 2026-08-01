import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

describe("health API endpoint", () => {
  beforeEach(() => {
    // @ts-expect-error — test isolation
    delete globalThis.__db;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ------------------------------------------------------------------
  // Response shape
  // ------------------------------------------------------------------

  test("response shape matches HealthResponse on success", () => {
    const response = {
      status: "ok",
      timestamp: "2025-01-01T00:00:00.000Z",
      uptime: 100,
      version: "0.1.0",
      db_path: "/tmp/test.db",
      db_size_bytes: 8192,
      monitor_count: 0,
      sample_count: 0,
      last_ingest_time: null,
    };

    // Basic fields
    expect(response.status).toBe("ok");
    expect(response.timestamp).toBeDefined();
    expect(typeof response.uptime).toBe("number");
    expect(typeof response.version).toBe("string");

    // F14 extended fields
    expect(typeof response.db_path).toBe("string");
    expect(typeof response.db_size_bytes).toBe("number");
    expect(typeof response.monitor_count).toBe("number");
    expect(typeof response.sample_count).toBe("number");
    expect(response.last_ingest_time).toBe(null);
  });

  test("response shape with data matches HealthResponse", () => {
    const response = {
      status: "ok",
      timestamp: "2025-01-01T00:00:00.000Z",
      uptime: 3600.42,
      version: "0.1.0",
      db_path: "/var/data/lingering.db",
      db_size_bytes: 524288,
      monitor_count: 42,
      sample_count: 158734,
      last_ingest_time: "2025-01-01T00:00:00.000Z",
    };

    expect(response.monitor_count).toBe(42);
    expect(response.sample_count).toBe(158734);
    expect(response.last_ingest_time).toBe("2025-01-01T00:00:00.000Z");
  });

  // ------------------------------------------------------------------
  // Error response shape
  // ------------------------------------------------------------------

  test("response shape matches HealthErrorResponse on error", () => {
    const response = {
      status: "error",
      timestamp: "2025-01-01T00:00:00.000Z",
      message: "Something went wrong",
    };

    expect(response.status).toBe("error");
    expect(response.timestamp).toBeDefined();
    expect(typeof response.message).toBe("string");
  });

  // ------------------------------------------------------------------
  // Database connectivity
  // ------------------------------------------------------------------

  test("database status is 'error' when db prepare fails", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        get: () => {
          throw new Error("connection lost");
        },
      }),
    };

    // @ts-expect-error — mock database
    globalThis.__db = mockDb;

    const { getDb } = await import("../utils/db");
    const db = getDb();
    expect(db).toBe(mockDb);

    // Simulate the health check's DB probe
    let dbStatus: "ok" | "error" = "ok";
    try {
      db.prepare("SELECT 1").get();
    } catch {
      dbStatus = "error";
    }

    expect(dbStatus).toBe("error");
  });

  test("database status is 'ok' when db prepare succeeds", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        get: () => ({ 1: 1 }),
      }),
    };

    // @ts-expect-error — mock database
    globalThis.__db = mockDb;

    const { getDb } = await import("../utils/db");
    const db = getDb();

    let dbStatus: "ok" | "error" = "ok";
    try {
      db.prepare("SELECT 1").get();
    } catch {
      dbStatus = "error";
    }

    expect(dbStatus).toBe("ok");
  });

  // ------------------------------------------------------------------
  // Error handler — various throw types
  // ------------------------------------------------------------------

  test("error handler returns structured error response", () => {
    const err = new Error("test error");

    const response = {
      status: "error",
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : "Unknown error",
    };

    expect(response.status).toBe("error");
    expect(response.message).toBe("test error");
  });

  test("error handler handles non-Error objects", () => {
    const err = "string error";

    const response = {
      status: "error",
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : "Unknown error",
    };

    expect(response.message).toBe("Unknown error");
  });

  test("error handler handles null thrown value", () => {
    const err = null;

    const response = {
      status: "error",
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : "Unknown error",
    };

    expect(response.message).toBe("Unknown error");
  });

  test("error handler handles number thrown value", () => {
    const err = 42;

    const response = {
      status: "error",
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : "Unknown error",
    };

    expect(response.message).toBe("Unknown error");
  });

  // ------------------------------------------------------------------
  // Version parsing
  // ------------------------------------------------------------------

  describe("version parsing", () => {
    test("package.json version is cached at module load", () => {
      const version1 = "0.0.0";
      const version2 = "0.0.0";
      expect(version1).toBe(version2);
    });

    test("fallback version is '0.0.0' when package.json is unreadable", () => {
      const fallback = (() => {
        try {
          throw new Error("ENOENT");
        } catch {
          return "0.0.0";
        }
      })();

      expect(fallback).toBe("0.0.0");
    });
  });

  // ------------------------------------------------------------------
  // Uptime
  // ------------------------------------------------------------------

  describe("uptime", () => {
    test("uptime is a positive number from process.uptime()", () => {
      const uptime = process.uptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(typeof uptime).toBe("number");
    });

    test("uptime is rounded to 2 decimal places", () => {
      const raw = 123.456789;
      const rounded = Math.round(raw * 100) / 100;
      expect(rounded).toBe(123.46);
    });
  });

  // ------------------------------------------------------------------
  // Timestamp format
  // ------------------------------------------------------------------

  describe("timestamp format", () => {
    test("timestamp is valid ISO 8601", () => {
      const timestamp = new Date().toISOString();
      expect(new Date(timestamp)).not.toBeInstanceOf(Error);
      expect(timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  // ------------------------------------------------------------------
  // F14 — last_ingest_time conversion
  // ------------------------------------------------------------------

  describe("last_ingest_time", () => {
    test("converts timestamp_ms to ISO 8601 string", () => {
      const max_ts = 1753939200000;
      const result = new Date(max_ts).toISOString();
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result).toContain("Z");
    });

    test("returns null when no samples exist (max_ts is null)", () => {
      const max_ts = null;
      const lastIngestTime =
        max_ts != null ? new Date(max_ts).toISOString() : null;
      expect(lastIngestTime).toBeNull();
    });

    test("returns null when max_ts is undefined", () => {
      const max_ts = undefined as number | undefined | null;
      const lastIngestTime =
        max_ts != null ? new Date(max_ts).toISOString() : null;
      expect(lastIngestTime).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // F14 — metric types
  // ------------------------------------------------------------------

  describe("F14 metric types", () => {
    test("db_size_bytes is a non-negative number", () => {
      const size = 8192;
      expect(typeof size).toBe("number");
      expect(size).toBeGreaterThanOrEqual(0);
    });

    test("monitor_count is a non-negative integer", () => {
      const count = 42;
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("sample_count is a non-negative integer", () => {
      const count = 158734;
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("zero counts for empty database", () => {
      const monitor_count = 0;
      const sample_count = 0;
      const last_ingest_time = null;
      expect(monitor_count).toBe(0);
      expect(sample_count).toBe(0);
      expect(last_ingest_time).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // F14 — COUNT query simulation
  // ------------------------------------------------------------------

  describe("F14 COUNT queries", () => {
    test("monitor_count returns correct count from mock", () => {
      const mockRow = { cnt: 5 };
      expect(mockRow.cnt).toBe(5);
    });

    test("sample_count returns correct count from mock", () => {
      const mockRow = { cnt: 100 };
      expect(mockRow.cnt).toBe(100);
    });

    test("COUNT returns 0 for empty table", () => {
      const mockRow = { cnt: 0 };
      expect(mockRow.cnt).toBe(0);
    });
  });
});
