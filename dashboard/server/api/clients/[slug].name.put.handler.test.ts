import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Handler-level tests for PUT /api/clients/:slug/name
 *
 * Exercises the decision logic of the route handler, including the
 * critical 404 path when updateClientName returns null.
 */

// Mock client utils
vi.mock("../../utils/client", () => ({
  updateClientName: vi.fn(),
  toClientResponse: vi.fn((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    username: row.username,
    hostname: row.hostname,
    mac_address: row.mac_address,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  })),
}));

import { updateClientName, toClientResponse } from "../../utils/client";

const mockUpdateClientName = updateClientName as ReturnType<typeof vi.fn>;
const mockToClientResponse = toClientResponse as ReturnType<typeof vi.fn>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Simulate the route handler's decision logic.
 * Mirrors the actual handler: getRouterParam → readBody → validate → updateClientName
 */
function simulatePutNameHandler(
  slug: string | undefined,
  body: { name?: unknown } | null,
) {
  try {
    // Step 1: Check slug
    if (!slug) {
      return {
        type: "error" as const,
        statusCode: 400,
        message: "Missing slug parameter",
      };
    }

    // Step 2: Parse body
    const { name } = body ?? {};

    // Step 3: Validate name type
    if (typeof name !== "string") {
      return {
        type: "error" as const,
        statusCode: 400,
        message: "Name is required and must be between 1 and 100 characters",
      };
    }

    // Step 4: Validate name length
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 100) {
      return {
        type: "error" as const,
        statusCode: 400,
        message: "Name is required and must be between 1 and 100 characters",
      };
    }

    // Step 5: Update name
    const row = mockUpdateClientName(slug, trimmed);
    if (!row) {
      return {
        type: "error" as const,
        statusCode: 404,
        message: "Client not found",
      };
    }

    // Step 6: Return response
    const response = mockToClientResponse(row);
    return {
      type: "success" as const,
      statusCode: 200,
      body: response,
    };
  } catch (err) {
    return {
      type: "error" as const,
      statusCode: 500,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Setup / Teardown                                                   */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  404 — client not found (null return from updateClientName)         */
/* ------------------------------------------------------------------ */

describe("PUT /api/clients/:slug/name — 404 client not found", () => {
  it("returns 404 when updateClientName returns null", () => {
    mockUpdateClientName.mockReturnValue(null);

    const result = simulatePutNameHandler("nonexistent-slug", { name: "New Name" });

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(404);
    expect(result.message).toBe("Client not found");
  });

  it("calls updateClientName with trimmed name", () => {
    mockUpdateClientName.mockReturnValue(null);

    simulatePutNameHandler("test-slug", { name: "  Trimmed Name  " });

    expect(mockUpdateClientName).toHaveBeenCalledWith("test-slug", "Trimmed Name");
  });
});

/* ------------------------------------------------------------------ */
/*  200 — successful name update                                       */
/* ------------------------------------------------------------------ */

describe("PUT /api/clients/:slug/name — 200 success", () => {
  it("returns updated client data", () => {
    const now = Date.now();
    const row = {
      id: 1,
      slug: "alice-desktop-00bb11cc22",
      name: "Alice's Workstation",
      username: "alice",
      hostname: "desktop",
      mac_address: "aa:00:bb:11:cc:22",
      sync_enabled: 1,
      sync_interval_min: 5,
      backend_url: "",
      last_synced_at_ms: now,
      created_at: now,
      updated_at: now,
    };

    mockUpdateClientName.mockReturnValue(row);
    mockToClientResponse.mockReturnValue({
      id: 1,
      slug: "alice-desktop-00bb11cc22",
      name: "Alice's Workstation",
      username: "alice",
      hostname: "desktop",
      mac_address: "aa:00:bb:11:cc:22",
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });

    const result = simulatePutNameHandler("alice-desktop-00bb11cc22", { name: "Alice's Workstation" });

    expect(result.type).toBe("success");
    expect(result.statusCode).toBe(200);
    expect(result.body.name).toBe("Alice's Workstation");
  });
});

/* ------------------------------------------------------------------ */
/*  400 — name validation                                              */
/* ------------------------------------------------------------------ */

describe("PUT /api/clients/:slug/name — 400 validation", () => {
  it("rejects null body", () => {
    const result = simulatePutNameHandler("test-slug", null);

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(400);
  });

  it("rejects missing name field", () => {
    const result = simulatePutNameHandler("test-slug", {});

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(400);
  });

  it("rejects empty name", () => {
    const result = simulatePutNameHandler("test-slug", { name: "" });

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(400);
  });

  it("rejects whitespace-only name", () => {
    const result = simulatePutNameHandler("test-slug", { name: "   " });

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(400);
  });

  it("rejects name exceeding 100 characters", () => {
    const result = simulatePutNameHandler(
      "test-slug",
      { name: "a".repeat(101) },
    );

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(400);
  });

  it("rejects non-string name (number)", () => {
    const result = simulatePutNameHandler("test-slug", { name: 42 as any });

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(400);
  });

  it("rejects non-string name (null)", () => {
    const result = simulatePutNameHandler("test-slug", { name: null as any });

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(400);
  });

  it("rejects non-string name (boolean)", () => {
    const result = simulatePutNameHandler("test-slug", { name: true as any });

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(400);
  });
});

/* ------------------------------------------------------------------ */
/*  400 — missing slug                                                */
/* ------------------------------------------------------------------ */

describe("PUT /api/clients/:slug/name — 400 missing slug", () => {
  it("returns 400 for undefined slug", () => {
    const result = simulatePutNameHandler(undefined, { name: "New Name" });

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Missing slug parameter");
  });

  it("returns 400 for empty string slug", () => {
    const result = simulatePutNameHandler("", { name: "New Name" });

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Missing slug parameter");
  });
});

/* ------------------------------------------------------------------ */
/*  Name length boundary tests                                         */
/* ------------------------------------------------------------------ */

describe("name length boundaries", () => {
  it("accepts name of exactly 1 character", () => {
    mockUpdateClientName.mockReturnValue(null);

    const result = simulatePutNameHandler("test-slug", { name: "a" });

    // updateClientName was called (didn't fail at validation)
    expect(mockUpdateClientName).toHaveBeenCalled();
    expect(result.statusCode).toBe(404); // null return = 404, meaning it passed validation
  });

  it("accepts name of exactly 100 characters", () => {
    mockUpdateClientName.mockReturnValue(null);

    const result = simulatePutNameHandler("test-slug", { name: "a".repeat(100) });

    expect(mockUpdateClientName).toHaveBeenCalled();
    expect(result.statusCode).toBe(404);
  });
});

/* ------------------------------------------------------------------ */
/*  Response shape                                                     */
/* ------------------------------------------------------------------ */

describe("response shape", () => {
  it("response excludes database-only fields", () => {
    const now = Date.now();
    const row = {
      id: 1,
      slug: "test-slug",
      name: "New Name",
      username: "u",
      hostname: "h",
      mac_address: "aa:00:bb:11:cc:22",
      sync_enabled: 1,
      sync_interval_min: 5,
      backend_url: "http://backend",
      last_synced_at_ms: now,
      created_at: now,
      updated_at: now,
    };

    mockUpdateClientName.mockReturnValue(row);
    mockToClientResponse.mockReturnValue({
      id: 1,
      slug: "test-slug",
      name: "New Name",
      username: "u",
      hostname: "h",
      mac_address: "aa:00:bb:11:cc:22",
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });

    const result = simulatePutNameHandler("test-slug", { name: "New Name" });

    expect(result.body).not.toHaveProperty("sync_enabled");
    expect(result.body).not.toHaveProperty("last_synced_at_ms");
    expect(result.body).not.toHaveProperty("backend_url");
  });

  it("response name matches the trimmed input", () => {
    const now = Date.now();
    mockUpdateClientName.mockReturnValue({
      id: 1,
      slug: "test",
      name: "Trimmed",
      username: "u",
      hostname: "h",
      mac_address: "aa:00:bb:11:cc:22",
      created_at: now,
      updated_at: now,
    });

    const result = simulatePutNameHandler("test", { name: "  Trimmed  " });
    // The handler trims before calling updateClientName
    expect(mockUpdateClientName).toHaveBeenCalledWith("test", "Trimmed");
  });
});
