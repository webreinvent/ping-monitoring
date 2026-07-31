---
type: api-design
version: "2.0"
---

# API Design — LNPM Cloud Dashboard

## 1. Overview

This document defines the complete API contract for the LNPM Cloud Dashboard backend: REST endpoints, WebSocket protocol, request/response shapes, error handling, and the client sync mechanism.

**Backend:** Nuxt + Nitro (persistent `node-server` runtime)
**Database:** SQLite (`better-sqlite3`) with WAL mode
**Real-time:** Nitro native WebSocket
**Auth:** None in MVP (open read, trust-based ingest via client slug)

---

## 2. API Endpoints

| Method | Path | Feature | Description |
|--------|------|---------|-------------|
| `GET` | `/api/health` | F1, F14 | Server health and metrics |
| `POST` | `/api/ping/ingest` | F3 | Batch ingest ping samples |
| `GET` | `/api/monitors` | F5 | List all monitors with latest state |
| `GET` | `/api/monitors/:id` | F6 | Monitor history (HistoryResponse) |
| `GET` | `/api/clients/:slug` | F2 | Get client by slug |
| `PUT` | `/api/clients/:slug/name` | F11 | Update client display name |
| `WS` | `/ws/ping` | F7 | Real-time ping broadcast |

---

## 3. Global Error Format

All error responses use a consistent JSON shape:

```json
{
  "error": "human_readable_message",
  "code": "ERROR_CODE"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `error` | string | Human-readable error description |
| `code` | string | Machine-readable error code (uppercase snake case) |

### HTTP Status Codes

| Status | Meaning | Used For |
|--------|---------|----------|
| `200 OK` | Success | GET reads, all-duplicate ingest, name update |
| `201 Created` | Success | All-new ingest (no duplicates) |
| `207 Multi-Status` | Partial success | Mixed ingest (accepted + duplicates/rejections) |
| `400 Bad Request` | Client error | Validation failure, malformed payload |
| `401 Unauthorized` | Auth error | Unknown client slug |
| `404 Not Found` | Not found | Unknown monitor or client |
| `413 Payload Too Large` | Too large | Batch exceeds max samples |
| `429 Too Many Requests` | Rate limited | Per-IP rate limit exceeded (F13) |
| `500 Internal Server Error` | Server error | Database failure, unexpected error |

---

## 4. GET /api/health

Return server health status and operational metrics. Publicly accessible — no authentication required.

**Feature:** F1 (basic), F14 (extended metrics)

### Request

```
GET /api/health
```

No parameters, no body.

### Response (200 OK)

```json
{
  "status": "ok",
  "timestamp": "2026-07-31T12:00:00.000Z",
  "uptime": 3600.42,
  "version": "0.1.0",
  "db_path": "/var/data/lingering.db",
  "db_size_bytes": 524288,
  "monitor_count": 42,
  "sample_count": 158734,
  "last_ingest_time": "2026-07-31T11:59:58.000Z"
}
```

### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always `"ok"` if the endpoint responds |
| `timestamp` | string | ISO 8601 server time |
| `uptime` | number | Server uptime in seconds (2 decimal places) |
| `version` | string | Backend version from `package.json` |
| `db_path` | string | Absolute path to the SQLite database file |
| `db_size_bytes` | number | Size of the main SQLite file in bytes |
| `monitor_count` | number | Total number of monitors |
| `sample_count` | number | Total number of ping samples |
| `last_ingest_time` | string or null | ISO 8601 timestamp of the most recent sample, or `null` if no samples |

### Errors

| Status | Code | Description |
|--------|------|-------------|
| `500` | `DATABASE_ERROR` | SQLite file missing, corrupt, or inaccessible |

---

## 5. POST /api/ping/ingest

Batch ingest raw ping samples from LNPM clients. Auto-registers the client on first ingest. Deduplicates via `INSERT OR IGNORE` on a compound unique index.

**Feature:** F2 (client registration), F3 (ingest)

### Request

```
POST /api/ping/ingest
Content-Type: application/json
```

```json
{
  "clientSlug": "alice-desktop-aa00bb11cc22",
  "username": "alice",
  "hostname": "desktop",
  "mac_address": "aa:00:bb:11:cc:22",
  "samples": [
    {
      "targetHost": "8.8.8.8",
      "timestampMs": 1722400000000,
      "latencyMs": 14.2,
      "status": "success",
      "resolvedAddress": "8.8.8.8"
    },
    {
      "targetHost": "1.1.1.1",
      "timestampMs": 1722400000000,
      "latencyMs": null,
      "status": "timeout",
      "resolvedAddress": null,
      "error": "Request timed out"
    }
  ]
}
```

### Request fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientSlug` | string | Yes | Immutable client identifier (auto-generated on first ingest if not provided) |
| `username` | string | Yes (first ingest) | OS username of the client machine |
| `hostname` | string | Yes (first ingest) | Hostname of the client machine |
| `mac_address` | string | Yes (first ingest) | MAC address of the primary network interface |
| `samples` | array | Yes | Array of ping samples (1–1000 items) |
| `samples[].targetHost` | string | Yes | Target host or IP being pinged |
| `samples[].timestampMs` | integer | Yes | Unix epoch milliseconds of the ping event |
| `samples[].latencyMs` | number or null | Conditional | Required if `status` is `"success"` |
| `samples[].status` | string | Yes | One of: `"success"`, `"timeout"`, `"error"` |
| `samples[].resolvedAddress` | string or null | Conditional | Required if `status` is `"success"` |
| `samples[].error` | string or null | No | Error message for timeout/error status |

