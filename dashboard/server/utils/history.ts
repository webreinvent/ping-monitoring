import { getDb } from "./db";
import { mapQualityState } from "./quality-states";
import type {
  HistoryPoint,
  QualityIntervalRecord,
  QualityState,
  QualityReason,
  RangeSummary,
  Target,
} from "#shared/types";

// ============================================================================
// Constants
// ============================================================================

/**
 * Clean bucket sizes (ms) matching the frontend chart.ts getBucketSize().
 * Used for down-sampling when point count exceeds maxPoints.
 */
const CLEAN_BUCKET_SIZES = [
  1000, 5000, 10000, 30000, 60000, 300000, 900000, 1800000, 3600000,
];

/** Default bucket size: 1 minute */
const DEFAULT_BUCKET_MS = 60000;

/** Warming-up threshold: 30 seconds */
const WARMING_UP_SECONDS = 30;

/** Minimum samples to exit warming-up */
const MIN_SAMPLES_FOR_WARMING = 5;

/**
 * Default thresholds for the Target type.
 * Used when building Target from DB rows that don't store these fields.
 */
const DEFAULT_THRESHOLDS = {
  windowSeconds: 300,
  minimumSamples: 10,
  packetLossPercent: 1,
  jitterMs: 20,
  p95LatencyMs: 100,
  unstableForSeconds: 60,
  stableForSeconds: 30,
  outageFailures: 5,
  recoverySuccesses: 3,
};

// ============================================================================
// DB row types
// ============================================================================

interface AggregatedRow {
  timestamp_ms: number;
  sample_count: number;
  success_count: number;
  failure_count: number;
  average_latency_ms: number | null;
  minimum_latency_ms: number | null;
  maximum_latency_ms: number | null;
}

export interface MonitorRow {
  id: number;
  client_id: number;
  target_host: string;
  target_name: string | null;
  quality_state: string;
  quality_state_updated_at: number | null;
  state_since_ms: number | null;
  last_seen_ms: number | null;
  last_status: string | null;
  last_latency_ms: number | null;
  created_at: number;
  updated_at: number;
}

