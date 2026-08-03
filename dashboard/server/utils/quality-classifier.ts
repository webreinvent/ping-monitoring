import { getDb } from "./db";
import { info, debug, error as logError } from "./logger";
import {
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
} from "./quality-states";
import type { QualityState, ClassifyResult } from "#shared/types";

/**
 * Extended result that includes the previous state and change flag.
 * Used by classifyMonitorsBatch to detect state changes without re-reading the DB.
 */
interface ClassifyResultWithDiff extends ClassifyResult {
  previousState: string | null;
  stateChanged: boolean;
}

/**
 * Classify a single monitor's quality based on its recent ping samples.
 * Uses a 5-minute sliding window. Persists result to the monitor row.
 *
 * Algorithm (first match wins):
 * 1. Disconnected — no samples in window AND (last sample > 5 min ago OR no samples at all)
 *    — but only if last sample was within the last hour (otherwise it's warmingUp)
 * 2. WarmingUp — fewer than 10 samples in window
 * 3. Unstable — cv > 0.5 AND packet_loss < 10%
 * 4. VeryHigh — packet_loss == 0% AND avg_latency < 50ms
 * 5. High — packet_loss == 0% AND avg_latency < 150ms
 * 6. Medium — packet_loss <= 10% AND avg_latency <= 300ms
 * 7. Low — everything else
 *
 * @param monitorId - The monitor to classify
 * @returns ClassifyResult with state, metrics, previous state, and change flag
 */
export function classifyMonitor(monitorId: number): ClassifyResultWithDiff {
  const db = getDb();
  const now = Date.now();
  const windowStart = now - QUALITY_WINDOW_MS;

  // Query #1: Aggregated stats for the 5-minute window + current monitor row
  // to get the existing quality_state in one query (avoids re-read in batch).
  const row = db
    .prepare(`
      SELECT
        COUNT(ps.id) AS sample_count,
        SUM(CASE WHEN ps.status = 'success' THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN ps.status = 'success' AND ps.latency_ms IS NOT NULL THEN ps.latency_ms END) AS sum_latency,
        SUM(CASE WHEN ps.status = 'success' AND ps.latency_ms IS NOT NULL THEN ps.latency_ms * ps.latency_ms END) AS sum_latency_sq,
        COUNT(CASE WHEN ps.status = 'success' AND ps.latency_ms IS NOT NULL THEN 1 END) AS latency_count,
        m.quality_state AS current_quality_state
      FROM monitors m
      LEFT JOIN ping_samples ps ON ps.monitor_id = m.id
        AND ps.timestamp_ms >= ?
      WHERE m.id = ?
    `)
    .get(windowStart, monitorId) as {
    sample_count: number;
    success_count: number | null;
    sum_latency: number | null;
    sum_latency_sq: number | null;
    latency_count: number;
    current_quality_state: string | null;
  };

  const sampleCount = row.sample_count;
  const successCount = row.success_count ?? 0;
  const previousState = row.current_quality_state;

  // Compute packet loss
  const packetLoss = sampleCount > 0
    ? (1 - successCount / sampleCount) * 100
    : 0;

  // Compute avg latency and stddev
  const latencyCount = row.latency_count;
  let avgLatency = 0;
  let cv = 0;

  if (latencyCount > 0) {
    const sumLatency = row.sum_latency ?? 0;
    const sumLatencySq = row.sum_latency_sq ?? 0;
    avgLatency = sumLatency / latencyCount;

    // Variance = E[X^2] - E[X]^2
    const variance = (sumLatencySq / latencyCount) - (avgLatency * avgLatency);
    const stddev = Math.sqrt(Math.max(0, variance));
    cv = avgLatency > 0 ? stddev / avgLatency : 0;
  }

  // Query #2: Last sample time (for disconnected detection)
  const lastRow = db
    .prepare(`
      SELECT MAX(timestamp_ms) AS last_sample_ms
      FROM ping_samples
      WHERE monitor_id = ?
    `)
    .get(monitorId) as { last_sample_ms: number | null };

  const lastSampleMs = lastRow.last_sample_ms;

  // Classify
  const qualityState = classifyFromMetrics({
    sampleCount,
    packetLoss,
    avgLatency,
    cv,
    lastSampleMs,
    now,
  });

  // Persist
  persistQualityState(db, monitorId, qualityState, now);

  const stateChanged = previousState !== qualityState;

  const result: ClassifyResultWithDiff = {
    qualityState,
    qualityStateUpdatedAtMs: now,
    sampleCount,
    packetLoss,
    avgLatency,
    cv,
    previousState,
    stateChanged,
  };

  return result;
}