### Validation rules (per sample)

| Rule | Error Code | Result |
|------|-----------|--------|
| `timestampMs` must be a positive integer | `INVALID_TIMESTAMP` | Rejected |
| `timestampMs` exceeds 5-minute future window | `FUTURE_TIMESTAMP` | Rejected |
| `latencyMs` required when `status` is `"success"` | `MISSING_LATENCY` | Rejected |
| `latencyMs` must be a positive number | `INVALID_LATENCY` | Rejected |
| `resolvedAddress` required when `status` is `"success"` | `MISSING_RESOLVED_ADDRESS` | Rejected |
| `status` must be one of `"success"`, `"timeout"`, `"error"` | `INVALID_STATUS` | Rejected |
| `targetHost` is required and must be non-empty | `MISSING_TARGET_HOST` | Rejected |

### Response (201 Created) — All samples accepted

```json
{
  "accepted": 50,
  "duplicate": 0,
  "rejected": 0
}
```

### Response (207 Multi-Status) — Mixed results

```json
{
  "accepted": 43,
  "duplicate": 5,
  "rejected": 2,
  "rejections": [
    {
      "index": 12,
      "reason": "Timestamp exceeds 5-minute future window",
      "code": "FUTURE_TIMESTAMP",
      "sample": {
        "timestampMs": 9999999999999,
        "status": "success",
        "targetHost": "8.8.8.8"
      }
    },
    {
      "index": 47,
      "reason": "Missing required field: latencyMs",
      "code": "MISSING_LATENCY",
      "sample": {
        "status": "success",
        "targetHost": "1.1.1.1"
      }
    }
  ]
}
```

### Response (200 OK) — All duplicates

```json
{
  "accepted": 0,
  "duplicate": 50,
  "rejected": 0
}
```

### Error responses

```json
// 401 — Unknown client slug (not yet registered)
{
  "error": "Unknown client slug",
  "code": "UNKNOWN_CLIENT"
}

// 400 — Empty samples array
{
  "error": "Samples array is required and must contain at least 1 item",
  "code": "EMPTY_SAMPLES"
}

// 413 — Batch exceeds maximum
{
  "error": "Batch exceeds maximum of 1000 samples",
  "code": "BATCH_TOO_LARGE"
}

// 400 — Malformed payload
{
  "error": "clientSlug is required",
  "code": "MISSING_CLIENT_SLUG"
}
```

### Response status code mapping

| Condition | Status Code |
|-----------|-------------|
| All samples accepted, no duplicates | `201 Created` |
| Mix of accepted, duplicates, or rejections | `207 Multi-Status` |
| All samples are duplicates, none accepted | `200 OK` |
| Unknown client slug (not registered) | `401 Unauthorized` |
| Empty samples array | `400 Bad Request` |
| Batch exceeds 1000 samples | `413 Payload Too Large` |
| Database or server error | `500 Internal Server Error` |

### Client registration (F2)

