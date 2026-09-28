import type { QualityIntervalRecord, QualityState } from "#shared/types";

/**
 * Color mapping for quality state background bands on charts.
 */
const QUALITY_BAND_COLORS: Record<QualityState, string> = {
  veryHigh: "rgba(34, 197, 94, 0.12)",
  high: "rgba(132, 204, 22, 0.12)",
  medium: "rgba(234, 179, 8, 0.12)",
  low: "rgba(249, 115, 22, 0.15)",
  unstable: "rgba(239, 68, 68, 0.18)",
  disconnected: "rgba(107, 114, 128, 0.20)",
  warmingUp: "rgba(156, 163, 175, 0.10)",
};

/**
 * Convert quality intervals to uPlot band configuration.
 */
export function getQualityBandPaths(
  intervals: QualityIntervalRecord[],
): { start: number; end: number; color: string }[] {
  return intervals.map((interval) => ({
    start: interval.startMs / 1000,
    end: interval.endMs != null ? interval.endMs / 1000 : Date.now() / 1000,
    color: QUALITY_BAND_COLORS[interval.state] ?? QUALITY_BAND_COLORS.warmingUp,
  }));
}

/**
 * Get the quality state at a given timestamp (in ms).
 */
export function getQualityStateAt(
  intervals: QualityIntervalRecord[],
  timestampMs: number,
): QualityState | null {
  for (const interval of intervals) {
    if (
      timestampMs >= interval.startMs &&
      (interval.endMs == null || timestampMs < interval.endMs)
    ) {
      return interval.state;
    }
  }
  return null;
}
