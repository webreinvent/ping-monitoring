/**
 * Test fixtures — mock data and factory helpers for tests.
 */

import type {
  ClientIdentity,
  PingSample,
  Monitor,
  WsMessage,
  HealthResponse,
  HealthErrorResponse,
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

/** Create a valid WsMessage with optional overrides. */
export function createWsMessage(
  overrides: Partial<WsMessage> = {},
): WsMessage {
  return {
    type: "ping_update",
    data: {},
    timestamp: "2025-01-01T00:00:00.000Z",
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
