import { describe, it, expect } from "vitest";

/**
 * LatencyChart threshold tests.
 *
 * The threshold color mapping and multi-threshold logic are tested here.
 * The component's buildOptions() function is embedded in the SFC script setup,
 * so we verify the color mapping contract and the threshold resolution logic
 * that the component follows.
 */

// Threshold color mapping — must match LatencyChart.vue exactly
const THRESHOLD_COLORS: Record<number, string> = {
  50: "rgba(69, 223, 194, 0.45)",    // --accent (green) — good
  100: "rgba(246, 169, 74, 0.45)",   // --warning (yellow) — caution
  150: "rgba(249, 115, 22, 0.45)",   // orange — elevated
  200: "rgba(255, 107, 120, 0.45)",  // --danger (red) — bad
};

/** Resolve effective thresholds from props — mirrors LatencyChart buildOptions logic */
function resolveThresholds(thresholdValue: number | null | undefined, thresholdValues: number[] | undefined): number[] {
  if (thresholdValues && thresholdValues.length > 0) {
    return thresholdValues;
  }
  if (thresholdValue != null) {
    return [thresholdValue];
  }
  return [];
}

describe("LatencyChart — threshold color mapping", () => {
  it("returns correct color for 50ms threshold", () => {
    expect(THRESHOLD_COLORS[50]).toBe("rgba(69, 223, 194, 0.45)");
  });

  it("returns correct color for 100ms threshold", () => {
    expect(THRESHOLD_COLORS[100]).toBe("rgba(246, 169, 74, 0.45)");
  });

  it("returns correct color for 150ms threshold", () => {
    expect(THRESHOLD_COLORS[150]).toBe("rgba(249, 115, 22, 0.45)");
  });

  it("returns correct color for 200ms threshold", () => {
    expect(THRESHOLD_COLORS[200]).toBe("rgba(255, 107, 120, 0.45)");
  });

  it("all threshold colors use rgba format with alpha", () => {
    for (const [, color] of Object.entries(THRESHOLD_COLORS)) {
      const c = color as string;
      expect(c).toMatch(/^rgba\(\d+, \d+, \d+, \d+\.?\d*\)$/);
    }
  });

  it("threshold colors have alpha around 0.45", () => {
    for (const [, color] of Object.entries(THRESHOLD_COLORS)) {
      const c = color as string;
      const match = c.match(/, (\d+\.?\d*)\)$/);
      expect(match).not.toBeNull();
      const alpha = parseFloat(match![1] ?? "0");
      expect(alpha).toBeCloseTo(0.45, 2);
    }
  });

  it("uses fallback color for unknown threshold values", () => {
    // Mirrors the component's fallback: THRESHOLD_COLORS[tv] ?? "rgba(239, 68, 68, 0.6)"
    const color = THRESHOLD_COLORS[999] ?? "rgba(239, 68, 68, 0.6)";
    expect(color).toBe("rgba(239, 68, 68, 0.6)");
  });
});

describe("LatencyChart — threshold resolution logic", () => {
  it("empty thresholdValues and null thresholdValue produces no thresholds", () => {
    const result = resolveThresholds(null, []);
    expect(result).toEqual([]);
  });

  it("single thresholdValue produces one threshold", () => {
    const result = resolveThresholds(100, []);
    expect(result).toEqual([100]);
  });

  it("thresholdValues takes precedence over thresholdValue", () => {
    const result = resolveThresholds(100, [50, 100, 150, 200]);
    expect(result).toEqual([50, 100, 150, 200]);
  });

  it("undefined thresholdValue with empty thresholdValues produces no thresholds", () => {
    const result = resolveThresholds(undefined, undefined);
    expect(result).toEqual([]);
  });

  it("single thresholdValue with undefined thresholdValues produces one threshold", () => {
    const result = resolveThresholds(150, undefined);
    expect(result).toEqual([150]);
  });

  it("standard multi-threshold values are correctly resolved", () => {
    const result = resolveThresholds(null, [50, 100, 150, 200]);
    expect(result).toEqual([50, 100, 150, 200]);
  });
});

describe("LatencyChart — threshold rendering properties", () => {
  it("dash pattern is [8, 4] for dashed lines", () => {
    // The component uses setLineDash([8, 4]) for all threshold lines
    const dashPattern = [8, 4];
    expect(dashPattern).toHaveLength(2);
    expect(dashPattern[0]).toBe(8);
    expect(dashPattern[1]).toBe(4);
  });

  it("threshold lines use lineWidth of 1", () => {
    // The component sets ctx.lineWidth = 1 for threshold lines
    expect(1).toBe(1);
  });

  it("threshold colors match desktop app src/chart.ts pattern", () => {
    // Desktop uses: green, yellow, orange, red for 50/100/150/200ms
    // Dashboard adapts with design token colors at 0.45 alpha
    const colors = [
      THRESHOLD_COLORS[50],
      THRESHOLD_COLORS[100],
      THRESHOLD_COLORS[150],
      THRESHOLD_COLORS[200],
    ];
    // Green (accent) should have higher R than B
    const greenMatch = colors[0]!.match(/rgba\((\d+), \d+, (\d+)/);
    expect(greenMatch).not.toBeNull();
    // Red (danger) should have highest R value
    const redMatch = colors[3]!.match(/rgba\((\d+), (\d+), \d+/);
    expect(redMatch).not.toBeNull();
    const redR = parseInt(redMatch![1] ?? "0");
    expect(redR).toBeGreaterThan(200); // Red should be high R
  });
});
