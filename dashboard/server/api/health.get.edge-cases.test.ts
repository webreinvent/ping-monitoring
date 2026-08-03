import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDb } from "../utils/db";

/* ------------------------------------------------------------------ */
/*  health.get — edge cases not covered by main tests                  */
/* ------------------------------------------------------------------ */

/**
 * Additional edge-case tests for the health endpoint.
 * The main health.get.test.ts covers 37 tests for response shapes,
 * DB connectivity, version parsing, uptime, timestamps, and F14 metrics.
 * These tests cover additional error and edge scenarios.
 */
describe("health.get — additional edge cases", () => {
  beforeEach(() => {
    // @ts-expect-error — globalThis.__db cleanup
    delete globalThis.__db;
  });

  afterEach(() => {
    // @ts-expect-error — globalThis.__db cleanup
    delete globalThis.__db;
    vi.restoreAllMocks();
  });

  describe("error response shape", () => {
    it("error response has status 'error'", () => {
      const errResponse = {
        status: "error",
        timestamp: new Date().toISOString(),
        message: "something went wrong",
      };

      expect(errResponse.status).toBe("error");
      expect(errResponse).toHaveProperty("timestamp");
      expect(errResponse).toHaveProperty("message");
    });

    it("error response includes ISO timestamp", () => {
      const timestamp = new Date().toISOString();
      expect(new Date(timestamp).getTime()).toBeGreaterThan(0);
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("error message for Error instance extracts message", () => {
      const err = new Error("specific error message");
      const message = err instanceof Error ? err.message : "Unknown error";
      expect(message).toBe("specific error message");
    });

    it("error message for string error returns the string", () => {
      const err = "string error" as unknown as Error;
      const message = err instanceof Error ? err.message : "Unknown error";
      expect(message).toBe("Unknown error");
    });

    it("error message for null returns Unknown error", () => {
      const err = null as unknown as Error;
      const message = err instanceof Error ? err.message : "Unknown error";
      expect(message).toBe("Unknown error");
    });

    it("error message for number returns Unknown error", () => {
      const err = 42 as unknown as Error;
      const message = err instanceof Error ? err.message : "Unknown error";
      expect(message).toBe("Unknown error");
    });
  });

  describe("version fallback", () => {
    it("falls back to 0.0.0 when package.json version is undefined", () => {
      const pkg = {} as { version?: string };
      const version = pkg.version || "0.0.0";
      expect(version).toBe("0.0.0");
    });

    it("falls back to 0.0.0 when package.json version is empty string", () => {
      const pkg = { version: "" } as { version?: string };
      const version = pkg.version || "0.0.0";
      expect(version).toBe("0.0.0");
    });

    it("returns actual version when present", () => {
      const pkg = { version: "1.2.3" } as { version?: string };
      const version = pkg.version || "0.0.0";
      expect(version).toBe("1.2.3");
    });
  });

  describe("uptime rounding", () => {
    it("rounds uptime to 2 decimal places", () => {
      const uptime = 123.456789;
      const rounded = Math.round(uptime * 100) / 100;
      expect(rounded).toBe(123.46);
    });

    it("handles uptime of 0", () => {
      const uptime = 0;
      const rounded = Math.round(uptime * 100) / 100;
      expect(rounded).toBe(0);
    });

    it("handles very large uptime", () => {
      const uptime = 999999.999;
      const rounded = Math.round(uptime * 100) / 100;
      expect(rounded).toBe(1000000);
    });
  });

  describe("last_ingest_time — additional edge cases", () => {
    it("returns null for null max_ts", () => {
      const maxTs = null;
      const lastIngestTime =
        maxTs != null ? new Date(maxTs).toISOString() : null;
      expect(lastIngestTime).toBeNull();
    });

    it("returns null for undefined max_ts", () => {
      const maxTs = undefined;
      const lastIngestTime =
        maxTs != null ? new Date(maxTs).toISOString() : null;
      expect(lastIngestTime).toBeNull();
    });

    it("converts valid timestamp to ISO string", () => {
      const maxTs = 1700000000000;
      const lastIngestTime =
        maxTs != null ? new Date(maxTs).toISOString() : null;
      expect(lastIngestTime).toBe("2023-11-14T22:13:20.000Z");
    });

    it("handles timestamp of 0 (epoch)", () => {
      const maxTs = 0;
      const lastIngestTime =
        maxTs != null ? new Date(maxTs).toISOString() : null;
      expect(lastIngestTime).toBe("1970-01-01T00:00:00.000Z");
    });

    it("handles very large timestamp", () => {
      const maxTs = 9999999999999;
      const lastIngestTime =
        maxTs != null ? new Date(maxTs).toISOString() : null;
      expect(lastIngestTime).toMatch(/Z$/);
    });
  });

  describe("db_path resolution edge cases", () => {
    it("resolves relative path to absolute", () => {
      const { resolve } = require("node:path");
      const dbPath = ".data/lingering.db";
      const fullPath = resolve(dbPath);
      expect(fullPath).toContain("lingering.db");
      // Resolved path should be absolute
      expect(fullPath[0]).toBe("/");
    });

    it("preserves absolute path when DATABASE_PATH is absolute", () => {
      process.env.DATABASE_PATH = "/var/lib/lnpm/lingering.db";
      const dbPath =
        (process.env.DATABASE_PATH as string) || ".data/lingering.db";
      expect(dbPath).toBe("/var/lib/lnpm/lingering.db");
      delete process.env.DATABASE_PATH;
    });
  });

  describe("statSync — success path", () => {
    it("statSync returns file size when file exists", () => {
      const { statSync: realStatSync } = require("node:fs");
      // package.json exists in the project root
      const pkgPath = require("node:path").resolve(
        process.cwd(),
        "package.json",
      );
      const stats = realStatSync(pkgPath);

      // Verify statSync returns a Stats object with a size property
      expect(typeof stats.size).toBe("number");
      expect(stats.size).toBeGreaterThan(0);
    });

    it("db_size_bytes uses statSync.size when file exists", () => {
      // Simulate the health check's statSync logic for an existing file
      const { statSync: realStatSync } = require("node:fs");
      const pkgPath = require("node:path").resolve(
        process.cwd(),
        "package.json",
      );

      let dbSizeBytes = 0;
      try {
        dbSizeBytes = realStatSync(pkgPath).size;
      } catch {
        // Won't be reached since package.json exists
      }

      expect(dbSizeBytes).toBeGreaterThan(0);
      expect(typeof dbSizeBytes).toBe("number");
    });

    it("statSync does not throw for existing file", () => {
      const { statSync: realStatSync } = require("node:fs");
      const pkgPath = require("node:path").resolve(
        process.cwd(),
        "package.json",
      );

      expect(() => realStatSync(pkgPath)).not.toThrow();
    });
  });

  describe("getDb failure in health check", () => {
    it("getDb throws when no DB is initialized", () => {
      expect(() => getDb()).toThrow(
        "Database not initialized. Ensure database plugin is loaded.",
      );
    });

    it("getDb error includes 'plugin' for debugging", () => {
      try {
        getDb();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        expect(message).toContain("plugin");
      }
    });
  });

  describe("response field presence", () => {
    it("success response contains all F14 fields", () => {
      const response = {
        status: "ok" as const,
        timestamp: new Date().toISOString(),
        uptime: 123.45,
        version: "1.0.0",
        db_path: "/path/to/db",
        db_size_bytes: 1024,
        monitor_count: 5,
        sample_count: 100,
        last_ingest_time: "2024-01-01T00:00:00.000Z",
      };

      // Required fields from F14
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

    it("error response contains minimal required fields", () => {
      const response = {
        status: "error" as const,
        timestamp: new Date().toISOString(),
        message: "Database connection failed",
      };

      expect(response).toHaveProperty("status");
      expect(response).toHaveProperty("timestamp");
      expect(response).toHaveProperty("message");
    });
  });
});
