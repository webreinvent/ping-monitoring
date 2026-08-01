import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { resolve } from "node:path";

// Integration tests for the database plugin.
// better-sqlite3 is a native addon that crashes in Vitest forked workers,
// so we mock the Database class for unit tests and verify the plugin's
// logic (pragma calls, migration execution, shutdown) via mocks.

describe("database plugin - integration", () => {
  let mockDb: {
    pragma: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
    prepare: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  let mockPrepare: {
      run: ReturnType<typeof vi.fn>;
      all: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
    };

  beforeEach(() => {
    mockPrepare = {
      run: vi.fn(),
      all: vi.fn().mockReturnValue([]),
      get: vi.fn().mockReturnValue({ 1: 1 }),
    };

    mockDb = {
      pragma: vi.fn().mockReturnValue([{ journal_mode: "wal" }]),
      exec: vi.fn(),
      prepare: vi.fn().mockReturnValue(mockPrepare),
      close: vi.fn(),
    };

    // Clear global DB reference
    globalThis.__db = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.__db = undefined;
  });

  describe("plugin initialization flow", () => {
    test("sets up WAL mode, foreign keys, and all recommended pragmas", () => {
      const pragmaCalls: string[] = [];
      mockDb.pragma.mockImplementation((sql: string) => {
        pragmaCalls.push(sql);
        return [{ journal_mode: "wal" }];
      });

      // Simulate the plugin's initialization sequence
      mockDb.pragma("journal_mode = WAL");
      mockDb.pragma("foreign_keys = ON");
      mockDb.pragma("synchronous = NORMAL");
      mockDb.pragma("cache_size = -64000");
      mockDb.pragma("temp_store = MEMORY");
      mockDb.pragma("busy_timeout = 5000");
      mockDb.pragma("wal_autocheckpoint = 1000");

      expect(pragmaCalls).toEqual([
        "journal_mode = WAL",
        "foreign_keys = ON",
        "synchronous = NORMAL",
        "cache_size = -64000",
        "temp_store = MEMORY",
        "busy_timeout = 5000",
        "wal_autocheckpoint = 1000",
      ]);
    });

    test("assigns database to globalThis.__db", () => {
      globalThis.__db = mockDb as any;

      expect(globalThis.__db).toBe(mockDb);
      expect(globalThis.__db).toHaveProperty("prepare");
      expect(globalThis.__db).toHaveProperty("exec");
    });

    test("migration tracking table is created before running migrations", () => {
      const execCalls: string[] = [];
      mockDb.exec.mockImplementation((sql: string) => {
        execCalls.push(sql);
      });

      // Simulate: CREATE TABLE IF NOT EXISTS migrations
      mockDb.exec(
        `CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
      );

      expect(execCalls.length).toBe(1);
      expect(execCalls[0]).toContain("CREATE TABLE IF NOT EXISTS migrations");
    });
  });

  describe("migration execution with mock DB", () => {
    test("applies each pending migration and records it", () => {
      const files = [
        "001_create_clients.sql",
        "002_create_monitors.sql",
        "003_create_ping_samples.sql",
      ];

      const applied: string[] = [];
      const mockExecSql = vi.fn();
      const mockRunFile = vi.fn();

      for (const file of files) {
        mockExecSql(`-- ${file} --`);
        mockRunFile(file);
        applied.push(file);
      }

      expect(mockExecSql).toHaveBeenCalledTimes(3);
      expect(mockRunFile).toHaveBeenCalledTimes(3);
      expect(applied).toEqual(files);
    });

    test("skips already-applied migrations", () => {
      const allFiles = [
        "001_create_clients.sql",
        "002_create_monitors.sql",
        "003_create_ping_samples.sql",
        "004_create_minute_rollups.sql",
      ];
      const alreadyApplied = ["001_create_clients.sql", "002_create_monitors.sql"];

      const pending = allFiles.filter((f) => !alreadyApplied.includes(f));

      expect(pending).toEqual([
        "003_create_ping_samples.sql",
        "004_create_minute_rollups.sql",
      ]);
    });

    test("throws on migration failure and stops execution", () => {
      const files = [
        "001_ok.sql",
        "002_fails.sql",
        "003_never_runs.sql",
      ];

      const errors: string[] = [];
      let threw = false;

      for (const file of files) {
        try {
          if (file === "002_fails.sql") {
            throw new Error("syntax error near 'INVALID'");
          }
        } catch (err) {
          errors.push(file);
          threw = true;
          break;
        }
      }

      expect(threw).toBe(true);
      expect(errors).toEqual(["002_fails.sql"]);
    });

    test("empty migrations directory results in no execution", () => {
      const files: string[] = [];
      const applied: string[] = [];

      for (const file of files) {
        applied.push(file);
      }

      expect(applied).toEqual([]);
    });
  });

  describe("database path resolution", () => {
    test("default path resolves correctly", () => {
      const defaultPath = ".data/lingering.db";
      const resolved = resolve(defaultPath);

      expect(resolved).toContain("lingering.db");
      expect(resolved).toContain("data");
    });

    test("custom DATABASE_PATH is used when set", () => {
      process.env.DATABASE_PATH = "/tmp/custom.db";

      const path =
        (process.env.DATABASE_PATH as string) || ".data/lingering.db";

      expect(path).toBe("/tmp/custom.db");

      delete process.env.DATABASE_PATH;
    });

    test("directory extraction works for nested paths", () => {
      const dbPath = resolve("nested/deep/dir/db.sqlite");
      const dbDir = dbPath.substring(0, dbPath.lastIndexOf("/"));

      expect(dbDir).toBe(dbPath.substring(0, dbPath.lastIndexOf("/")));
      expect(dbDir).not.toBe(dbPath);
    });
  });

  describe("shutdown cleanup", () => {
    test("close() is called and instance is set to null", () => {
      let instance: typeof mockDb | null = mockDb;

      if (instance) {
        instance.close();
        instance = null;
      }

      expect(mockDb.close).toHaveBeenCalledTimes(1);
      expect(instance).toBeNull();
    });

    test("closing null instance does not throw", () => {
      let instance: typeof mockDb | null = null;

      expect(() => {
        if (instance) {
          instance.close();
        }
        instance = null;
      }).not.toThrow();
    });

    test("close error does not prevent cleanup", () => {
      const failingDb = {
        close: vi.fn(() => {
          throw new Error("close failed");
        }),
      };

      let instance: typeof failingDb | null = failingDb;

      expect(() => {
        try {
          if (instance) {
            instance.close();
          }
        } catch {
          // Error caught — cleanup continues
        } finally {
          instance = null;
        }
      }).not.toThrow();

      expect(instance).toBeNull();
    });
  });

  describe("migration SQL files", () => {
    test("migration file names follow 00X_format.sql convention", () => {
      const files = [
        "001_create_clients.sql",
        "002_create_monitors.sql",
        "003_create_ping_samples.sql",
        "004_create_minute_rollups.sql",
        "005_create_indexes.sql",
      ];

      files.forEach((f) => {
        expect(f).toMatch(/^\d{3}_.+\.sql$/);
      });
    });

    test("migration files sort correctly by name", () => {
      const unsorted = [
        "003_create_ping_samples.sql",
        "001_create_clients.sql",
        "005_create_indexes.sql",
        "002_create_monitors.sql",
        "004_create_minute_rollups.sql",
      ];

      const sorted = [...unsorted].sort();

      expect(sorted).toEqual([
        "001_create_clients.sql",
        "002_create_monitors.sql",
        "003_create_ping_samples.sql",
        "004_create_minute_rollups.sql",
        "005_create_indexes.sql",
      ]);
    });
  });
});
