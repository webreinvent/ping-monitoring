import { ref, computed, watch, nextTick } from "vue";
import type { WsPingSample, QualityState } from "#shared/types";
import { useWebSocket } from "~/composables/useWebSocket";

/**
 * Maximum number of data points to retain per monitor.
 * Prevents unbounded memory growth. Oldest points are dropped when exceeded.
 */
const MAX_POINTS_PER_MONITOR = 2000;

/**
 * Per-monitor data store for live chart updates.
 */
interface MonitorLiveData {
  timestamps: Float64Array;
  values: Float64Array;
}

/**
 * Centralized composable that bridges WebSocket ping samples into
 * reactive chart data. Consumes `useWebSocket()` internally and
 * exposes a `liveData` Map<monitorId, { timestamps, values }>`
 * that chart components consume and push to uPlot.
 *
 * Key responsibilities:
 * - Subscribe to monitors on demand
 * - Maintain bounded per-monitor time series (caps at MAX_POINTS)
 * - On snapshot: initialize full data for a monitor
 * - On sample: append new data point
 * - Debounce chart updates via requestAnimationFrame
 * - Expose subscription set for reactively tracking what's live
 */
export function useLiveChart() {
  const ws = useWebSocket();

  // Per-monitor live data store
  const liveData = ref<Map<number, MonitorLiveData>>(new Map());

  // Track which monitors we've subscribed to
  const subscribedMonitorIds = ref<Set<number>>(new Set());

  // Track which callbacks have been registered (to avoid calling updateChart multiple times)
  const updateCallbacks = ref<Set<() => void>>(new Set());

  // Debounce flag — prevent multiple rAF calls per frame
  let pendingUpdate = false;

  /**
   * Register a callback that fires on requestAnimationFrame when
   * new live data arrives. This is how parent components schedule
   * their uPlot `updateChart()` calls.
   */
  function onUpdate(callback: () => void): void {
    updateCallbacks.value = new Set(updateCallbacks.value).add(callback);
  }

  /**
   * Remove a registered update callback.
   */
  function offUpdate(callback: () => void): void {
    const newSet = new Set(updateCallbacks.value);
    newSet.delete(callback);
    updateCallbacks.value = newSet;
  }

  /**
   * Schedule a debounced update via requestAnimationFrame.
   * Only one rAF call is queued at a time, regardless of how many
   * samples arrive.
   */
  function scheduleUpdate(): void {
    if (pendingUpdate) return;
    pendingUpdate = true;
    requestAnimationFrame(() => {
      pendingUpdate = false;
      for (const cb of updateCallbacks.value) {
        try {
          cb();
        } catch {
          // Don't let a single callback failure crash the update cycle
        }
      }
    });
  }

  /**
   * Append a sample to the monitor's data, dropping oldest
   * points if MAX_POINTS_PER_MONITOR is exceeded.
   */
  function appendSample(monitorId: number, sample: WsPingSample, _qualityState: QualityState): void {
    let entry = liveData.value.get(monitorId);

    if (!entry) {
      // First sample for this monitor — initialize from this single point
      entry = {
        timestamps: new Float64Array([sample.timestampMs / 1000]),
        values: new Float64Array([sample.latencyMs ?? NaN]),
      };
      liveData.value.set(monitorId, entry);
    } else {
      // Append to existing data
      const currentLen = entry.timestamps.length;
      const willExceed = currentLen + 1 > MAX_POINTS_PER_MONITOR;

      // If at capacity, drop the oldest point and keep size at MAX_POINTS
      const offset = willExceed ? 1 : 0;
      const finalLen = willExceed ? MAX_POINTS_PER_MONITOR : currentLen + 1;

      const newTimestamps = new Float64Array(finalLen);
      const newValues = new Float64Array(finalLen);

      const copyLen = currentLen - offset;
      for (let i = 0; i < copyLen; i++) {
        newTimestamps[i] = entry.timestamps[i + offset] as number;
        newValues[i] = entry.values[i + offset] as number;
      }

      newTimestamps[copyLen] = sample.timestampMs / 1000;
      newValues[copyLen] = sample.latencyMs ?? NaN;

      entry.timestamps = newTimestamps;
      entry.values = newValues;
    }

    scheduleUpdate();
  }

  /**
   * Handle a snapshot — replace the monitor's data entirely.
   * Called when first subscribing (server sends a snapshot of recent history).
   */
  function handleSnapshot(monitorId: number, samples: WsPingSample[], _monitorInfo: { id: number; targetHost: string; targetName: string; status: "up" | "down" | null; latencyMs: number | null; qualityState: QualityState; lastSeenMs: number | null }): void {
    if (samples.length === 0) return;

    // Sort by timestamp (defensive — server should already send sorted)
    const sorted = [...samples].sort((a, b) => a.timestampMs - b.timestampMs);

    // Cap at MAX_POINTS_PER_MONITOR — keep the newest points
    const capped = sorted.length > MAX_POINTS_PER_MONITOR
      ? sorted.slice(-MAX_POINTS_PER_MONITOR)
      : sorted;

    const timestamps = new Float64Array(capped.length);
    const values = new Float64Array(capped.length);

    for (let i = 0; i < capped.length; i++) {
      const s = capped[i]!;
      timestamps[i] = s.timestampMs / 1000;
      values[i] = s.latencyMs ?? NaN;
    }

    liveData.value.set(monitorId, { timestamps, values });

    scheduleUpdate();
  }

  /**
   * Subscribe to a monitor's live feed.
   */
  function subscribe(monitorId: number): void {
    if (subscribedMonitorIds.value.has(monitorId)) return;
    subscribedMonitorIds.value = new Set(subscribedMonitorIds.value).add(monitorId);
    ws.subscribe(monitorId);
  }

  /**
   * Unsubscribe from a monitor's live feed.
   */
  function unsubscribe(monitorId: number): void {
    subscribedMonitorIds.value = new Set(subscribedMonitorIds.value);
    subscribedMonitorIds.value.delete(monitorId);
    ws.unsubscribe(monitorId);
  }

  /**
   * Check if a monitor is currently subscribed for live updates.
   */
  function isSubscribed(monitorId: number): boolean {
    return subscribedMonitorIds.value.has(monitorId);
  }

  // Register WebSocket callbacks
  ws.onSample(appendSample);
  ws.onSnapshot(handleSnapshot);

  // Expose reactive liveData so components can watch it
  // The Map itself is reactive (ref), so watch(liveData, ...) works

  return {
    liveData,
    subscribedMonitorIds,
    subscribe,
    unsubscribe,
    isSubscribed,
    onUpdate,
    offUpdate,
    connectionState: ws.connectionState,
  };
}
