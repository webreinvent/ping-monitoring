import type { HistoryPoint, HistoryResponse } from "#shared/types";

/**
 * Transform a HistoryResponse into uPlot-ready data format.
 *
 * uPlot expects Float64Array columns:
 *   Column 0: timestamps in seconds (not ms)
 *   Column 1: latency in ms
 *   Column 2: packet loss percentage (0-100), NaN for buckets with no samples
 *
 * Missing data points (where averageLatencyMs is null) are represented as NaN.
 *
 * @param history - The history response from the API
 * @returns uPlot data array: Float64Array[]
 */
export function transformToUPlotData(history: HistoryResponse): Float64Array[] {
  const seriesArr = history.series ?? [];
  const series = seriesArr[0];
  if (!series || series.points.length === 0) {
    return [new Float64Array(0)];
  }

  const points: HistoryPoint[] = series.points;
  const len = points.length;

  // Column 0: timestamps in seconds
  const timestamps = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    timestamps[i] = points[i]!.timestampMs / 1000;
  }

  // Column 1: average latency (NaN for null)
  const latency = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    latency[i] = points[i]!.averageLatencyMs ?? NaN;
  }

  // Column 2: packet loss percentage
  const packetLoss = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const p = points[i]!;
    packetLoss[i] = p.sampleCount > 0 ? (p.failureCount / p.sampleCount) * 100 : NaN;
  }

  return [timestamps, latency, packetLoss];
}

/**
 * Transform a single monitor's history points for a multi-series chart.
 * Returns [Float64Array, Float64Array] format for uPlot.
 *
 * @param points - The history points for a single monitor
 * @returns [timestamps (seconds), values (ms)]
 */
export function transformPointsToUPlotSeries(points: HistoryPoint[]): [Float64Array, Float64Array] {
  if (points.length === 0) {
    return [new Float64Array(0), new Float64Array(0)];
  }

  const len = points.length;
  const timestamps = new Float64Array(len);
  const values = new Float64Array(len);

  for (let i = 0; i < len; i++) {
    timestamps[i] = points[i]!.timestampMs / 1000;
    values[i] = points[i]!.averageLatencyMs ?? NaN;
  }

  return [timestamps, values];
}

/**
 * Compute packet loss percentage series from history points.
 * Returns a Float64Array of loss percentages (0-100) aligned to timestamps.
 * Buckets with no samples produce NaN.
 */
export function computePacketLossSeries(points: HistoryPoint[]): Float64Array {
  const len = points.length;
  const loss = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const p = points[i]!;
    loss[i] = p.sampleCount > 0 ? (p.failureCount / p.sampleCount) * 100 : NaN;
  }
  return loss;
}