export interface ClientRow {
  id: number;
  slug: string;
  name: string;
  username: string;
  hostname: string;
  mac_address: string;
  sync_enabled: number;
  sync_interval_min: number;
  backend_url: string;
  last_synced_at_ms: number | null;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Calculate the optimal bucket size to fit within maxPoints.
 *
 * Starts with 1-minute buckets and increases to larger sizes
 * until the expected bucket count fits within maxPoints.
 */
export function calculateBucketSize(
  fromMs: number,
  toMs: number,
  maxPoints: number,
): number {
  const rangeMs = toMs - fromMs;

  // Try each clean bucket size starting from the default (1 minute)
  for (const bucketMs of CLEAN_BUCKET_SIZES) {
    if (bucketMs < DEFAULT_BUCKET_MS) {
      continue; // Skip sub-minute buckets
    }
    const expectedCount = Math.ceil(rangeMs / bucketMs);
    if (expectedCount <= maxPoints) {
      return bucketMs;
    }
  }

  // If even the largest bucket doesn't fit, return the largest
  return CLEAN_BUCKET_SIZES[CLEAN_BUCKET_SIZES.length - 1] ?? 3600000;
}

/**
 * Fetch aggregated history points from ping_samples for a monitor in a time range.
 *
 * Uses GROUP BY on truncated timestamps to produce time-bucketed records.
 * Returns empty array when no data exists in the range.
 */
export function getMonitorHistoryPoints(
  monitorId: number,
  fromMs: number,
  toMs: number,
  bucketMs: number,
): HistoryPoint[] {
  const db = getDb();

  const rows = db
    .prepare(`
    SELECT
      CAST(floor(timestamp_ms / :bucketMs) * :bucketMs AS INTEGER) AS timestamp_ms,
      COUNT(*) AS sample_count,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
      SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failure_count,
      AVG(CASE WHEN latency_ms IS NOT NULL THEN latency_ms END) AS average_latency_ms,
      MIN(latency_ms) AS minimum_latency_ms,
      MAX(latency_ms) AS maximum_latency_ms
    FROM ping_samples
    WHERE monitor_id = :monitor_id
      AND timestamp_ms > :fromMs
      AND timestamp_ms <= :toMs
    GROUP BY CAST(floor(timestamp_ms / :bucketMs) * :bucketMs AS INTEGER)
    ORDER BY timestamp_ms ASC
  `)
    .all({
      monitor_id: monitorId,
      fromMs,
      toMs,
      bucketMs,
    }) as Array<AggregatedRow>;

  return rows.map((row) => ({
    timestampMs: row.timestamp_ms,
    averageLatencyMs: row.average_latency_ms,
    minimumLatencyMs: row.minimum_latency_ms,
    maximumLatencyMs: row.maximum_latency_ms,
    sampleCount: row.sample_count,
    failureCount: row.failure_count,
  }));
}

/**
 * Compute quality intervals from aggregated history points.
 *
 * Iterates through points and assigns a quality state to each,
 * then merges consecutive points with the same state into intervals.
 *
 * Quality states:
 * - warmingUp: first 30s or fewer than 5 cumulative samples
 * - low: packetLoss < 1%, avgLatency < 50ms
 * - medium: packetLoss < 5%, avgLatency < 100ms
 * - high: packetLoss < 10%, avgLatency < 200ms
 * - veryHigh: packetLoss < 10%, avgLatency >= 200ms
 * - unstable: packetLoss >= 10%
 * - disconnected: gap between points > 2x bucket size
 */
export function computeQualityIntervals(
  points: HistoryPoint[],
  bucketMs: number = DEFAULT_BUCKET_MS,
): QualityIntervalRecord[] {
  if (points.length === 0) {
    return [];
  }

  const intervals: QualityIntervalRecord[] = [];
  let cumulativeSamples = 0;

  let currentStartMs: number | null = null;
  let currentState: QualityState = "warmingUp";
  let currentReasons: QualityReason[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i]!;
    cumulativeSamples += point.sampleCount;

    // Detect gaps (disconnected intervals)
    if (i > 0) {
      const prevPoint = points[i - 1]!;
      const gapMs = point.timestampMs - prevPoint.timestampMs;
      if (gapMs > bucketMs * 2) {
        // Close the current interval
        if (currentStartMs !== null) {
          intervals.push({
            startMs: currentStartMs,
            endMs: prevPoint.timestampMs,
            state: currentState,
            reasons: [...currentReasons],
          });
        }
        // Add disconnected interval
        intervals.push({
          startMs: prevPoint.timestampMs,
          endMs: point.timestampMs,
          state: "disconnected",
          reasons: [],
        });
        // Start new interval
        currentStartMs = point.timestampMs;
        currentState = classifyPoint(point, cumulativeSamples, i);
        currentReasons = collectReasons(point, currentState);
        continue;
      }
    }

    // Classify this point
    const state = classifyPoint(point, cumulativeSamples, i);
    const reasons = collectReasons(point, state);

    if (currentStartMs === null) {
      // First point
      currentStartMs = point.timestampMs;
    }

    if (state !== currentState) {
      // State changed — close current interval and start new one
      if (currentStartMs !== null && i > 0) {
        const prevPoint = points[i - 1]!;
        intervals.push({
          startMs: currentStartMs,
          endMs: prevPoint.timestampMs,
          state: currentState,
          reasons: [...currentReasons],
        });
      }
      currentStartMs = point.timestampMs;
      currentState = state;
      currentReasons = reasons;
    } else {
      currentReasons = [...new Set([...currentReasons, ...reasons])];
    }
  }

  // Close the final interval
  if (currentStartMs !== null) {
    const lastPoint = points[points.length - 1];
    intervals.push({
      startMs: currentStartMs,
      endMs: null, // Open-ended final interval
      state: currentState,
      reasons: [...currentReasons],
    });
  }

  return intervals;
}

/**
 * Classify a single point's quality state.
 * Uses the F12 quality state semantics consistently with quality-classifier.ts:
 * - veryHigh = best quality (0% loss, low latency)
 * - low = worst acceptable quality
 * - unstable = high variance or high packet loss
 *
 * Note: This classification is for historical chart intervals and uses
 * slightly different thresholds than the real-time classifier because
 * it operates on per-bucket aggregates rather than a sliding window.
 */