On the first ingest from a new client, the server:
1. Extracts `username`, `hostname`, and `mac_address` from the request.
2. Generates a slug: `<username>-<hostname>-<truncated-mac>` (e.g., `alice-desktop-aa00bb11cc22`).
3. Inserts a `clients` record with `name` defaulting to `username@hostname`.
4. Uses `INSERT OR IGNORE` on the unique `slug` constraint, so retrying a first ingest is safe.

Subsequent ingests from the same `clientSlug` match the existing record and refresh `updated_at`.

---

## 6. GET /api/monitors

Return all monitors with their latest ping state. Used by the dashboard sidebar and "All Monitors" view.

**Feature:** F5

### Request

```
GET /api/monitors
```

No parameters. No authentication required in MVP (open read).

### Response (200 OK)

```json
{
  "monitors": [
    {
      "id": 1,
      "clientSlug": "alice-desktop-aa00bb11cc22",
      "clientName": "Alice's Desktop",
      "targetHost": "8.8.8.8",
      "targetName": "Google DNS",
      "status": "up",
      "latencyMs": 14.2,
      "qualityState": "unknown",
      "lastSeenMs": 1722364800000,
      "createdAt": "2026-07-01T12:00:00Z"
    },
    {
      "id": 2,
      "clientSlug": "alice-desktop-aa00bb11cc22",
      "clientName": "Alice's Desktop",
      "targetHost": "1.1.1.1",
      "targetName": "Cloudflare DNS",
      "status": "down",
      "latencyMs": null,
      "qualityState": "unknown",
      "lastSeenMs": 1722364700000,
      "createdAt": "2026-07-01T12:05:00Z"
    }
  ]
}
```

### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Monitor primary key |
| `clientSlug` | string | Immutable client identifier |
| `clientName` | string | Human-readable client display name |
| `targetHost` | string | The monitored host (IP or hostname) |
| `targetName` | string | Human-readable target label |
| `status` | `"up" \| "down" \| null` | Latest ping status from the most recent sample |
| `latencyMs` | number or null | Latency of the most recent sample |
| `qualityState` | `"good" \| "degraded" \| "poor" \| "unknown"` | Computed quality state (default `"unknown"` until F12) |
| `lastSeenMs` | number or null | Timestamp of the most recent sample in milliseconds |
| `createdAt` | string | ISO 8601 timestamp when the monitor was created |

### Ordering

Sorted by `lastSeenMs` descending (most recent first), with `monitors.id` ascending as a stable tiebreaker.

### Empty response

```json
{
  "monitors": []
}
```

### Errors

| Status | Code | Description |
|--------|------|-------------|
| `500` | `DATABASE_ERROR` | Database unavailable |

---

## 7. GET /api/monitors/:id

Return historical ping data for a single monitor, formatted as a `HistoryResponse` matching the LNPM chart contract consumed by uPlot.

**Feature:** F6

### Request

```
GET /api/monitors/:id?fromMs=<epoch_ms>&toMs=<epoch_ms>&maxPoints=<int>
```

### Path parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Monitor unique identifier (integer ID as string) |

### Query parameters

| Name | Type | Required | Default | Max | Description |
|------|------|----------|---------|-----|-------------|
| `fromMs` | integer | No | `now - 3,600,000` (1 hour ago) | — | Start of time range (exclusive) |
| `toMs` | integer | No | `now` | — | End of time range (inclusive) |
| `maxPoints` | integer | No | `2000` | `5000` | Max data points; server aggregates to fit |

### Example request

```
GET /api/monitors/42?fromMs=1753852800000&toMs=1753939200000&maxPoints=500
```

### Response (200 OK)

