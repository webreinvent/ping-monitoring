/**
 * Test fixtures — mock data and factory helpers for tests.
 */

import type {
  ClientIdentity,
  PingSample,
  Monitor,
  HealthResponse,
  HealthErrorResponse,
  MonitorListItem,
  MonitorsListResponse,
  HistoryResponse,
  HistorySeries,
  HistoryPoint,
  QualityIntervalRecord,
  RangeSummary,
  Target,
} from "~/shared/types";
import type {
  IngestPayload,
  IngestResponse as PingIngestResponse,
} from "~/server/utils/ping-types";

/** Create a valid PingSample with optional overrides. */
export function createPingSample(
  overrides: Partial<PingSample> = {},
): PingSample {
  return {
    timestamp: "2025-01-01T00:00:00.000Z",
    clientName: "test-client",
    rtt: 42,
    target: "8.8.8.8",
    packetLoss: 0,
    jitter: 2,
    ...overrides,
  };
}

/** Create a batch of PingSamples. */
export function createPingSamples(
  count: number,
  overrides: Partial<PingSample> = {},
): PingSample[] {
  return Array.from({ length: count }, (_, i) =>
    createPingSample({
      ...overrides,
      timestamp: `2025-01-01T00:0${i}:00.000Z`,
    }),
  );
}

/** Create a valid ClientIdentity with optional overrides. */
export function createClientIdentity(
  overrides: Partial<ClientIdentity> = {},
): ClientIdentity {
  return {
    slug: "test-client",
    name: "Test Client",
    ip: "192.168.1.1",
    os: "Linux",
    hostname: "test-host",
    ...overrides,
  };
}

/** Create a valid Monitor with optional overrides. */
export function createMonitor(
  overrides: Partial<Monitor> = {},
): Monitor {
  return {
    id: 1,
    clientSlug: "test-client",
    name: "Test Monitor",
    target: "8.8.8.8",
    lastPingAt: "2025-01-01T00:00:00.000Z",
    status: "up",
    avgRtt: 42,
    avgPacketLoss: 0,
    ...overrides,
  };
}

/** Create a valid IngestPayload with optional overrides. */
export function createIngestPayload(
  overrides: Partial<IngestPayload> = {},
): IngestPayload {
  return {
    clientSlug: "test-client",
    samples: [],
    ...overrides,
  };
}

/** Create a valid IngestResponse with optional overrides. */
export function createIngestResponse(
  overrides: Partial<PingIngestResponse> = {},
): PingIngestResponse {
  return {
    accepted: 1,
    duplicate: 0,
    rejected: 0,
    ...overrides,
  };
}

/** Create a valid HealthResponse with optional overrides. */
export function createHealthResponse(
  overrides: Partial<HealthResponse> = {},
): HealthResponse {
  return {
    status: "ok",
    timestamp: "2025-01-01T00:00:00.000Z",
    uptime: 100,
    version: "0.1.0",
    db_path: "/tmp/test.db",
    db_size_bytes: 8192,
    monitor_count: 0,
    sample_count: 0,
    last_ingest_time: null,
    ...overrides,
  };
}

/** Create a valid HealthErrorResponse with optional overrides. */
export function createHealthErrorResponse(
  overrides: Partial<HealthErrorResponse> = {},
): HealthErrorResponse {
  return {
    status: "error",
    timestamp: "2025-01-01T00:00:00.000Z",
    message: "Something went wrong",
    ...overrides,
  };
}

/** Create a valid MonitorListItem with optional overrides. */
export function createMonitorListItem(
  overrides: Partial<MonitorListItem> = {},
): MonitorListItem {
  return {
    id: 1,
    clientSlug: "test-client",
    clientName: "Test Client",
    targetHost: "8.8.8.8",
    targetName: "Google DNS",
    status: "up",
    latencyMs: 42,
    qualityState: "warmingUp",
    qualityStateUpdatedAtMs: null,
    lastSeenMs: Date.now(),
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Create a valid MonitorsListResponse with optional overrides. */
export function createMonitorsListResponse(
  overrides: Partial<MonitorsListResponse> = {},
): MonitorsListResponse {
  return {
    monitors: [],
    ...overrides,
  };
}

// ============================================================================
// F6: Monitor History API fixtures
// ============================================================================

/** Create a valid HistoryPoint with optional overrides. */
export function createHistoryPoint(
  overrides: Partial<HistoryPoint> = {},
): HistoryPoint {
  return {
    timestampMs: 1753852860000,
    averageLatencyMs: 14.2,
    minimumLatencyMs: 12.1,
    maximumLatencyMs: 18.5,
    sampleCount: 60,
    failureCount: 0,
    ...overrides,
  };
}

/** Create a batch of HistoryPoints with sequential timestamps. */
export function createHistoryPoints(
  count: number,
  overrides: Partial<HistoryPoint> = {},
): HistoryPoint[] {
  return Array.from({ length: count }, (_, i) =>
    createHistoryPoint({
      ...overrides,
      timestampMs: 1753852800000 + i * 60000,
    }),
  );
}

/** Create a valid QualityIntervalRecord with optional overrides. */
export function createQualityInterval(
  overrides: Partial<QualityIntervalRecord> = {},
): QualityIntervalRecord {
  return {
    startMs: 1753852800000,
    endMs: 1753856400000,
    state: "low",
    reasons: [],
    ...overrides,
  };
}

/** Create a valid RangeSummary with optional overrides. */
export function createRangeSummary(
  overrides: Partial<RangeSummary> = {},
): RangeSummary {
  return {
    sampleCount: 3600,
    successCount: 3598,
    failureCount: 2,
    packetLossPercent: 0.056,
    averageLatencyMs: 14.5,
    minimumLatencyMs: 11.2,
    maximumLatencyMs: 45.3,
    p95LatencyMs: 22.1,
    stableMs: 3540000,
    unstableMs: 60000,
    disconnectedMs: 0,
    stablePercent: 98.33,
    unstablePercent: 1.67,
    disconnectedPercent: 0,
    ...overrides,
  };
}

/** Create a valid Target with optional overrides. */
export function createTarget(
  overrides: Partial<Target> = {},
): Target {
  return {
    id: "42",
    name: "Google DNS",
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
    createdAtMs: 1753000000000,
    archivedAtMs: null,
    ...overrides,
  };
}

/** Create a valid HistorySeries with optional overrides. */
export function createHistorySeries(
  overrides: Partial<HistorySeries> = {},
): HistorySeries {
  return {
    target: createTarget(),
    points: [],
    intervals: [],
    summary: createRangeSummary(),
    ...overrides,
  };
}

/** Create a valid HistoryResponse with optional overrides. */
export function createHistoryResponse(
  overrides: Partial<HistoryResponse> = {},
): HistoryResponse {
  return {
    fromMs: 1753852800000,
    toMs: 1753939200000,
    bucketMs: 60000,
    series: [createHistorySeries()],
    ...overrides,
  };
}
