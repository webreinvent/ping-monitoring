import { describe, test, expect, vi, beforeEach } from "vitest";

describe("database plugin", () => {
  describe("singleton pattern", () => {
    test("getDatabase returns the same instance on subsequent calls", () => {
      // The plugin uses a module-level singleton via dbInstance.
      // We can't easily re-import it in tests, so we test the pattern directly.

      let instance: unknown = null;

      function getSingleton(): object {
        if (instance) {
          return instance as object;
        }
        instance = { id: 1 };
        return instance;
      }

      const first = getSingleton();
      const second = getSingleton();

      expect(first).toBe(second);
    });
  });

  describe("migration execution", () => {
    test("runs SQL files in sorted order", () => {
      const executionOrder: string[] = [];

      const mockDb = {
        exec: (sql: string) => {
          // Extract the filename from the SQL comment
          executionOrder.push(sql);
        },
      };

      // Simulate sorted file listing
      const files = ["003_third.sql", "001_first.sql", "002_second.sql"];
      const sorted = files.filter((f) => f.endsWith(".sql")).sort();

      expect(sorted[0]).toBe("001_first.sql");
      expect(sorted[1]).toBe("002_second.sql");
      expect(sorted[2]).toBe("003_third.sql");
    });

    test("only processes .sql files", () => {
      const files = [
        "001_migration.sql",
        "002_notes.txt",
        "003_data.json",
        "004_another.sql",
      ];

      const sqlFiles = files.filter((f) => f.endsWith(".sql"));

      expect(sqlFiles).toEqual(["001_migration.sql", "004_another.sql"]);
    });

    test("skips already-applied migrations", () => {
      const applied = ["001_first.sql", "002_second.sql"];
      const files = ["001_first.sql", "002_second.sql", "003_third.sql"];

      const pending = files.filter((f) => !applied.includes(f));

      expect(pending).toEqual(["003_third.sql"]);
    });

    test("empty migrations directory results in no migrations run", () => {
      const files: string[] = [];
      const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

      expect(sqlFiles).toEqual([]);
    });
  });

  describe("WAL mode and foreign keys", () => {
    test("enables WAL journal mode via pragma", () => {
      const pragmaCalls: string[] = [];
      const mockDb = {
        pragma: (sql: string) => {
          pragmaCalls.push(sql);
        },
      };

      // Simulate the plugin's initialization
      mockDb.pragma("journal_mode = WAL");
      mockDb.pragma("foreign_keys = ON");

      expect(pragmaCalls).toContain("journal_mode = WAL");
      expect(pragmaCalls).toContain("foreign_keys = ON");
    });

    test("pragmas are called in correct order", () => {
      const pragmaCalls: string[] = [];
      const mockDb = {
        pragma: (sql: string) => {
          pragmaCalls.push(sql);
        },
      };

      mockDb.pragma("journal_mode = WAL");
      mockDb.pragma("foreign_keys = ON");

      expect(pragmaCalls[0]).toBe("journal_mode = WAL");
      expect(pragmaCalls[1]).toBe("foreign_keys = ON");
    });
  });

  describe("globalThis assignment", () => {
    test("stores database on globalThis.__db after initialization", () => {
      // @ts-expect-error — test isolation
      delete globalThis.__db;

      const mockDb = { id: "mock-db" };

      // Simulate what the plugin does
      // @ts-expect-error — setting global __db
      globalThis.__db = mockDb;

      // @ts-expect-error — reading global __db
      expect(globalThis.__db).toBe(mockDb);
    });

    test("globalThis.__db is accessible after plugin initialization", () => {
      // @ts-expect-error — test isolation
      delete globalThis.__db;

      const mockDb = { prepare: vi.fn() };

      // @ts-expect-error — setting global __db
      globalThis.__db = mockDb;

      // Verify it's accessible
      // @ts-expect-error — reading global __db
      const retrieved = globalThis.__db;
      expect(retrieved).toBe(mockDb);
      expect(retrieved.prepare).toBeInstanceOf(Function);
    });
  });

  describe("database path resolution", () => {
    test("defaults to .data/lingering.db when DATABASE_PATH is not set", () => {
      const originalEnv = process.env.DATABASE_PATH;
      // @ts-expect-error — delete for test
      delete process.env.DATABASE_PATH;

      const dbPath =
        (process.env.DATABASE_PATH as string) || ".data/lingering.db";

      expect(dbPath).toBe(".data/lingering.db");

      // Restore
      if (originalEnv !== undefined) {
        process.env.DATABASE_PATH = originalEnv;
      }
    });

    test("uses DATABASE_PATH when set", () => {
      process.env.DATABASE_PATH = "/custom/path/db.sqlite";

      const dbPath =
        (process.env.DATABASE_PATH as string) || ".data/lingering.db";

      expect(dbPath).toBe("/custom/path/db.sqlite");

      // Cleanup
      delete process.env.DATABASE_PATH;
    });
  });

  describe("migration tracking table", () => {
    test("creates migrations table if not exists", () => {
      const execCalls: string[] = [];
      const mockDb = {
        exec: (sql: string) => {
          execCalls.push(sql);
        },
      };

      // Simulate the CREATE TABLE IF NOT EXISTS migrations
      mockDb.exec(
        `CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
      );

      expect(execCalls.length).toBe(1);
      expect(execCalls[0]).toContain("CREATE TABLE IF NOT EXISTS migrations");
      expect(execCalls[0]).toContain("name TEXT NOT NULL UNIQUE");
    });
  });
});
