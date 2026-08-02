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

```typescript
interface IngestRequest {
  samples: PingSample[];
}

interface IngestResponse {
  accepted: number;
  rejected: number;
  clientSlug: string;
}
```

**Used by:** `POST /api/ping/ingest` endpoint (to be implemented in Phase 5).

## Future Types (Planned)

The following types are planned for future phases (documented in the [implementation plan](../../memory/agent-05-implementation-plan.md)):

- **Phase 3:** IngestPayload, PingSampleIngest, Rejection, MonitorListItem, ClientRecord, HistoryResponse, HistorySeries, HistoryPoint, RangeSummary, SubscribeMessage, SnapshotMessage, SampleMessage, ErrorMessage
- **Phase 4:** QualityState, QualityReason, ValidationResult

## Edge Cases

- **Optional fields:** `PingSample.packetLoss` and `PingSample.jitter` are optional — not all clients send these metrics.
- **Empty samples:** `IngestRequest.samples` may be empty — the ingest endpoint (Phase 5) will return a 400 for empty batches.
- **Type safety:** All types are exported as `interface` or `type` (not `class`) — they are used purely for type checking and cannot be instantiated at runtime.
