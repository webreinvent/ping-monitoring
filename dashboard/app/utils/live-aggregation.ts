/**
 * Live aggregation — mirrors the desktop Tauri app's `getBucketSize` +
 * `aggregateData` (src/chart.ts:482) so the dashboard chart shows the same
 * readable bar density as the Tauri client.
 *
 * Why this exists:
 * The WebSocket snapshot delivers ~100 raw ping samples per monitor
 * (one ping per second, ~5 minutes of history). Drawing each sample as
 * a separate bar produces a solid mass. Tauri aggregates raw samples into
 * time-bucketed bars (one bar per N samples) so the chart stays readable
 * regardless of how many raw samples arrive.
 *
 * The target bar count is `rangeMs / 500` (clamped to 100–2000), matching
 * Tauri's `targetBarCount = Math.max(100, Math.min(2000, Math.round(rangeMs / 500)))`.
 * For a 5-minute (300_000 ms) window this yields 600 bars. For a 30-second
 * window it yields 100 bars, matching Tauri's "~80 bars in 30s" visual.
 */

const CLEAN_BUCKET_SIZES = [
  1_000, 5_000, 10_000, 30_000, 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, 3_600_000,
];

function getBucketSize(rangeMs: number, pointCount: number, targetBarCount: number): number {
  if (pointCount <= targetBarCount) return 0; // No aggregation needed
  const rawBucket = Math.max(1_000, Math.round(rangeMs / targetBarCount));
  for (const size of CLEAN_BUCKET_SIZES) {
    if (rawBucket <= size) return size;
  }
  return 3_600_000;
}

/**
 * Aggregate raw live samples into time-bucketed bars.
 * Each bar's value is the **average** of all samples in its bucket —
 * mirrors Tauri's `aggregateData` (latency.reduce((a, b) => a + b) / latency.length).
 *
 * @param timestamps - Seconds (Float64Array of uPlot-style timestamps)
 * @param values - Latency values (ms; NaN for failures)
 * @returns [aggregated timestamps (seconds), aggregated values (ms)]
 */
export function aggregateLiveSamples(
  timestamps: Float64Array,
  values: Float64Array,
): [Float64Array, Float64Array] {
  if (timestamps.length === 0 || values.length === 0) {
    return [new Float64Array(0), new Float64Array(0)];
  }
  if (timestamps.length !== values.length) {
    throw new Error("aggregateLiveSamples: timestamps/values length mismatch");
  }

  const fromMs = timestamps[0]! * 1000;
  const toMs = timestamps[timestamps.length - 1]! * 1000;
  const rangeMs = Math.max(0, toMs - fromMs);
  const pointCount = timestamps.length;

  // Match Tauri's target bar count formula.
  const targetBarCount = Math.max(100, Math.min(2_000, Math.round(rangeMs / 500)));
  let bucketMs = getBucketSize(rangeMs, pointCount, targetBarCount);

  // Tauri's `getBucketSize` returns 0 when pointCount <= targetBarCount (i.e.
  // when the raw sample count is already sparse enough). On the desktop, raw
  // data is rare — the historical fetcher returns pre-aggregated buckets from
  // the server, so this path almost never fires. On the dashboard, however,
  // the WebSocket delivers ~1 raw ping per second (~100 samples in a 5-min
  // window). Tauri's formula would skip aggregation entirely, leaving us
  // with ~100 raw bars spread across 5 minutes — which renders as a sparse
  // cluster at the leading edge of the chart (uPlot draws each raw sample
  // exactly at its timestamp, so most samples pile up at "now").
  //
  // To match Tauri's visual density, we force a minimum bucket of 1 second
  // when raw count is below the target. This means at most 1 bar per second
  // of coverage — keeping the same readable density Tauri's chart shows when
  // it IS aggregating (1s minimum bucket). When the raw stream is faster
  // than 1Hz (rare in practice), Tauri's getBucketSize() handles aggregation
  // automatically.
  if (bucketMs === 0 && rangeMs > 0) {
    bucketMs = 1_000;
  }

  if (bucketMs === 0) {
    // Empty range — nothing to aggregate.
    return [timestamps, values];
  }

  // Bucket samples by their bucket start (ms). Use a sorted iteration since
  // timestamps are already in ascending order (the live store appends in order).
  const buckets = new Map<number, { sum: number; count: number; hasValid: boolean }>();
  for (let i = 0; i < timestamps.length; i++) {
    const tsMs = timestamps[i]! * 1000;
    const v = values[i]!;
    const bucketKey = Math.floor(tsMs / bucketMs) * bucketMs;
    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = { sum: 0, count: 0, hasValid: false };
      buckets.set(bucketKey, bucket);
    }
    if (!Number.isNaN(v) && v != null) {
      bucket.sum += v;
      bucket.count += 1;
      bucket.hasValid = true;
    }
  }

  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
  const outTs = new Float64Array(sortedKeys.length);
  const outVals = new Float64Array(sortedKeys.length);
  for (let i = 0; i < sortedKeys.length; i++) {
    const k = sortedKeys[i]!;
    const bucket = buckets.get(k)!;
    outTs[i] = k / 1000;
    outVals[i] = bucket.hasValid ? bucket.sum / bucket.count : NaN;
  }
  return [outTs, outVals];
}
