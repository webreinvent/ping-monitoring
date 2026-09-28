/**
 * Sidebar monitor dot freshness rule.
 *
 * A monitor's status dot turns red when no ping sample has been received
 * within STALE_THRESHOLD_MS. This is a UI-level rule that complements the
 * server-side quality classifier, which only marks a monitor
 * "disconnected" after 5 minutes of silence — the dot reacts in seconds.
 */

/** No ping data for this long → the dot turns red. */
export const STALE_THRESHOLD_MS = 10_000;

/**
 * Whether a monitor's dot should be red because no data has arrived
 * recently.
 *
 * - `lastSeenMs === null` (no samples ever) → false: the monitor keeps
 *   its quality-state color (warmingUp / disconnected).
 * - `nowMs <= 0` (SSR, or the client clock has not ticked yet) → false.
 */
export function isMonitorStale(
  lastSeenMs: number | null,
  nowMs: number,
  thresholdMs: number = STALE_THRESHOLD_MS,
): boolean {
  if (lastSeenMs == null || nowMs <= 0) return false;
  return nowMs - lastSeenMs > thresholdMs;
}
