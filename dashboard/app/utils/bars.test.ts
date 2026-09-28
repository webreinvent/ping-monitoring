import { describe, expect, it } from "vitest";

import {
  BAR_COLOR_THRESHOLDS,
  BAR_GAP_FILL,
  barFillColor,
  medianLatencyFill,
} from "./bars";

describe("BAR_COLOR_THRESHOLDS", () => {
  it("mirrors the desktop chart's bar-color thresholds exactly", () => {
    expect(BAR_COLOR_THRESHOLDS).toEqual([
      [50, "#4ade80"],
      [100, "#facc15"],
      [200, "#fb923c"],
      [Infinity, "#f87171"],
    ]);
  });
});

describe("BAR_GAP_FILL", () => {
  it("is the desktop chart's gap-fill gray", () => {
    expect(BAR_GAP_FILL).toBe("rgba(148, 163, 184, 0.25)");
  });
});

describe("barFillColor", () => {
  it("maps the threshold boundaries", () => {
    expect(barFillColor(0)).toBe(BAR_GAP_FILL);
    expect(barFillColor(0.1)).toBe("#4ade80");
    expect(barFillColor(49.9)).toBe("#4ade80");
    expect(barFillColor(50)).toBe("#facc15");
    expect(barFillColor(99.9)).toBe("#facc15");
    expect(barFillColor(100)).toBe("#fb923c");
    expect(barFillColor(199.9)).toBe("#fb923c");
    expect(barFillColor(200)).toBe("#f87171");
    expect(barFillColor(500)).toBe("#f87171");
  });
});

describe("medianLatencyFill", () => {
  it("returns the fallback 10 when no positive values exist", () => {
    expect(medianLatencyFill([])).toBe(10);
    expect(medianLatencyFill([NaN, NaN])).toBe(10);
    expect(medianLatencyFill([0, 0, 0])).toBe(10);
  });

  it("excludes NaN and zero values from the median", () => {
    expect(medianLatencyFill([NaN, 0, 30, 70, 10, 50])).toBe(50);
  });

  it("picks the upper-middle element for even lengths (mirrors align)", () => {
    expect(medianLatencyFill([10, 30])).toBe(30);
  });

  it("is order-independent", () => {
    expect(medianLatencyFill([70, 10, 30, 50, 20])).toBe(30);
  });
});