```json
{
  "fromMs": 1753852800000,
  "toMs": 1753939200000,
  "bucketMs": 60000,
  "series": [
    {
      "target": {
        "id": "42",
        "name": "Google DNS",
        "host": "8.8.8.8",
        "enabled": true,
        "addressFamily": "ipv4",
        "intervalMs": 1000,
        "timeoutMs": 5000,
        "thresholds": {
          "windowSeconds": 300,
          "minimumSamples": 10,
          "packetLossPercent": 1,
          "jitterMs": 20,
          "p95LatencyMs": 100,
          "unstableForSeconds": 60,
          "stableForSeconds": 30,
          "outageFailures": 5,
          "recoverySuccesses": 3
        },
        "createdAtMs": 1753000000000,
        "archivedAtMs": null
      },
      "points": [
        {
          "timestampMs": 1753852860000,
          "averageLatencyMs": 14.2,
          "minimumLatencyMs": 12.1,
          "maximumLatencyMs": 18.5,
          "sampleCount": 60,
          "failureCount": 0
        },
        {
          "timestampMs": 1753852920000,
          "averageLatencyMs": 15.8,
          "minimumLatencyMs": 13.0,
          "maximumLatencyMs": 22.4,
          "sampleCount": 58,
          "failureCount": 2
        }
      ],
      "intervals": [
        {
          "startMs": 1753852800000,
          "endMs": 1753856400000,
          "state": "low",
          "reasons": []
        }
      ],
      "summary": {
        "sampleCount": 3600,
        "successCount": 3598,
        "failureCount": 2,
        "packetLossPercent": 0.056,
        "averageLatencyMs": 14.5,
        "minimumLatencyMs": 11.2,
        "maximumLatencyMs": 45.3,
        "p95LatencyMs": 22.1,
        "stableMs": 3540000,
        "unstableMs": 60000,
        "disconnectedMs": 0,
        "stablePercent": 98.33,
        "unstablePercent": 1.67,
        "disconnectedPercent": 0
      }
    }
  ]
}
```

### TypeScript types (matches `src/types.ts`)

```ts
export interface HistoryResponse {
  fromMs: number;
  toMs: number;
  bucketMs: number;
  series: HistorySeries[];
}

export interface HistorySeries {
  target: Target;
  points: HistoryPoint[];
  intervals: QualityIntervalRecord[];
  summary: RangeSummary;
}

export interface HistoryPoint {
  timestampMs: number;
  averageLatencyMs: number | null;
  minimumLatencyMs: number | null;
  maximumLatencyMs: number | null;
  sampleCount: number;
  failureCount: number;
}

export interface QualityIntervalRecord {
  startMs: number;
  endMs: number | null;
  state: QualityState;
  reasons: QualityReason[];
}

export type QualityState =
  | "warmingUp"
  | "low"
  | "medium"
  | "high"
  | "veryHigh"
  | "unstable"
  | "disconnected";

export type QualityReason =
  | "packetLoss"
  | "highLatency"
  | "highJitter"
  | "insufficientSamples";

export interface RangeSummary {
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

export interface Target {
  id: string;
  name: string;
  host: string;
  enabled: boolean;
  addressFamily: "ipv4" | "ipv6";
  intervalMs: number;
  timeoutMs: number;
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
  createdAtMs: number;
  archivedAtMs: number | null;
}
```

### Aggregation

- Server aggregates raw `ping_samples` into time-bucketed `HistoryPoint` records.
- Default bucket size: `60000` ms (1 minute).
- When raw bucket count exceeds `maxPoints`, server increases bucket size using the same clean sizes as the frontend: `[1000, 5000, 10000, 30000, 60000, 300000, 900000, 1800000, 3600000]`.
- `bucketMs` in the response tells the frontend which granularity was used.

### Quality intervals

Computed server-side from aggregated points using a sliding-window classifier:

| State | Conditions |
|-------|-----------|
| `warmingUp` | First 30 seconds or fewer than 5 samples |
| `low` | packetLoss < 1%, avgLatency < 50ms |
| `medium` | packetLoss < 5%, avgLatency < 100ms |
| `high` | packetLoss < 10%, avgLatency < 200ms |
| `veryHigh` | packetLoss < 10%, avgLatency >= 200ms |
| `unstable` | packetLoss >= 10% or high jitter |
| `disconnected` | No samples in the interval |

### Empty data response (200 OK)

```json
{
  "fromMs": 1753852800000,
  "toMs": 1753939200000,
  "bucketMs": 60000,
  "series": [
    {
      "target": { /* target metadata */ },
      "points": [],
      "intervals": [],
      "summary": {
        "sampleCount": 0,
        "successCount": 0,
        "failureCount": 0,
        "packetLossPercent": 0,
        "averageLatencyMs": null,
        "minimumLatencyMs": null,
        "maximumLatencyMs": null,
        "p95LatencyMs": null,
        "stableMs": 0,
        "unstableMs": 0,
        "disconnectedMs": 0,
        "stablePercent": 0,
        "unstablePercent": 0,
        "disconnectedPercent": 0
      }
    }
  ]
}
```

