import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  client.ts — integration-style tests with mock DB                   */
/* ------------------------------------------------------------------ */
/*  These test the behavior of getClientBySlug, updateClientName,       */
/*  and upsertClient through their interaction with the database.       */
/*  We mock getDb() to return a controlled mock database.              */
/* ------------------------------------------------------------------ */

// We mock the db module to avoid the better-sqlite3 native module
// which segfaults in Vitest forked workers on Node 20.
vi.mock("../utils/db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "../utils/db";
import { getClientBySlug, updateClientName, upsertClient, generateSlug, toClientResponse } from "./client";

const mockGetDb = getDb as unknown as ReturnType<typeof vi.fn>;

function createMockDb(
  selectResult: Record<string, unknown> | null = null,
  updateChanges = 1,
) {
  return {
    prepare: vi.fn((sql: string) => {
      if (sql.includes("SELECT * FROM clients WHERE slug = ?")) {
        return {
          get: vi.fn(() => selectResult),
        };
      }
      if (sql.includes("UPDATE clients SET name")) {
        return {
          run: vi.fn(() => ({ changes: updateChanges })),
        };
      }
      // INSERT ... ON CONFLICT — upsert
      if (sql.includes("INSERT INTO clients")) {
        return {
          run: vi.fn(),
        };
      }
      return {
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => null),
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  getClientBySlug — integration with mock DB                         */
/* ------------------------------------------------------------------ */

describe("getClientBySlug — integration with mock DB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when client does not exist", () => {
    mockGetDb.mockReturnValue(createMockDb(null));

    const row = getClientBySlug("nonexistent-slug");
    expect(row).toBeNull();
  });

  it("returns client row when found", () => {
    const expectedRow = {
      id: 1,
      slug: "alice-desktop-00bb11cc22",
      name: "alice@desktop",
      username: "alice",
      hostname: "desktop",
      mac_address: "aa:00:bb:11:cc:22",
      sync_enabled: 1,
      sync_interval_min: 5,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: 1751472000000,
      updated_at: 1751472000000,
    };

    mockGetDb.mockReturnValue(createMockDb(expectedRow));

    const row = getClientBySlug("alice-desktop-00bb11cc22");
    expect(row).toEqual(expectedRow);
  });

  it("calls getDb() to obtain the database instance", () => {
    mockGetDb.mockReturnValue(createMockDb(null));

    getClientBySlug("test-slug");
    expect(mockGetDb).toHaveBeenCalledTimes(1);
  });

  it("passes the slug as the query parameter", () => {
    const mockPrepare = vi.fn((sql: string) => ({
      get: vi.fn((slug: string) => {
        expect(slug).toBe("test-slug-123");
        return null;
      }),
    }));

    mockGetDb.mockReturnValue({ prepare: mockPrepare });

    getClientBySlug("test-slug-123");
    expect(mockPrepare).toHaveBeenCalledWith("SELECT * FROM clients WHERE slug = ?");
  });

  it("preserves all row fields in the returned object", () => {
    const expectedRow = {
      id: 42,
      slug: "test-host-1122",
      name: "Test Client",
      username: "test",
      hostname: "host",
      mac_address: "11:22",
      sync_enabled: 0,
      sync_interval_min: 10,
      backend_url: "http://example.com",
      last_synced_at_ms: 1700000000000,
      created_at: 1700000000000,
      updated_at: 1700000000000,
    };

    mockGetDb.mockReturnValue(createMockDb(expectedRow));

    const row = getClientBySlug("test-host-1122");
    expect(row).not.toBeNull();
    expect(row!.id).toBe(42);
    expect(row!.name).toBe("Test Client");
    expect(row!.mac_address).toBe("11:22");
  });
});

/* ------------------------------------------------------------------ */
/*  updateClientName — integration with mock DB                        */
/* ------------------------------------------------------------------ */

describe("updateClientName — integration with mock DB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when client does not exist (0 changes)", () => {
    // UPDATE returns 0 changes → function returns null
    const mockPrepare = vi.fn((sql: string) => {
      if (sql.includes("UPDATE clients SET name")) {
        return {
          run: vi.fn(() => ({ changes: 0 })),
        };
      }
      return {
        get: vi.fn(() => null),
        run: vi.fn(() => ({ changes: 1 })),
      };
    });

    mockGetDb.mockReturnValue({ prepare: mockPrepare });

    const row = updateClientName("nonexistent", "New Name");
    expect(row).toBeNull();
  });

  it("returns updated client row when update succeeds", () => {
    const updatedRow = {
      id: 1,
      slug: "alice-desktop-00bb11cc22",
      name: "Alice's Workstation",
      username: "alice",
      hostname: "desktop",
      mac_address: "aa:00:bb:11:cc:22",
      sync_enabled: 1,
      sync_interval_min: 5,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: 1751472000000,
      updated_at: 1751472000000,
    };

    // Mock: UPDATE returns 1 change, then SELECT returns the row
    const callCount = { prepare: 0 };
    const mockPrepare = vi.fn((sql: string) => {
      callCount.prepare++;
      if (sql.includes("UPDATE clients SET name")) {
        return {
          run: vi.fn(() => ({ changes: 1 })),
        };
      }
      // SELECT * FROM clients WHERE slug = ?
      return {
        get: vi.fn(() => updatedRow),
      };
    });

    mockGetDb.mockReturnValue({ prepare: mockPrepare });

    const row = updateClientName("alice-desktop-00bb11cc22", "Alice's Workstation");
    expect(row).toEqual(updatedRow);
    expect(row!.name).toBe("Alice's Workstation");
  });

  it("calls UPDATE with correct parameters", () => {
    let capturedParams: unknown[] | null = null;

    const mockPrepare = vi.fn((sql: string) => {
      if (sql.includes("UPDATE clients SET name")) {
        return {
          run: vi.fn((...params: unknown[]) => {
            capturedParams = params;
            return { changes: 1 };
          }),
        };
      }
      return {
        get: vi.fn(() => ({
          id: 1,
          slug: "test",
          name: "New Name",
          username: "u",
          hostname: "h",
          mac_address: "m",
          sync_enabled: 0,
          sync_interval_min: 5,
          backend_url: "",
          last_synced_at_ms: null,
          created_at: 0,
          updated_at: 0,
        })),
      };
    });

    mockGetDb.mockReturnValue({ prepare: mockPrepare });

    updateClientName("test-slug", "New Name");

    expect(capturedParams).not.toBeNull();
    expect(capturedParams![0]).toBe("New Name");
    expect(typeof capturedParams![1]).toBe("number");
    expect(capturedParams![2]).toBe("test-slug");
  });

  it("updates the updated_at timestamp", () => {
    let capturedTimestamp: number | null = null;

    const mockPrepare = vi.fn((sql: string) => {
      if (sql.includes("UPDATE clients SET name")) {
        return {
          run: vi.fn((...params: unknown[]) => {
            capturedTimestamp = params[1] as number;
            return { changes: 1 };
          }),
        };
      }
      return {
        get: vi.fn(() => null),
      };
    });

    mockGetDb.mockReturnValue({ prepare: mockPrepare });

    const before = Date.now();
    updateClientName("test", "New");
    const after = Date.now();

    expect(capturedTimestamp).not.toBeNull();
    expect(capturedTimestamp!).toBeGreaterThanOrEqual(before);
    expect(capturedTimestamp!).toBeLessThanOrEqual(after);
  });
});

/* ------------------------------------------------------------------ */
/*  upsertClient — integration with mock DB                            */
/* ------------------------------------------------------------------ */

describe("upsertClient — integration with mock DB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserts new client with correct slug and default name", () => {
    const createdRow = {
      id: 1,
      slug: "alice-desktop-00bb11cc22",
      name: "alice@desktop",
      username: "alice",
      hostname: "desktop",
      mac_address: "aa:00:bb:11:cc:22",
      sync_enabled: 0,
      sync_interval_min: 0,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    let capturedInsertParams: unknown[] | null = null;

    const mockPrepare = vi.fn((sql: string) => {
      if (sql.includes("INSERT INTO clients")) {
        return {
          run: vi.fn((...params: unknown[]) => {
            capturedInsertParams = params;
            return { changes: 1 };
          }),
        };
      }
      return {
        get: vi.fn(() => createdRow),
      };
    });

    mockGetDb.mockReturnValue({ prepare: mockPrepare });

    const row = upsertClient("alice", "desktop", "aa:00:bb:11:cc:22");
    expect(row).toEqual(createdRow);

    // Verify the INSERT was called with correct parameters
    expect(capturedInsertParams).not.toBeNull();
    expect(capturedInsertParams![0]).toBe("alice-desktop-00bb11cc22"); // slug
    expect(capturedInsertParams![1]).toBe("alice@desktop"); // name
    expect(capturedInsertParams![2]).toBe("alice"); // username
    expect(capturedInsertParams![3]).toBe("desktop"); // hostname
    expect(capturedInsertParams![4]).toBe("aa:00:bb:11:cc:22"); // mac
  });

  it("trims whitespace from inputs before generating slug", () => {
    let capturedSlug = "";

    const mockPrepare = vi.fn((sql: string) => {
      if (sql.includes("INSERT INTO clients")) {
        return {
          run: vi.fn((...params: unknown[]) => {
            capturedSlug = params[0] as string;
            return { changes: 1 };
          }),
        };
      }
      return {
        get: vi.fn(() => ({
          id: 1,
          slug: capturedSlug,
          name: "alice@desktop",
          username: "alice",
          hostname: "desktop",
          mac_address: "aa:00:bb:11:cc:22",
          sync_enabled: 0,
          sync_interval_min: 0,
          backend_url: "",
          last_synced_at_ms: null,
          created_at: 0,
          updated_at: 0,
        })),
      };
    });

    mockGetDb.mockReturnValue({ prepare: mockPrepare });

    upsertClient(" alice ", " desktop ", " aa:00:bb:11:cc:22 ");

    // The slug should NOT have extra hyphens from whitespace
    expect(capturedSlug).toBe("alice-desktop-00bb11cc22");
  });

  it("calls getDb() to obtain the database instance", () => {
    const mockPrepare = vi.fn((sql: string) => {
      if (sql.includes("INSERT INTO clients")) {
        return { run: vi.fn(() => ({ changes: 1 })) };
      }
      return { get: vi.fn(() => null) };
    });

    mockGetDb.mockReturnValue({ prepare: mockPrepare });

    upsertClient("user", "host", "aa:bb:cc");

    // upsertClient calls getDb() twice: once for INSERT, once for getClientBySlug
    expect(mockGetDb).toHaveBeenCalledTimes(2);
  });
});
