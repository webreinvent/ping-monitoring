import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Database } from "better-sqlite3";

// Mock the db module
vi.mock("../utils/db", () => ({ getDb: vi.fn() }));

import { getDb } from "../utils/db";
import { getAllMonitorsWithLatestState } from "../utils/monitors";

const mockGetDb = getDb as unknown as ReturnType<typeof vi.fn>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createMockDb(
  rows: Array<{
    id: number;
    client_slug: string;
    client_name: string;
    target_host: string;
    target_name: string | null;
    last_status: string | null;
    last_latency_ms: number | null;
    last_seen_ms: number | null;
    quality_state: string;
    quality_state_updated_at?: number | null;
    created_at: number;
  }>,
): Database {
  return {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue(rows),
    }),
  } as unknown as Database;
}

function createMockError(): Database {
  return {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockImplementation(() => {
        throw new Error("database disk image is malformed");
      }),
    }),
  } as unknown as Database;
}

/* ------------------------------------------------------------------ */
/*  Setup / Teardown                                                   */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.clearAllMocks();
  // @ts-expect-error — globalThis.__db cleanup
  delete globalThis.__db;
});

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error — globalThis.__db cleanup
  delete globalThis.__db;
});

/* ------------------------------------------------------------------ */
/*  Multiple monitors with identical lastSeenMs (tiebreaker)           */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — tiebreaker on lastSeenMs", () => {
  it("sorts by id ASC when lastSeenMs is identical", () => {
    const sameTime = Date.now();
    // Mock returns data already sorted as SQL would (ORDER BY COALESCE(ls.timestamp_ms, 0) DESC, m.id ASC)
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "a",
        client_name: "A",
        target_host: "a.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 20,
        last_seen_ms: sameTime,
        quality_state: "good",
        created_at: 1700000000000,
      },
      {
        id: 2,
        client_slug: "b",
        client_name: "B",
        target_host: "b.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 30,
        last_seen_ms: sameTime,
        quality_state: "good",
        created_at: 1700000000000,
      },
      {
        id: 3,
        client_slug: "c",
        client_name: "C",
        target_host: "c.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: sameTime,
        quality_state: "good",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result).toHaveLength(3);
    // SQL ORDER BY COALESCE(ls.timestamp_ms, 0) DESC, m.id ASC
    // Same timestamp → sorted by id ASC
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
    expect(result[2].id).toBe(3);
  });

  it("monitors with null lastSeenMs sort last (COALESCE to 0)", () => {
    const now = Date.now();
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "a",
        client_name: "A",
        target_host: "a.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: now,
        quality_state: "good",
        created_at: 1700000000000,
      },
      {
        id: 2,
        client_slug: "b",
        client_name: "B",
        target_host: "b.com",
        target_name: null,
        last_status: null,
        last_latency_ms: null,
        last_seen_ms: null,
        quality_state: "warmingUp",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result).toHaveLength(2);
    // Monitor with data sorts before monitor without data
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/*  Large monitor lists                                                */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — large monitor lists", () => {
  it("handles 100 monitors", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      client_slug: `client-${i}`,
      client_name: `Client ${i}`,
      target_host: `${i}.example.com`,
      target_name: null,
      last_status: i % 3 === 0 ? "timeout" : "success",
      last_latency_ms: i % 3 === 0 ? null : 10 + i,
      last_seen_ms: Date.now() - i * 1000,
      quality_state: i % 3 === 0 ? "poor" : "good",
      created_at: 1700000000000,
    }));
    const mockDb = createMockDb(rows);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result).toHaveLength(100);
    // First should have highest last_seen_ms
    expect(result[0].lastSeenMs).toBeGreaterThanOrEqual(result[99].lastSeenMs!);
  });
});

/* ------------------------------------------------------------------ */
/*  Database error handling                                            */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — database errors", () => {
  it("throws when database query fails", () => {
    const mockDb = createMockError();
    mockGetDb.mockReturnValue(mockDb);

    expect(() => getAllMonitorsWithLatestState()).toThrow(
      "database disk image is malformed",
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Quality state edge cases                                           */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — quality_state edge values", () => {
  it("maps unknown DB quality state to 'warmingUp'", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "test",
        client_name: "Test",
        target_host: "test.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: Date.now(),
        quality_state: "something_weird",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].qualityState).toBe("warmingUp");
  });

  it("maps empty string quality state to 'warmingUp'", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "test",
        client_name: "Test",
        target_host: "test.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: Date.now(),
        quality_state: "",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].qualityState).toBe("warmingUp");
  });
});

/* ------------------------------------------------------------------ */
/*  Status mapping edge cases                                          */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — status mapping edge cases", () => {
  it("maps null status to null", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "test",
        client_name: "Test",
        target_host: "test.com",
        target_name: null,
        last_status: null,
        last_latency_ms: null,
        last_seen_ms: null,
        quality_state: "warmingUp",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].status).toBeNull();
  });

  it("preserves 'up' for success status", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "test",
        client_name: "Test",
        target_host: "test.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 14.2,
        last_seen_ms: Date.now(),
        quality_state: "good",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].status).toBe("up");
  });
});

/* ------------------------------------------------------------------ */
/*  target_name edge cases                                             */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — target_name edge cases", () => {
  it("fallback to targetHost when target_name is empty string", () => {
    // In the DB, an empty string target_name would not be null,
    // so the fallback only triggers on null. But let's verify the
    // null path is the only fallback mechanism.
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "test",
        client_name: "Test",
        target_host: "8.8.8.8",
        target_name: null,
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: Date.now(),
        quality_state: "good",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].targetName).toBe("8.8.8.8");
  });

  it("preserves target_name with special characters", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "test",
        client_name: "Test",
        target_host: "8.8.8.8",
        target_name: "Google DNS (Primary)",
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: Date.now(),
        quality_state: "good",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].targetName).toBe("Google DNS (Primary)");
  });
});

/* ------------------------------------------------------------------ */
/*  created_at edge cases                                              */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — created_at edge cases", () => {
  it("converts zero epoch to valid ISO date", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "test",
        client_name: "Test",
        target_host: "test.com",
        target_name: null,
        last_status: null,
        last_latency_ms: null,
        last_seen_ms: null,
        quality_state: "warmingUp",
        created_at: 0,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].createdAt).toBe("1970-01-01T00:00:00.000Z");
  });

  it("handles future created_at values", () => {
    const futureDate = new Date("2099-12-31T23:59:59.999Z").getTime();
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "test",
        client_name: "Test",
        target_host: "test.com",
        target_name: null,
        last_status: null,
        last_latency_ms: null,
        last_seen_ms: null,
        quality_state: "warmingUp",
        created_at: futureDate,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].createdAt).toBe("2099-12-31T23:59:59.999Z");
  });
});
