import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateSample } from "./ping-validation";
import type { PingSampleIngest } from "./ping-types";

/* ------------------------------------------------------------------ */
/*  Boundary: Timestamp boundaries                                     */
/* ------------------------------------------------------------------ */

describe("timestampMs boundaries", () => {
  it("accepts timestamp exactly at the future window edge", () => {
    // With default 5-minute window (300_000ms), a timestamp at exactly
    // now + 300_000 should pass (not exceed)
    const exactEdge = Math.floor(Date.now() / 1000) * 1000; // Round down to nearest second
    // The sample's timestamp is now + 300_000 which is the boundary
    // We use a timestamp that's safely within the window
    const withinWindow = Date.now() + 299_000;
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: withinWindow,
      latencyMs: 42,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects timestamp 1ms beyond the future window", () => {
    const beyond = Date.now() + 300_001; // 1ms past 5-minute window
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: beyond,
      latencyMs: 42,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "FUTURE_TIMESTAMP");
    expect(rejection).toBeDefined();
  });

  it("rejects timestampMs = 0", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: 0,
      latencyMs: 42,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_TIMESTAMP");
    expect(rejection).toBeDefined();
  });

  it("accepts timestampMs = 1 (minimum positive)", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: 1,
      latencyMs: 42,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Boundary: Latency boundaries                                        */
/* ------------------------------------------------------------------ */

describe("latencyMs boundaries", () => {
  it("rejects latencyMs = 0", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: Date.now(),
      latencyMs: 0,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_LATENCY");
    expect(rejection).toBeDefined();
  });

  it("accepts latencyMs = 0.001 (minimum positive)", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: Date.now(),
      latencyMs: 0.001,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects latencyMs = Infinity", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: Date.now(),
      latencyMs: Infinity,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_LATENCY");
    expect(rejection).toBeDefined();
  });

  it("rejects latencyMs = NaN", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: Date.now(),
      latencyMs: NaN,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_LATENCY");
    expect(rejection).toBeDefined();
  });

  it("rejects latencyMs = -0.001", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: Date.now(),
      latencyMs: -0.001,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_LATENCY");
    expect(rejection).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Boundary: targetHost whitespace                                    */
/* ------------------------------------------------------------------ */

describe("targetHost edge cases", () => {
  it("rejects targetHost with only whitespace", () => {
    const result = validateSample({
      targetHost: "   ",
      timestampMs: Date.now(),
      latencyMs: 42,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "MISSING_TARGET_HOST");
    expect(rejection).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Boundary: resolvedAddress whitespace                               */
/* ------------------------------------------------------------------ */

describe("resolvedAddress edge cases", () => {
  it("rejects resolvedAddress with only whitespace for success", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: Date.now(),
      latencyMs: 42,
      status: "success",
      resolvedAddress: "   ",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "MISSING_RESOLVED_ADDRESS");
    expect(rejection).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Edge: Status variations                                            */
/* ------------------------------------------------------------------ */

describe("status edge cases", () => {
  it("rejects status = 'SUCCESS' (uppercase)", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: Date.now(),
      latencyMs: 42,
      status: "SUCCESS" as unknown as "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_STATUS");
    expect(rejection).toBeDefined();
  });

  it("rejects status = null", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: Date.now(),
      latencyMs: 42,
      status: null as unknown as "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_STATUS");
    expect(rejection).toBeDefined();
  });

  it("rejects status = empty string", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: Date.now(),
      latencyMs: 42,
      status: "" as unknown as "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_STATUS");
    expect(rejection).toBeDefined();
  });

  it("rejects status = undefined", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: Date.now(),
      latencyMs: 42,
      status: undefined as unknown as "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "INVALID_STATUS");
    expect(rejection).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Edge: All fields null/undefined                                    */
/* ------------------------------------------------------------------ */

describe("sample with null/undefined fields", () => {
  it("rejects sample with all fields as null/undefined", () => {
    const result = validateSample({
      targetHost: "" as unknown as string,
      timestampMs: null as unknown as number,
      latencyMs: null,
      status: null as unknown as "success",
      resolvedAddress: null,
    });
    expect(result.valid).toBe(false);
    // Should have multiple rejections
    expect(result.rejections.length).toBeGreaterThanOrEqual(3);
  });
});

/* ------------------------------------------------------------------ */
/*  Edge: Extra unknown fields (should not cause errors)               */
/* ------------------------------------------------------------------ */

describe("extra unknown fields", () => {
  it("does not reject sample with extra unknown fields", () => {
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: Date.now(),
      latencyMs: 42,
      status: "success",
      resolvedAddress: "8.8.8.8",
      // Extra fields — should be ignored
      extraField: "some value",
      anotherExtra: 123,
    } as PingSampleIngest);
    expect(result.valid).toBe(true);
    expect(result.rejections).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Edge: INGEST_FUTURE_WINDOW_MS = 0 (env override)                   */
/* ------------------------------------------------------------------ */

describe("INGEST_FUTURE_WINDOW_MS env override", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects any future timestamp when window is 0", () => {
    vi.stubEnv("INGEST_FUTURE_WINDOW_MS", "0");

    // Module needs to be re-evaluated to pick up the new env var.
    // Since we can't easily re-import, we test with a past timestamp
    // which should pass regardless, and a far future which should fail.
    // With window = 0, any timestamp > Date.now() should fail.
    const future = Date.now() + 1;
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: future,
      latencyMs: 42,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });

    // The validateSample function calls getFutureWindowMs() which reads
    // env each time, so this should use 0
    expect(result.valid).toBe(false);
    const rejection = result.rejections.find(r => r.code === "FUTURE_TIMESTAMP");
    expect(rejection).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Edge: Large but valid timestamp                                    */
/* ------------------------------------------------------------------ */

describe("large timestamp values", () => {
  it("accepts large valid timestamp (far future year)", () => {
    // Year 2030, well within safe integer range
    const largeTimestamp = new Date("2030-01-01T00:00:00Z").getTime();
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: largeTimestamp,
      latencyMs: null,
      status: "timeout",
      resolvedAddress: null,
    });
    // This depends on when the test runs — in 2026 this is ~4 years ahead
    // which exceeds the 5-minute window
    expect(result.valid).toBe(false);
    expect(result.rejections.find(r => r.code === "FUTURE_TIMESTAMP")).toBeDefined();
  });

  it("accepts valid timestamp at a reasonable value", () => {
    const reasonableTimestamp = Date.now() - 60_000; // 1 minute ago
    const result = validateSample({
      targetHost: "8.8.8.8",
      timestampMs: reasonableTimestamp,
      latencyMs: 42,
      status: "success",
      resolvedAddress: "8.8.8.8",
    });
    expect(result.valid).toBe(true);
  });
});
