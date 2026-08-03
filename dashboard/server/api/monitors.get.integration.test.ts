import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Database } from "better-sqlite3";

/**
 * Integration tests for GET /api/monitors.
 *
 * Uses mock DB approach (following the pattern established in
 * ping-ingest.integration.test.ts) to test the full query path
 * through getAllMonitorsWithLatestState.
 */

// Mock dependencies
vi.mock("../utils/db", () => ({ getDb: vi.fn() }));
vi.mock("../utils/logger", () => ({
  info: vi.fn(),
  error: vi.fn(),
}));

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
/*  Full endpoint response shape                                       */
/* ------------------------------------------------------------------ */

describe("GET /api/monitors — full endpoint response", () => {
  it("returns correct response shape with multiple monitors", () => {
    const now = Date.now();
    const rows = [
      {
        id: 1,
        client_slug: "alice-desktop-aa00bb11cc22",
        client_name: "Alice's Desktop",
        target_host: "8.8.8.8",
        target_name: "Google DNS",
        last_status: "success",
        last_latency_ms: 14.2,
        last_seen_ms: now,
        quality_state: "good",
        created_at: 1700000000000,
      },
      {
        id: 2,
        client_slug: "bob-laptop-22cc33dd44",
        client_name: "Bob's Laptop",
        target_host: "1.1.1.1",
        target_name: "Cloudflare",
        last_status: "timeout",
        last_latency_ms: null,
        last_seen_ms: now - 1000,
        quality_state: "degraded",
        created_at: 1700000000000,
      },
    ];

    const mockDb = createMockDb(rows);
    mockGetDb.mockReturnValue(mockDb);

    const monitors = getAllMonitorsWithLatestState();
    const response = { monitors };

    // Verify response shape
    expect(response).toHaveProperty("monitors");
    expect(Array.isArray(response.monitors)).toBe(true);
    expect(response.monitors).toHaveLength(2);

    // Verify sort order (most recent first)
    expect(response.monitors[0].id).toBe(1);
    expect(response.monitors[1].id).toBe(2);

    // Verify full shape of first item
    expect(response.monitors[0]).toEqual({
      id: 1,
      clientSlug: "alice-desktop-aa00bb11cc22",
      clientName: "Alice's Desktop",
      targetHost: "8.8.8.8",
      targetName: "Google DNS",
      status: "up",
      latencyMs: 14.2,
      qualityState: "warmingUp",
      lastSeenMs: now,
      qualityStateUpdatedAtMs: null,
      createdAt: "2023-11-14T22:13:20.000Z",
    });

    // Verify second item (down status)
    expect(response.monitors[1].status).toBe("down");
    expect(response.monitors[1].latencyMs).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Empty database returns 200 with empty array                        */
/* ------------------------------------------------------------------ */

describe("GET /api/monitors — empty database", () => {
  it("returns empty array with 200 status (no error thrown)", () => {
    const mockDb = createMockDb([]);
    mockGetDb.mockReturnValue(mockDb);

    // Should not throw
    const monitors = getAllMonitorsWithLatestState();

    expect(monitors).toEqual([]);
    expect(Array.isArray(monitors)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Multiple monitors sorted correctly end-to-end                      */
/* ------------------------------------------------------------------ */

describe("GET /api/monitors — sort order end-to-end", () => {
  it("sorts monitors by lastSeenMs DESC with id ASC tiebreaker", () => {
    const base = Date.now();
    const rows = [
      // Already in correct DB sort order (simulating what the query returns)
      {
        id: 1,
        client_slug: "client-1",
        client_name: "Client 1",
        target_host: "host-1.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: base,
        quality_state: "good",
        created_at: 1700000000000,
      },
      {
        id: 4,
        client_slug: "client-4",
        client_name: "Client 4",
        target_host: "host-4.com",
        target_name: "Host 4",
        last_status: "success",
        last_latency_ms: 20,
        last_seen_ms: base - 5000,
        quality_state: "good",
        created_at: 1700000000000,
      },
      {
        id: 2,
        client_slug: "client-2",
        client_name: "Client 2",
        target_host: "host-2.com",
        target_name: null,
        last_status: "timeout",
        last_latency_ms: null,
        last_seen_ms: base - 5000,
        quality_state: "poor",
        created_at: 1700000000000,
      },
      {
        id: 10,
        client_slug: "client-10",
        client_name: "Client 10",
        target_host: "host-10.com",
        target_name: null,
        last_status: null,
        last_latency_ms: null,
        last_seen_ms: null,
        quality_state: "warmingUp",
        created_at: 1700000000000,
      },
    ];

    const mockDb = createMockDb(rows);
    mockGetDb.mockReturnValue(mockDb);

    const monitors = getAllMonitorsWithLatestState();

    // Verify order: most recent first, monitors with no samples last
    expect(monitors).toHaveLength(4);
    expect(monitors[0].id).toBe(1); // Most recent (base)
    expect(monitors[1].id).toBe(4); // Middle time, lower id
    expect(monitors[2].id).toBe(2); // Middle time, higher id
    expect(monitors[3].id).toBe(10); // No samples (null lastSeenMs)

    // Verify the null-samples monitor has correct null fields
    expect(monitors[3].status).toBeNull();
    expect(monitors[3].latencyMs).toBeNull();
    expect(monitors[3].lastSeenMs).toBeNull();
    expect(monitors[3].qualityState).toBe("warmingUp");
  });
});

/* ------------------------------------------------------------------ */
/*  Database error returns 500                                         */
/* ------------------------------------------------------------------ */

describe("GET /api/monitors — database error", () => {
  it("throws error when database throws", () => {
    const mockDb = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error("SQLITE_ERROR: no such table: monitors");
      }),
    } as unknown as Database;
    mockGetDb.mockReturnValue(mockDb);

    expect(() => getAllMonitorsWithLatestState()).toThrow(
      "SQLITE_ERROR: no such table: monitors",
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Mixed quality states                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/monitors — mixed quality states", () => {
  it("correctly maps all quality state variants", () => {
    const rows = [
      {
        id: 1,
        client_slug: "c1",
        client_name: "C1",
        target_host: "h1.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 5,
        last_seen_ms: Date.now(),
        quality_state: "good",
        created_at: 1700000000000,
      },
      {
        id: 2,
        client_slug: "c2",
        client_name: "C2",
        target_host: "h2.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 100,
        last_seen_ms: Date.now() - 1000,
        quality_state: "degraded",
        created_at: 1700000000000,
      },
      {
        id: 3,
        client_slug: "c3",
        client_name: "C3",
        target_host: "h3.com",
        target_name: null,
        last_status: "timeout",
        last_latency_ms: null,
        last_seen_ms: Date.now() - 2000,
        quality_state: "poor",
        created_at: 1700000000000,
      },
      {
        id: 4,
        client_slug: "c4",
        client_name: "C4",
        target_host: "h4.com",
        target_name: null,
        last_status: null,
        last_latency_ms: null,
        last_seen_ms: null,
        quality_state: "warmingUp",
        created_at: 1700000000000,
      },
    ];

    const mockDb = createMockDb(rows);
    mockGetDb.mockReturnValue(mockDb);

    const monitors = getAllMonitorsWithLatestState();

    expect(monitors[0].qualityState).toBe("warmingUp"); // legacy 'good' → warmingUp
    expect(monitors[1].qualityState).toBe("warmingUp"); // legacy 'degraded' → warmingUp
    expect(monitors[2].qualityState).toBe("warmingUp"); // legacy 'poor' → warmingUp
    expect(monitors[3].qualityState).toBe("warmingUp");
  });
});
