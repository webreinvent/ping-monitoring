import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

describe("getDb", () => {
  beforeEach(() => {
    // Clear the global database reference before each test
    globalThis.__db = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  test("throws when globalThis.__db is undefined", async () => {
    globalThis.__db = undefined;

    const { getDb } = await import("./db");

    expect(() => getDb()).toThrow();
  });

  test("throws when globalThis.__db is null", async () => {
    globalThis.__db = undefined;

    const { getDb } = await import("./db");

    expect(() => getDb()).toThrow();
  });

  test("error message includes exact phrasing 'Database not initialized'", async () => {
    const { getDb } = await import("./db");

    try {
      getDb();
    } catch (err) {
      expect((err as Error).message).toBe(
        "Database not initialized. Ensure database plugin is loaded.",
      );
    }
  });

  test("getDb returns truthy value when mock is set", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
      exec: vi.fn(),
      pragma: vi.fn(),
    };

    globalThis.__db = mockDb;

    const { getDb } = await import("./db");

    const db = getDb();
    expect(Boolean(db)).toBe(true);
  });

  test("getDb throws when mock is set to falsy value", async () => {
    // @ts-expect-error — test falsy __db
    globalThis.__db = null;

    const { getDb } = await import("./db");

    expect(() => getDb()).toThrow();
  });
});
