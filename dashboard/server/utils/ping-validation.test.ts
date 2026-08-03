import { describe, it, expect } from "vitest";
import { validateSample } from "./ping-validation";
import type { PingSampleIngest } from "./ping-types";

/* ------------------------------------------------------------------ */
/*  Helper: create a valid sample with optional overrides             */
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

/* ------------------------------------------------------------------ */
/*  Valid Samples — all 3 statuses                                     */
/* ------------------------------------------------------------------ */

describe("validateSample — valid samples", () => {
  it("accepts a valid success sample", () => {
    const result = validateSample(createValidSample());
    expect(result.valid).toBe(true);
    expect(result.rejections).toHaveLength(0);
  });

  it("accepts a valid timeout sample (latency/resolvedAddress not required)", () => {
    const result = validateSample(createValidSample({
      status: "timeout",
      latencyMs: null,
      resolvedAddress: null,
    }));
    expect(result.valid).toBe(true);
    expect(result.rejections).toHaveLength(0);
  });

  it("accepts a valid error sample", () => {
    const result = validateSample(createValidSample({
      status: "error",
      latencyMs: null,
      resolvedAddress: null,
      error: "Network unreachable",
    }));
    expect(result.valid).toBe(true);
    expect(result.rejections).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Rule 1: targetHost is required and non-empty                       */
/* ------------------------------------------------------------------ */

describe("Rule 1: targetHost required", () => {
  it("rejects missing targetHost", () => {
    const result = validateSample({
      targetHost: "",
      timestampMs: Date.now(),
      latencyMs: 42,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "MISSING_TARGET_HOST");
    expect(rejection).toBeDefined();
    expect(rejection?.reason).toBe("Missing required field: targetHost");
  });

  it("rejects whitespace-only targetHost", () => {
    const result = validateSample(createValidSample({ targetHost: "   " }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "MISSING_TARGET_HOST");
    expect(rejection).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Rule 2: timestampMs must be a positive integer                     */
/* ------------------------------------------------------------------ */

describe("Rule 2: timestampMs positive integer", () => {
  it("rejects non-integer timestamp", () => {
    const result = validateSample(createValidSample({ timestampMs: 12345.5 }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_TIMESTAMP");
    expect(rejection).toBeDefined();
  });

  it("rejects zero timestamp", () => {
    const result = validateSample(createValidSample({ timestampMs: 0 }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_TIMESTAMP");
    expect(rejection).toBeDefined();
  });

  it("rejects negative timestamp", () => {
    const result = validateSample(createValidSample({ timestampMs: -1000 }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_TIMESTAMP");
    expect(rejection).toBeDefined();
  });

  it("rejects NaN timestamp", () => {
    const result = validateSample(createValidSample({ timestampMs: NaN }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_TIMESTAMP");
    expect(rejection).toBeDefined();
  });

  it("rejects Infinity timestamp", () => {
    const result = validateSample(createValidSample({ timestampMs: Infinity }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_TIMESTAMP");
    expect(rejection).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Rule 3: timestamp must not exceed 5-minute future window           */
/* ------------------------------------------------------------------ */

describe("Rule 3: future timestamp window", () => {
  it("rejects timestamp too far in the future", () => {
    const farFuture = Date.now() + 600_000; // 10 minutes ahead
    const result = validateSample(createValidSample({ timestampMs: farFuture }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "FUTURE_TIMESTAMP");
    expect(rejection).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Rule 4: status must be one of the valid values                     */
/* ------------------------------------------------------------------ */

describe("Rule 4: valid status", () => {
  it("rejects unknown status", () => {
    const result = validateSample(createValidSample({
      status: "unknown" as unknown as "success",
    }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_STATUS");
    expect(rejection).toBeDefined();
  });

  it("rejects empty string status", () => {
    const result = validateSample(createValidSample({
      status: "" as unknown as "success",
    }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_STATUS");
    expect(rejection).toBeDefined();
  });

  it("rejects non-string status", () => {
    const result = validateSample(createValidSample({
      status: 123 as unknown as "success",
    }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_STATUS");
    expect(rejection).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Rule 5: latencyMs required and positive for success                */
/* ------------------------------------------------------------------ */

describe("Rule 5: latencyMs for success status", () => {
  it("rejects missing latencyMs for success", () => {
    const result = validateSample(createValidSample({ latencyMs: null }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "MISSING_LATENCY");
    expect(rejection).toBeDefined();
  });

  it("rejects zero latencyMs for success", () => {
    const result = validateSample(createValidSample({ latencyMs: 0 }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_LATENCY");
    expect(rejection).toBeDefined();
  });

  it("rejects negative latencyMs for success", () => {
    const result = validateSample(createValidSample({ latencyMs: -5 }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_LATENCY");
    expect(rejection).toBeDefined();
  });

  it("rejects NaN latencyMs for success", () => {
    const result = validateSample(createValidSample({ latencyMs: NaN }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_LATENCY");
    expect(rejection).toBeDefined();
  });

  it("rejects Infinity latencyMs for success", () => {
    const result = validateSample(createValidSample({ latencyMs: Infinity }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_LATENCY");
    expect(rejection).toBeDefined();
  });

  it("accepts null latencyMs for timeout status (not required)", () => {
    const result = validateSample(createValidSample({
      status: "timeout",
      latencyMs: null,
      resolvedAddress: null,
    }));
    expect(result.valid).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Rule 6: resolvedAddress required for success                       */
/* ------------------------------------------------------------------ */

describe("Rule 6: resolvedAddress for success status", () => {
  it("rejects missing resolvedAddress for success", () => {
    const result = validateSample(createValidSample({ resolvedAddress: null }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "MISSING_RESOLVED_ADDRESS");
    expect(rejection).toBeDefined();
  });

  it("rejects empty resolvedAddress for success", () => {
    const result = validateSample(createValidSample({ resolvedAddress: "" }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "MISSING_RESOLVED_ADDRESS");
    expect(rejection).toBeDefined();
  });

  it("rejects whitespace-only resolvedAddress for success", () => {
    const result = validateSample(createValidSample({ resolvedAddress: "   " }));
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "MISSING_RESOLVED_ADDRESS");
    expect(rejection).toBeDefined();
  });

  it("accepts null resolvedAddress for timeout status (not required)", () => {
    const result = validateSample(createValidSample({
      status: "timeout",
      latencyMs: null,
      resolvedAddress: null,
    }));
    expect(result.valid).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Multiple Rejections                                                */
/* ------------------------------------------------------------------ */

describe("multiple rejections", () => {
  it("accumulates multiple rejections on a single sample", () => {
    const result = validateSample(createValidSample({
      targetHost: "",
      timestampMs: 0,
      latencyMs: null,
      resolvedAddress: null,
    }));
    expect(result.valid).toBe(false);
    // Should have rejections for: MISSING_TARGET_HOST, INVALID_TIMESTAMP,
    // MISSING_LATENCY, MISSING_RESOLVED_ADDRESS
    expect(result.rejections.length).toBeGreaterThanOrEqual(3);
  });

  it("valid is false when any rejection exists", () => {
    const result = validateSample(createValidSample({ targetHost: "" }));
    expect(result.valid).toBe(false);
    expect(result.rejections.length).toBeGreaterThan(0);
  });

  it("valid is true when no rejections exist", () => {
    const result = validateSample(createValidSample());
    expect(result.valid).toBe(true);
    expect(result.rejections).toHaveLength(0);
  });
});
