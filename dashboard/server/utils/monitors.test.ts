import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Database } from "better-sqlite3";

// Mock the db module
vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { getAllMonitorsWithLatestState } from "./monitors";

const mockGetDb = getDb as unknown as ReturnType<typeof vi.fn>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createMockDb(rows: Array<{
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
}>): Database {
  return {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue(rows),
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
/*  getAllMonitorsWithLatestState — basic behavior                     */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — basic behavior", () => {
  it("returns empty array when no monitors exist", () => {
    const mockDb = createMockDb([]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result).toEqual([]);
  });

  it("returns a single monitor with correct shape", () => {
    const created_at = new Date("2026-01-15T12:00:00.000Z").getTime();
    const last_seen_ms = new Date("2026-01-15T12:05:00.000Z").getTime();

    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "test-client",
        client_name: "Test Client",
        target_host: "8.8.8.8",
        target_name: "Google DNS",
        last_status: "success",
        last_latency_ms: 14.2,
        last_seen_ms,
        quality_state: "veryHigh",
        quality_state_updated_at: last_seen_ms,
        created_at,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      clientSlug: "test-client",
      clientName: "Test Client",
      targetHost: "8.8.8.8",
      targetName: "Google DNS",
      status: "up",
      latencyMs: 14.2,
      qualityState: "veryHigh",
      lastSeenMs: last_seen_ms,
      qualityStateUpdatedAtMs: last_seen_ms,
      createdAt: "2026-01-15T12:00:00.000Z",
    });
  });

  it("maps 'success' status to 'up'", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "c",
        client_name: "C",
        target_host: "host.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: Date.now(),
        quality_state: "veryHigh",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].status).toBe("up");
  });

  it("maps 'timeout' status to 'down'", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "c",
        client_name: "C",
        target_host: "host.com",
        target_name: null,
        last_status: "timeout",
        last_latency_ms: null,
        last_seen_ms: Date.now(),
        quality_state: "high",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].status).toBe("down");
  });

  it("maps 'error' status to 'down'", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "c",
        client_name: "C",
        target_host: "host.com",
        target_name: null,
        last_status: "error",
        last_latency_ms: null,
        last_seen_ms: Date.now(),
        quality_state: "medium",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].status).toBe("down");
  });

  it("maps null status to null (no recent samples)", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "c",
        client_name: "C",
        target_host: "host.com",
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

  it("converts created_at epoch to ISO 8601 string", () => {
    const epochMs = new Date("2026-06-15T08:30:00.000Z").getTime();
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "c",
        client_name: "C",
        target_host: "host.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: Date.now(),
        quality_state: "high",
        created_at: epochMs,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].createdAt).toBe("2026-06-15T08:30:00.000Z");
  });

  it("falls back to target_host when target_name is null", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "c",
        client_name: "C",
        target_host: "8.8.8.8",
        target_name: null,
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: Date.now(),
        quality_state: "high",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].targetName).toBe("8.8.8.8");
  });

  it("preserves target_name when it is set", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "c",
        client_name: "C",
        target_host: "8.8.8.8",
        target_name: "Google Public DNS",
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: Date.now(),
        quality_state: "high",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    expect(result[0].targetName).toBe("Google Public DNS");
  });
});

/* ------------------------------------------------------------------ */
/*  getAllMonitorsWithLatestState — sorting                            */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — sorting", () => {
  it("sorts by last_seen_ms DESC (most recent first)", () => {
    const now = Date.now();
    // Mock DB returns rows in the order SQL would return them (last_seen_ms DESC)
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
        quality_state: "high",
        created_at: 1700000000000,
      },
      {
        id: 2,
        client_slug: "b",
        client_name: "B",
        target_host: "b.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: now - 5000,
        quality_state: "high",
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
        last_seen_ms: now - 10000,
        quality_state: "high",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    // DB returns sorted by last_seen_ms DESC (SQL does the sort)
    // The function just maps the rows, so the order is preserved
    expect(result[0].lastSeenMs).toBe(now);
    expect(result[1].lastSeenMs).toBe(now - 5000);
    expect(result[2].lastSeenMs).toBe(now - 10000);
  });
});

/* ------------------------------------------------------------------ */
/*  getAllMonitorsWithLatestState — multiple monitors                  */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — multiple monitors", () => {
  it("returns all monitors from the DB", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "c1",
        client_name: "Client 1",
        target_host: "a.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: Date.now(),
        quality_state: "veryHigh",
        created_at: 1700000000000,
      },
      {
        id: 2,
        client_slug: "c1",
        client_name: "Client 1",
        target_host: "b.com",
        target_name: null,
        last_status: "timeout",
        last_latency_ms: null,
        last_seen_ms: Date.now() - 1000,
        quality_state: "high",
        created_at: 1700000000000,
      },
      {
        id: 3,
        client_slug: "c2",
        client_name: "Client 2",
        target_host: "c.com",
        target_name: "Server C",
        last_status: "error",
        last_latency_ms: null,
        last_seen_ms: Date.now() - 2000,
        quality_state: "medium",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
    expect(result[2].id).toBe(3);
  });
});
