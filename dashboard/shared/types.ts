// LNPM Cloud Dashboard — Shared Types
// Used by both server and client code.

/**
 * Client identity information derived from ping samples.
 */
export interface ClientIdentity {
  /** Unique slug derived from first ping sample's client_name */
  slug: string;

  /** Human-readable name (editable) */
  name: string;

  /** IP address of the client */
  ip: string;

  /** OS identifier (e.g. "Linux", "Windows", "macOS") */
  os: string;

  /** Hostname of the client machine */
  hostname: string;
}

/**
 * Ping sample received from a client.
 */
export interface PingSample {
  /** ISO 8601 timestamp when the ping was sent */
  timestamp: string;

  /** Client name sent in the ping */
  clientName: string;

  /** Round-trip time in milliseconds */
  rtt: number;

  /** Packet loss percentage (0-100) */
  packetLoss?: number;

  /** Target hostname or IP */
  target: string;

  /** Jitter in milliseconds */
  jitter?: number;
}

/**
 * Monitor derived from ping data.
 */
export interface Monitor {
  /** Unique monitor ID */
  id: number;

  /** Associated client slug */
  clientSlug: string;

  /** Human-readable monitor name */
  name: string;

  /** Target being monitored */
  target: string;

  /** ISO 8601 timestamp of the last ping */
  lastPingAt: string;

  /** Current status */
  status: "up" | "down" | "degraded";

  /** Average RTT over the last retention window (ms) */
  avgRtt: number;

  /** Packet loss percentage over the last retention window */
  avgPacketLoss: number;
}

/**
 * Quality classification for a ping sample.
 */
export type QualityClass = "good" | "fair" | "poor" | "critical";

/**
 * WebSocket message types.
 * Legacy types retained for backward compatibility.
 */
export type WsMessageType =
  | "ping_update"
  | "monitor_status"
  | "client_online"
  | "client_offline";

/**
 * WebSocket message payload.
 */
export interface WsMessage {
  type: WsMessageType;
  data: Record<string, unknown>;
  timestamp: string;
}

// ============================================================================
// F7: WebSocket Live Broadcast — Message Types
// ============================================================================

/**
 * Inbound message types (client → server).
 */
export type WsInboundType = "subscribe" | "unsubscribe";

/**
 * Outbound message types (server → client).
 */
export type WsOutboundType = "subscribed" | "unsubscribed" | "snapshot" | "sample";

/**
 * A single ping sample in the WebSocket broadcast.
 */
export interface WsPingSample {
  /** Epoch milliseconds of the ping */
  timestampMs: number;

  /** Round-trip latency in ms (null on failure) */
  latencyMs: number | null;

  /** Ping result status */
  status: "success" | "timeout" | "error";

  /** Resolved IP address (null on failure) */
  resolvedAddress: string | null;
}

/**
 * Monitor state included in the snapshot message.
 */
export interface WsMonitorState {
  /** Monitor ID */
  id: number;

  /** Target hostname or IP */
  targetHost: string;

  /** Human-readable target name */
  targetName: string;

  /** Current status */
  status: "up" | "down" | null;

  /** Latest latency */
  latencyMs: number | null;

  /** Quality classification */
  qualityState: "good" | "degraded" | "poor" | "unknown";

  /** Epoch ms of latest ping, or null */
  lastSeenMs: number | null;
}

/**
 * Health endpoint response (success).
 * Extended with F14 metrics: database size, monitor/sample counts, last ingest time.
 */
export interface HealthResponse {
  status: "ok";
  timestamp: string;
  uptime: number;
  version: string;
  db_path: string;
  db_size_bytes: number;
  monitor_count: number;
  sample_count: number;
  last_ingest_time: string | null;
}

/**
 * Health endpoint response (error).
 */
export interface HealthErrorResponse {
  status: "error";
  timestamp: string;
  message: string;
}

/**
 * Monitor item in the monitors list API response (F5).
 * Represents a single monitor with its latest state and client info.
 */
export interface MonitorListItem {
  /** Unique monitor ID */
  id: number;

  /** Client slug (immutable identifier) */
  clientSlug: string;

  /** Client human-readable name */
  clientName: string;

  /** Target hostname or IP being monitored */
  targetHost: string;

  /** Human-readable target name (falls back to targetHost) */
  targetName: string;

  /** Latest status: up (success), down (timeout/error), or null (no samples) */
  status: "up" | "down" | null;

  /** Latest latency in milliseconds, or null if no samples */
  latencyMs: number | null;

  /** Quality classification from monitor row */
  qualityState: "good" | "degraded" | "poor" | "unknown";

  /** Timestamp in epoch ms of the latest ping sample, or null */
  lastSeenMs: number | null;

  /** ISO 8601 creation timestamp */
  createdAt: string;
}

/**
 * Response from GET /api/monitors (F5).
 */
export interface MonitorsListResponse {
  monitors: MonitorListItem[];
}

