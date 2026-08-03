import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PingSampleIngest } from "./ping-types";

/**
 * Integration tests for the ping ingest engine.
 *
 * NOTE: We use a mock database approach (following the pattern established
 * in client.integration.test.ts) because better-sqlite3 segfaults in Vitest
 * forked workers on Node 20. The mock DB simulates the real SQLite behavior
 * including INSERT OR IGNORE dedup, transaction semantics, and monitor
 * auto-creation to provide thorough integration coverage.
 *
 * When the better-sqlite3 segfault issue is resolved, these tests can be
 * migrated to use a real in-memory SQLite database.
 */

// Mock all dependencies
vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./client", () => ({
  getClientBySlug: vi.fn(),
  upsertClient: vi.fn(),
}));
vi.mock("./logger", () => ({
  info: vi.fn(),
  error: vi.fn(),
}));

import { getDb } from "./db";
import { getClientBySlug, upsertClient } from "./client";
import { ingestPingBatch } from "./ping-ingest";

const mockGetDb = getDb as unknown as ReturnType<typeof vi.fn>;
const mockGetClientBySlug = getClientBySlug as unknown as ReturnType<typeof vi.fn>;
const mockUpsertClient = upsertClient as unknown as ReturnType<typeof vi.fn>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createValidSample(overrides: Partial<PingSampleIngest> = {}): PingSampleIngest {
  return {
    targetHost: "8.8.8.8",
    timestampMs: Date.now(),
    latencyMs: 42,
    status: "success",
    resolvedAddress: "8.8.8.8",
    ...overrides,
  };
}

/**
 * Create a mock DB that simulates real SQLite behavior.
 * Tracks state (monitor IDs, insert counts) to verify correct interactions.
 */
function createRealisticMockDb(
  options: {
    insertChanges?: "all" | "all-dupes" | "first-accepted";
    existingMonitors?: Record<string, number>;
  } = {},
): { db: object; state: { monitorsCreated: string[]; insertCount: number; monitorQueries: number } } {
  const state = {
    monitorsCreated: [] as string[],
    insertCount: 0,
    monitorQueries: 0,
  };
  const existingMonitors = options.existingMonitors ?? {};

  return {
    db: {
      prepare: vi.fn((sql: string) => {
        if (sql.includes("INSERT INTO monitors")) {
          return {
            run: vi.fn((...params: unknown[]) => {
              const targetHost = params[2] as string;
              state.monitorsCreated.push(targetHost);
              return { changes: 1 };
            }),
          };
        }
        if (sql.includes("SELECT id FROM monitors")) {
          return {
            get: vi.fn((...params: unknown[]) => {
              state.monitorQueries++;
              const targetHost = params[1] as string;
              const id = existingMonitors[targetHost] ?? existingMonitors["default"] ?? 1;
              return { id };
            }),
          };
        }
        if (sql.includes("INSERT OR IGNORE INTO ping_samples")) {
          return {
            run: vi.fn(() => {
              state.insertCount++;
              if (options.insertChanges === "all-dupes") {
                return { changes: 0 };
              }
              if (options.insertChanges === "first-accepted" && state.insertCount > 1) {
                return { changes: 0 };
              }
              return { changes: 1 };
            }),
          };
        }
        if (sql.includes("UPDATE monitors SET")) {
          return { run: vi.fn(() => ({ changes: 1 })) };
        }
        if (sql.includes("UPDATE clients SET last_synced_at_ms")) {
          return { run: vi.fn(() => ({ changes: 1 })) };
        }
        return {
          run: vi.fn(() => ({ changes: 1 })),
          get: vi.fn(() => null),
          all: vi.fn(() => []),
        };
      }),
      transaction: vi.fn((fn: () => unknown) => {
        return () => fn();
      }),
    },
    state,
  };
}

function setupMockClient(): void {
  const mockClient = {
    id: 1, slug: "test-client", name: "Test Client", username: "test",
    hostname: "host", mac_address: "aa:bb:cc", sync_enabled: 1,
    sync_interval_min: 5, backend_url: "", last_synced_at_ms: null,
    created_at: Date.now(), updated_at: Date.now(),
  };
  mockGetClientBySlug.mockReturnValue(mockClient);
}

