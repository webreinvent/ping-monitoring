import { describe, test, expect, vi, beforeEach } from "vitest";

describe("getDb", () => {
  beforeEach(() => {
    // Clear the global database reference before each test
    globalThis.__db = undefined;
  });

  test("throws when database is not initialized", async () => {
    const { getDb } = await import("./db");

    expect(() => getDb()).toThrow(
      "Database not initialized. Ensure database plugin is loaded.",
    );
  });

  test("throws with Error type when database is not initialized", async () => {
    const { getDb } = await import("./db");

    try {
      getDb();
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("Database not initialized");
    }
  });

  test("returns the database instance when it is initialized", async () => {
    // Create a minimal mock Database
    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnValue({}),
      exec: vi.fn(),
      pragma: vi.fn(),
      close: vi.fn(),
    };

    globalThis.__db = mockDb;

    const { getDb } = await import("./db");

    const result = getDb();

    expect(result).toBe(mockDb);
  });

  test("returns the same instance on subsequent calls", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
    };

    globalThis.__db = mockDb;

    const { getDb } = await import("./db");

    const first = getDb();
    const second = getDb();

    expect(first).toBe(second);
    expect(first).toBe(mockDb);
  });

  test("throws with specific message containing 'plugin'", async () => {
    const { getDb } = await import("./db");

    try {
      getDb();
    } catch (err) {
      expect((err as Error).message).toContain("plugin");
    }
  });

  test("throws when globalThis.__db is null", async () => {
    globalThis.__db = undefined;

    const { getDb } = await import("./db");

    expect(() => getDb()).toThrow();
  });
});
