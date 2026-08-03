import type { QualityState } from "#shared/types";

export type { QualityState };

/**
 * Map a quality_state value from the database to a typed QualityState.
 * Handles both F12 values and legacy values with fallback to "warmingUp".
 *
 * F12 values: veryHigh, high, medium, low, unstable, disconnected, warmingUp
 * Legacy values (mapped to warmingUp as fallback): good, degraded, poor
 */
export function mapQualityState(state: string): QualityState {
  if (
    state === "veryHigh" ||
    state === "high" ||
    state === "medium" ||
    state === "low" ||
    state === "unstable" ||
    state === "disconnected" ||
    state === "warmingUp"
  ) {
    return state;
  }
  // Legacy/unknown fallback
  return "warmingUp";
}

/** 5-minute sliding window for classification */
export const QUALITY_WINDOW_MS = 5 * 60 * 1000;

/** Minimum samples required before classification can proceed */
export const QUALITY_MIN_SAMPLES = 10;

/** VeryHigh: packet_loss == 0% AND avg_latency < 50ms */
export const QUALITY_VERY_HIGH_MAX_LATENCY = 50;

/** High: packet_loss == 0% AND avg_latency < 150ms */
export const QUALITY_HIGH_MAX_LATENCY = 150;

/** Medium: packet_loss <= 10% AND avg_latency <= 300ms */
export const QUALITY_MEDIUM_MAX_LATENCY = 300;
export const QUALITY_MEDIUM_MAX_PACKET_LOSS = 10;

/** Unstable: cv > 0.5 AND packet_loss < 10% */
export const QUALITY_UNSTABLE_CV = 0.5;
export const QUALITY_UNSTABLE_MAX_PACKET_LOSS = 10;

/** Disconnected: no samples in window AND last sample > 5 min ago AND last sample < 1 hour ago */
export const QUALITY_DISCONNECTED_NO_SAMPLES_WINDOW_MS = 5 * 60 * 1000;
export const QUALITY_DISCONNECTED_RECENT_MS = 60 * 60 * 1000;

/** Display color mapping for quality states */
export const QUALITY_COLORS: Record<QualityState, string> = {
  veryHigh: "#22c55e", // green-500
  high: "#84cc16", // lime-500
  medium: "#eab308", // yellow-500
  low: "#f97316", // orange-500
  unstable: "#ef4444", // red-500
  disconnected: "#6b7280", // gray-500
  warmingUp: "#9ca3af", // gray-400
};
