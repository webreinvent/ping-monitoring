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
 */
export type WsMessageType =
  "ping_update" | "monitor_status" | "client_online" | "client_offline";

/**
 * WebSocket message payload.
 */
export interface WsMessage {
  type: WsMessageType;
  data: Record<string, unknown>;
  timestamp: string;
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

