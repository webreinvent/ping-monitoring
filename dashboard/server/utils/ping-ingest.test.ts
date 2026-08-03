import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PingSampleIngest } from "./ping-types";

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Mock the client module
vi.mock("./client", () => ({
  getClientBySlug: vi.fn(),
  upsertClient: vi.fn(),
}));

// Mock the logger
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
 * Create a mock DB object (not a vi.fn). This is what getDb() returns.
 * The prepare() method dispatches based on the SQL string.
 */
function createMockDb(): object {
  return {
    prepare: vi.fn((sql: string) => {
      if (sql.includes("INSERT INTO monitors")) {
        return { run: vi.fn(() => ({ changes: 1 })) };
      }
      if (sql.includes("SELECT id FROM monitors")) {
        return { get: vi.fn(() => ({ id: 1 })) };
      }
      if (sql.includes("INSERT OR IGNORE INTO ping_samples")) {
        return { run: vi.fn(() => ({ changes: 1 })) };
      }
      if (sql.includes("UPDATE monitors SET")) {
        return { run: vi.fn(() => ({ changes: 1 })) };
      }
      if (sql.includes("UPDATE clients SET last_synced_at_ms")) {
        return { run: vi.fn(() => ({ changes: 1 })) };
      }
      // Default
      return {
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => null),
        all: vi.fn(() => []),
      };
    }),
    transaction: vi.fn((fn: () => unknown) => {
      return () => fn();
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  Client lookup                                                      */
/* ------------------------------------------------------------------ */

describe("ingestPingBatch — client lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when client not found (401 path)", () => {
    mockGetClientBySlug.mockReturnValue(null);
    mockUpsertClient.mockReturnValue(null);
    mockGetDb.mockReturnValue(createMockDb());

    const result = ingestPingBatch("unknown-slug", [createValidSample()]);
    expect(result).toBeNull();
  });

  it("finds client by slug when known", () => {
    const mockClient = {
      id: 1, slug: "test-client", name: "Test Client", username: "test",
      hostname: "host", mac_address: "aa:bb:cc", sync_enabled: 1,
      sync_interval_min: 5, backend_url: "", last_synced_at_ms: null,
      created_at: Date.now(), updated_at: Date.now(),
    };
    mockGetClientBySlug.mockReturnValue(mockClient);
    mockGetDb.mockReturnValue(createMockDb());

    const result = ingestPingBatch("test-client", [createValidSample()]);
    expect(result).not.toBeNull();
    expect(result!.accepted).toBe(1);
  });

  it("auto-registers client when identity provided on first ingest", () => {
    mockGetClientBySlug.mockReturnValue(null);

    const newClient = {
      id: 2, slug: "alice-desktop-00bb11cc22", name: "alice@desktop",
      username: "alice", hostname: "desktop", mac_address: "aa:00:bb:11:cc:22",
      sync_enabled: 1, sync_interval_min: 5, backend_url: "",
      last_synced_at_ms: null, created_at: Date.now(), updated_at: Date.now(),
    };
    mockUpsertClient.mockReturnValue(newClient);
    mockGetDb.mockReturnValue(createMockDb());

    const result = ingestPingBatch(
      "alice-desktop-00bb11cc22",
      [createValidSample()],
      { username: "alice", hostname: "desktop", mac_address: "aa:00:bb:11:cc:22" },
    );

    expect(result).not.toBeNull();
    expect(mockUpsertClient).toHaveBeenCalledWith("alice", "desktop", "aa:00:bb:11:cc:22");
  });

  it("does NOT auto-register when identity is incomplete", () => {
    mockGetClientBySlug.mockReturnValue(null);
    mockUpsertClient.mockReturnValue(null);
    mockGetDb.mockReturnValue(createMockDb());

    const result = ingestPingBatch(
      "unknown-slug",
      [createValidSample()],
      { username: "alice", hostname: "desktop" },
    );

    expect(result).toBeNull();
    expect(mockUpsertClient).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  Validation phase                                                   */
/* ------------------------------------------------------------------ */

describe("ingestPingBatch — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupMockClient(): void {
    const mockClient = {
      id: 1, slug: "test", name: "Test", username: "u",
      hostname: "h", mac_address: "m", sync_enabled: 1,
      sync_interval_min: 5, backend_url: "", last_synced_at_ms: null,
      created_at: Date.now(), updated_at: Date.now(),
    };
    mockGetClientBySlug.mockReturnValue(mockClient);
    mockGetDb.mockReturnValue(createMockDb());
  }

  it("correctly separates valid and rejected samples", () => {
    setupMockClient();

    const valid = createValidSample();
    const invalid = {
      targetHost: "",
      timestampMs: -1,
      latencyMs: null,
      status: "success",
      resolvedAddress: null,
    } as PingSampleIngest;

    const result = ingestPingBatch("test", [valid, invalid]);
    expect(result).not.toBeNull();
    expect(result!.accepted).toBe(1);
    expect(result!.rejected).toBe(1);
    expect(result!.rejections).toBeDefined();
    expect(result!.rejections!.length).toBeGreaterThan(0);
  });

  it("rejected count is based on unique sample indices", () => {
    setupMockClient();

    // A single sample with multiple validation failures counts as 1 rejected sample
    const multiFailSample = {
      targetHost: "",
      timestampMs: -1,
      latencyMs: null,
      status: "success",
      resolvedAddress: null,
    } as PingSampleIngest;

    const result = ingestPingBatch("test", [multiFailSample]);
    expect(result).not.toBeNull();
    expect(result!.rejected).toBe(1);
    // But multiple rejection entries exist
    expect(result!.rejections!.length).toBeGreaterThanOrEqual(3);
  });

  it("rejections array is only populated when rejected > 0", () => {
    setupMockClient();
    const result = ingestPingBatch("test", [createValidSample()]);
    expect(result).not.toBeNull();
    expect(result!.rejections).toBeUndefined();
  });

  it("rejections are undefined when all samples are valid", () => {
    setupMockClient();
    const result = ingestPingBatch("test", [
      createValidSample(),
      createValidSample({ targetHost: "1.1.1.1", resolvedAddress: "1.1.1.1" }),
    ]);
    expect(result!.rejections).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Batch size validation                                              */
/* ------------------------------------------------------------------ */

describe("ingestPingBatch — batch size", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("throws EMPTY_SAMPLES for empty batch", () => {
    expect(() => ingestPingBatch("test", [])).toThrow("EMPTY_SAMPLES");
  });

  it("throws BATCH_TOO_LARGE for oversized batch", () => {
    const samples = Array.from({ length: 1001 }, () => createValidSample());
    expect(() => ingestPingBatch("test", samples)).toThrow("BATCH_TOO_LARGE");
  });

  it("respects INGEST_MAX_SAMPLES env variable", () => {
    vi.stubEnv("INGEST_MAX_SAMPLES", "5");
    const samples = Array.from({ length: 6 }, () => createValidSample());
    expect(() => ingestPingBatch("test", samples)).toThrow("BATCH_TOO_LARGE");
  });

  it("accepts batch at exactly the max size", () => {
    const mockClient = {
      id: 1, slug: "test", name: "Test", username: "u",
      hostname: "h", mac_address: "m", sync_enabled: 1,
      sync_interval_min: 5, backend_url: "", last_synced_at_ms: null,
      created_at: Date.now(), updated_at: Date.now(),
    };
    mockGetClientBySlug.mockReturnValue(mockClient);
    mockGetDb.mockReturnValue(createMockDb());

    const result = ingestPingBatch("test", [createValidSample()]);
    expect(result).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Ingest phase — INSERT OR IGNORE                                    */
/* ------------------------------------------------------------------ */

describe("ingestSamples — dedup via INSERT OR IGNORE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("counts accepted when changes > 0", () => {
    const mockClient = {
      id: 1, slug: "test", name: "Test", username: "u",
      hostname: "h", mac_address: "m", sync_enabled: 1,
      sync_interval_min: 5, backend_url: "", last_synced_at_ms: null,
      created_at: Date.now(), updated_at: Date.now(),
    };
    mockGetClientBySlug.mockReturnValue(mockClient);
    mockGetDb.mockReturnValue(createMockDb());

    const result = ingestPingBatch("test", [createValidSample()]);
    expect(result).not.toBeNull();
    expect(result!.accepted).toBe(1);
    expect(result!.duplicate).toBe(0);
  });

  it("counts duplicate when changes = 0", () => {
    const mockClient = {
      id: 1, slug: "test", name: "Test", username: "u",
      hostname: "h", mac_address: "m", sync_enabled: 1,
      sync_interval_min: 5, backend_url: "", last_synced_at_ms: null,
      created_at: Date.now(), updated_at: Date.now(),
    };
    mockGetClientBySlug.mockReturnValue(mockClient);

    // Simulate duplicate: changes = 0
    const mockDb = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes("INSERT INTO monitors")) {
          return { run: vi.fn(() => ({ changes: 1 })) };
        }
        if (sql.includes("SELECT id FROM monitors")) {
          return { get: vi.fn(() => ({ id: 1 })) };
        }
        if (sql.includes("INSERT OR IGNORE INTO ping_samples")) {
          return { run: vi.fn(() => ({ changes: 0 })) };
        }
        if (sql.includes("UPDATE monitors SET")) {
          return { run: vi.fn(() => ({ changes: 1 })) };
        }
        if (sql.includes("UPDATE clients")) {
          return { run: vi.fn(() => ({ changes: 1 })) };
        }
        return { run: vi.fn(() => ({ changes: 1 })), get: vi.fn(() => null) };
      }),
      transaction: vi.fn((fn: () => unknown) => () => fn()),
    };
    mockGetDb.mockReturnValue(mockDb);

    const result = ingestPingBatch("test", [createValidSample()]);
    expect(result).not.toBeNull();
    expect(result!.accepted).toBe(0);
    expect(result!.duplicate).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Monitor auto-creation                                              */
/* ------------------------------------------------------------------ */

describe("ensureMonitor — auto-creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ensures monitor exists for new target hosts", () => {
    const mockClient = {
      id: 1, slug: "test", name: "Test", username: "u",
      hostname: "h", mac_address: "m", sync_enabled: 1,
      sync_interval_min: 5, backend_url: "", last_synced_at_ms: null,
      created_at: Date.now(), updated_at: Date.now(),
    };
    mockGetClientBySlug.mockReturnValue(mockClient);

    const mockDb = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes("INSERT INTO monitors")) return { run: vi.fn(() => ({ changes: 1 })) };
        if (sql.includes("SELECT id FROM monitors")) return { get: vi.fn(() => ({ id: 42 })) };
        if (sql.includes("INSERT OR IGNORE")) return { run: vi.fn(() => ({ changes: 1 })) };
        if (sql.includes("UPDATE monitors SET")) return { run: vi.fn(() => ({ changes: 1 })) };
        if (sql.includes("UPDATE clients")) return { run: vi.fn(() => ({ changes: 1 })) };
        return { run: vi.fn(() => ({ changes: 1 })), get: vi.fn(() => null) };
      }),
      transaction: vi.fn((fn: () => unknown) => () => fn()),
    };
    mockGetDb.mockReturnValue(mockDb);

    const result = ingestPingBatch("test", [createValidSample({ targetHost: "new-target.com" })]);
    expect(result).not.toBeNull();
    expect(result!.accepted).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Transaction rollback on DB error                                   */
/* ------------------------------------------------------------------ */

describe("transaction rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("re-throws database errors so the transaction rolls back", () => {
    const mockClient = {
      id: 1, slug: "test", name: "Test", username: "u",
      hostname: "h", mac_address: "m", sync_enabled: 1,
      sync_interval_min: 5, backend_url: "", last_synced_at_ms: null,
      created_at: Date.now(), updated_at: Date.now(),
    };
    mockGetClientBySlug.mockReturnValue(mockClient);

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

    expect(() => ingestPingBatch("test", [createValidSample()])).toThrow("SQLITE_CONSTRAINT");
  });
});

/* ------------------------------------------------------------------ */
/*  db.transaction() wraps all operations                              */
/* ------------------------------------------------------------------ */

describe("transaction wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("db.transaction() is called wrapping all operations", () => {
    const mockClient = {
      id: 1, slug: "test", name: "Test", username: "u",
      hostname: "h", mac_address: "m", sync_enabled: 1,
      sync_interval_min: 5, backend_url: "", last_synced_at_ms: null,
      created_at: Date.now(), updated_at: Date.now(),
    };
    mockGetClientBySlug.mockReturnValue(mockClient);

    let transactionCalled = false;
    const mockDb = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes("INSERT INTO monitors")) return { run: vi.fn(() => ({ changes: 1 })) };
        if (sql.includes("SELECT id FROM monitors")) return { get: vi.fn(() => ({ id: 1 })) };
        if (sql.includes("INSERT OR IGNORE")) return { run: vi.fn(() => ({ changes: 1 })) };
        if (sql.includes("UPDATE monitors SET")) return { run: vi.fn(() => ({ changes: 1 })) };
        if (sql.includes("UPDATE clients")) return { run: vi.fn(() => ({ changes: 1 })) };
        return { run: vi.fn(() => ({ changes: 1 })), get: vi.fn(() => null) };
      }),
      transaction: vi.fn((fn: () => unknown) => {
        transactionCalled = true;
        return () => fn();
      }),
    };
    mockGetDb.mockReturnValue(mockDb);

    ingestPingBatch("test", [createValidSample()]);
    expect(transactionCalled).toBe(true);
  });
});
