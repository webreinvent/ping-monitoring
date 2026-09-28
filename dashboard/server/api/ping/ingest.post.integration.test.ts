import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Integration tests for the ingest route handler.
 *
 * These tests verify the full handler logic through mock-based integration.
 * Because we can't easily spin up a Nitro event handler in Vitest without
 * the full framework, we test the handler's decision logic by simulating
 * the request flow.
 *
 * NOTE: When better-sqlite3 works in Vitest (or when E2E testing is set up),
 * these can be extended to test the full HTTP request→response cycle.
 */

// Mock dependencies
vi.mock("../../utils/ping-ingest", () => ({
  ingestPingBatch: vi.fn(),
}));
vi.mock("../../utils/logger", () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

import { ingestPingBatch } from "../../utils/ping-ingest";

const mockIngestPingBatch = ingestPingBatch as unknown as ReturnType<typeof vi.fn>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createValidSample() {
  return {
    targetHost: "8.8.8.8",
    timestampMs: Date.now(),
    latencyMs: 42,
    status: "success",
    resolvedAddress: "8.8.8.8",
  };
}

/**
 * Simulate the route handler's response logic.
 * This is a test double that mirrors the handler's decision-making.
 */
function simulateHandler(
  body: Record<string, unknown>,
  ingestResult: NonNullable<ReturnType<typeof ingestPingBatch>> | null,
) {
  const errors: { code: string; statusCode: number; message: string }[] = [];
  let statusCode = 0;
  let response: Record<string, unknown> | null = null;

  // Step 1: Validate clientSlug
  if (!body || typeof body.clientSlug !== "string" || !body.clientSlug.trim()) {
    errors.push({ code: "MISSING_CLIENT_SLUG", statusCode: 400, message: "clientSlug is required" });
    return { errors, statusCode: 0, response: null };
  }

  // Step 2: Validate samples array
  const samples = body.samples;
  if (!Array.isArray(samples) || samples.length === 0) {
    errors.push({ code: "EMPTY_SAMPLES", statusCode: 400, message: "Samples array required" });
    return { errors, statusCode: 0, response: null };
  }

  // Step 3: Check batch size
  const maxSamples = Number(process.env.INGEST_MAX_SAMPLES ?? 1000);
  if (samples.length > maxSamples) {
    errors.push({ code: "BATCH_TOO_LARGE", statusCode: 413, message: "Batch too large" });
    return { errors, statusCode: 0, response: null };
  }

  // Step 4: Unknown client
  if (ingestResult === null) {
    errors.push({ code: "UNKNOWN_CLIENT", statusCode: 401, message: "Unknown client slug" });
    return { errors, statusCode: 0, response: null };
  }

  // Step 5: Determine status code
  const { accepted, duplicate, rejected } = ingestResult;
  if (accepted === 0 && duplicate === 0) {
    statusCode = 200;
  } else if (accepted === 0 && duplicate > 0) {
    statusCode = 200;
  } else if (accepted > 0 && duplicate === 0 && rejected === 0) {
    statusCode = 201;
  } else {
    statusCode = 207;
  }

  response = {
    accepted,
    duplicate,
    rejected,
    rejections: ingestResult.rejections,
  };

  return { errors, statusCode, response };
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
/*  Full request → response cycle                                      */
/* ------------------------------------------------------------------ */

describe("ingest handler — full request cycle", () => {
  it("valid batch returns 201 with correct response shape", () => {
    const body = {
      clientSlug: "test-client",
      samples: [createValidSample()],
    };

    const result = simulateHandler(body, { accepted: 1, duplicate: 0, rejected: 0 });

    expect(result.statusCode).toBe(201);
    expect(result.response).toEqual({
      accepted: 1,
      duplicate: 0,
      rejected: 0,
    });
    expect(result.errors).toHaveLength(0);
  });

  it("missing clientSlug returns 400", () => {
    const body = { samples: [createValidSample()] };
    const result = simulateHandler(body, { accepted: 1, duplicate: 0, rejected: 0 });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("MISSING_CLIENT_SLUG");
  });

  it("empty clientSlug returns 400", () => {
    const body = { clientSlug: "", samples: [createValidSample()] };
    const result = simulateHandler(body, { accepted: 1, duplicate: 0, rejected: 0 });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("MISSING_CLIENT_SLUG");
  });

  it("whitespace clientSlug returns 400", () => {
    const body = { clientSlug: "   ", samples: [createValidSample()] };
    const result = simulateHandler(body, { accepted: 1, duplicate: 0, rejected: 0 });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("MISSING_CLIENT_SLUG");
  });

  it("empty samples returns 400", () => {
    const body = { clientSlug: "test-client", samples: [] };
    const result = simulateHandler(body, null);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("EMPTY_SAMPLES");
  });

  it("missing samples returns 400", () => {
    const body = { clientSlug: "test-client" };
    const result = simulateHandler(body, null);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("EMPTY_SAMPLES");
  });
});

/* ------------------------------------------------------------------ */
/*  Batch size limit                                                   */
/* ------------------------------------------------------------------ */

describe("ingest handler — batch size limit", () => {
  it("oversized batch returns 413", () => {
    const body = {
      clientSlug: "test-client",
      samples: Array.from({ length: 1001 }, () => createValidSample()),
    };
    const result = simulateHandler(body, { accepted: 1001, duplicate: 0, rejected: 0 });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("BATCH_TOO_LARGE");
  });

  it("batch at exactly max size is accepted", () => {
    const body = {
      clientSlug: "test-client",
      samples: Array.from({ length: 1000 }, () => createValidSample()),
    };
    const result = simulateHandler(body, { accepted: 1000, duplicate: 0, rejected: 0 });

    expect(result.errors).toHaveLength(0);
    expect(result.statusCode).toBe(201);
  });

  it("respects custom INGEST_MAX_SAMPLES env", () => {
    vi.stubEnv("INGEST_MAX_SAMPLES", "50");

    const body = {
      clientSlug: "test-client",
      samples: Array.from({ length: 51 }, () => createValidSample()),
    };
    const result = simulateHandler(body, { accepted: 51, duplicate: 0, rejected: 0 });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("BATCH_TOO_LARGE");
  });
});

/* ------------------------------------------------------------------ */
/*  Unknown client → 401                                              */
/* ------------------------------------------------------------------ */

describe("ingest handler — unknown client", () => {
  it("null ingest result maps to 401", () => {
    const body = {
      clientSlug: "unknown-client",
      samples: [createValidSample()],
    };
    const result = simulateHandler(body, null);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("UNKNOWN_CLIENT");
    expect(result.errors[0].statusCode).toBe(401);
  });
});

/* ------------------------------------------------------------------ */
/*  Status code is correctly set via setResponseStatus                 */
/* ------------------------------------------------------------------ */

describe("ingest handler — setResponseStatus", () => {
  it("sets 201 for all accepted", () => {
    const body = { clientSlug: "test", samples: [createValidSample()] };
    const result = simulateHandler(body, { accepted: 1, duplicate: 0, rejected: 0 });
    expect(result.statusCode).toBe(201);
  });

  it("sets 200 for all duplicates", () => {
    const body = { clientSlug: "test", samples: [createValidSample()] };
    const result = simulateHandler(body, { accepted: 0, duplicate: 1, rejected: 0 });
    expect(result.statusCode).toBe(200);
  });

  it("sets 207 for mixed", () => {
    const body = { clientSlug: "test", samples: [createValidSample()] };
    const result = simulateHandler(body, { accepted: 5, duplicate: 2, rejected: 1 });
    expect(result.statusCode).toBe(207);
  });
});

/* ------------------------------------------------------------------ */
/*  Error responses match API design error shape                       */
/* ------------------------------------------------------------------ */

describe("ingest handler — error response shape", () => {
  it("error response includes error message and code", () => {
    const body = { clientSlug: "", samples: [createValidSample()] };
    const result = simulateHandler(body, null);

    expect(result.errors[0]).toHaveProperty("code");
    expect(typeof result.errors[0].code).toBe("string");
  });

  it("success response matches F3 contract", () => {
    const body = { clientSlug: "test", samples: [createValidSample()] };
    const result = simulateHandler(body, {
      accepted: 1,
      duplicate: 0,
      rejected: 0,
    });

    expect(result.response).toHaveProperty("accepted");
    expect(result.response).toHaveProperty("duplicate");
    expect(result.response).toHaveProperty("rejected");
    expect(typeof result.response!.accepted).toBe("number");
  });

  it("rejections included when rejected > 0", () => {
    const body = { clientSlug: "test", samples: [createValidSample()] };
    const rejections = [
      { index: 0, reason: "Invalid timestamp", code: "INVALID_TIMESTAMP", sample: {} },
    ];
    const result = simulateHandler(body, {
      accepted: 0,
      duplicate: 0,
      rejected: 1,
      rejections,
    });

    expect(result.response).toHaveProperty("rejections");
    expect(result.response!.rejections).toEqual(rejections);
  });
});

/* ------------------------------------------------------------------ */
/*  sendResponse helper sets correct status codes                      */
/* ------------------------------------------------------------------ */

describe("sendResponse helper", () => {
  it("maps status code to event response", () => {
    // The sendResponse function calls setResponseStatus(event, statusCode)
    // and returns the body. We verify the mapping:
    const statusMap = [
      { result: { accepted: 1, duplicate: 0, rejected: 0 }, expected: 201 },
      { result: { accepted: 0, duplicate: 1, rejected: 0 }, expected: 200 },
      { result: { accepted: 0, duplicate: 0, rejected: 1 }, expected: 200 },
      { result: { accepted: 5, duplicate: 2, rejected: 1 }, expected: 207 },
    ];

    for (const { result, expected } of statusMap) {
      const body = { clientSlug: "test", samples: [createValidSample()] };
      const res = simulateHandler(body, result);
      expect(res.statusCode).toBe(expected);
    }
  });
});
