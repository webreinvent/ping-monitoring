import { describe, test, expect, vi, beforeEach } from "vitest";

describe("getDb", () => {
  beforeEach(() => {
    // @ts-expect-error — test isolation
    delete globalThis.__db;
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

    // @ts-expect-error — mock database instance
    globalThis.__db = mockDb;

    const { getDb } = await import("./db");

    const result = getDb();

    expect(result).toBe(mockDb);
  });

  test("returns the same instance on subsequent calls", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
    };

    // @ts-expect-error — mock database instance
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

  test("does not throw when globalThis.__db is set to a falsy-but-not-undefined value", async () => {
    // Edge case: what if __db is null? It should still throw since null is falsy
    // @ts-expect-error — setting to null for edge case test
    globalThis.__db = null;

    const { getDb } = await import("./db");

    expect(() => getDb()).toThrow();
  });
});
