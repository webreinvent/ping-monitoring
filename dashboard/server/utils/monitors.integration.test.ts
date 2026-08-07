import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  monitors.ts — integration-style tests with mock DB                 */
/* ------------------------------------------------------------------ */
/*  deleteMonitor() interacts with the SQLite `ON DELETE CASCADE`       */
/*  machinery on the `monitors` table. We mock `getDb()` to return a   */
/*  controlled `prepare`/`run` pair so we don't need an actual SQLite  */
/*  engine to verify the query shape and result semantics.             */
/* ------------------------------------------------------------------ */

vi.mock("../utils/db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "../utils/db";
import {
  getAllMonitorsWithLatestState,
  deleteMonitor,
} from "./monitors";

const mockGetDb = getDb as unknown as ReturnType<typeof vi.fn>;

/**
 * Build a mock DB whose `prepare().run()` returns the given change count
 * (default 1). Captures the prepared SQL and the run parameters so the
 * tests can assert the exact SQL and bind values.
 */
function createMockDb(opts: {
  changes?: number;
  capturedSql?: { value: string | null };
  capturedParams?: { value: unknown[] | null };
} = {}) {
  const changes = opts.changes ?? 1;
  const capturedSql = opts.capturedSql ?? { value: null };
  const capturedParams = opts.capturedParams ?? { value: null };

  return {
    prepare: vi.fn((sql: string) => {
      capturedSql.value = sql;
      return {
        run: vi.fn((...params: unknown[]) => {
          capturedParams.value = params;
          return { changes };
        }),
        get: vi.fn(() => null),
        all: vi.fn(() => []),
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  deleteMonitor                                                     */
/* ------------------------------------------------------------------ */

describe("deleteMonitor — integration with mock DB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when a row was deleted", () => {
    mockGetDb.mockReturnValue(createMockDb({ changes: 1 }));

    const result = deleteMonitor(42);
    expect(result).toBe(true);
  });

  it("returns false when no monitor exists with that id (0 changes)", () => {
    mockGetDb.mockReturnValue(createMockDb({ changes: 0 }));

    const result = deleteMonitor(999_999);
    expect(result).toBe(false);
  });

  it("issues a DELETE FROM monitors WHERE id = ? statement", () => {
    const capturedSql = { value: null as string | null };
    mockGetDb.mockReturnValue(createMockDb({ capturedSql }));

    deleteMonitor(7);
    expect(capturedSql.value).not.toBeNull();
    expect(capturedSql.value).toBe("DELETE FROM monitors WHERE id = ?");
  });

  it("binds the monitor id as the single parameter", () => {
    const capturedParams = { value: null as unknown[] | null };
    mockGetDb.mockReturnValue(createMockDb({ capturedParams }));

    deleteMonitor(123);
    expect(capturedParams.value).not.toBeNull();
    expect(capturedParams.value).toEqual([123]);
  });

  it("does NOT manually cascade to ping_samples or minute_rollups", () => {
    // The whole point of the cascade is that the FK `ON DELETE CASCADE`
    // handles dependents. The function MUST NOT issue DELETE statements
    // against `ping_samples` or `minute_rollups` itself — capturing the
    // SQL proves we rely on the cascade.
    const observedSql: string[] = [];
    const mockPrepare = vi.fn((sql: string) => {
      observedSql.push(sql);
      return {
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => null),
        all: vi.fn(() => []),
      };
    });
    mockGetDb.mockReturnValue({ prepare: mockPrepare });

    deleteMonitor(5);
    expect(observedSql).toEqual([
      "DELETE FROM monitors WHERE id = ?",
    ]);
  });

  it("calls getDb() once per delete", () => {
    mockGetDb.mockReturnValue(createMockDb());

    deleteMonitor(11);
    expect(mockGetDb).toHaveBeenCalledTimes(1);
  });
});
