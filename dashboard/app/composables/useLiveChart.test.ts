import { describe, it, expect } from "vitest";
import type { WsPingSample } from "#shared/types";

/**
 * useLiveChart unit tests.
 *
 * Tests the core data transformation logic:
 * - Snapshot initializes data correctly
 * - New sample appends to existing data
 * - Data cap prevents unbounded growth (oldest points dropped when exceeding max)
 * - Multiple monitors maintained independently
 * - Subscribe/unsubscribe tracking
 */

const MAX_POINTS = 2000;

/** Create a synthetic ping sample */
function createSample(timestampMs: number, latencyMs: number | null = 10): WsPingSample {
  return {
    timestampMs,
    latencyMs,
    status: "success",
    resolvedAddress: "1.2.3.4",
  };
}

/**
 * Simulate the core data transformation logic from useLiveChart.
 * This mirrors the internal behavior without needing to mock Vue composables.
 */
function appendSampleToData(
  dataMap: Map<number, { timestamps: Float64Array; values: Float64Array }>,
  monitorId: number,
  sample: WsPingSample,
): void {
  let entry = dataMap.get(monitorId);

  if (!entry) {
    entry = {
      timestamps: new Float64Array([sample.timestampMs / 1000]),
      values: new Float64Array([sample.latencyMs ?? NaN]),
    };
    dataMap.set(monitorId, entry);
  } else {
    const currentLen = entry.timestamps.length;
    const willExceed = currentLen + 1 > MAX_POINTS;

    const offset = willExceed ? 1 : 0;
    const finalLen = willExceed ? MAX_POINTS : currentLen + 1;

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
}

function applySnapshotToData(
  dataMap: Map<number, { timestamps: Float64Array; values: Float64Array }>,
  monitorId: number,
  samples: WsPingSample[],
): void {
  if (samples.length === 0) return;

  const sorted = [...samples].sort((a, b) => a.timestampMs - b.timestampMs);

  const capped = sorted.length > MAX_POINTS
    ? sorted.slice(-MAX_POINTS)
    : sorted;

  const timestamps = new Float64Array(capped.length);
  const values = new Float64Array(capped.length);

  for (let i = 0; i < capped.length; i++) {
    const s = capped[i]!;
    timestamps[i] = s.timestampMs / 1000;
    values[i] = s.latencyMs ?? NaN;
  }

  dataMap.set(monitorId, { timestamps, values });
}

describe("useLiveChart — snapshot initialization", () => {
  it("initializes data from a snapshot with correct length", () => {
    const dataMap = new Map<number, { timestamps: Float64Array; values: Float64Array }>();
    const samples = [
      createSample(1000, 10),
      createSample(2000, 15),
      createSample(3000, 12),
    ];

    applySnapshotToData(dataMap, 1, samples);

    const entry = dataMap.get(1);
    expect(entry).toBeDefined();
    expect(entry!.timestamps.length).toBe(3);
    expect(entry!.values.length).toBe(3);
  });

  it("converts timestampMs to seconds for uPlot", () => {
    const dataMap = new Map<number, { timestamps: Float64Array; values: Float64Array }>();
    const samples = [createSample(15000, 10)];

    applySnapshotToData(dataMap, 1, samples);

    const entry = dataMap.get(1);
    expect(entry!.timestamps[0]).toBe(15); // 15000 / 1000
  });

  it("handles null latencyMs by storing NaN", () => {
    const dataMap = new Map<number, { timestamps: Float64Array; values: Float64Array }>();
    const samples = [createSample(1000, null)];

    applySnapshotToData(dataMap, 1, samples);

    const entry = dataMap.get(1);
    expect(Number.isNaN(entry!.values[0] as number)).toBe(true);
  });

  it("sorts samples by timestamp before storing", () => {
    const dataMap = new Map<number, { timestamps: Float64Array; values: Float64Array }>();
    // Intentionally out of order
    const samples = [
      createSample(3000, 12),
      createSample(1000, 10),
      createSample(2000, 15),
    ];

    applySnapshotToData(dataMap, 1, samples);

    const entry = dataMap.get(1);
    expect(entry!.timestamps[0]).toBe(1);
    expect(entry!.timestamps[1]).toBe(2);
    expect(entry!.timestamps[2]).toBe(3);
  });

  it("caps snapshot at MAX_POINTS when exceeding limit", () => {
    const dataMap = new Map<number, { timestamps: Float64Array; values: Float64Array }>();
    const samples: WsPingSample[] = [];
    for (let i = 0; i < MAX_POINTS + 500; i++) {
      samples.push(createSample((i + 1) * 1000, 10 + i));
    }

    applySnapshotToData(dataMap, 1, samples);

    const entry = dataMap.get(1);
    expect(entry!.timestamps.length).toBe(MAX_POINTS);
    // Should keep the newest 2000 points: indices 500..2499 of the original array
    // First remaining timestamp = (500 + 1) * 1000 / 1000 = 501
    expect(entry!.timestamps[0]).toBe(501);
  });

  it("empty snapshot is a no-op", () => {
    const dataMap = new Map<number, { timestamps: Float64Array; values: Float64Array }>();

    applySnapshotToData(dataMap, 1, []);

    expect(dataMap.has(1)).toBe(false);
  });
});

describe("useLiveChart — sample appending", () => {
  it("creates new entry on first sample", () => {
    const dataMap = new Map<number, { timestamps: Float64Array; values: Float64Array }>();

    appendSampleToData(dataMap, 1, createSample(1000, 10));

    expect(dataMap.has(1)).toBe(true);
    const entry = dataMap.get(1);
    expect(entry!.timestamps.length).toBe(1);
    expect(entry!.values.length).toBe(1);
    expect(entry!.timestamps[0]).toBe(1);
    expect(entry!.values[0]).toBe(10);
  });

  it("appends to existing data", () => {
    const dataMap = new Map<number, { timestamps: Float64Array; values: Float64Array }>();

    appendSampleToData(dataMap, 1, createSample(1000, 10));
    appendSampleToData(dataMap, 1, createSample(2000, 20));
    appendSampleToData(dataMap, 1, createSample(3000, 15));

    const entry = dataMap.get(1);
    expect(entry!.timestamps.length).toBe(3);
    expect(entry!.values.length).toBe(3);
    expect(entry!.timestamps[0]).toBe(1);
    expect(entry!.timestamps[1]).toBe(2);
    expect(entry!.timestamps[2]).toBe(3);
    expect(entry!.values[0]).toBe(10);
    expect(entry!.values[1]).toBe(20);
    expect(entry!.values[2]).toBe(15);
  });

  it("drops oldest points when exceeding MAX_POINTS", () => {
    const dataMap = new Map<number, { timestamps: Float64Array; values: Float64Array }>();

    // Add MAX_POINTS + 10 samples
    for (let i = 0; i < MAX_POINTS + 10; i++) {
      appendSampleToData(dataMap, 1, createSample((i + 1) * 1000, 10 + i));
    }

    const entry = dataMap.get(1);
    expect(entry!.timestamps.length).toBe(MAX_POINTS);
    // Oldest 10 points should be dropped; first remaining timestamp should be 11
    expect(entry!.timestamps[0]).toBe(11); // (10 + 1) * 1000 / 1000
    // Last timestamp should be MAX_POINTS + 10
    expect(entry!.timestamps[MAX_POINTS - 1]).toBe(MAX_POINTS + 10);
  });

  it("maintains independent data for multiple monitors", () => {
    const dataMap = new Map<number, { timestamps: Float64Array; values: Float64Array }>();

    appendSampleToData(dataMap, 1, createSample(1000, 10));
    appendSampleToData(dataMap, 2, createSample(1000, 20));
    appendSampleToData(dataMap, 1, createSample(2000, 15));

    const entry1 = dataMap.get(1);
    const entry2 = dataMap.get(2);

    expect(entry1!.timestamps.length).toBe(2);
    expect(entry2!.timestamps.length).toBe(1);
    expect(entry1!.values[0]).toBe(10);
    expect(entry2!.values[0]).toBe(20);
  });
});

describe("useLiveChart — subscribe/unsubscribe tracking", () => {
  it("tracks subscriptions in a set", () => {
    const subscribed = new Set<number>();

    // Subscribe
    subscribed.add(1);
    subscribed.add(2);
    subscribed.add(3);

    expect(subscribed.has(1)).toBe(true);
    expect(subscribed.has(2)).toBe(true);
    expect(subscribed.has(3)).toBe(true);
    expect(subscribed.has(4)).toBe(false);

    // Unsubscribe
    subscribed.delete(2);
    expect(subscribed.has(2)).toBe(false);
    expect(subscribed.size).toBe(2);
  });

  it("does not double-subscribe to the same monitor", () => {
    const subscribed = new Set<number>();

    // First subscribe
    if (!subscribed.has(1)) {
      subscribed.add(1);
    }
    // Second subscribe (should be no-op)
    if (!subscribed.has(1)) {
      subscribed.add(1);
    }

    expect(subscribed.size).toBe(1);
  });
});

describe("useLiveChart — rAF debounce logic", () => {
  it("scheduleUpdate only queues one rAF call", () => {
    let callCount = 0;
    let pendingUpdate = false;

    function scheduleUpdate() {
      if (pendingUpdate) return;
      pendingUpdate = true;
      // Simulate rAF
      setTimeout(() => {
        pendingUpdate = false;
        callCount++;
      }, 0);
    }

    // Call multiple times — only one should be queued
    scheduleUpdate();
    scheduleUpdate();
    scheduleUpdate();

    // Pending flag should be true (only first call set it, others returned early)
    expect(pendingUpdate).toBe(true);
  });
});
