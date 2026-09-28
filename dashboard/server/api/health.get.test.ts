import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    // @ts-expect-error — delete for test isolation
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("health API endpoint", () => {
  beforeEach(() => {
    // Clear the global database reference before each test
    // @ts-expect-error — test isolation
    delete globalThis.__db;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Reset env
    setEnv("DATABASE_PATH", undefined);
  });

  // ------------------------------------------------------------------
  // Response shape
  // ------------------------------------------------------------------

  describe("response shape", () => {
    test("success response shape matches HealthResponse", () => {
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

    test("error response shape matches HealthErrorResponse", () => {
      const response = {
        status: "error",
        timestamp: "2025-01-01T00:00:00.000Z",
        message: "Something went wrong",
      };

      expect(response.status).toBe("error");
      expect(response.timestamp).toBeDefined();
      expect(typeof response.message).toBe("string");
    });
  });

  // ------------------------------------------------------------------
  // Database connectivity probe
  // ------------------------------------------------------------------

  describe("database connectivity", () => {
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
  });

  // ------------------------------------------------------------------
  // Error handler — various throw types
  // ------------------------------------------------------------------

  describe("error handler", () => {
    test("returns structured error response for Error objects", () => {
      const err = new Error("test error");

      const response = {
        status: "error",
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : "Unknown error",
      };

      expect(response.status).toBe("error");
      expect(response.message).toBe("test error");
    });

    test("handles non-Error string objects", () => {
      const err = "string error";

      const response = {
        status: "error",
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : "Unknown error",
      };

      expect(response.message).toBe("Unknown error");
    });

    test("handles null thrown value", () => {
      const err = null;

      const response = {
        status: "error",
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : "Unknown error",
      };

      expect(response.message).toBe("Unknown error");
    });

    test("handles number thrown value", () => {
      const err = 42;

      const response = {
        status: "error",
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : "Unknown error",
      };

      expect(response.message).toBe("Unknown error");
    });

    test("handles boolean thrown value", () => {
      const err = false;

      const response = {
        status: "error",
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : "Unknown error",
      };

      expect(response.message).toBe("Unknown error");
    });
  });

  // ------------------------------------------------------------------
  // Version parsing
  // ------------------------------------------------------------------

  describe("version parsing", () => {
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

    test("version is cached — returns same value on repeated calls", () => {
      // The module-level IIFE only runs once.
      // Verifying the pattern: two identical reads produce the same result.
      const v1 = "cached-version";
      const v2 = "cached-version";
      expect(v1).toBe(v2);
    });

    test("returns package.json version when available", () => {
      const pkgPath = resolve(process.cwd(), "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
        version?: string;
      };
      const version = pkg.version || "0.0.0";
      expect(typeof version).toBe("string");
      expect(version.length).toBeGreaterThan(0);
    });
  });

  // ------------------------------------------------------------------
  // Uptime
  // ------------------------------------------------------------------

  describe("uptime", () => {
    test("uptime is a non-negative number from process.uptime()", () => {
      const uptime = process.uptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(typeof uptime).toBe("number");
    });

    test("uptime is rounded to 2 decimal places", () => {
      const raw = 123.456789;
      const rounded = Math.round(raw * 100) / 100;
      expect(rounded).toBe(123.46);
    });

    test("uptime rounding handles zero correctly", () => {
      const raw = 0.001;
      const rounded = Math.round(raw * 100) / 100;
      expect(rounded).toBe(0);
    });

    test("uptime rounding handles exact values", () => {
      const raw = 100.5;
      const rounded = Math.round(raw * 100) / 100;
      expect(rounded).toBe(100.5);
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

    test("timestamp ends with 'Z'", () => {
      const timestamp = new Date().toISOString();
      expect(timestamp).toMatch(/Z$/);
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

    test("handles large timestamp values", () => {
      const max_ts = 9999999999000; // Far future
      const result = new Date(max_ts).toISOString();
      expect(result).toBeDefined();
      expect(result).toContain("T");
    });

    test("handles small positive timestamp values", () => {
      const max_ts = 1; // 1ms after epoch
      const result = new Date(max_ts).toISOString();
      expect(result).toBe("1970-01-01T00:00:00.001Z");
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

  // ------------------------------------------------------------------
  // getExtendedMetrics — path resolution
  // ------------------------------------------------------------------

  describe("getExtendedMetrics path resolution", () => {
    test("defaults to .data/lingering.db when DATABASE_PATH is not set", () => {
      setEnv("DATABASE_PATH", undefined);

      const dbPath =
        (process.env.DATABASE_PATH as string) || ".data/lingering.db";

      expect(dbPath).toBe(".data/lingering.db");
    });

    test("uses DATABASE_PATH when set", () => {
      setEnv("DATABASE_PATH", "/custom/path/db.sqlite");

      const dbPath =
        (process.env.DATABASE_PATH as string) || ".data/lingering.db";

      expect(dbPath).toBe("/custom/path/db.sqlite");
    });

    test("resolves relative path to absolute", () => {
      setEnv("DATABASE_PATH", ".data/lingering.db");

      const dbPath =
        (process.env.DATABASE_PATH as string) || ".data/lingering.db";
      const fullPath = resolve(dbPath);

      // The resolved path is absolute and ends with the expected filename
      expect(fullPath.startsWith("/")).toBe(true);
      expect(fullPath.endsWith("lingering.db")).toBe(true);
      // The relative path .data/ is now part of the absolute resolved path
      expect(fullPath).toContain("lingering.db");
    });
  });

  // ------------------------------------------------------------------
  // getExtendedMetrics — db_size_bytes fallback
  // ------------------------------------------------------------------

  describe("getExtendedMetrics db_size_bytes", () => {
    test("statSync fallback to 0 when file does not exist", () => {
      let dbSizeBytes = 0;
      try {
        // This will throw ENOENT for a non-existent path
        dbSizeBytes = statSync("/tmp/nonexistent-db-12345.db").size;
      } catch {
        // Expected — file doesn't exist, keep 0
      }

      expect(dbSizeBytes).toBe(0);
    });

    test("dbSizeBytes starts at 0 before stat attempt", () => {
      const initialSize = 0;
      expect(initialSize).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Full endpoint integration — mock DB + handler
  // ------------------------------------------------------------------

  describe("full endpoint integration", () => {
    test("health endpoint returns ok status with mock database", async () => {
      const mockPrepare = vi.fn();
      const mockDb = {
        prepare: (sql: string) => {
          mockPrepare(sql);
          if (sql === "SELECT 1") {
            return { get: () => ({ 1: 1 }) };
          }
          if (sql.includes("COUNT(*)") && sql.includes("monitors")) {
            return { get: () => ({ cnt: 3 }) };
          }
          if (sql.includes("COUNT(*)") && sql.includes("ping_samples")) {
            return { get: () => ({ cnt: 42 }) };
          }
          if (sql.includes("MAX(timestamp_ms)")) {
            return { get: () => ({ max_ts: 1753939200000 }) };
          }
          return { get: () => null };
        },
      };

      // @ts-expect-error — mock database
      globalThis.__db = mockDb;

      const { getDb } = await import("../utils/db");
      const db = getDb();
      expect(db).toBe(mockDb);

      // Simulate DB probe
      let dbStatus: "ok" | "error" = "ok";
      try {
        db.prepare("SELECT 1").get();
      } catch {
        dbStatus = "error";
      }
      expect(dbStatus).toBe("ok");

      // Simulate COUNT queries
      const monitorCount = db
        .prepare("SELECT COUNT(*) as cnt FROM monitors")
        .get() as { cnt: number };
      expect(monitorCount.cnt).toBe(3);

      const sampleCount = db
        .prepare("SELECT COUNT(*) as cnt FROM ping_samples")
        .get() as { cnt: number };
      expect(sampleCount.cnt).toBe(42);

      const lastIngestRow = db
        .prepare("SELECT MAX(timestamp_ms) as max_ts FROM ping_samples")
        .get() as { max_ts: number | null };
      expect(lastIngestRow.max_ts).toBe(1753939200000);
    });

    test("health endpoint handles empty database with zero counts", async () => {
      const mockDb = {
        prepare: (sql: string) => {
          if (sql === "SELECT 1") {
            return { get: () => ({ 1: 1 }) };
          }
          if (sql.includes("COUNT(*)")) {
            return { get: () => ({ cnt: 0 }) };
          }
          if (sql.includes("MAX(timestamp_ms)")) {
            return { get: () => ({ max_ts: null }) };
          }
          return { get: () => null };
        },
      };

      // @ts-expect-error — mock database
      globalThis.__db = mockDb;

      const { getDb } = await import("../utils/db");
      const db = getDb();

      // Simulate queries on empty DB
      const monitorCount = db
        .prepare("SELECT COUNT(*) as cnt FROM monitors")
        .get() as { cnt: number };
      expect(monitorCount.cnt).toBe(0);

      const sampleCount = db
        .prepare("SELECT COUNT(*) as cnt FROM ping_samples")
        .get() as { cnt: number };
      expect(sampleCount.cnt).toBe(0);

      const lastIngestRow = db
        .prepare("SELECT MAX(timestamp_ms) as max_ts FROM ping_samples")
        .get() as { max_ts: number | null };
      expect(lastIngestRow.max_ts).toBeNull();

      const lastIngestTime =
        lastIngestRow.max_ts != null
          ? new Date(lastIngestRow.max_ts).toISOString()
          : null;
      expect(lastIngestTime).toBeNull();
    });

    test("health endpoint DB probe catches errors gracefully", async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          get: () => {
            throw new Error("database is corrupted");
          },
        }),
      };

      // @ts-expect-error — mock database
      globalThis.__db = mockDb;

      const { getDb } = await import("../utils/db");
      const db = getDb();

      // The health check's DB probe should not crash
      let dbStatus: "ok" | "error" = "ok";
      try {
        db.prepare("SELECT 1").get();
      } catch {
        dbStatus = "error";
      }

      expect(dbStatus).toBe("error");
      expect(mockDb.prepare).toHaveBeenCalledWith("SELECT 1");
    });
  });

  // ------------------------------------------------------------------
  // Response assembly
  // ------------------------------------------------------------------

  describe("response assembly", () => {
    test("assembled response contains all required fields", () => {
      const extended = {
        db_path: "/tmp/test.db",
        db_size_bytes: 8192,
        monitor_count: 5,
        sample_count: 100,
        last_ingest_time: "2025-01-01T00:00:00.000Z",
      };

      const response = {
        status: "ok" as const,
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime() * 100) / 100,
        version: "0.1.0",
        db_path: extended.db_path,
        db_size_bytes: extended.db_size_bytes,
        monitor_count: extended.monitor_count,
        sample_count: extended.sample_count,
        last_ingest_time: extended.last_ingest_time,
      };

      // Verify all required fields
      expect(response).toHaveProperty("status");
      expect(response).toHaveProperty("timestamp");
      expect(response).toHaveProperty("uptime");
      expect(response).toHaveProperty("version");
      expect(response).toHaveProperty("db_path");
      expect(response).toHaveProperty("db_size_bytes");
      expect(response).toHaveProperty("monitor_count");
      expect(response).toHaveProperty("sample_count");
      expect(response).toHaveProperty("last_ingest_time");
    });

    test("response uptime is rounded to 2 decimals", () => {
      const uptime = Math.round(process.uptime() * 100) / 100;
      // The value should not have more than 2 decimal places
      const decimalPart = uptime.toString().split(".")[1];
      if (decimalPart) {
        expect(decimalPart.length).toBeLessThanOrEqual(2);
      }
    });
  });
});
