import { describe, it, expect } from "vitest";
import { transformToUPlotData, transformPointsToUPlotSeries } from "./useChartSeries";
import type { HistoryResponse, HistoryPoint } from "#shared/types";

/* ------------------------------------------------------------------ */
/*  transformToUPlotData                                               */
/* ------------------------------------------------------------------ */

describe("transformToUPlotData", () => {
  it("returns empty Float64Array when series is empty", () => {
    const response: HistoryResponse = {
      fromMs: 0,
      toMs: 1,
      bucketMs: 60000,
      series: [],
    };
    const result = transformToUPlotData(response);
    expect(result).toHaveLength(1);
    expect(result[0]!).toBeInstanceOf(Float64Array);
    expect(result[0]!.length).toBe(0);
  });

  it("returns empty Float64Array when series has no points", () => {
    const response: HistoryResponse = {
      fromMs: 0,
      toMs: 1,
      bucketMs: 60000,
      series: [{
        target: {
          id: "1",
          name: "test",
          host: "8.8.8.8",
          enabled: true,
          addressFamily: "ipv4",
          qualityState: "warmingUp",
          qualityStateUpdatedAtMs: null,
          intervalMs: 1000,
          timeoutMs: 5000,
          thresholds: {
            windowSeconds: 300,
            minimumSamples: 10,
            packetLossPercent: 1,
            jitterMs: 20,
            p95LatencyMs: 100,
            unstableForSeconds: 60,
            stableForSeconds: 30,
            outageFailures: 5,
            recoverySuccesses: 3,
          },
          createdAtMs: 1000,
          archivedAtMs: null,
        },
        points: [],
        intervals: [],
        summary: {
          sampleCount: 0,
          successCount: 0,
          failureCount: 0,
          packetLossPercent: 0,
          averageLatencyMs: null,
          minimumLatencyMs: null,
          maximumLatencyMs: null,
          p95LatencyMs: null,
          stableMs: 0,
          unstableMs: 0,
          disconnectedMs: 0,
          stablePercent: 0,
          unstablePercent: 0,
          disconnectedPercent: 0,
        },
      }],
    };
    const result = transformToUPlotData(response);
    expect(result).toHaveLength(1);
    expect(result[0]!.length).toBe(0);
  });

  it("transforms points into [timestamps, latency] Float64Arrays", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 1000000, averageLatencyMs: 20, minimumLatencyMs: 10, maximumLatencyMs: 30, sampleCount: 10, failureCount: 0 },
      { timestampMs: 1060000, averageLatencyMs: 25, minimumLatencyMs: 15, maximumLatencyMs: 35, sampleCount: 10, failureCount: 1 },
      { timestampMs: 1120000, averageLatencyMs: 30, minimumLatencyMs: 20, maximumLatencyMs: 40, sampleCount: 10, failureCount: 0 },
    ];

    const response: HistoryResponse = {
      fromMs: 0,
      toMs: 2000000,
      bucketMs: 60000,
      series: [{
        target: {
          id: "1",
          name: "test",
          host: "8.8.8.8",
          enabled: true,
          addressFamily: "ipv4",
          qualityState: "warmingUp",
          qualityStateUpdatedAtMs: null,
          intervalMs: 1000,
          timeoutMs: 5000,
          thresholds: {
            windowSeconds: 300,
            minimumSamples: 10,
            packetLossPercent: 1,
            jitterMs: 20,
            p95LatencyMs: 100,
            unstableForSeconds: 60,
            stableForSeconds: 30,
            outageFailures: 5,
            recoverySuccesses: 3,
          },
          createdAtMs: 1000,
          archivedAtMs: null,
        },
        points,
        intervals: [],
        summary: {
          sampleCount: 30,
          successCount: 29,
          failureCount: 1,
          packetLossPercent: 3.33,
          averageLatencyMs: 25,
          minimumLatencyMs: 10,
          maximumLatencyMs: 40,
          p95LatencyMs: 35,
          stableMs: 120000,
          unstableMs: 0,
          disconnectedMs: 0,
          stablePercent: 100,
          unstablePercent: 0,
          disconnectedPercent: 0,
        },
      }],
    };

    const result = transformToUPlotData(response);

    // Should return [timestamps, latency]
    expect(result).toHaveLength(2);
    expect(result[0]!).toBeInstanceOf(Float64Array);
    expect(result[1]!).toBeInstanceOf(Float64Array);
    expect(result[0]!.length).toBe(3);
    expect(result[1]!.length).toBe(3);

    // Timestamps should be in seconds (ms / 1000)
    expect(result[0]![0]).toBe(1000000 / 1000);
    expect(result[0]![1]).toBe(1060000 / 1000);
    expect(result[0]![2]).toBe(1120000 / 1000);

    // Latency values should match
    expect(result[1]![0]).toBe(20);
    expect(result[1]![1]).toBe(25);
    expect(result[1]![2]).toBe(30);
  });

  it("converts null averageLatencyMs to NaN", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 1000000, averageLatencyMs: null, minimumLatencyMs: null, maximumLatencyMs: null, sampleCount: 5, failureCount: 5 },
      { timestampMs: 1060000, averageLatencyMs: 20, minimumLatencyMs: 10, maximumLatencyMs: 30, sampleCount: 10, failureCount: 0 },
    ];

    const response: HistoryResponse = {
      fromMs: 0,
      toMs: 2000000,
      bucketMs: 60000,
      series: [{
        target: {
          id: "1",
          name: "test",
          host: "8.8.8.8",
          enabled: true,
          addressFamily: "ipv4",
          qualityState: "warmingUp",
          qualityStateUpdatedAtMs: null,
          intervalMs: 1000,
          timeoutMs: 5000,
          thresholds: {
            windowSeconds: 300,
            minimumSamples: 10,
            packetLossPercent: 1,
            jitterMs: 20,
            p95LatencyMs: 100,
            unstableForSeconds: 60,
            stableForSeconds: 30,
            outageFailures: 5,
            recoverySuccesses: 3,
          },
          createdAtMs: 1000,
          archivedAtMs: null,
        },
        points,
        intervals: [],
        summary: {
          sampleCount: 15,
          successCount: 10,
          failureCount: 5,
          packetLossPercent: 33.3,
          averageLatencyMs: 20,
          minimumLatencyMs: 10,
          maximumLatencyMs: 30,
          p95LatencyMs: 25,
          stableMs: 60000,
          unstableMs: 60000,
          disconnectedMs: 0,
          stablePercent: 50,
          unstablePercent: 50,
          disconnectedPercent: 0,
        },
      }],
    };

    const result = transformToUPlotData(response);
    expect(result[1]![0]).toBeNaN();
    expect(result[1]![1]).toBe(20);
  });
});

