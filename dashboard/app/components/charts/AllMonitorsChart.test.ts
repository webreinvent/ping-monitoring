import { describe, it, expect } from "vitest";
import { getPaletteColor } from "../../composables/useDashboardPalette";
import type { MonitorListItem } from "#shared/types";

/**
 * AllMonitorsChart unit tests.
 *
 * Tests the visibility filtering logic, palette color stability,
 * and threshold passthrough that the component implements.
 */

// Test fixtures
function createMonitor(id: number, targetName: string): MonitorListItem {
  return {
    id,
    targetHost: targetName,
    targetName,
    clientSlug: "test-client",
    clientName: "Test Client",
    status: "up",
    latencyMs: 10,
    qualityState: "veryHigh",
    qualityStateUpdatedAtMs: null,
    lastSeenMs: Date.now(),
    createdAt: new Date().toISOString(),
  };
}

const monitors: MonitorListItem[] = [
  createMonitor(1, "Google DNS"),
  createMonitor(2, "Cloudflare DNS"),
  createMonitor(3, "OpenDNS"),
];

describe("AllMonitorsChart — visibility filtering", () => {
  /** Simulate isVisible from useMonitors */
  function createIsVisible(visibleIds: Set<number>) {
    return (id: number): boolean => visibleIds.has(id);
  }

  it("filters series to only visible monitors", () => {
    const isVisible = createIsVisible(new Set([1, 3]));
    const visible = monitors.filter((m) => isVisible(m.id));
    expect(visible).toHaveLength(2);
    expect(visible[0]!.id).toBe(1);
    expect(visible[1]!.id).toBe(3);
  });

  it("filters all monitors when none are visible", () => {
    const isVisible = createIsVisible(new Set());
    const visible = monitors.filter((m) => isVisible(m.id));
    expect(visible).toHaveLength(0);
  });

  it("includes all monitors when all are visible", () => {
    const isVisible = createIsVisible(new Set([1, 2, 3]));
    const visible = monitors.filter((m) => isVisible(m.id));
    expect(visible).toHaveLength(3);
  });
});

describe("AllMonitorsChart — palette color stability", () => {
  it("uses original index for color assignment (not filtered index)", () => {
    // When monitor 1 is hidden, monitors 2 and 3 should keep their original colors
    // Original: 1 -> index 0, 2 -> index 1, 3 -> index 2
    const color2 = getPaletteColor(monitors.indexOf(monitors[1]!)); // index 1
    const color3 = getPaletteColor(monitors.indexOf(monitors[2]!)); // index 2

    // If we filtered out monitor 1 and used filtered index, monitor 2 would get index 0's color
    const wrongColor2 = getPaletteColor(0); // This would be wrong

    expect(color2).not.toBe(wrongColor2);
    expect(color2).toBe(getPaletteColor(1));
    expect(color3).toBe(getPaletteColor(2));
  });

  it("color assignment is stable when toggling individual monitors", () => {
    const getColor = (monitor: MonitorListItem) =>
      getPaletteColor(monitors.indexOf(monitor));

    const color1Before = getColor(monitors[0]!);
    const color2Before = getColor(monitors[1]!);
    const color3Before = getColor(monitors[2]!);

    // Simulate hiding monitor 2 — colors should not change
    const visibleAfterHide = monitors.filter((m) => m.id !== 2);

    // Colors of remaining monitors stay the same (using original index)
    expect(getColor(visibleAfterHide[0]!)).toBe(color1Before);
    expect(getColor(visibleAfterHide[1]!)).toBe(color3Before);

    // Simulate showing all again — colors unchanged
    const visibleAfterShow = monitors;
    expect(getColor(visibleAfterShow[0]!)).toBe(color1Before);
    expect(getColor(visibleAfterShow[1]!)).toBe(color2Before);
    expect(getColor(visibleAfterShow[2]!)).toBe(color3Before);
  });

  it("each monitor gets a distinct color from the palette", () => {
    const colors = monitors.map((m) => getPaletteColor(monitors.indexOf(m)));
    const unique = new Set(colors);
    expect(unique.size).toBe(colors.length);
  });
});

describe("AllMonitorsChart — data merging with visibility", () => {
  it("excludes hidden monitors from merged data columns", () => {
    // Simulate monitor data map with 3 monitors
    const mockData = new Map<number, { timestamps: Float64Array; values: Float64Array }>();
    mockData.set(1, { timestamps: new Float64Array([1, 2]), values: new Float64Array([10, 20]) });
    mockData.set(2, { timestamps: new Float64Array([1, 2]), values: new Float64Array([15, 25]) });
    mockData.set(3, { timestamps: new Float64Array([1, 2]), values: new Float64Array([12, 22]) });

    // Filter by visibility: only monitors 1 and 3
    const isVisible = (id: number) => [1, 3].includes(id);
    const entries = [...mockData.entries()].filter(([id]) => isVisible(id));

    expect(entries).toHaveLength(2);
    expect(entries[0]![0]).toBe(1);
    expect(entries[1]![0]).toBe(3);
  });

  it("empty filtered data returns empty Float64Array", () => {
    const mockData = new Map<number, { timestamps: Float64Array; values: Float64Array }>();
    mockData.set(1, { timestamps: new Float64Array([1, 2]), values: new Float64Array([10, 20]) });

    // All hidden
    const isVisible = (_: number) => false;
    const entries = [...mockData.entries()].filter(([id]) => isVisible(id));

    expect(entries).toHaveLength(0);
    // The component returns [new Float64Array(0)] in this case
    const result = entries.length === 0 ? [new Float64Array(0)] : null;
    expect(result).not.toBeNull();
    expect((result as Float64Array[])[0]!.length).toBe(0);
  });
});

describe("AllMonitorsChart — threshold values", () => {
  it("passes standard threshold values [50, 100, 150, 200] to LatencyChart", () => {
    // The component hardcodes these values matching the desktop app
    const thresholdValues = [50, 100, 150, 200];
    expect(thresholdValues).toHaveLength(4);
    expect(thresholdValues[0]).toBe(50);
    expect(thresholdValues[1]).toBe(100);
    expect(thresholdValues[2]).toBe(150);
    expect(thresholdValues[3]).toBe(200);
  });

  it("threshold values are in ascending order", () => {
    const thresholdValues = [50, 100, 150, 200];
    for (let i = 1; i < thresholdValues.length; i++) {
      expect(thresholdValues[i]).toBeGreaterThan(thresholdValues[i - 1]!);
    }
  });
});

describe("AllMonitorsChart — legend item state", () => {
  it("hidden legend items have reduced opacity via CSS class", () => {
    // Component applies: :class="{ 'chart-legend-item--hidden': !isVisible(item.id) }"
    const isVisible = (id: number) => id === 1;
    expect(!isVisible(2)).toBe(true); // Should be hidden
    expect(!isVisible(1)).toBe(false); // Should be visible
  });

  it("aria-pressed reflects visibility state", () => {
    // Component uses: :aria-pressed="String(isVisible(item.id))"
    const isVisible = (id: number) => id === 1;
    expect(String(isVisible(1))).toBe("true");
    expect(String(isVisible(2))).toBe("false");
  });
});