/**
 * Bulk classify multiple monitors.
 * Returns a Map of monitorId -> new QualityState for monitors whose state actually changed.
 */
export function classifyMonitorsBatch(
  monitorIds: number[],
): Map<number, QualityState> {
  if (monitorIds.length === 0) {
    return new Map();
  }

  const changes = new Map<number, QualityState>();

  for (const monitorId of monitorIds) {
    try {
      const result = classifyMonitor(monitorId);

      if (result.stateChanged) {
        changes.set(monitorId, result.qualityState);
        info(`Quality state changed for monitor ${monitorId}`, {
          monitorId,
          newState: result.qualityState,
          oldState: result.previousState,
          sampleCount: result.sampleCount,
          packetLoss: result.packetLoss.toFixed(1),
          avgLatency: result.avgLatency.toFixed(1),
          cv: result.cv.toFixed(3),
        });
      } else {
        debug(`Quality state unchanged for monitor ${monitorId}`, {
          monitorId,
          state: result.qualityState,
        });
      }
    } catch (err) {
      logError(`Classification failed for monitor ${monitorId}`, {
        monitorId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return changes;
}

// ============================================================================
// Internal: Classification logic
// ============================================================================

/**
 * Internal metrics used for classification decision.
 */
interface ClassificationMetrics {
  sampleCount: number;
  packetLoss: number;
  avgLatency: number;
  cv: number;
  lastSampleMs: number | null;
  now: number;
}

/**
 * Apply the classification algorithm (first match wins).
 */
function classifyFromMetrics(metrics: ClassificationMetrics): QualityState {
  const { sampleCount, packetLoss, avgLatency, cv, lastSampleMs, now } = metrics;

  // 1. Disconnected: no samples in window AND (no samples ever OR last sample > 5 min ago)
  //    But only if last sample was within 1 hour (otherwise it's still warmingUp)
  if (sampleCount === 0) {
    if (lastSampleMs === null) {
      // No samples at all
      return "disconnected";
    }
    const timeSinceLast = now - lastSampleMs;
    if (timeSinceLast > QUALITY_DISCONNECTED_NO_SAMPLES_WINDOW_MS) {
      if (timeSinceLast > QUALITY_DISCONNECTED_RECENT_MS) {
        // Last sample more than 1 hour ago — warmingUp (old monitor with no activity)
        return "warmingUp";
      }
      // Last sample between 5 min and 1 hour ago — disconnected
      return "disconnected";
    }
    // Samples exist but none in 5-min window — could be between pings.
    // Still warmingUp since we don't have enough recent data.
    return "warmingUp";
  }

  // 2. WarmingUp: fewer than 10 samples in window
  if (sampleCount < QUALITY_MIN_SAMPLES) {
    return "warmingUp";
  }

  // 3. Unstable: cv > 0.5 AND packet_loss < 10%
  if (cv > QUALITY_UNSTABLE_CV && packetLoss < QUALITY_UNSTABLE_MAX_PACKET_LOSS) {
    return "unstable";
  }

  // 4. VeryHigh: packet_loss == 0% AND avg_latency < 50ms
  if (packetLoss === 0 && avgLatency < QUALITY_VERY_HIGH_MAX_LATENCY) {
    return "veryHigh";
  }

  // 5. High: packet_loss == 0% AND avg_latency < 150ms
  if (packetLoss === 0 && avgLatency < QUALITY_HIGH_MAX_LATENCY) {
    return "high";
  }

  // 6. Medium: packet_loss <= 10% AND avg_latency <= 300ms
  if (packetLoss <= QUALITY_MEDIUM_MAX_PACKET_LOSS && avgLatency <= QUALITY_MEDIUM_MAX_LATENCY) {
    return "medium";
  }

  // 7. Low: everything else
  return "low";
}

/**
 * Persist the quality state to the monitor row.
 */
function persistQualityState(
  db: ReturnType<typeof getDb>,
  monitorId: number,
  qualityState: QualityState,
  now: number,
): void {
  db.prepare(`
    UPDATE monitors
    SET quality_state = ?, quality_state_updated_at = ?, updated_at = ?
    WHERE id = ?
  `).run(qualityState, now, now, monitorId);
}
