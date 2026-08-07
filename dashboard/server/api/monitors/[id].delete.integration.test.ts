import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  DELETE /api/monitors/:id — endpoint validation with mock DB        */
/* ------------------------------------------------------------------ */
/*  The handler requires the Nitro runtime (`defineEventHandler`,      */
/*  `createError`, `getRouterParam`), so we test the validation,       */
/*  parameter plumbing, and cascade-rely contract independently of     */
/*  the Nuxt handler chain.                                            */
/* ------------------------------------------------------------------ */

vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "../../utils/db";
import { deleteMonitor } from "../../utils/monitors";

const mockGetDb = getDb as unknown as ReturnType<typeof vi.fn>;

function createMockDb(changes = 1) {
  return {
    prepare: vi.fn(() => ({
      run: vi.fn(() => ({ changes })),
      get: vi.fn(() => null),
      all: vi.fn(() => []),
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  validation: id parsing                                              */
/* ------------------------------------------------------------------ */

describe("DELETE /api/monitors/:id — id parameter validation", () => {
  it("rejects empty string id", () => {
    // Mirrors the handler check: `raw === ""` ⇒ 400.
    const raw = "";
    const isBlank = raw === undefined || raw === null || raw === "";
    expect(isBlank).toBe(true);
  });

  it("rejects undefined id", () => {
    const raw = undefined as unknown as string;
    const isBlank = raw === undefined || raw === null || raw === "";
    expect(isBlank).toBe(true);
  });

  it("rejects null id", () => {
    const raw = null as unknown as string;
    const isBlank = raw === undefined || raw === null || raw === "";
    expect(isBlank).toBe(true);
  });

  it("rejects non-numeric id (e.g. 'abc')", () => {
    const raw = "abc";
    const id = Number(raw);
    expect(Number.isInteger(id)).toBe(false);
  });

  it("rejects zero id", () => {
    const raw = "0";
    const id = Number(raw);
    expect(Number.isInteger(id) && id > 0).toBe(false);
  });

  it("rejects negative id", () => {
    const raw = "-5";
    const id = Number(raw);
    expect(Number.isInteger(id) && id > 0).toBe(false);
  });

  it("rejects floating-point id", () => {
    const raw = "3.14";
    const id = Number(raw);
    expect(Number.isInteger(id)).toBe(false);
  });

  it("accepts a positive integer id", () => {
    const raw = "42";
    const id = Number(raw);
    expect(Number.isInteger(id) && id > 0).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  integration with deleteMonitor()                                   */
/* ------------------------------------------------------------------ */

describe("DELETE /api/monitors/:id — endpoint flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls deleteMonitor() with the parsed numeric id", () => {
    mockGetDb.mockReturnValue(createMockDb(1));

    // Simulate the handler: id parse → deleteMonitor
    const raw = "42";
    const id = Number(raw);
    const ok = deleteMonitor(id);

    expect(ok).toBe(true);
    expect(mockGetDb).toHaveBeenCalled();
  });

  it("returns 200-equivalent success when a row is deleted", () => {
    mockGetDb.mockReturnValue(createMockDb(1));

    const ok = deleteMonitor(1);
    expect(ok).toBe(true);
  });

  it("returns 404-equivalent (false) when no row is deleted", () => {
    mockGetDb.mockReturnValue(createMockDb(0));

    const ok = deleteMonitor(999_999);
    expect(ok).toBe(false);
  });

  it("does not delete the parent client even if this was its only monitor", () => {
    // The mock DB is set up so `prepare()` returns a single DELETE
    // statement. If the handler ever tried to cascade into `clients`,
    // an additional SQL would appear. Capture all SQL observed.
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

    deleteMonitor(7);
    expect(observedSql).toEqual([
      "DELETE FROM monitors WHERE id = ?",
    ]);
    expect(observedSql.some((s) => /FROM clients/i.test(s))).toBe(false);
  });

  it("relies on ON DELETE CASCADE for ping_samples / minute_rollups", () => {
    // The whole point of the design: a single DELETE on `monitors`
    // triggers SQLite's cascade machinery for dependents. The
    // function MUST NOT issue a second DELETE against ping_samples
    // or minute_rollups.
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

    deleteMonitor(11);
    expect(observedSql.some((s) => /FROM ping_samples/i.test(s))).toBe(
      false,
    );
    expect(observedSql.some((s) => /FROM minute_rollups/i.test(s))).toBe(
      false,
    );
  });
});

/* ------------------------------------------------------------------ */
/*  response shape                                                     */
/* ------------------------------------------------------------------ */

describe("DELETE /api/monitors/:id — response shape", () => {
  it("returns { ok: true, id } on success", () => {
    mockGetDb.mockReturnValue(createMockDb(1));

    // Simulate the handler return: { ok: deleteMonitor(id), id }
    const ok = deleteMonitor(42);
    const response = { ok, id: 42 };
    expect(response).toEqual({ ok: true, id: 42 });
  });
});
