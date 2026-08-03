import { describe, test, expect } from "vitest";
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
import type { QualityState } from "#shared/types";

/* ------------------------------------------------------------------ */
/*  mapQualityState — F12 valid states should pass through            */
/* ------------------------------------------------------------------ */

describe("mapQualityState — F12 valid states", () => {
  const f12States: QualityState[] = [
    "veryHigh",
    "high",
    "medium",
    "low",
    "unstable",
    "disconnected",
    "warmingUp",
  ];

  test.each(f12States)(`"%s" maps to itself`, (state) => {
    expect(mapQualityState(state)).toBe(state);
  });
});

/* ------------------------------------------------------------------ */
/*  mapQualityState — legacy values should fall back to warmingUp     */
/* ------------------------------------------------------------------ */

describe("mapQualityState — legacy/unknown values", () => {
  test('maps "good" (legacy) to "warmingUp"', () => {
    expect(mapQualityState("good")).toBe("warmingUp");
  });

  test('maps "degraded" (legacy) to "warmingUp"', () => {
    expect(mapQualityState("degraded")).toBe("warmingUp");
  });

  test('maps "poor" (legacy) to "warmingUp"', () => {
    expect(mapQualityState("poor")).toBe("warmingUp");
  });

  test('maps arbitrary unknown string to "warmingUp"', () => {
    expect(mapQualityState("unknownState")).toBe("warmingUp");
  });

  test('maps empty string to "warmingUp"', () => {
    expect(mapQualityState("")).toBe("warmingUp");
  });
});

/* ------------------------------------------------------------------ */
/*  Quality state constants — verify expected values                  */
/* ------------------------------------------------------------------ */

describe("quality constants", () => {
  test("QUALITY_WINDOW_MS is 5 minutes", () => {
    expect(QUALITY_WINDOW_MS).toBe(5 * 60 * 1000);
  });

  test("QUALITY_MIN_SAMPLES is 10", () => {
    expect(QUALITY_MIN_SAMPLES).toBe(10);
  });

  test("QUALITY_VERY_HIGH_MAX_LATENCY is 50ms", () => {
    expect(QUALITY_VERY_HIGH_MAX_LATENCY).toBe(50);
  });

  test("QUALITY_HIGH_MAX_LATENCY is 150ms", () => {
    expect(QUALITY_HIGH_MAX_LATENCY).toBe(150);
  });

  test("QUALITY_MEDIUM_MAX_LATENCY is 300ms", () => {
    expect(QUALITY_MEDIUM_MAX_LATENCY).toBe(300);
  });

  test("QUALITY_MEDIUM_MAX_PACKET_LOSS is 10%", () => {
    expect(QUALITY_MEDIUM_MAX_PACKET_LOSS).toBe(10);
  });

  test("QUALITY_UNSTABLE_CV is 0.5", () => {
    expect(QUALITY_UNSTABLE_CV).toBe(0.5);
  });

  test("QUALITY_UNSTABLE_MAX_PACKET_LOSS is 10%", () => {
    expect(QUALITY_UNSTABLE_MAX_PACKET_LOSS).toBe(10);
  });

  test("QUALITY_DISCONNECTED_NO_SAMPLES_WINDOW_MS is 5 minutes", () => {
    expect(QUALITY_DISCONNECTED_NO_SAMPLES_WINDOW_MS).toBe(5 * 60 * 1000);
  });

  test("QUALITY_DISCONNECTED_RECENT_MS is 1 hour", () => {
    expect(QUALITY_DISCONNECTED_RECENT_MS).toBe(60 * 60 * 1000);
  });
});

/* ------------------------------------------------------------------ */
/*  QUALITY_COLORS — all states have a color defined                  */
/* ------------------------------------------------------------------ */

describe("QUALITY_COLORS", () => {
  test("has entries for all 7 quality states", () => {
    const expectedStates: QualityState[] = [
      "veryHigh",
      "high",
      "medium",
      "low",
      "unstable",
      "disconnected",
      "warmingUp",
    ];

    for (const state of expectedStates) {
      expect(QUALITY_COLORS[state]).toBeDefined();
      expect(typeof QUALITY_COLORS[state]).toBe("string");
      // Color should be a hex string (at least 3 chars)
      expect(QUALITY_COLORS[state].length).toBeGreaterThanOrEqual(3);
    }
  });

  test("veryHigh is green", () => {
    expect(QUALITY_COLORS["veryHigh"]).toBe("#22c55e");
  });

  test("high is lime", () => {
    expect(QUALITY_COLORS["high"]).toBe("#84cc16");
  });

  test("medium is yellow", () => {
    expect(QUALITY_COLORS["medium"]).toBe("#eab308");
  });

  test("low is orange", () => {
    expect(QUALITY_COLORS["low"]).toBe("#f97316");
  });

  test("unstable is red", () => {
    expect(QUALITY_COLORS["unstable"]).toBe("#ef4444");
  });

  test("disconnected is gray-500", () => {
    expect(QUALITY_COLORS["disconnected"]).toBe("#6b7280");
  });

  test("warmingUp is gray-400", () => {
    expect(QUALITY_COLORS["warmingUp"]).toBe("#9ca3af");
  });

  test("all colors are distinct", () => {
    const values = Object.values(QUALITY_COLORS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
