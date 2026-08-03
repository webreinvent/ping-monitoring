import { describe, it, expect } from "vitest";
import { getQualityBandPaths, getQualityStateAt } from "./quality-bands";
import type { QualityIntervalRecord } from "#shared/types";

/* ------------------------------------------------------------------ */
/*  getQualityBandPaths                                                */
/* ------------------------------------------------------------------ */

describe("getQualityBandPaths", () => {
  it("returns empty array for empty intervals", () => {
    const result = getQualityBandPaths([]);
    expect(result).toEqual([]);
  });

  it("converts intervals to band paths with correct ms-to-seconds conversion", () => {
    const intervals: QualityIntervalRecord[] = [
      { startMs: 1000000, endMs: 1060000, state: "veryHigh", reasons: [] },
      { startMs: 1060000, endMs: 1120000, state: "high", reasons: [] },
      { startMs: 1120000, endMs: null, state: "medium", reasons: [] },
    ];

    const result = getQualityBandPaths(intervals);
    expect(result).toHaveLength(3);

    expect(result[0]).toEqual({
      start: 1000000 / 1000,
      end: 1060000 / 1000,
      color: expect.any(String),
    });

    expect(result[1]).toEqual({
      start: 1060000 / 1000,
      end: 1120000 / 1000,
      color: expect.any(String),
    });

    // Open-ended interval should use Date.now() / 1000 for end
    expect(result[2]!.start).toBe(1120000 / 1000);
    expect(result[2]!.end).toBeCloseTo(Date.now() / 1000, -3);
  });

  it("uses warmingUp fallback color for unknown state", () => {
    const intervals: QualityIntervalRecord[] = [
      { startMs: 1000000, endMs: 1060000, state: "warmingUp", reasons: [] },
    ];
    const result = getQualityBandPaths(intervals);
    expect(result[0]?.color).toContain("rgba(156, 163, 175");
  });

  it("assigns different colors for different quality states", () => {
    const intervals: QualityIntervalRecord[] = [
      { startMs: 1000000, endMs: 1060000, state: "veryHigh", reasons: [] },
      { startMs: 1060000, endMs: 1120000, state: "low", reasons: [] },
      { startMs: 1120000, endMs: 1180000, state: "unstable", reasons: [] },
      { startMs: 1180000, endMs: 1240000, state: "disconnected", reasons: [] },
    ];

    const result = getQualityBandPaths(intervals);

    // veryHigh should be green-ish
    expect(result[0]!.color).toContain("rgba(34, 197, 94");
    // low should be orange-ish
    expect(result[1]!.color).toContain("rgba(249, 115, 22");
    // unstable should be red-ish
    expect(result[2]?.color).toContain("rgba(239, 68, 68");
    // disconnected should be gray-ish
    expect(result[3]?.color).toContain("rgba(107, 114, 128");
  });
});

/* ------------------------------------------------------------------ */
/*  getQualityStateAt                                                  */
/* ------------------------------------------------------------------ */

describe("getQualityStateAt", () => {
  it("returns null when no intervals", () => {
    expect(getQualityStateAt([], 1000000)).toBeNull();
  });

  it("returns the state when timestamp falls within an interval", () => {
    const intervals: QualityIntervalRecord[] = [
      { startMs: 1000000, endMs: 1060000, state: "veryHigh", reasons: [] },
      { startMs: 1060000, endMs: 1120000, state: "high", reasons: [] },
    ];

    expect(getQualityStateAt(intervals, 1030000)).toBe("veryHigh");
    expect(getQualityStateAt(intervals, 1090000)).toBe("high");
  });

  it("returns null when timestamp is before all intervals", () => {
    const intervals: QualityIntervalRecord[] = [
      { startMs: 1000000, endMs: 1060000, state: "veryHigh", reasons: [] },
    ];

    expect(getQualityStateAt(intervals, 999999)).toBeNull();
  });

  it("returns null when timestamp is after all intervals", () => {
    const intervals: QualityIntervalRecord[] = [
      { startMs: 1000000, endMs: 1060000, state: "veryHigh", reasons: [] },
    ];

    expect(getQualityStateAt(intervals, 1060001)).toBeNull();
  });

  it("includes the start boundary (inclusive)", () => {
    const intervals: QualityIntervalRecord[] = [
      { startMs: 1000000, endMs: 1060000, state: "veryHigh", reasons: [] },
    ];

    expect(getQualityStateAt(intervals, 1000000)).toBe("veryHigh");
  });

  it("excludes the end boundary (exclusive)", () => {
    const intervals: QualityIntervalRecord[] = [
      { startMs: 1000000, endMs: 1060000, state: "veryHigh", reasons: [] },
    ];

    expect(getQualityStateAt(intervals, 1060000)).toBeNull();
  });

  it("handles open-ended intervals (endMs is null)", () => {
    const intervals: QualityIntervalRecord[] = [
      { startMs: 1000000, endMs: 1060000, state: "veryHigh", reasons: [] },
      { startMs: 1060000, endMs: null, state: "high", reasons: [] },
    ];

    // Far future should match the open-ended interval
    expect(getQualityStateAt(intervals, 999999999999)).toBe("high");
    expect(getQualityStateAt(intervals, 1060000)).toBe("high");
  });

  it("returns the first matching interval for overlapping cases", () => {
    const intervals: QualityIntervalRecord[] = [
      { startMs: 1000000, endMs: 1100000, state: "veryHigh", reasons: [] },
      { startMs: 1050000, endMs: 1150000, state: "high", reasons: [] },
    ];

    // Should return veryHigh since it's first in the array
    expect(getQualityStateAt(intervals, 1070000)).toBe("veryHigh");
  });

  it("handles all quality states", () => {
    const states: QualityIntervalRecord[] = [
      { startMs: 1000000, endMs: 1010000, state: "veryHigh", reasons: [] },
      { startMs: 1010000, endMs: 1020000, state: "high", reasons: [] },
      { startMs: 1020000, endMs: 1030000, state: "medium", reasons: [] },
      { startMs: 1030000, endMs: 1040000, state: "low", reasons: [] },
      { startMs: 1040000, endMs: 1050000, state: "unstable", reasons: [] },
      { startMs: 1050000, endMs: 1060000, state: "disconnected", reasons: [] },
      { startMs: 1060000, endMs: 1070000, state: "warmingUp", reasons: [] },
    ];

    expect(getQualityStateAt(states, 1005000)).toBe("veryHigh");
    expect(getQualityStateAt(states, 1015000)).toBe("high");
    expect(getQualityStateAt(states, 1025000)).toBe("medium");
    expect(getQualityStateAt(states, 1035000)).toBe("low");
    expect(getQualityStateAt(states, 1045000)).toBe("unstable");
    expect(getQualityStateAt(states, 1055000)).toBe("disconnected");
    expect(getQualityStateAt(states, 1065000)).toBe("warmingUp");
  });
});
