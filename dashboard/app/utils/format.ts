/**
 * Format a latency value in milliseconds for display.
 * - Values >= 10: round to integer (e.g. 57.8 → "58")
 * - Values < 10:  show 1 decimal (e.g. 4.32 → "4.3")
 * - null/undefined/NaN: return "—"
 */
export function formatMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 10) return String(Math.round(value));
  return value.toFixed(1);
}

/**
 * Format a percentage value for display.
 * - 0: "0"
 * - < 1:  show 1 decimal (e.g. 0.5 → "0.5")
 * - >= 1: round to integer (e.g. 12.7 → "13")
 * - null/undefined/NaN: return "—"
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  if (value < 1) return value.toFixed(1);
  return String(Math.round(value));
}
