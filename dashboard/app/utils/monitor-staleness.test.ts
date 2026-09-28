import { describe, it, expect } from "vitest";

import { isMonitorStale, STALE_THRESHOLD_MS } from "./monitor-staleness";

const NOW = 1_000_000_000;

describe("isMonitorStale", () => {
  it("is false when data arrived within the threshold", () => {
    expect(isMonitorStale(NOW - 5_000, NOW)).toBe(false);
  });

  it("is false exactly at the threshold boundary", () => {
    expect(isMonitorStale(NOW - STALE_THRESHOLD_MS, NOW)).toBe(false);
  });

  it("is true when data is older than the threshold", () => {
    expect(isMonitorStale(NOW - (STALE_THRESHOLD_MS + 1), NOW)).toBe(true);
  });

  it("is true for long-stale monitors", () => {
    // Last seen 3 minutes ago — well past the 10s rule.
    expect(isMonitorStale(NOW - 180_000, NOW)).toBe(true);
  });

  it("is false when the monitor has no samples (lastSeenMs null)", () => {
    // Brand-new monitors keep their quality-state color (warmingUp).
    expect(isMonitorStale(null, NOW)).toBe(false);
  });

  it("is false before the client clock starts (nowMs <= 0, SSR)", () => {
    expect(isMonitorStale(0, 0)).toBe(false);
    expect(isMonitorStale(NOW, 0)).toBe(false);
  });

  it("supports a custom threshold", () => {
    expect(isMonitorStale(NOW - 5_000, NOW, 3_000)).toBe(true);
    expect(isMonitorStale(NOW - 1_000, NOW, 3_000)).toBe(false);
  });
});