### Errors

```json
// 404 — Monitor not found
{
  "error": "monitor_not_found",
  "code": "MONITOR_NOT_FOUND"
}

// 400 — Invalid query parameters
{
  "error": "fromMs must be less than toMs",
  "code": "INVALID_QUERY_PARAMS"
}

// 400 — maxPoints exceeds maximum
{
  "error": "maxPoints must not exceed 5000",
  "code": "INVALID_QUERY_PARAMS"
}
```

---

## 8. GET /api/clients/:slug

Retrieve a single client by its immutable slug.

**Feature:** F2

### Request

```
GET /api/clients/:slug
```

### Response (200 OK)

```json
{
  "id": 1,
  "slug": "alice-desktop-aa00bb11cc22",
  "name": "alice@desktop",
  "username": "alice",
  "hostname": "desktop",
  "mac_address": "aa:00:bb:11:cc:22",
  "created_at": "2026-07-31T10:00:00Z",
  "updated_at": "2026-07-31T10:00:00Z"
}
```

### Errors

```json
// 404 — Client not found
{
  "error": "Client not found",
  "code": "CLIENT_NOT_FOUND"
}
```

---

## 9. PUT /api/clients/:slug/name

Update the display name of a client. The slug is immutable.

**Feature:** F11

### Request

```
PUT /api/clients/:slug/name
Content-Type: application/json
```

```json
{
  "name": "Alice's Workstation"
}
```

### Response (200 OK)

Returns the updated client record:

```json
{
  "id": 1,
  "slug": "alice-desktop-aa00bb11cc22",
  "name": "Alice's Workstation",
  "username": "alice",
  "hostname": "desktop",
  "mac_address": "aa:00:bb:11:cc:22",
  "created_at": "2026-07-31T10:00:00Z",
  "updated_at": "2026-07-31T14:22:00Z"
}
```

After a successful update, the server broadcasts a `client_name_updated` WebSocket event (see Section 12) to all connected clients.

### Errors

```json
// 400 — Invalid name
{
  "error": "Name is required and must be between 1 and 100 characters",
  "code": "INVALID_NAME"
}

// 404 — Client not found
{
  "error": "Client not found",
  "code": "CLIENT_NOT_FOUND"
}
```

---

## 10. WebSocket Protocol — /ws/ping

Real-time ping data broadcast. JSON messages over WebSocket.

**Feature:** F7

### Connection

```
ws://<host>/ws/ping
wss://<host>/ws/ping  (production, with TLS)
```

No authentication in MVP. No query parameters.

### Connection limits

| Parameter | Default | Description |
|-----------|---------|-------------|
| `WS_MAX_CLIENTS` | 1000 (dev) / 10000 (prod) | Max concurrent WebSocket connections |
| `WS_HEARTBEAT_INTERVAL_MS` | 30000 | Ping/pong heartbeat interval |

### Client-to-Server Messages

#### Subscribe