/* ------------------------------------------------------------------ */
/*  transformPointsToUPlotSeries                                       */
/* ------------------------------------------------------------------ */

describe("transformPointsToUPlotSeries", () => {
  it("returns empty arrays for empty input", () => {
    const [timestamps, values] = transformPointsToUPlotSeries([]);
    expect(timestamps).toBeInstanceOf(Float64Array);
    expect(values).toBeInstanceOf(Float64Array);
    expect(timestamps.length).toBe(0);
    expect(values.length).toBe(0);
  });

  it("transforms a single point correctly", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 1700000000000, averageLatencyMs: 15.5, minimumLatencyMs: 10, maximumLatencyMs: 20, sampleCount: 60, failureCount: 0 },
    ];

    const [timestamps, values] = transformPointsToUPlotSeries(points);

    expect(timestamps.length).toBe(1);
    expect(values.length).toBe(1);
    expect(timestamps[0]).toBe(1700000000000 / 1000);
    expect(values[0]).toBe(15.5);
  });

  it("transforms multiple points correctly", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 1000000, averageLatencyMs: 10, minimumLatencyMs: 5, maximumLatencyMs: 15, sampleCount: 60, failureCount: 0 },
      { timestampMs: 1060000, averageLatencyMs: 20, minimumLatencyMs: 10, maximumLatencyMs: 30, sampleCount: 60, failureCount: 0 },
      { timestampMs: 1120000, averageLatencyMs: 30, minimumLatencyMs: 20, maximumLatencyMs: 40, sampleCount: 60, failureCount: 0 },
    ];

    const [timestamps, values] = transformPointsToUPlotSeries(points);

    expect(timestamps).toEqual(new Float64Array([1000000 / 1000, 1060000 / 1000, 1120000 / 1000]));
    expect(values).toEqual(new Float64Array([10, 20, 30]));
  });

  it("handles null averageLatencyMs as NaN in multi-point series", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 1000000, averageLatencyMs: 10, minimumLatencyMs: 5, maximumLatencyMs: 15, sampleCount: 60, failureCount: 0 },
      { timestampMs: 1060000, averageLatencyMs: null, minimumLatencyMs: null, maximumLatencyMs: null, sampleCount: 10, failureCount: 10 },
      { timestampMs: 1120000, averageLatencyMs: 30, minimumLatencyMs: 20, maximumLatencyMs: 40, sampleCount: 60, failureCount: 0 },
    ];

    const [timestamps, values] = transformPointsToUPlotSeries(points);

    expect(values[0]).toBe(10);
    expect(values[1]).toBeNaN();
    expect(values[2]).toBe(30);
  });

  it("preserves order of points", () => {
    const points: HistoryPoint[] = [
      { timestampMs: 3000000, averageLatencyMs: 50, minimumLatencyMs: 40, maximumLatencyMs: 60, sampleCount: 60, failureCount: 0 },
      { timestampMs: 1000000, averageLatencyMs: 10, minimumLatencyMs: 5, maximumLatencyMs: 15, sampleCount: 60, failureCount: 0 },
      { timestampMs: 2000000, averageLatencyMs: 30, minimumLatencyMs: 20, maximumLatencyMs: 40, sampleCount: 60, failureCount: 0 },
    ];

    const [timestamps, values] = transformPointsToUPlotSeries(points);

    // Should preserve the original order (not sorted)
    expect(timestamps[0]).toBe(3000000 / 1000);
    expect(timestamps[1]).toBe(1000000 / 1000);
    expect(timestamps[2]).toBe(2000000 / 1000);
    expect(values[0]).toBe(50);
    expect(values[1]).toBe(10);
    expect(values[2]).toBe(30);
  });
});
