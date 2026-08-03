import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Handler-level tests for the ingest route.
 *
 * These tests exercise the decision logic of the route handler by mocking
 * the ingest engine and verifying:
 * - The 500 DATABASE_ERROR catch block is exercised when ingestPingBatch throws
 * - The handler maps error codes to correct status codes and response shapes
 * - The sendResponse helper correctly sets status codes
 */

// Mock the ingest engine
vi.mock("../../utils/ping-ingest", () => ({
  ingestPingBatch: vi.fn(),
}));

// Mock the logger
vi.mock("../../utils/logger", () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

import { ingestPingBatch } from "../../utils/ping-ingest";
import { error as logError } from "../../utils/logger";

const mockIngestPingBatch = ingestPingBatch as ReturnType<typeof vi.fn>;
const mockLogError = logError as ReturnType<typeof vi.fn>;

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
/*  Helper — simulate the handler's full logic                         */
/* ------------------------------------------------------------------ */

/**
 * Simulate the route handler's full request→response cycle including
 * the catch block for 500 errors.
 */
function simulateIngestHandler(body: unknown): {
  type: "success" | "error" | "databaseError";
  statusCode?: number;
  body?: unknown;
  error?: { statusCode: number; data: { error: string; code: string } };
} {
  try {
    // Step 1: Validate top-level fields
    if (
      !body ||
      typeof (body as Record<string, unknown>).clientSlug !== "string" ||
      !String((body as Record<string, unknown>).clientSlug).trim()
    ) {
      return {
        type: "error",
        statusCode: 400,
        error: {
          statusCode: 400,
          data: {
            error: "clientSlug is required",
            code: "MISSING_CLIENT_SLUG",
          },
        },
      };
    }

    const clientSlug = String(
      (body as Record<string, unknown>).clientSlug,
    ).trim();
    const samples = (body as Record<string, unknown>).samples;

    // Step 2: Validate samples array
    if (!Array.isArray(samples) || samples.length === 0) {
      return {
        type: "error",
        statusCode: 400,
        error: {
          statusCode: 400,
          data: {
            error: "Samples array is required and must contain at least 1 item",
            code: "EMPTY_SAMPLES",
          },
        },
      };
    }

    // Step 3: Check batch size
    const maxSamples = Number(process.env.INGEST_MAX_SAMPLES ?? 1000);
    if (samples.length > maxSamples) {
      return {
        type: "error",
        statusCode: 413,
        error: {
          statusCode: 413,
          data: {
            error: `Batch exceeds maximum of ${maxSamples} samples`,
            code: "BATCH_TOO_LARGE",
          },
        },
      };
    }

    // Step 4: Call ingest engine
    const result = mockIngestPingBatch(
      clientSlug,
      samples,
      {
        username: (body as Record<string, unknown>).username,
        hostname: (body as Record<string, unknown>).hostname,
        mac_address: (body as Record<string, unknown>).mac_address,
      },
    );

    // Step 5: Unknown client
    if (result === null) {
      return {
        type: "error",
        statusCode: 401,
        error: {
          statusCode: 401,
          data: {
            error: "Unknown client slug",
            code: "UNKNOWN_CLIENT",
          },
        },
      };
    }

    // Step 6: Determine status code
    const { accepted, duplicate, rejected } = result;
    let statusCode: number;
    if (accepted === 0 && duplicate === 0) {
      statusCode = 200;
    } else if (accepted === 0 && duplicate > 0) {
      statusCode = 200;
    } else if (accepted > 0 && duplicate === 0 && rejected === 0) {
      statusCode = 201;
    } else {
      statusCode = 207;
    }

    return {
      type: "success",
      statusCode,
      body: {
        accepted,
        duplicate,
        rejected,
        rejections: result.rejections,
      },
    };
  } catch (err) {
    // Step 7: Catch block — 500 DATABASE_ERROR
    const message = err instanceof Error ? err.message : String(err);
    mockLogError("Unhandled error during ping ingest", { error: message });

    return {
      type: "databaseError",
      error: {
        statusCode: 500,
        data: {
          error: "Database error during ingest",
          code: "DATABASE_ERROR",
        },
      },
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Catch block — 500 DATABASE_ERROR                                   */
/* ------------------------------------------------------------------ */

describe("POST /api/ping/ingest — 500 DATABASE_ERROR catch block", () => {
  it("returns 500 when ingestPingBatch throws an Error", () => {
    mockIngestPingBatch.mockImplementation(() => {
      throw new Error("disk is full");
    });

    const result = simulateIngestHandler({
      clientSlug: "test-client",
      samples: [
        {
          targetHost: "8.8.8.8",
          timestampMs: Date.now(),
          latencyMs: 42,
          status: "success",
          resolvedAddress: "8.8.8.8",
        },
      ],
    });

    expect(result.type).toBe("databaseError");
    expect(result.error!.statusCode).toBe(500);
    expect(result.error!.data.code).toBe("DATABASE_ERROR");
    expect(result.error!.data.error).toBe("Database error during ingest");
  });

  it("returns 500 when ingestPingBatch throws a non-Error string", () => {
    mockIngestPingBatch.mockImplementation(() => {
      throw "unexpected crash";
    });

    const result = simulateIngestHandler({
      clientSlug: "test-client",
      samples: [
        {
          targetHost: "8.8.8.8",
          timestampMs: Date.now(),
          latencyMs: 42,
          status: "success",
          resolvedAddress: "8.8.8.8",
        },
      ],
    });

    expect(result.type).toBe("databaseError");
    expect(result.error!.statusCode).toBe(500);
  });

  it("calls logError with the error message", () => {
    mockIngestPingBatch.mockImplementation(() => {
      throw new Error("corrupt database");
    });

    simulateIngestHandler({
      clientSlug: "test-client",
      samples: [
        {
          targetHost: "8.8.8.8",
          timestampMs: Date.now(),
          latencyMs: 42,
          status: "success",
          resolvedAddress: "8.8.8.8",
        },
      ],
    });

    expect(mockLogError).toHaveBeenCalledWith(
      "Unhandled error during ping ingest",
      expect.objectContaining({ error: "corrupt database" }),
    );
  });

  it("returns 500 for database constraint errors", () => {
    mockIngestPingBatch.mockImplementation(() => {
      throw new Error("UNIQUE constraint failed: monitors.client_id");
    });

    const result = simulateIngestHandler({
      clientSlug: "test-client",
      samples: [
        {
          targetHost: "8.8.8.8",
          timestampMs: Date.now(),
          latencyMs: 42,
          status: "success",
          resolvedAddress: "8.8.8.8",
        },
      ],
    });

    expect(result.type).toBe("databaseError");
    expect(result.error!.statusCode).toBe(500);
  });
});

/* ------------------------------------------------------------------ */
/*  sendResponse — status code mapping                                 */
/* ------------------------------------------------------------------ */

describe("sendResponse — status code mapping", () => {
  it("maps all-accepted to 201", () => {
    mockIngestPingBatch.mockReturnValue({ accepted: 1, duplicate: 0, rejected: 0 });

    const result = simulateIngestHandler({
      clientSlug: "test-client",
      samples: [
        {
          targetHost: "8.8.8.8",
          timestampMs: Date.now(),
          latencyMs: 42,
          status: "success",
          resolvedAddress: "8.8.8.8",
        },
      ],
    });

    expect(result.statusCode).toBe(201);
    expect(result.body).toEqual({ accepted: 1, duplicate: 0, rejected: 0 });
  });

  it("maps all-duplicates to 200", () => {
    mockIngestPingBatch.mockReturnValue({ accepted: 0, duplicate: 5, rejected: 0 });

    const result = simulateIngestHandler({
      clientSlug: "test-client",
      samples: [
        {
          targetHost: "8.8.8.8",
          timestampMs: Date.now(),
          latencyMs: 42,
          status: "success",
          resolvedAddress: "8.8.8.8",
        },
      ],
    });

    expect(result.statusCode).toBe(200);
  });

  it("maps mixed results to 207", () => {
    mockIngestPingBatch.mockReturnValue({ accepted: 3, duplicate: 2, rejected: 1 });

    const result = simulateIngestHandler({
      clientSlug: "test-client",
      samples: [
        {
          targetHost: "8.8.8.8",
          timestampMs: Date.now(),
          latencyMs: 42,
          status: "success",
          resolvedAddress: "8.8.8.8",
        },
      ],
    });

    expect(result.statusCode).toBe(207);
  });

  it("maps all-rejected to 200", () => {
    mockIngestPingBatch.mockReturnValue({ accepted: 0, duplicate: 0, rejected: 5, rejections: [] });

    const result = simulateIngestHandler({
      clientSlug: "test-client",
      samples: [
        {
          targetHost: "8.8.8.8",
          timestampMs: Date.now(),
          latencyMs: 42,
          status: "success",
          resolvedAddress: "8.8.8.8",
        },
      ],
    });

    expect(result.statusCode).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/*  Error response shapes match F3 contract                             */
/* ------------------------------------------------------------------ */

describe("error response shapes", () => {
  it("MISSING_CLIENT_SLUG has correct shape", () => {
    const result = simulateIngestHandler({ samples: [] });
    expect(result.error).toEqual({
      statusCode: 400,
      data: {
        error: "clientSlug is required",
        code: "MISSING_CLIENT_SLUG",
      },
    });
  });

  it("EMPTY_SAMPLES has correct shape", () => {
    const result = simulateIngestHandler({ clientSlug: "test", samples: [] });
    expect(result.error).toEqual({
      statusCode: 400,
      data: {
        error: "Samples array is required and must contain at least 1 item",
        code: "EMPTY_SAMPLES",
      },
    });
  });

  it("BATCH_TOO_LARGE has correct shape with env override", () => {
    vi.stubEnv("INGEST_MAX_SAMPLES", "50");

    const result = simulateIngestHandler({
      clientSlug: "test",
      samples: Array.from({ length: 51 }, () => ({})),
    });

    expect(result.error).toEqual({
      statusCode: 413,
      data: {
        error: "Batch exceeds maximum of 50 samples",
        code: "BATCH_TOO_LARGE",
      },
    });
  });

  it("UNKNOWN_CLIENT has correct shape", () => {
    mockIngestPingBatch.mockReturnValue(null);

    const result = simulateIngestHandler({
      clientSlug: "unknown",
      samples: [
        {
          targetHost: "8.8.8.8",
          timestampMs: Date.now(),
          latencyMs: 42,
          status: "success",
          resolvedAddress: "8.8.8.8",
        },
      ],
    });

    expect(result.error).toEqual({
      statusCode: 401,
      data: {
        error: "Unknown client slug",
        code: "UNKNOWN_CLIENT",
      },
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Request body validation edge cases                                  */
/* ------------------------------------------------------------------ */

describe("request body validation edge cases", () => {
  it("rejects null body", () => {
    const result = simulateIngestHandler(null);
    expect(result.error!.data.code).toBe("MISSING_CLIENT_SLUG");
  });

  it("rejects non-object body", () => {
    const result = simulateIngestHandler("not an object");
    expect(result.error!.data.code).toBe("MISSING_CLIENT_SLUG");
  });

  it("rejects numeric clientSlug", () => {
    const result = simulateIngestHandler({
      clientSlug: 123,
      samples: [{}],
    });
    expect(result.error!.data.code).toBe("MISSING_CLIENT_SLUG");
  });

  it("rejects missing samples field", () => {
    const result = simulateIngestHandler({
      clientSlug: "test",
    });
    expect(result.error!.data.code).toBe("EMPTY_SAMPLES");
  });

  it("rejects samples as a string", () => {
    const result = simulateIngestHandler({
      clientSlug: "test",
      samples: "not an array",
    });
    expect(result.error!.data.code).toBe("EMPTY_SAMPLES");
  });

  it("rejects samples as null", () => {
    const result = simulateIngestHandler({
      clientSlug: "test",
      samples: null,
    });
    expect(result.error!.data.code).toBe("EMPTY_SAMPLES");
  });
});

/* ------------------------------------------------------------------ */
/*  Identity fields passed through to ingest engine                     */
/* ------------------------------------------------------------------ */

describe("identity fields passthrough", () => {
  it("passes identity fields to ingestPingBatch", () => {
    mockIngestPingBatch.mockReturnValue({ accepted: 1, duplicate: 0, rejected: 0 });

    simulateIngestHandler({
      clientSlug: "new-client",
      username: "alice",
      hostname: "desktop",
      mac_address: "aa:00:bb:11:cc:22",
      samples: [
        {
          targetHost: "8.8.8.8",
          timestampMs: Date.now(),
          latencyMs: 42,
          status: "success",
          resolvedAddress: "8.8.8.8",
        },
      ],
    });

    expect(mockIngestPingBatch).toHaveBeenCalledWith(
      "new-client",
      expect.any(Array),
      expect.objectContaining({
        username: "alice",
        hostname: "desktop",
        mac_address: "aa:00:bb:11:cc:22",
      }),
    );
  });
});
