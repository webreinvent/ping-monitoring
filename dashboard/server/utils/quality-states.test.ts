import { describe, it, expect } from "vitest";
import {
  mapQualityState,
  QUALITY_WINDOW_MS,
  QUALITY_MIN_SAMPLES,
  QUALITY_VERY_HIGH_MAX_LATENCY,
  QUALITY_HIGH_MAX_LATENCY,
  QUALITY_MEDIUM_MAX_LATENCY,
  QUALITY_MEDIUM_MAX_PACKET_LOSS,
  QUALITY_UNSTABLE_CV,
  QUALITY_UNSTABLE_MAX_PACKET_LOSS,
  QUALITY_DISCONNECTED_NO_SAMPLES_WINDOW_MS,
  QUALITY_DISCONNECTED_RECENT_MS,
  QUALITY_COLORS,
} from "./quality-states";

/* ------------------------------------------------------------------ */
/*  mapQualityState                                                    */
/* ------------------------------------------------------------------ */

describe("mapQualityState", () => {
  it.each([
    "veryHigh",
    "high",
    "medium",
    "low",
    "unstable",
    "disconnected",
    "warmingUp",
  ])('passes through valid F12 state "%s" unchanged', (state) => {
    expect(mapQualityState(state)).toBe(state);
  });

  it('maps legacy "good" to "warmingUp"', () => {
    expect(mapQualityState("good")).toBe("warmingUp");
  });

  it('maps legacy "degraded" to "warmingUp"', () => {
    expect(mapQualityState("degraded")).toBe("warmingUp");
  });

  it('maps legacy "poor" to "warmingUp"', () => {
    expect(mapQualityState("poor")).toBe("warmingUp");
  });

  it("maps unknown string to warmingUp", () => {
    expect(mapQualityState("unknown_state")).toBe("warmingUp");
  });

  it("maps empty string to warmingUp", () => {
    expect(mapQualityState("")).toBe("warmingUp");
  });

  it("maps random gibberish to warmingUp", () => {
    expect(mapQualityState("xyz123")).toBe("warmingUp");
  });
});

/* ------------------------------------------------------------------ */
/*  Constants — verify expected values                                 */
/* ------------------------------------------------------------------ */

describe("quality constants", () => {
  it("QUALITY_WINDOW_MS is 5 minutes in milliseconds", () => {
    expect(QUALITY_WINDOW_MS).toBe(5 * 60 * 1000);
  });

  it("QUALITY_MIN_SAMPLES is 10", () => {
    expect(QUALITY_MIN_SAMPLES).toBe(10);
  });

  it("QUALITY_VERY_HIGH_MAX_LATENCY is 50ms", () => {
    expect(QUALITY_VERY_HIGH_MAX_LATENCY).toBe(50);
  });

  it("QUALITY_HIGH_MAX_LATENCY is 150ms", () => {
    expect(QUALITY_HIGH_MAX_LATENCY).toBe(150);
  });

  it("QUALITY_MEDIUM_MAX_LATENCY is 300ms", () => {
    expect(QUALITY_MEDIUM_MAX_LATENCY).toBe(300);
  });

  it("QUALITY_MEDIUM_MAX_PACKET_LOSS is 10%", () => {
    expect(QUALITY_MEDIUM_MAX_PACKET_LOSS).toBe(10);
  });

  it("QUALITY_UNSTABLE_CV is 0.5", () => {
    expect(QUALITY_UNSTABLE_CV).toBe(0.5);
  });

  it("QUALITY_UNSTABLE_MAX_PACKET_LOSS is 10%", () => {
    expect(QUALITY_UNSTABLE_MAX_PACKET_LOSS).toBe(10);
  });

  it("QUALITY_DISCONNECTED_NO_SAMPLES_WINDOW_MS is 5 minutes", () => {
    expect(QUALITY_DISCONNECTED_NO_SAMPLES_WINDOW_MS).toBe(5 * 60 * 1000);
  });

  it("QUALITY_DISCONNECTED_RECENT_MS is 1 hour", () => {
    expect(QUALITY_DISCONNECTED_RECENT_MS).toBe(60 * 60 * 1000);
  });
});

/* ------------------------------------------------------------------ */
/*  QUALITY_COLORS                                                     */
/* ------------------------------------------------------------------ */

describe("QUALITY_COLORS", () => {
  const expectedStates = [
    "veryHigh",
    "high",
    "medium",
    "low",
    "unstable",
    "disconnected",
    "warmingUp",
  ] as const;

  it("has an entry for every valid quality state", () => {
    for (const state of expectedStates) {
      expect(QUALITY_COLORS).toHaveProperty(state);
      expect(typeof QUALITY_COLORS[state]).toBe("string");
    }
  });

  it("has exactly 7 entries (one per quality state)", () => {
    expect(Object.keys(QUALITY_COLORS).length).toBe(7);
  });

  it("all values are hex color strings", () => {
    for (const value of Object.values(QUALITY_COLORS)) {
      expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("veryHigh is green (#22c55e)", () => {
    expect(QUALITY_COLORS.veryHigh).toBe("#22c55e");
  });

  it("high is lime (#84cc16)", () => {
    expect(QUALITY_COLORS.high).toBe("#84cc16");
  });

  it("medium is yellow (#eab308)", () => {
    expect(QUALITY_COLORS.medium).toBe("#eab308");
  });

  it("low is orange (#f97316)", () => {
    expect(QUALITY_COLORS.low).toBe("#f97316");
  });

  it("unstable is red (#ef4444)", () => {
    expect(QUALITY_COLORS.unstable).toBe("#ef4444");
  });

  it("disconnected is gray-500 (#6b7280)", () => {
    expect(QUALITY_COLORS.disconnected).toBe("#6b7280");
  });

  it("warmingUp is gray-400 (#9ca3af)", () => {
    expect(QUALITY_COLORS.warmingUp).toBe("#9ca3af");
  });

  it("all colors are distinct (no two states share the same color)", () => {
    const values = Object.values(QUALITY_COLORS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

/* ------------------------------------------------------------------ */
/*  Threshold ordering sanity checks                                   */
/* ------------------------------------------------------------------ */

describe("threshold ordering", () => {
  it("veryHigh max latency < high max latency", () => {
    expect(QUALITY_VERY_HIGH_MAX_LATENCY).toBeLessThan(QUALITY_HIGH_MAX_LATENCY);
  });

  it("high max latency < medium max latency", () => {
    expect(QUALITY_HIGH_MAX_LATENCY).toBeLessThan(QUALITY_MEDIUM_MAX_LATENCY);
  });

  it("unstable max packet loss equals medium max packet loss", () => {
    expect(QUALITY_UNSTABLE_MAX_PACKET_LOSS).toBe(QUALITY_MEDIUM_MAX_PACKET_LOSS);
  });

  it("quality window matches disconnected no-samples window", () => {
    expect(QUALITY_WINDOW_MS).toBe(QUALITY_DISCONNECTED_NO_SAMPLES_WINDOW_MS);
  });

  it("disconnected recent threshold is larger than quality window", () => {
    expect(QUALITY_DISCONNECTED_RECENT_MS).toBeGreaterThan(QUALITY_WINDOW_MS);
  });
});
