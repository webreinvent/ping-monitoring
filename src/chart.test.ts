import { describe, expect, it } from "vitest";

import {
  palette,
  QUALITY_BAND_COLORS,
  resolveQualityBands,
  THRESHOLD_LINE_COLORS,
} from "./chart";
import type { QualityIntervalRecord, QualityState } from "./types";

const interval = (
  state: QualityState,
  startMs: number,
  endMs: number | null,
): QualityIntervalRecord => ({
  startMs,
  endMs,
  state,
  reasons: [],
});

describe("palette", () => {
  it("exposes the dashboard-matched 12-color series palette", () => {
    expect(palette).toEqual([
      "#3b82f6",
      "#ef4444",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#ec4899",
      "#06b6d4",
      "#f97316",
      "#14b8a6",
      "#6366f1",
      "#84cc16",
      "#e11d48",
    ]);
  });

  it("wraps around for series indices beyond the palette length", () => {
    expect(palette[(palette.length + 3) % palette.length]).toBe(palette[3]);
  });
});

describe("THRESHOLD_LINE_COLORS", () => {
  it("maps the four latency thresholds to dashboard rgba strokes", () => {
    expect(THRESHOLD_LINE_COLORS).toEqual({
      50: "rgba(69, 223, 194, 0.45)",
      100: "rgba(246, 169, 74, 0.45)",
      150: "rgba(249, 115, 22, 0.45)",
      200: "rgba(255, 107, 120, 0.45)",
    });
  });
});

describe("QUALITY_BAND_COLORS", () => {
  it("matches the dashboard quality-band fills", () => {
    expect(QUALITY_BAND_COLORS).toEqual({
      veryHigh: "rgba(34, 197, 94, 0.12)",
      high: "rgba(132, 204, 22, 0.12)",
      medium: "rgba(234, 179, 8, 0.12)",
      low: "rgba(249, 115, 22, 0.15)",
      unstable: "rgba(239, 68, 68, 0.18)",
      disconnected: "rgba(107, 114, 128, 0.20)",
      warmingUp: "rgba(156, 163, 175, 0.10)",
      // Desktop-only states fall back to the disconnected gray
      paused: "rgba(107, 114, 128, 0.20)",
      unobserved: "rgba(107, 114, 128, 0.20)",
      error: "rgba(107, 114, 128, 0.20)",
    });
  });
});

describe("resolveQualityBands", () => {
  it("converts millisecond timestamps to seconds", () => {
    const bands = resolveQualityBands([interval("low", 20_000, 50_000)], 60_000);
    expect(bands).toEqual([{ startSec: 20, endSec: 50, color: QUALITY_BAND_COLORS.low }]);
  });

  it("falls back for open-ended intervals", () => {
    const bands = resolveQualityBands([interval("high", 10_000, null)], 90_000);
    expect(bands[0].endSec).toBe(90);
  });

  it("uses the warmingUp fill for unmapped states", () => {
    const bands = resolveQualityBands(
      [interval("bogus" as unknown as QualityState, 0, 1_000)],
      1_000,
    );
    expect(bands[0].color).toBe(QUALITY_BAND_COLORS.warmingUp);
  });

  it("returns no bands for empty input", () => {
    expect(resolveQualityBands([], 60_000)).toEqual([]);
  });
});
