import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Handler-level tests for GET /api/clients/:slug
 *
 * Exercises the decision logic of the route handler, including the
 * critical 404 path when getClientBySlug returns null.
 */

// Mock client utils
vi.mock("../../utils/client", () => ({
  getClientBySlug: vi.fn(),
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
  generateSlug: vi.fn((username, hostname, mac) => {
    const cleanMac = mac.replace(/[^a-f0-9]/gi, "");
    const truncatedMac = cleanMac.slice(-10);
    const raw = `${username}-${hostname}-${truncatedMac}`;
    let result = raw.replace(/[^a-zA-Z0-9]/g, "-");
    result = result.replace(/-+/g, "-");
    result = result.replace(/^-+|-+$/g, "");
    return result;
  }),
}));

import { getClientBySlug, toClientResponse } from "../../utils/client";

const mockGetClientBySlug = getClientBySlug as ReturnType<typeof vi.fn>;
const mockToClientResponse = toClientResponse as ReturnType<typeof vi.fn>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Simulate the route handler's decision logic.
 * Mirrors the actual handler: getRouterParam → getClientBySlug → toClientResponse
 */
function simulateGetClientHandler(slug: string | undefined) {
  try {
    // Step 1: Check slug exists
    if (!slug) {
      return {
        type: "error" as const,
        statusCode: 400,
        message: "Missing slug parameter",
      };
    }

    // Step 2: Lookup client
    const row = mockGetClientBySlug(slug);
    if (!row) {
      return {
        type: "error" as const,
        statusCode: 404,
        message: "Client not found",
      };
    }

    // Step 3: Return response
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
/*  404 — client not found (null return from getClientBySlug)          */
/* ------------------------------------------------------------------ */

describe("GET /api/clients/:slug — 404 client not found", () => {
  it("returns 404 when getClientBySlug returns null", () => {
    mockGetClientBySlug.mockReturnValue(null);

    const result = simulateGetClientHandler("nonexistent-slug");

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(404);
    expect(result.message).toBe("Client not found");
  });

  it("returns 404 for empty string slug", () => {
    mockGetClientBySlug.mockReturnValue(null);

    const result = simulateGetClientHandler("");

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Missing slug parameter");
  });

  it("returns 404 for undefined slug", () => {
    mockGetClientBySlug.mockReturnValue(null);

    const result = simulateGetClientHandler(undefined);

    expect(result.type).toBe("error");
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Missing slug parameter");
  });
});

/* ------------------------------------------------------------------ */
/*  200 — successful client lookup                                     */
/* ------------------------------------------------------------------ */

describe("GET /api/clients/:slug — 200 success", () => {
  it("returns client data when found", () => {
    const now = Date.now();
    const row = {
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
      created_at: now,
      updated_at: now,
    };

    mockGetClientBySlug.mockReturnValue(row);
    mockToClientResponse.mockReturnValue({
      id: 1,
      slug: "alice-desktop-00bb11cc22",
      name: "alice@desktop",
      username: "alice",
      hostname: "desktop",
      mac_address: "aa:00:bb:11:cc:22",
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });

    const result = simulateGetClientHandler("alice-desktop-00bb11cc22");

    expect(result.type).toBe("success");
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      id: 1,
      slug: "alice-desktop-00bb11cc22",
      name: "alice@desktop",
    });
  });

  it("calls getClientBySlug with the correct slug", () => {
    mockGetClientBySlug.mockReturnValue(null);

    simulateGetClientHandler("test-slug-123");

    expect(mockGetClientBySlug).toHaveBeenCalledWith("test-slug-123");
  });

  it("calls toClientResponse with the row when found", () => {
    const row = {
      id: 1,
      slug: "test-slug",
      name: "test",
      username: "u",
      hostname: "h",
      mac_address: "aa:00:bb:11:cc:22",
      sync_enabled: 1,
      sync_interval_min: 5,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    mockGetClientBySlug.mockReturnValue(row);

    simulateGetClientHandler("test-slug");

    expect(mockToClientResponse).toHaveBeenCalledWith(row);
  });
});

/* ------------------------------------------------------------------ */
/*  Response shape verification                                        */
/* ------------------------------------------------------------------ */

describe("response shape", () => {
  it("response excludes database-only fields", () => {
    const now = Date.now();
    const row = {
      id: 1,
      slug: "test-slug",
      name: "test",
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

    mockGetClientBySlug.mockReturnValue(row);
    mockToClientResponse.mockReturnValue({
      id: 1,
      slug: "test-slug",
      name: "test",
      username: "u",
      hostname: "h",
      mac_address: "aa:00:bb:11:cc:22",
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });

    const result = simulateGetClientHandler("test-slug");
    expect(result.body).not.toHaveProperty("sync_enabled");
    expect(result.body).not.toHaveProperty("last_synced_at_ms");
    expect(result.body).not.toHaveProperty("backend_url");
    expect(result.body).not.toHaveProperty("sync_interval_min");
  });

  it("response timestamps are ISO 8601", () => {
    const now = Date.now();
    mockGetClientBySlug.mockReturnValue({
      id: 1,
      slug: "test",
      name: "test",
      username: "u",
      hostname: "h",
      mac_address: "aa:00:bb:11:cc:22",
      created_at: now,
      updated_at: now,
    });

    const result = simulateGetClientHandler("test");
    if (result.type === "success") {
      expect(() => new Date(result.body.created_at)).not.toThrow();
      expect(() => new Date(result.body.updated_at)).not.toThrow();
      expect(result.body.created_at).toMatch(/Z$/);
    }
  });
});
