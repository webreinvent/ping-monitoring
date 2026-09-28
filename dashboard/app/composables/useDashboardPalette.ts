/**
 * 12-color palette for simultaneous monitor series in uPlot charts.
 * Colors are chosen for distinguishability against the dark theme.
 */
const DASHBOARD_PALETTE: readonly string[] = [
  "#3b82f6", // blue-500
  "#ef4444", // red-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#14b8a6", // teal-500
  "#6366f1", // indigo-500
  "#84cc16", // lime-500
  "#e11d48", // rose-600
];

/**
 * Get a palette color by index. Wraps around if index exceeds the palette.
 *
 * @param index - Zero-based index into the palette
 * @returns The hex color string
 */
export function getPaletteColor(index: number): string {
  return DASHBOARD_PALETTE[index % DASHBOARD_PALETTE.length] ?? DASHBOARD_PALETTE[0]!;
}

/**
 * Return the full palette array for iteration.
 */
export function useDashboardPalette(): readonly string[] {
  return DASHBOARD_PALETTE;
}
