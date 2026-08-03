import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Database } from "better-sqlite3";
import type { MonitorListItem } from "~/shared/types";

/**
 * Unit tests for the monitors list utility.
 *
 * NOTE: We use a mock database approach (following the pattern established
 * in ping-ingest.integration.test.ts) because better-sqlite3 segfaults in
 * Vitest forked workers on Node 20.
 */

// Mock dependencies
vi.mock("../utils/db", () => ({ getDb: vi.fn() }));

import { getDb } from "../utils/db";
import { getAllMonitorsWithLatestState } from "../utils/monitors";

const mockGetDb = getDb as unknown as ReturnType<typeof vi.fn>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Create a mock DB that returns a pre-configured set of rows from the
 * monitors list query.
 */
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
/*  Empty database returns empty array                                 */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — empty database", () => {
  it("returns empty array when no monitors exist", () => {
    const mockDb = createMockDb([]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  Single monitor with sample data                                    */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — single monitor with samples", () => {
  it("returns correct shape for a monitor with success status", () => {
    const now = Date.now();
    const mockDb = createMockDb([
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
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      clientSlug: "alice-desktop-aa00bb11cc22",
      clientName: "Alice's Desktop",
      targetHost: "8.8.8.8",
      targetName: "Google DNS",
      status: "up",
      latencyMs: 14.2,
      qualityState: "good",
      lastSeenMs: now,
      createdAt: new Date(1700000000000).toISOString(),
    });
  });

  it("maps timeout status to 'down'", () => {
    const mockDb = createMockDb([
      {
        id: 2,
        client_slug: "test-client",
        client_name: "Test",
        target_host: "1.1.1.1",
        target_name: "Cloudflare",
        last_status: "timeout",
        last_latency_ms: null,
        last_seen_ms: Date.now(),
        quality_state: "poor",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result[0].status).toBe("down");
    expect(result[0].latencyMs).toBeNull();
    expect(result[0].qualityState).toBe("poor");
  });

  it("maps error status to 'down'", () => {
    const mockDb = createMockDb([
      {
        id: 3,
        client_slug: "test-client",
        client_name: "Test",
        target_host: "1.1.1.1",
        target_name: null,
        last_status: "error",
        last_latency_ms: null,
        last_seen_ms: Date.now(),
        quality_state: "degraded",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result[0].status).toBe("down");
    expect(result[0].targetName).toBe("1.1.1.1"); // Fallback to targetHost
  });
});

/* ------------------------------------------------------------------ */
/*  Monitor with no samples (null latest state)                        */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — monitor with no samples", () => {
  it("returns null for status, latencyMs, and lastSeenMs when no samples", () => {
    const mockDb = createMockDb([
      {
        id: 10,
        client_slug: "new-client",
        client_name: "New Client",
        target_host: "new.target.com",
        target_name: "New Target",
        last_status: null,
        last_latency_ms: null,
        last_seen_ms: null,
        quality_state: "warmingUp",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result).toHaveLength(1);
    expect(result[0].status).toBeNull();
    expect(result[0].latencyMs).toBeNull();
    expect(result[0].lastSeenMs).toBeNull();
    expect(result[0].qualityState).toBe("unknown"); // warmingUp → unknown
  });
});

/* ------------------------------------------------------------------ */
/*  Sort order                                                         */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — sort order", () => {
  it("sorts by lastSeenMs DESC, then id ASC for tiebreaker", () => {
    const recent = Date.now();
    const older = recent - 10000;
    const oldest = recent - 20000;

    const mockDb = createMockDb([
      // Returned in DB order: newest first, then tiebreaker by id
      {
        id: 1,
        client_slug: "client-a",
        client_name: "A",
        target_host: "a.com",
        target_name: null,
        last_status: "success",
        last_latency_ms: 10,
        last_seen_ms: recent,
        quality_state: "good",
        created_at: 1700000000000,
      },
      {
        id: 3,
        client_slug: "client-b",
        client_name: "B",
        target_host: "b.com",
        target_name: "B Target",
        last_status: "success",
        last_latency_ms: 20,
        last_seen_ms: older,
        quality_state: "degraded",
        created_at: 1700000000000,
      },
      {
        id: 5,
        client_slug: "client-c",
        client_name: "C",
        target_host: "c.com",
        target_name: null,
        last_status: "timeout",
        last_latency_ms: null,
        last_seen_ms: oldest,
        quality_state: "poor",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe(1); // Most recent
    expect(result[1].id).toBe(3); // Middle
    expect(result[2].id).toBe(5); // Oldest
  });
});

/* ------------------------------------------------------------------ */
/*  Client join                                                        */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — client join", () => {
  it("returns clientSlug and clientName from joined clients table", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "alice-desktop-aa00bb11cc22",
        client_name: "Alice's Desktop",
        target_host: "8.8.8.8",
        target_name: "Google DNS",
        last_status: "success",
        last_latency_ms: 14.2,
        last_seen_ms: Date.now(),
        quality_state: "good",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result[0].clientSlug).toBe("alice-desktop-aa00bb11cc22");
    expect(result[0].clientName).toBe("Alice's Desktop");
  });
});

/* ------------------------------------------------------------------ */
/*  targetName fallback                                                */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — targetName fallback", () => {
  it("falls back to targetHost when target_name is null", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "test",
        client_name: "Test",
        target_host: "8.8.4.4",
        target_name: null,
        last_status: "success",
        last_latency_ms: 15,
        last_seen_ms: Date.now(),
        quality_state: "unknown",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result[0].targetName).toBe("8.8.4.4");
  });

  it("uses target_name when available", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "test",
        client_name: "Test",
        target_host: "8.8.4.4",
        target_name: "Google DNS Secondary",
        last_status: "success",
        last_latency_ms: 15,
        last_seen_ms: Date.now(),
        quality_state: "good",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result[0].targetName).toBe("Google DNS Secondary");
  });
});

