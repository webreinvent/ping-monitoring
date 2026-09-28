import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb } from "./db";

/* ------------------------------------------------------------------ */
/*  getDb — edge cases                                                 */
/* ------------------------------------------------------------------ */

describe("getDb — edge cases", () => {
  beforeEach(() => {
    // @ts-expect-error — globalThis.__db cleanup
    delete globalThis.__db;
  });

  afterEach(() => {
    // @ts-expect-error — globalThis.__db cleanup
    delete globalThis.__db;
  });

  it("throws with descriptive error when DB is null", () => {
    // @ts-expect-error — explicitly set null for test
    globalThis.__db = null;

    expect(() => getDb()).toThrow(
      "Database not initialized. Ensure database plugin is loaded.",
    );
  });

  it("throws with descriptive error when DB is 0 (falsy)", () => {
    // @ts-expect-error — set falsy value for test
    globalThis.__db = 0;

    expect(() => getDb()).toThrow(
      "Database not initialized. Ensure database plugin is loaded.",
    );
  });

  it("throws with descriptive error when DB is empty string (falsy)", () => {
    // @ts-expect-error — set falsy value for test
    globalThis.__db = "";

    expect(() => getDb()).toThrow(
      "Database not initialized. Ensure database plugin is loaded.",
    );
  });

  it("throws with descriptive error when DB is false (falsy)", () => {
    // @ts-expect-error — set falsy value for test
    globalThis.__db = false;

    expect(() => getDb()).toThrow(
      "Database not initialized. Ensure database plugin is loaded.",
    );
  });

  it("error message mentions 'plugin' keyword", () => {
    expect(() => getDb()).toThrow(/plugin/i);
  });

  it("error message mentions 'Database not initialized'", () => {
    expect(() => getDb()).toThrow(/Database not initialized/i);
  });

  it("returns the exact same reference that was set", () => {
    const mockDb = {
      prepare: () => ({ run: () => {}, get: () => null }),
      exec: () => {},
    };

    // @ts-expect-error — mock DB for test
    globalThis.__db = mockDb;

    const result = getDb();
    expect(result).toBe(mockDb);
  });

  it("returns truthy value when mock DB is set", () => {
    const mockDb = {
      prepare: () => ({ run: () => {}, get: () => null }),
    };

    // @ts-expect-error — mock DB for test
    globalThis.__db = mockDb;

    const result = getDb();
    expect(!!result).toBe(true);
  });
});