function classifyPoint(
  point: HistoryPoint,
  cumulativeSamples: number,
  pointIndex: number,
): QualityState {
  // Warming up: fewer than 5 cumulative samples
  if (cumulativeSamples < MIN_SAMPLES_FOR_WARMING) {
    return "warmingUp";
  }

  const totalSamples = point.sampleCount;
  const packetLossPercent =
    totalSamples > 0 ? (point.failureCount / totalSamples) * 100 : 100;
  const avgLatency = point.averageLatencyMs;

  // No success samples at all — treat as unstable (100% loss)
  if (avgLatency === null) {
    return "unstable";
  }

  // Unstable: packetLoss >= 10%
  if (packetLossPercent >= 10) {
    return "unstable";
  }

  // veryHigh: packetLoss < 1%, avgLatency < 50ms (best quality)
  if (packetLossPercent < 1 && avgLatency < 50) {
    return "veryHigh";
  }

  // high: packetLoss < 5%, avgLatency < 100ms
  if (packetLossPercent < 5 && avgLatency < 100) {
    return "high";
  }

  // medium: packetLoss < 10%, avgLatency < 200ms
  if (packetLossPercent < 10 && avgLatency < 200) {
    return "medium";
  }

  // low: packetLoss < 10%, avgLatency >= 200ms (worst acceptable)
  if (packetLossPercent < 10) {
    return "low";
  }

  // Fallback
  return "unstable";
}

/**
 * Collect quality reasons for a given state.
 */
function collectReasons(
  point: HistoryPoint,
  state: QualityState,
): QualityReason[] {
  const reasons: QualityReason[] = [];

  const totalSamples = point.sampleCount;
  const packetLossPercent =
    totalSamples > 0 ? (point.failureCount / totalSamples) * 100 : 100;

  if (state === "warmingUp" && point.sampleCount < MIN_SAMPLES_FOR_WARMING) {
    reasons.push("insufficientSamples");
  }

  if (packetLossPercent >= 10) {
    reasons.push("packetLoss");
  }

  if (point.averageLatencyMs !== null && point.averageLatencyMs >= 200) {
    reasons.push("highLatency");
  }

  return reasons;
}

/**
 * Compute range summary statistics from the full set of aggregated points.
 *
 * Computes packet loss, latency stats, p95, and stable/unstable/disconnected
 * time percentages. Accepts pre-computed quality intervals to avoid redundant
 * computation (since the API endpoint already computes them).
 */