/* ------------------------------------------------------------------ */
/*  quality_state mapping                                              */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — quality_state mapping", () => {
  it("maps warmingUp to unknown", () => {
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

    expect(result[0].qualityState).toBe("unknown");
  });

  it("passes through good, degraded, poor", () => {
    const qualityStates = ["good", "degraded", "poor"];

    for (const qs of qualityStates) {
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
          quality_state: qs,
          created_at: 1700000000000,
        },
      ]);
      mockGetDb.mockReturnValue(mockDb);

      const result = getAllMonitorsWithLatestState();
      expect(result[0].qualityState).toBe(qs);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Response shape verification                                        */
/* ------------------------------------------------------------------ */

describe("getAllMonitorsWithLatestState — response shape", () => {
  it("matches MonitorListItem interface", () => {
    const mockDb = createMockDb([
      {
        id: 1,
        client_slug: "test",
        client_name: "Test",
        target_host: "8.8.8.8",
        target_name: "DNS",
        last_status: "success",
        last_latency_ms: 14,
        last_seen_ms: Date.now(),
        quality_state: "good",
        created_at: 1700000000000,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();
    const item = result[0] as MonitorListItem;

    // Verify all required fields are present and correctly typed
    expect(typeof item.id).toBe("number");
    expect(typeof item.clientSlug).toBe("string");
    expect(typeof item.clientName).toBe("string");
    expect(typeof item.targetHost).toBe("string");
    expect(typeof item.targetName).toBe("string");
    expect(item.status).toBe("up");
    expect(typeof item.latencyMs).toBe("number");
    expect(item.qualityState).toBe("good");
    expect(typeof item.lastSeenMs).toBe("number");
    expect(typeof item.createdAt).toBe("string");
    // Verify ISO 8601 format
    expect(item.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(item.createdAt).toMatch(/Z$/);
  });

  it("createdAt is ISO 8601 from epoch ms", () => {
    const epochMs = 1700000000000;
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
        created_at: epochMs,
      },
    ]);
    mockGetDb.mockReturnValue(mockDb);

    const result = getAllMonitorsWithLatestState();

    expect(result[0].createdAt).toBe(new Date(epochMs).toISOString());
  });
});
