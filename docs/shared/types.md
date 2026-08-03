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

- [Ping Ingest API](../api/ping-ingest.md) — `IngestPayload` request, `IngestResponse` response
- [Ping Validation](../utils/ping-validation.md) — `ValidationResult` return type
- [Ping Ingest Engine](../utils/ping-ingest.md) — `IngestResponse` return from `ingestPingBatch()`