export function computeRangeSummary(
  points: HistoryPoint[],
  intervals: QualityIntervalRecord[] = [],
): RangeSummary {
  if (points.length === 0) {
    return {
      sampleCount: 0,
      successCount: 0,
      failureCount: 0,
      packetLossPercent: 0,
      averageLatencyMs: null,
      minimumLatencyMs: null,
      maximumLatencyMs: null,
      p95LatencyMs: null,
      stableMs: 0,
      unstableMs: 0,
      disconnectedMs: 0,
      stablePercent: 0,
      unstablePercent: 0,
      disconnectedPercent: 0,
    };
  }

  const totalSampleCount = points.reduce(
    (sum, p) => sum + p.sampleCount,
    0,
  );
  const totalFailureCount = points.reduce(
    (sum, p) => sum + p.failureCount,
    0,
  );
  const totalSuccessCount = totalSampleCount - totalFailureCount;

  // Collect all success latencies for stats
  const successLatencies: number[] = [];
  for (const point of points) {
    if (point.averageLatencyMs !== null && point.sampleCount - point.failureCount > 0) {
      // We only have aggregate stats per bucket, so we use the average
      // For p95 we need individual latencies, but since we only have bucket aggregates,
      // we approximate: if a bucket has success samples, include its average once
      // This is a simplification — ideally we'd have individual latencies
      successLatencies.push(point.averageLatencyMs);
    }
  }

  // Compute latency stats from per-bucket averages
  // Note: For accurate p95, we'd need individual sample latencies.
  // Since the aggregation gives us per-bucket averages, we use those
  // as a proxy. For production, this should query individual latencies.
  let averageLatencyMs: number | null = null;
  let minimumLatencyMs: number | null = null;
  let maximumLatencyMs: number | null = null;
  let p95LatencyMs: number | null = null;

  // Get min/max from the aggregated min/max columns (these ARE individual sample extremes)
  const minLatencies: number[] = [];
  const maxLatencies: number[] = [];
  for (const point of points) {
    if (point.minimumLatencyMs !== null) {
      minLatencies.push(point.minimumLatencyMs);
    }
    if (point.maximumLatencyMs !== null) {
      maxLatencies.push(point.maximumLatencyMs);
    }
  }

  if (minLatencies.length > 0) {
    minimumLatencyMs = Math.min(...minLatencies);
  }
  if (maxLatencies.length > 0) {
    maximumLatencyMs = Math.max(...maxLatencies);
  }

  // For average and p95, we use the per-bucket averages as data points
  // (This is an approximation; true p95 requires individual samples)
  if (successLatencies.length > 0) {
    const sum = successLatencies.reduce((s, v) => s + v, 0);
    averageLatencyMs = sum / successLatencies.length;

    // Sort for p95
    const sorted = [...successLatencies].sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    p95LatencyMs = sorted[Math.max(0, p95Index)] ?? null;
  }

  // Compute stable/unstable/disconnected ms from intervals
  // Uses pre-computed intervals if provided, otherwise computes them
  const qualityIntervals =
    intervals.length > 0 ? intervals : computeQualityIntervals(points);
  let stableMs = 0;
  let unstableMs = 0;
  let disconnectedMs = 0;

  const lastPoint = points[points.length - 1]!;

  for (const interval of qualityIntervals) {
    const actualEndMs =
      interval.endMs !== null
        ? interval.endMs
        : lastPoint.timestampMs;
    const actualMs = actualEndMs - interval.startMs;

    switch (interval.state) {
      case "low":
      case "medium":
        stableMs += actualMs;
        break;
      case "high":
      case "veryHigh":
      case "unstable":
        unstableMs += actualMs;
        break;
      case "disconnected":
        disconnectedMs += actualMs;
        break;
      case "warmingUp":
        // Warming up counts as stable for percentage calculations
        stableMs += actualMs;
        break;
    }
  }

  const firstPoint = points[0]!;
  const totalTimeMs =
    points.length > 0
      ? lastPoint.timestampMs - firstPoint.timestampMs
      : 0;

  const stablePercent =
    totalTimeMs > 0 ? (stableMs / totalTimeMs) * 100 : 0;
  const unstablePercent =
    totalTimeMs > 0 ? (unstableMs / totalTimeMs) * 100 : 0;
  const disconnectedPercent =
    totalTimeMs > 0 ? (disconnectedMs / totalTimeMs) * 100 : 0;

  return {
    sampleCount: totalSampleCount,
    successCount: totalSuccessCount,
    failureCount: totalFailureCount,
    packetLossPercent:
      totalSampleCount > 0 ? (totalFailureCount / totalSampleCount) * 100 : 0,
    averageLatencyMs,
    minimumLatencyMs,
    maximumLatencyMs,
    p95LatencyMs,
    stableMs,
    unstableMs,
    disconnectedMs,
    stablePercent,
    unstablePercent,
    disconnectedPercent,
  };
}

/**
 * Build a Target object from monitor and client DB rows.
 * Uses sensible defaults for fields not stored in the DB.
 */
export function buildTarget(
  monitorRow: MonitorRow,
  clientRow: ClientRow | null,
): Target {
  const targetName = monitorRow.target_name ?? monitorRow.target_host;

  // Determine address family from target_host
  // Simple heuristic: if it looks like an IPv6 address (contains ':'), use ipv6
  const addressFamily: "ipv4" | "ipv6" =
    monitorRow.target_host.includes(":") ? "ipv6" : "ipv4";

  // F12: Map quality_state to QualityState type
  const qualityState = mapQualityState(monitorRow.quality_state);

  return {
    id: String(monitorRow.id),
    name: targetName,
    host: monitorRow.target_host,
    enabled: true,
    addressFamily,
    qualityState,
    qualityStateUpdatedAtMs: monitorRow.quality_state_updated_at,
    intervalMs: 1000,
    timeoutMs: 5000,
    thresholds: { ...DEFAULT_THRESHOLDS },
    createdAtMs: monitorRow.created_at,
    archivedAtMs: null,
  };
}
