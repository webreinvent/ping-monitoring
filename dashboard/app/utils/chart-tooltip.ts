/**
 * Hover-tooltip positioning for the uPlot latency charts.
 *
 * Pure, DOM-free (port of the desktop app's `src/chart-tooltip.ts`): given the
 * cursor anchor and the tooltip/container sizes, returns the `left`/`top` that
 * keeps the tooltip inside the chart. Prefers the right of the cursor, flips to
 * the left when it would overflow, and clamps to the container edges.
 */

export interface TooltipPositionInput {
  anchorX: number;
  anchorY: number;
  tooltipWidth: number;
  tooltipHeight: number;
  containerWidth: number;
  containerHeight: number;
}

export interface TooltipPosition {
  left: number;
  top: number;
}

const EDGE_PADDING = 8;
const CURSOR_GAP = 12;

export function calculateTooltipPosition({
  anchorX,
  anchorY,
  tooltipWidth,
  tooltipHeight,
  containerWidth,
  containerHeight,
}: TooltipPositionInput): TooltipPosition {
  const right = anchorX + CURSOR_GAP;
  const leftSide = anchorX - tooltipWidth - CURSOR_GAP;
  let left = right;
  if (right + tooltipWidth > containerWidth - EDGE_PADDING && leftSide >= EDGE_PADDING) {
    left = leftSide;
  }

  const top = anchorY - tooltipHeight / 2;

  return {
    left: clamp(left, EDGE_PADDING, Math.max(EDGE_PADDING, containerWidth - tooltipWidth - EDGE_PADDING)),
    top: clamp(top, EDGE_PADDING, Math.max(EDGE_PADDING, containerHeight - tooltipHeight - EDGE_PADDING)),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