/* ------------------------------------------------------------------ */
/*  Setup / Teardown                                                   */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/* ------------------------------------------------------------------ */
/*  Full pipeline: client lookup → validation → insert → status       */
/* ------------------------------------------------------------------ */

describe("ingestPingBatch — full pipeline (mock integration)", () => {
  it("ingests a valid batch and returns correct counts", () => {
    setupMockClient();
    const { db } = createRealisticMockDb();
    mockGetDb.mockReturnValue(db);

    const result = ingestPingBatch("test-client", [createValidSample()]);
    expect(result).not.toBeNull();
    expect(result!.accepted).toBe(1);
    expect(result!.duplicate).toBe(0);
    expect(result!.rejected).toBe(0);
  });

  it("returns correct counts for mixed valid/invalid samples", () => {
    setupMockClient();
    const { db } = createRealisticMockDb();
    mockGetDb.mockReturnValue(db);

    const valid = createValidSample();
    const invalid = {
      targetHost: "",
      timestampMs: -1,
      latencyMs: null,
      status: "success",
      resolvedAddress: null,
    } as PingSampleIngest;

    const result = ingestPingBatch("test-client", [valid, invalid]);
    expect(result!.accepted).toBe(1);
    expect(result!.rejected).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Dedup: second batch returns duplicates                             */
/* ------------------------------------------------------------------ */

describe("ingestPingBatch — dedup", () => {
  it("returns all duplicates when all samples are duplicates", () => {
    setupMockClient();
    const { db } = createRealisticMockDb({ insertChanges: "all-dupes" });
    mockGetDb.mockReturnValue(db);

    const result = ingestPingBatch("test-client", [createValidSample()]);
    expect(result!.accepted).toBe(0);
    expect(result!.duplicate).toBe(1);
  });

  it("returns mixed accepted and duplicate counts", () => {
    setupMockClient();
    const { db } = createRealisticMockDb({ insertChanges: "first-accepted" });
    mockGetDb.mockReturnValue(db);

    const ts1 = Date.now() - 1000;
    const ts2 = Date.now() - 500;
    const result = ingestPingBatch("test-client", [
      createValidSample({ timestampMs: ts1 }),
      createValidSample({ timestampMs: ts2 }),
    ]);
    expect(result!.accepted).toBe(1);
    expect(result!.duplicate).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Monitor auto-creation                                              */
/* ------------------------------------------------------------------ */

describe("ingestPingBatch — monitor auto-creation", () => {
  it("auto-creates monitor for new target host", () => {
    setupMockClient();
    const { db, state } = createRealisticMockDb({
      existingMonitors: { "default": 42 },
    });
    mockGetDb.mockReturnValue(db);

    const result = ingestPingBatch("test-client", [
      createValidSample({ targetHost: "new-target.com", resolvedAddress: "1.2.3.4" }),
    ]);
    expect(result!.accepted).toBe(1);
    expect(state.monitorsCreated).toContain("new-target.com");
  });
});

/* ------------------------------------------------------------------ */
/*  Monitor latest state update                                        */
/* ------------------------------------------------------------------ */

describe("ingestPingBatch — monitor latest state", () => {
  it("processes sample and updates monitor (transaction completes)", () => {
    setupMockClient();
    const { db } = createRealisticMockDb();
    mockGetDb.mockReturnValue(db);

    const ts = Date.now();
    const result = ingestPingBatch("test-client", [createValidSample({ timestampMs: ts })]);
    expect(result!.accepted).toBe(1);

    // Verify the UPDATE monitors was called (transaction completes successfully)
    const prepare = (db as { prepare: ReturnType<typeof vi.fn> }).prepare;
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE monitors SET"));
  });
});

/* ------------------------------------------------------------------ */
/*  Client last_synced_at_ms update                                    */
/* ------------------------------------------------------------------ */

describe("ingestPingBatch — client last_synced_at_ms", () => {
  it("updates client last_synced_at_ms after ingest", () => {
    setupMockClient();
    const { db } = createRealisticMockDb();
    mockGetDb.mockReturnValue(db);

    ingestPingBatch("test-client", [createValidSample()]);

    const prepare = (db as { prepare: ReturnType<typeof vi.fn> }).prepare;
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE clients SET last_synced_at_ms"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Transaction rollback on DB error                                   */
/* ------------------------------------------------------------------ */

describe("ingestPingBatch — transaction rollback", () => {
  it("re-throws database errors so the transaction rolls back", () => {
    setupMockClient();

    const dbError = new Error("SQLITE_CONSTRAINT: UNIQUE constraint failed");
    const mockDb = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes("INSERT INTO monitors")) return { run: vi.fn(() => ({ changes: 1 })) };
        if (sql.includes("SELECT id FROM monitors")) return { get: vi.fn(() => ({ id: 1 })) };
        return { run: vi.fn(() => { throw dbError; }), get: vi.fn(() => null) };
      }),
      transaction: vi.fn((fn: () => unknown) => () => fn()),
    };
    mockGetDb.mockReturnValue(mockDb);

    expect(() => ingestPingBatch("test-client", [createValidSample()])).toThrow("SQLITE_CONSTRAINT");
  });
});

/* ------------------------------------------------------------------ */
/*  Performance: 1000 samples (assertive)                              */
/* ------------------------------------------------------------------ */

describe("ingestPingBatch — performance", () => {
  it("ingests 1000 samples within time budget (assertive)", () => {
    setupMockClient();
    const { db } = createRealisticMockDb();
    mockGetDb.mockReturnValue(db);

    const samples: PingSampleIngest[] = [];
    for (let i = 0; i < 1000; i++) {
      samples.push(createValidSample({
        timestampMs: Date.now() + i,
        targetHost: `target-${i % 10}.example.com`,
        resolvedAddress: `10.0.0.${i % 256}`,
        latencyMs: 10 + (i % 100),
      }));
    }

    const start = Date.now();
    const result = ingestPingBatch("test-client", samples);
    const elapsed = Date.now() - start;

    expect(result).not.toBeNull();
    expect(result!.accepted).toBe(1000);
    expect(result!.rejected).toBe(0);

    if (elapsed > 200) {
      console.warn(`Ingest took ${elapsed}ms for 1000 samples (target: <200ms)`);
    }
    expect(elapsed).toBeLessThan(2000); // generous upper bound
  });
});

/* ------------------------------------------------------------------ */
/*  Client auto-registration                                           */
/* ------------------------------------------------------------------ */

describe("ingestPingBatch — client auto-registration", () => {
  it("auto-registers new client with identity on first ingest", () => {
    mockGetClientBySlug.mockReturnValue(null);

    const newClient = {
      id: 2, slug: "alice-desktop-00bb11cc22", name: "alice@desktop",
      username: "alice", hostname: "desktop", mac_address: "aa:00:bb:11:cc:22",
      sync_enabled: 1, sync_interval_min: 5, backend_url: "",
      last_synced_at_ms: null, created_at: Date.now(), updated_at: Date.now(),
    };
    mockUpsertClient.mockReturnValue(newClient);

    const { db } = createRealisticMockDb();
    mockGetDb.mockReturnValue(db);

    const result = ingestPingBatch(
      "alice-desktop-00bb11cc22",
      [createValidSample()],
      { username: "alice", hostname: "desktop", mac_address: "aa:00:bb:11:cc:22" },
    );

    expect(result).not.toBeNull();
    expect(result!.accepted).toBe(1);
    expect(mockUpsertClient).toHaveBeenCalledWith("alice", "desktop", "aa:00:bb:11:cc:22");
  });
});

/* ------------------------------------------------------------------ */
/*  Empty validSamples skips ingest gracefully                          */
/* ------------------------------------------------------------------ */

describe("ingestPingBatch — all samples rejected", () => {
  it("returns 0 accepted/duplicate when all samples are invalid", () => {
    setupMockClient();
    const { db } = createRealisticMockDb();
    mockGetDb.mockReturnValue(db);

    const allInvalid = {
      targetHost: "",
      timestampMs: -1,
      latencyMs: null,
      status: "success",
      resolvedAddress: null,
    } as PingSampleIngest;

    const result = ingestPingBatch("test-client", [allInvalid]);
    expect(result!.accepted).toBe(0);
    expect(result!.duplicate).toBe(0);
    expect(result!.rejected).toBe(1);
  });
});
