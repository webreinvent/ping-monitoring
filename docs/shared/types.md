# Shared Types

**File:** `shared/types.ts`

## Purpose

TypeScript interfaces and type aliases shared between the server (`server/`) and client (`app/`) code. These types define the contract for API requests/responses, WebSocket messages, and data models. Imported explicitly (not auto-imported) — Nuxt auto-imports only pick up functions and constants, not type interfaces.

## Usage

```typescript
// Import in server code
import type { PingSample, HealthResponse } from "../shared/types";

// Import in client code
import type { Monitor, WsMessage } from "~/shared/types";
```

## Types

### ClientIdentity

```typescript
interface ClientIdentity {
  slug: string;           // Unique slug derived from client_name
  name: string;           // Human-readable name (editable)
  ip: string;             // Client IP address
  os: string;             // OS identifier (e.g., "Linux", "Windows", "macOS")
  hostname: string;       // Client machine hostname
}
```

**Used by:** Client management endpoints, monitor display.

---

### PingSample

```typescript
interface PingSample {
  timestamp: string;      // ISO 8601 when the ping was sent
  clientName: string;     // Client name sent in the ping
  rtt: number;            // Round-trip time (ms)
  packetLoss?: number;    // Packet loss percentage (0-100)
  target: string;         // Target hostname or IP
  jitter?: number;        // Jitter (ms)
}
```

**Used by:** Ingest endpoint, WebSocket broadcast, chart rendering.

---

### Monitor

```typescript
interface Monitor {
  id: number;              // Unique monitor ID
  clientSlug: string;      // Associated client slug
  name: string;            // Human-readable monitor name
  target: string;          // Target being monitored
  lastPingAt: string;      // ISO 8601 of last ping
  status: "up" | "down" | "degraded";
  avgRtt: number;          // Average RTT over retention window (ms)
  avgPacketLoss: number;   // Avg packet loss over retention window
}
```

**Used by:** Monitors list endpoint, sidebar display, chart data.

---

### QualityClass

```typescript
type QualityClass = "good" | "fair" | "poor" | "critical";
```

**Used by:** Quality classification, visual indicators.

---

### WebSocket Types

```typescript
type WsMessageType =
  | "ping_update"
  | "monitor_status"
  | "client_online"
  | "client_offline";

interface WsMessage {
  type: WsMessageType;
  data: Record<string, unknown>;
  timestamp: string;
}
```

**Used by:** WebSocket handler (`server/ws/ping.ts`), client WebSocket composables.

---

### Health Response

```typescript
interface HealthResponse {
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

interface HealthErrorResponse {
  status: "error";
  timestamp: string;
  message: string;
}
```

**Used by:** `GET /api/health` endpoint (F14 — health check with extended metrics).

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"ok"` | Always `"ok"` if endpoint responds |
| `timestamp` | `string` | ISO 8601 server time |
| `uptime` | `number` | Server uptime in seconds (2 decimal places) |
| `version` | `string` | Backend version from `package.json` |
| `db_path` | `string` | Absolute path to SQLite database file |
| `db_size_bytes` | `number` | Size of the main SQLite file in bytes |
| `monitor_count` | `number` | Total monitors in database |
| `sample_count` | `number` | Total ping samples in database |
| `last_ingest_time` | `string \| null` | ISO 8601 of most recent sample, or `null` |

---

### MonitorListItem

```typescript
interface MonitorListItem {
  id: number;                    // Unique monitor ID
  clientSlug: string;            // Immutable client identifier
  clientName: string;            // Client human-readable name
  targetHost: string;            // Monitored host (IP or hostname)
  targetName: string;            // Human-readable target label (falls back to targetHost)
  status: "up" | "down" | null; // Latest ping status (null = no samples yet)
  latencyMs: number | null;     // Latest latency in ms (null = no samples)
  qualityState: "good" | "degraded" | "poor" | "unknown";
  lastSeenMs: number | null;    // Epoch ms of latest sample (null = no samples)
  createdAt: string;            // ISO 8601 creation timestamp
}
```

**Used by:** `GET /api/monitors` endpoint (F5 — monitors list).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Monitor primary key |
| `clientSlug` | `string` | Immutable client identifier (derived from username + hostname + MAC) |
| `clientName` | `string` | Human-readable client display name |
| `targetHost` | `string` | The monitored host (IP or hostname) |
| `targetName` | `string` | Human-readable target label; falls back to `targetHost` if `target_name` is null in DB |
| `status` | `"up" \| "down" \| null` | `"up"` = success, `"down"` = timeout/error, `null` = no samples yet |
| `latencyMs` | `number \| null` | Latency of the most recent sample in ms |
| `qualityState` | `"good" \| "degraded" \| "poor" \| "unknown"` | Computed quality state; `"unknown"` for monitors still warming up |
| `lastSeenMs` | `number \| null` | Epoch milliseconds of the most recent sample |
| `createdAt` | `string` | ISO 8601 timestamp when the monitor was created |

### MonitorsListResponse

```typescript
interface MonitorsListResponse {
  monitors: MonitorListItem[];
}
```

**Used by:** `GET /api/monitors` response envelope. Contains an array of `MonitorListItem` objects sorted by `lastSeenMs DESC, id ASC`.

---

### F6: Monitor History Types

The following types are used by the `GET /api/monitors/:id` endpoint (F6 — Monitor History API) and define the chart contract consumed by uPlot.

#### QualityState

```typescript
type QualityState =
  | "warmingUp"
  | "low"
  | "medium"
  | "high"
  | "veryHigh"
  | "unstable"
  | "disconnected";