```json
{
  "type": "subscribe",
  "monitorId": 42
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `"subscribe"` |
| `monitorId` | number | Yes | The monitor to subscribe to |

#### Unsubscribe

```json
{
  "type": "unsubscribe",
  "monitorId": 42
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `"unsubscribe"` |
| `monitorId` | number | Yes | The monitor to unsubscribe from |

### Server-to-Client Messages

#### Subscribed (acknowledgment)

```json
{
  "type": "subscribed",
  "monitorId": 42
}
```

#### Unsubscribed (acknowledgment)

```json
{
  "type": "unsubscribed",
  "monitorId": 42
}
```

#### Snapshot (initial data on subscribe)

Sent immediately after a `subscribed` acknowledgment, containing the most recent 100 samples for the monitor.

```json
{
  "type": "snapshot",
  "monitorId": 42,
  "data": {
    "monitor": {
      "id": 42,
      "clientSlug": "alice-desktop-aa00bb11cc22",
      "clientName": "Alice's Desktop",
      "targetHost": "8.8.8.8",
      "targetName": "Google DNS",
      "status": "up",
      "latencyMs": 14.2,
      "qualityState": "unknown",
      "lastSeenMs": 1722364800000,
      "createdAt": "2026-07-01T12:00:00Z"
    },
    "samples": [
      {
        "timestampMs": 1700000000000,
        "latencyMs": 24.5,
        "status": "success",
        "resolvedAddress": "93.184.216.34"
      },
      {
        "timestampMs": 1700000001000,
        "latencyMs": 23.1,
        "status": "success",
        "resolvedAddress": "93.184.216.34"
      }
    ]
  }
}
```

**Snapshot contents:**
- `monitor`: Latest monitor state (same shape as F5 response item)
- `samples`: Last 100 samples, oldest first

#### Sample (real-time push)

Sent whenever a new ping sample is ingested for a subscribed monitor.

```json
{
  "type": "sample",
  "monitorId": 42,
  "data": {
    "timestampMs": 1700000005000,
    "latencyMs": 23.1,
    "status": "success",
    "resolvedAddress": "93.184.216.34"
  }
}
```

#### Client name updated (F11)

Broadcast to all connected WebSocket clients after a successful name change.

```json
{
  "type": "client_name_updated",
  "client_slug": "alice-desktop-aa00bb11cc22",
  "client_name": "Alice's Workstation"
}
```

Clients receiving this event should patch their sidebar client list and any cached client name references.

### Message type summary

| Direction | Type | Description |
|-----------|------|-------------|
| Client -> Server | `subscribe` | Subscribe to a monitor |
| Client -> Server | `unsubscribe` | Unsubscribe from a monitor |
| Server -> Client | `subscribed` | Subscription acknowledged |
| Server -> Client | `unsubscribed` | Unsubscription acknowledged |
| Server -> Client | `snapshot` | Initial data on subscribe |
| Server -> Client | `sample` | Real-time sample push |
| Server -> Client | `client_name_updated` | Client name change broadcast |

### Reconnect policy (client-side)

| Parameter | Value |
|-----------|-------|
| Initial delay | 1000 ms |
| Multiplier | 2x (exponential) |
| Maximum delay | 30000 ms |
| Jitter | +/- 10% random variation |
| Reset | On successful reconnect |

Sequence: 1s -> 2s -> 4s -> 8s -> 16s -> 30s (capped)

On successful reconnect, the client re-subscribes to all previously subscribed monitors and receives fresh snapshots.

---

## 11. Client Sync Protocol

The LNPM desktop client (not the web dashboard) uses the ingest endpoint to sync local ping samples to the cloud backend.

**Feature:** F4

### Sync flow

1. **Client collects** ping samples locally in its own SQLite with `cloud_synced_at_ms = NULL`.
2. **BatchBuffer** accumulates samples until count >= 10 OR 5 seconds elapse (whichever first).
3. **SyncService** POSTs the batch to `POST /api/ping/ingest`.
4. **On success** (HTTP 2xx), client updates `cloud_synced_at_ms = now()` for all samples in the batch.
5. **On failure** (network error, 5xx, timeout), client retries with exponential backoff: 3 attempts at 1s, 2s, 4s.
6. **On startup**, client syncs all unsynced samples from the last hour before entering normal buffered sync.
7. **Every `syncIntervalMin`** (default 5 minutes), client performs a sweep for any remaining unsynced samples.

### Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `batchThreshold` | 10 | Samples that trigger immediate flush |
| `batchTimeoutMs` | 5000 | Time that triggers flush regardless of count |
| `maxBatchSize` | 1000 | Maximum samples per POST (matches server limit) |
| `retryAttempts` | 3 | Number of retry attempts |
| `retryBaseDelayMs` | 1000 | Base delay for exponential backoff |
| `syncIntervalMin` | 5 | Periodic sync sweep interval in minutes |

### Idempotency

The backend uses `INSERT OR IGNORE` with a unique compound index on `(monitor_id, timestamp_ms, resolved_address)`. Resending an already-ingested batch is a safe no-op — the server returns it as `duplicate` in the response.

---

## 12. Error Codes Reference

| Code | HTTP Status | Endpoint(s) | Description |
|------|-------------|-------------|-------------|
| `DATABASE_ERROR` | 500 | All | SQLite connection failure or corruption |
| `UNKNOWN_CLIENT` | 401 | `/api/ping/ingest` | Client slug not registered |
| `EMPTY_SAMPLES` | 400 | `/api/ping/ingest` | Samples array is empty or missing |
| `BATCH_TOO_LARGE` | 413 | `/api/ping/ingest` | More than 1000 samples in request |
| `INVALID_TIMESTAMP` | — | `/api/ping/ingest` | Per-sample rejection: invalid timestamp |
| `FUTURE_TIMESTAMP` | — | `/api/ping/ingest` | Per-sample rejection: >5 min in future |
| `MISSING_LATENCY` | — | `/api/ping/ingest` | Per-sample rejection: latency required for success |
| `INVALID_LATENCY` | — | `/api/ping/ingest` | Per-sample rejection: latency not a positive number |
| `MISSING_RESOLVED_ADDRESS` | — | `/api/ping/ingest` | Per-sample rejection: address required for success |
| `INVALID_STATUS` | — | `/api/ping/ingest` | Per-sample rejection: invalid status value |
| `MISSING_TARGET_HOST` | — | `/api/ping/ingest` | Per-sample rejection: targetHost missing |
| `MONITOR_NOT_FOUND` | 404 | `/api/monitors/:id` | No monitor with the given ID |
| `INVALID_QUERY_PARAMS` | 400 | `/api/monitors/:id` | Invalid fromMs, toMs, or maxPoints |
| `CLIENT_NOT_FOUND` | 404 | `/api/clients/:slug` | No client with the given slug |
| `INVALID_NAME` | 400 | `/api/clients/:slug/name` | Name is empty, too long, or invalid |
| `RATE_LIMITED` | 429 | All | Per-IP rate limit exceeded (F13) |
| `MISSING_CLIENT_SLUG` | 400 | `/api/ping/ingest` | clientSlug field missing from request |

---

## 13. Rate Limiting (F13)

Per-IP rate limiting applied to all API endpoints.

| Parameter | Dev Default | Prod Default | Description |
|-----------|------------|--------------|-------------|
| `RATE_LIMIT_WINDOW_MS` | 60000 | 60000 | Time window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | 1000 | 100 | Max requests per window per IP |

### Response (429 Too Many Requests)

```json
{
  "error": "Rate limit exceeded. Try again in 30 seconds.",
  "code": "RATE_LIMITED"
}
```

Includes a `Retry-After` header (seconds until the limit resets).

---

## 14. Data Retention (F10)

Scheduled cleanup of old data. Not an API endpoint — a background task.

| Parameter | Dev Default | Prod Default | Description |
|-----------|------------|--------------|-------------|
| `RETENTION_DAYS` | 30 | 7 | Delete samples older than N days |

Cleanup runs as a scheduled job (e.g., every 24 hours):

```sql
DELETE FROM ping_samples WHERE timestamp_ms < (strftime('%s', 'now', '-' || ? || ' days') * 1000);
DELETE FROM minute_rollups WHERE timestamp_ms < (strftime('%s', 'now', '-' || ? || ' days') * 1000);
```

After cleanup, `VACUUM` is called periodically to reclaim disk space.

---

## 15. TypeScript type summary for shared models

```ts
// Ingest payload (client -> server)
export interface IngestPayload {
  clientSlug: string;
  username?: string;
  hostname?: string;
  mac_address?: string;
  samples: PingSample[];
}

export interface PingSample {
  targetHost: string;
  timestampMs: number;
  latencyMs: number | null;
  status: "success" | "timeout" | "error";
  resolvedAddress: string | null;
  error: string | null;
}

// Ingest response (server -> client)
export interface IngestResponse {
  accepted: number;
  duplicate: number;
  rejected: number;
  rejections?: Rejection[];
}

export interface Rejection {
  index: number;
  reason: string;
  code: string;
  sample: Partial<PingSample>;
}

// Monitor list item (GET /api/monitors)
export interface MonitorListItem {
  id: number;
  clientSlug: string;
  clientName: string;
  targetHost: string;
  targetName: string;
  status: "up" | "down" | null;
  latencyMs: number | null;
  qualityState: "good" | "degraded" | "poor" | "unknown";
  lastSeenMs: number | null;
  createdAt: string;
}

// Client record
export interface ClientRecord {
  id: number;
  slug: string;
  name: string;
  username: string;
  hostname: string;
  mac_address: string;
  created_at: string;
  updated_at: string;
}

// Health response
export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  db_path: string;
  db_size_bytes: number;
  monitor_count: number;
  sample_count: number;
  last_ingest_time: string | null;
}
```
