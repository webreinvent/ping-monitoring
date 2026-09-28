/**
 * Bar-fill semantics for the single-monitor bar-mode chart.
 *
 * Mirrors the desktop (Tauri) chart's bar-mode fills exactly (`src/chart.ts`:
 * `barColor` + `alignSeries` gap-fill) so both surfaces render identical
 * colors: latency-bucketed columns filled per-bar by threshold color, with
 * buckets lacking a usable latency rendered as gray bars at a median-fill
 * height. Pure functions — no chart or DOM dependencies, directly testable.
 */

/** Threshold→fill-color ladder (exact mirror of the desktop chart's). */
export const BAR_COLOR_THRESHOLDS: [number, string][] = [
  [50, "#4ade80"],
  [100, "#facc15"],
  [200, "#fb923c"],
  [Infinity, "#f87171"],
];

/** Fill for bars without a usable latency (gap buckets and zero-latency). */
export const BAR_GAP_FILL = "rgba(148, 163, 184, 0.25)";

/** Fill color for a bucketed latency value. `0` maps to the gap gray. */
export function barFillColor(latencyMs: number): string {
  if (latencyMs === 0) return BAR_GAP_FILL;
  for (const [threshold, color] of BAR_COLOR_THRESHOLDS) {
    if (latencyMs < threshold) return color;
  }
  return "#ef4444";
}

/**
 * Median of the positive latency values (gap-fill height).
 *
 * Mirrors the desktop chart's `alignSeries` gap-fill: median of that series'
 * positive latencies (upper-middle element), falling back to 10 when no
 * positive values exist.
 */
export function medianLatencyFill(values: ArrayLike<number>): number {
  const positives: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!Number.isNaN(v) && v > 0) positives.push(v);
  }
  if (positives.length === 0) return 10;
  positives.sort((a, b) => a - b);
  return positives[Math.floor(positives.length / 2)]!;
}
