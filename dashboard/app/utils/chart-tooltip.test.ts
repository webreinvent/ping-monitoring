import { describe, it, expect } from "vitest";

import { calculateTooltipPosition } from "./chart-tooltip";

const CONTAINER = { containerWidth: 800, containerHeight: 300 };
const TOOLTIP = { tooltipWidth: 140, tooltipHeight: 60 };

describe("calculateTooltipPosition", () => {
  it("places the tooltip to the right of the cursor, vertically centered", () => {
    const { left, top } = calculateTooltipPosition({
      anchorX: 200,
      anchorY: 150,
      ...TOOLTIP,
      ...CONTAINER,
    });
    // 12px gap right of cursor; top = anchorY - height/2
    expect(left).toBe(212);
    expect(top).toBe(120);
  });

  it("flips to the left side when it would overflow the right edge", () => {
    const { left } = calculateTooltipPosition({
      anchorX: 700,
      anchorY: 150,
      ...TOOLTIP,
      ...CONTAINER,
    });
    // right = 712; 712 + 140 = 852 > 792 → left side: 700 - 140 - 12 = 548
    expect(left).toBe(548);
  });

  it("keeps the tooltip on the right when it fits", () => {
    const { left } = calculateTooltipPosition({
      anchorX: 600,
      anchorY: 150,
      ...TOOLTIP,
      ...CONTAINER,
    });
    // right = 612; 612 + 140 = 752 <= 792 → no flip
    expect(left).toBe(612);
  });

  it("clamps left to the edge padding when the cursor is near the left edge", () => {
    const { left } = calculateTooltipPosition({
      anchorX: 0,
      anchorY: 150,
      ...TOOLTIP,
      ...CONTAINER,
    });
    // right = 12 → clamped to EDGE_PADDING (8)? No: 12 >= 8, so left stays 12.
    expect(left).toBe(12);
  });

  it("clamps left to EDGE_PADDING when even the right side is negative", () => {
    const { left } = calculateTooltipPosition({
      anchorX: -100,
      anchorY: 150,
      ...TOOLTIP,
      ...CONTAINER,
    });
    expect(left).toBe(8);
  });

  it("does not flip to the left when the left side would also overflow", () => {
    // Tiny container: both sides overflow → stay right, clamp to max
    const { left } = calculateTooltipPosition({
      anchorX: 50,
      anchorY: 150,
      tooltipWidth: 300,
      tooltipHeight: 60,
      containerWidth: 320,
      containerHeight: 300,
    });
    // right = 62; 62 + 300 = 362 > 312, but leftSide = 50 - 300 - 12 = -262 < 8 → no flip
    // clamp(62, 8, max(8, 320 - 300 - 8)) = clamp(62, 8, 12) = 12
    expect(left).toBe(12);
  });

  it("clamps top to the top edge padding", () => {
    const { top } = calculateTooltipPosition({
      anchorX: 200,
      anchorY: 10,
      ...TOOLTIP,
      ...CONTAINER,
    });
    // top = 10 - 30 = -20 → clamped to 8
    expect(top).toBe(8);
  });

  it("clamps top to the bottom edge", () => {
    const { top } = calculateTooltipPosition({
      anchorX: 200,
      anchorY: 295,
      ...TOOLTIP,
      ...CONTAINER,
    });
    // top = 295 - 30 = 265; max = 300 - 60 - 8 = 232 → clamped to 232
    expect(top).toBe(232);
  });
});
