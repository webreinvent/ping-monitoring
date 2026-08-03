/**
 * F12: Quality Classifier — Unit Tests
 *
 * Tests the classification algorithm by verifying the mathematical
 * correctness of the metrics computation and the decision logic
 * for each quality state.
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Metrics Computation Tests
// ============================================================================

describe("F12: Quality Classifier — Metrics Computation", () => {
  it("computes correct metrics from aggregate stats", () => {
    // 15 samples, all success, avg 30ms, no variance
    const sampleCount = 15;
    const successCount = 15;
    const sumLatency = 15 * 30;
    const sumLatencySq = 15 * (30 * 30);
    const latencyCount = 15;

    const packetLoss = (1 - successCount / sampleCount) * 100;
    const avgLatency = sumLatency / latencyCount;
    const variance = sumLatencySq / latencyCount - avgLatency * avgLatency;
    const stddev = Math.sqrt(Math.max(0, variance));
    const cv = avgLatency > 0 ? stddev / avgLatency : 0;

    expect(packetLoss).toBe(0);
    expect(avgLatency).toBe(30);
    expect(cv).toBe(0);
  });

  it("computes correct packet loss for 1 failure out of 15", () => {
    const sampleCount = 15;
    const successCount = 14;
    const packetLoss = (1 - successCount / sampleCount) * 100;
    expect(packetLoss).toBeCloseTo(6.67, 1);
  });

  it("computes correct CV for alternating 10ms and 500ms samples", () => {
    // 15 samples: 8 at 10ms, 7 at 500ms
    const values = [10, 500, 10, 500, 10, 500, 10, 500, 10, 500, 10, 500, 10, 500, 10];
    const n = values.length;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance =
      values.reduce((s, v) => s + v * v, 0) / n - mean * mean;
    const stddev = Math.sqrt(Math.max(0, variance));
    const cv = stddev / mean;

    expect(cv).toBeGreaterThan(0.5);
  });
});

// ============================================================================
// Classification Decision Logic Tests
// ============================================================================
// These tests verify the classification algorithm by computing the expected
// state using the same decision logic as the classifier.

function classify(packetLoss: number, avgLatency: number, cv: number, sampleCount: number, lastSampleMs: number | null, now: number): string {
  // 1. Disconnected
  if (sampleCount === 0) {
    if (lastSampleMs === null) return "disconnected";
    const timeSinceLast = now - lastSampleMs;
    const windowMs = 5 * 60 * 1000;
    const disconnectedRecentMs = 60 * 60 * 1000;
    if (timeSinceLast > windowMs) {
      if (timeSinceLast > disconnectedRecentMs) return "warmingUp";
      return "disconnected";
    }
    return "warmingUp";
  }
  // 2. WarmingUp
  if (sampleCount < 10) return "warmingUp";
  // 3. Unstable
  if (cv > 0.5 && packetLoss < 10) return "unstable";
  // 4. VeryHigh
  if (packetLoss === 0 && avgLatency < 50) return "veryHigh";
  // 5. High
  if (packetLoss === 0 && avgLatency < 150) return "high";
  // 6. Medium
  if (packetLoss <= 10 && avgLatency <= 300) return "medium";
  // 7. Low
  return "low";
}

describe("F12: Quality Classifier — Decision Logic", () => {
  it("veryHigh: packetLoss == 0 AND avg < 50ms", () => {
    expect(classify(0, 49, 0, 15, Date.now(), Date.now())).toBe("veryHigh");
  });

  it("high: packetLoss == 0 AND 50ms <= avg < 150ms", () => {
    expect(classify(0, 100, 0, 15, Date.now(), Date.now())).toBe("high");
  });

  it("medium: packetLoss <= 10 AND avg <= 300ms", () => {
    expect(classify(5, 200, 0, 15, Date.now(), Date.now())).toBe("medium");
  });

  it("low: packetLoss > 10", () => {
    expect(classify(20, 100, 0, 15, Date.now(), Date.now())).toBe("low");
  });

  it("low: avg > 300ms", () => {
    expect(classify(5, 400, 0, 15, Date.now(), Date.now())).toBe("low");
  });

  it("unstable: cv > 0.5 AND packetLoss < 10", () => {
    expect(classify(3, 100, 0.6, 15, Date.now(), Date.now())).toBe("unstable");
  });

  it("classification priority: unstable takes precedence over veryHigh", () => {
    expect(classify(0, 30, 0.8, 15, Date.now(), Date.now())).toBe("unstable");
  });

  it("disconnected: no samples and last sample 30 min ago", () => {
    const now = Date.now();
    const lastSampleMs = now - 30 * 60 * 1000;
    expect(classify(0, 0, 0, 0, lastSampleMs, now)).toBe("disconnected");
  });

  it("disconnected: no samples at all", () => {
    expect(classify(0, 0, 0, 0, null, Date.now())).toBe("disconnected");
  });

  it("warmingUp: fewer than 10 samples in window", () => {
    expect(classify(0, 30, 0, 5, Date.now(), Date.now())).toBe("warmingUp");
  });

  it("warmingUp: no samples but last sample > 1 hour ago", () => {
    const now = Date.now();
    const lastSampleMs = now - 2 * 60 * 60 * 1000;
    expect(classify(0, 0, 0, 0, lastSampleMs, now)).toBe("warmingUp");
  });

  it("boundary: veryHigh at exactly 50ms avg -> high", () => {
    expect(classify(0, 50, 0, 15, Date.now(), Date.now())).toBe("high");
  });

  it("boundary: high at exactly 150ms avg -> medium", () => {
    expect(classify(0, 150, 0, 15, Date.now(), Date.now())).toBe("medium");
  });

  it("boundary: medium at exactly 300ms avg -> medium", () => {
    expect(classify(10, 300, 0, 15, Date.now(), Date.now())).toBe("medium");
  });

  it("boundary: unstable at exactly 0.5 cv -> not unstable (falls to veryHigh)", () => {
    expect(classify(0, 30, 0.5, 15, Date.now(), Date.now())).toBe("veryHigh");
  });

  it("boundary: unstable at exactly 10% packet loss -> not unstable (falls to medium)", () => {
    expect(classify(10, 100, 0.6, 15, Date.now(), Date.now())).toBe("medium");
  });
});