// ============================================================================
// F6: Monitor History API — HistoryResponse types
// ============================================================================

/**
 * Quality state classification for a time interval.
 * Matches the F6 quality classifier thresholds.
 */
export type QualityState =
  | "warmingUp"
  | "low"
  | "medium"
  | "high"
  | "veryHigh"
  | "unstable"
  | "disconnected";

/**
 * Reason for a quality state classification.
 */
export type QualityReason =
  | "packetLoss"
  | "highLatency"
  | "highJitter"
  | "insufficientSamples";

/**
 * Single aggregated data point in the history response.
 * Represents one time bucket (e.g., 1 minute) of aggregated ping samples.
 */
export interface HistoryPoint {
  /** Epoch milliseconds of the bucket start */
  timestampMs: number;
  /** Average latency across all success samples in the bucket, or null if none */
  averageLatencyMs: number | null;
  /** Minimum latency across all success samples in the bucket, or null if none */
  minimumLatencyMs: number | null;
  /** Maximum latency across all success samples in the bucket, or null if none */
  maximumLatencyMs: number | null;
  /** Total number of samples in this bucket */
  sampleCount: number;
  /** Number of failed samples (timeout/error) in this bucket */
  failureCount: number;
}

/**
 * A contiguous time interval with a single quality classification.
 * Used to color-code chart regions (green/yellow/red/grey).
 */
export interface QualityIntervalRecord {
  /** Epoch milliseconds of interval start */
  startMs: number;
  /** Epoch milliseconds of interval end, or null for the open-ended final interval */
  endMs: number | null;
  /** Quality classification for this interval */
  state: QualityState;
  /** Reasons for the classification (e.g., packetLoss, highLatency) */
  reasons: QualityReason[];
}

/**
 * Aggregate statistics computed over the full time range.
 */
export interface RangeSummary {
  /** Total number of samples in the range */
  sampleCount: number;
  /** Number of successful samples */
  successCount: number;
  /** Number of failed samples */
  failureCount: number;
  /** Packet loss percentage (0-100) */
  packetLossPercent: number;
  /** Average latency across all success samples, or null */
  averageLatencyMs: number | null;
  /** Minimum latency across all success samples, or null */
  minimumLatencyMs: number | null;
  /** Maximum latency across all success samples, or null */
  maximumLatencyMs: number | null;
  /** 95th percentile latency across success samples, or null */
  p95LatencyMs: number | null;
  /** Milliseconds spent in stable state (low/medium) */
  stableMs: number;
  /** Milliseconds spent in unstable state (high/veryHigh/unstable) */
  unstableMs: number;
  /** Milliseconds spent disconnected (no data) */
  disconnectedMs: number;
  /** Percentage of range that is stable (0-100) */
  stablePercent: number;
  /** Percentage of range that is unstable (0-100) */
  unstablePercent: number;
  /** Percentage of range that is disconnected (0-100) */
  disconnectedPercent: number;
}

/**
 * Target metadata for a single monitor in the history response.
 * Maps to the chart component's Target interface.
 */
export interface Target {
  /** Monitor ID as string (matches chart contract) */
  id: string;
  /** Human-readable target name */
  name: string;
  /** Target host (IP or hostname) */
  host: string;
  /** Whether the target is enabled */
  enabled: boolean;
  /** Address family: ipv4 or ipv6 */
  addressFamily: "ipv4" | "ipv6";
  /** Ping interval in milliseconds */
  intervalMs: number;
  /** Ping timeout in milliseconds */
  timeoutMs: number;
  /** Quality thresholds (used by frontend for display) */
  thresholds: {
    windowSeconds: number;
    minimumSamples: number;
    packetLossPercent: number;
    jitterMs: number;
    p95LatencyMs: number;
    unstableForSeconds: number;
    stableForSeconds: number;
    outageFailures: number;
    recoverySuccesses: number;
  };
  /** Epoch milliseconds when the target was created */
  createdAtMs: number;
  /** Epoch milliseconds when archived, or null */
  archivedAtMs: number | null;
}

/**
 * Single history series in the response.
 * Contains target metadata, aggregated points, quality intervals, and summary.
 */
export interface HistorySeries {
  /** Target metadata for this series */
  target: Target;
  /** Aggregated time-bucketed data points */
  points: HistoryPoint[];
  /** Quality classification intervals */
  intervals: QualityIntervalRecord[];
  /** Aggregate range summary */
  summary: RangeSummary;
}

/**
 * Full response from GET /api/monitors/:id (F6).
 * Matches the LNPM chart contract consumed by uPlot.
 */
export interface HistoryResponse {
  /** Start of time range in epoch ms (exclusive) */
  fromMs: number;
  /** End of time range in epoch ms (inclusive) */
  toMs: number;
  /** Bucket size in ms used for aggregation */
  bucketMs: number;
  /** Series array (single element for single-monitor view) */
  series: HistorySeries[];
}