```

**Used by:** `QualityIntervalRecord`, quality classification logic.

#### QualityReason

```typescript
type QualityReason =
  | "packetLoss"
  | "highLatency"
  | "highJitter"
  | "insufficientSamples";
```

**Used by:** `QualityIntervalRecord.reasons` array.

#### HistoryPoint

```typescript
interface HistoryPoint {
  timestampMs: number;              // Epoch ms of bucket start
  averageLatencyMs: number | null;  // Average latency across success samples
  minimumLatencyMs: number | null;  // Min latency across all samples
  maximumLatencyMs: number | null;  // Max latency across all samples
  sampleCount: number;              // Total samples in bucket
  failureCount: number;             // Failed samples in bucket
}
```

**Used by:** `HistorySeries.points`, chart rendering.

#### QualityIntervalRecord

```typescript
interface QualityIntervalRecord {
  startMs: number;                 // Epoch ms of interval start
  endMs: number | null;            // Epoch ms of end, or null (open-ended)
  state: QualityState;             // Quality classification
  reasons: QualityReason[];        // Reasons for classification
}
```

**Used by:** `HistorySeries.intervals`, chart region coloring.

#### RangeSummary

```typescript
interface RangeSummary {
  sampleCount: number;
  successCount: number;
  failureCount: number;
  packetLossPercent: number;
  averageLatencyMs: number | null;
  minimumLatencyMs: number | null;
  maximumLatencyMs: number | null;
  p95LatencyMs: number | null;
  stableMs: number;
  unstableMs: number;
  disconnectedMs: number;
  stablePercent: number;
  unstablePercent: number;
  disconnectedPercent: number;
}
```

**Used by:** `HistorySeries.summary`, dashboard metrics display.

#### Target

```typescript
interface Target {
  id: string;                          // Monitor ID (string format for chart contract)
  name: string;                        // Human-readable target name
  host: string;                        // Target host (IP or hostname)
  enabled: boolean;                    // Whether target is enabled
  addressFamily: "ipv4" | "ipv6";      // Address family
  intervalMs: number;                  // Ping interval in ms
  timeoutMs: number;                   // Ping timeout in ms
  thresholds: {                         // Quality threshold configuration
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
  createdAtMs: number;                 // Epoch ms when target was created
  archivedAtMs: number | null;        // Epoch ms when archived, or null
}
```

**Used by:** `HistorySeries.target`, chart metadata display.

#### HistorySeries

```typescript
interface HistorySeries {
  target: Target;                        // Target metadata
  points: HistoryPoint[];                // Aggregated data points
  intervals: QualityIntervalRecord[];   // Quality classification intervals
  summary: RangeSummary;                 // Aggregate statistics
}
```

**Used by:** `HistoryResponse.series` array.

#### HistoryResponse

```typescript
interface HistoryResponse {
  fromMs: number;                         // Start of time range (epoch ms)
  toMs: number;                           // End of time range (epoch ms)
  bucketMs: number;                       // Bucket size used for aggregation
  series: HistorySeries[];                // Array of history series
}
```

**Used by:** `GET /api/monitors/:id` endpoint (F6) response envelope.

| Field | Type | Description |
|-------|------|-------------|
| `fromMs` | `number` | Start of time range in epoch ms (exclusive) |
| `toMs` | `number` | End of time range in epoch ms (inclusive) |
| `bucketMs` | `number` | Bucket size in ms used for aggregation |
| `series` | `HistorySeries[]` | Single-element array for single-monitor view |

---

### Ingest Types

> **Note:** The ingest types (`PingSampleIngest`, `IngestPayload`, `Rejection`, `IngestResponse`, `ValidationResult`) are defined in `server/utils/ping-types.ts` rather than `shared/types.ts` because they are server-only types used by the ingest pipeline. The types below are the shared ones used across server and client code.

## Server-Only Ingest Types

The following types are defined in `server/utils/ping-types.ts` and used exclusively by the ingest pipeline:

### `PingSampleIngest`

```typescript
interface PingSampleIngest {
  targetHost: string;            // Target host or IP being pinged
  timestampMs: number;           // Unix epoch milliseconds
  latencyMs: number | null;     // Round-trip latency (required for "success")
  status: "success" | "timeout" | "error";
  resolvedAddress: string | null; // Resolved IP (required for "success")
  error?: string | null;         // Optional error message
}
```

**Used by:** `POST /api/ping/ingest` endpoint, `validateSample()`, `ingestPingBatch()`.

### `IngestPayload`

```typescript
interface IngestPayload {
  clientSlug: string;
  username?: string;      // Required on first ingest for auto-registration
  hostname?: string;      // Required on first ingest
  mac_address?: string;   // Required on first ingest
  samples: PingSampleIngest[];
}
```

**Used by:** Request body parsing in `server/api/ping/ingest.post.ts`.

### `Rejection`

```typescript
interface Rejection {
  index: number;                      // Position in the original batch
  reason: string;                     // Human-readable reason
  code: string;                       // Machine-readable error code
  sample: Partial<PingSampleIngest>; // The offending sample
}
```

**Used by:** Ingest response — included when `rejected > 0`.

### `IngestResponse`

```typescript
interface IngestResponse {
  accepted: number;
  duplicate: number;
  rejected: number;
  rejections?: Rejection[];
}
```

**Used by:** `POST /api/ping/ingest` response, `ingestPingBatch()` return value.

### `ValidationResult`

```typescript
interface ValidationResult {
  valid: boolean;
  rejections: { reason: string; code: string }[];
}
```

**Used by:** `validateSample()` in `server/utils/ping-validation.ts`.

## Edge Cases

- **Optional fields:** `PingSample.packetLoss` and `PingSample.jitter` are optional — not all clients send these metrics.
- **Ingest sample nullability:** `PingSampleIngest.latencyMs` and `PingSampleIngest.resolvedAddress` are `null` for timeout/error status — the validation layer enforces they are present for `"success"` status.
- **Type safety:** All types are exported as `interface` or `type` (not `class`) — they are used purely for type checking and cannot be instantiated at runtime.

## Related

- [Monitors List API](../api/monitors.md) — `MonitorListItem`, `MonitorsListResponse`
- [Monitor History API](../api/monitors-history.md) — `HistoryResponse`, `HistorySeries`, `HistoryPoint`, `QualityIntervalRecord`, `RangeSummary`, `Target`, `QualityState`, `QualityReason`
- [Ping Ingest API](../api/ping-ingest.md) — `IngestPayload` request, `IngestResponse` response
- [Ping Validation](../utils/ping-validation.md) — `ValidationResult` return type
- [Ping Ingest Engine](../utils/ping-ingest.md) — `IngestResponse` return from `ingestPingBatch()`
- [Monitors Utility](../utils/monitors.md) — `getAllMonitorsWithLatestState()` query logic
- [History Aggregation](../utils/history.md) — `calculateBucketSize()`, `getMonitorHistoryPoints()`, `computeQualityIntervals()`, `computeRangeSummary()`, `buildTarget()`
