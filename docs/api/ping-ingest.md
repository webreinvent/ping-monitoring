# API: Ping Data Ingest

**Endpoint:** `POST /api/ping/ingest`
**File:** `server/api/ping/ingest.post.ts`
**Features:** F3 (Ping data ingest), F4 (Client sync — auto-registration)

## Purpose

Primary data ingestion endpoint for raw ping telemetry from LNPM desktop clients. Accepts batches of up to 1000 samples, validates each against business rules, deduplicates using `INSERT OR IGNORE` on a unique index, auto-creates monitors for new target hosts, and returns counts of accepted/duplicate/rejected samples.

Also handles **first-time client registration**: if an unknown `clientSlug` is sent with `username`, `hostname`, and `mac_address`, the client is automatically registered in the database.

## Request

- **Method:** POST
- **Path:** `/api/ping/ingest`
- **Content-Type:** `application/json`
- **Authentication:** None (client identity via `clientSlug`)
- **Body:** `IngestPayload`

### Request Body Shape

```json
{
  "clientSlug": "alice-desktop-00bb11cc22",
  "username": "alice",
  "hostname": "desktop",
  "mac_address": "aa:00:bb:11:cc:22",
  "samples": [
    {
      "targetHost": "8.8.8.8",
      "timestampMs": 1725200400000,
      "latencyMs": 12.5,
      "status": "success",
      "resolvedAddress": "8.8.8.8",
      "error": null
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientSlug` | `string` | Yes | Immutable client identifier (trimmed). Must be non-empty. |
| `username` | `string` | Conditional | OS username. Required on first ingest for auto-registration. |
| `hostname` | `string` | Conditional | Client machine hostname. Required on first ingest. |
| `mac_address` | `string` | Conditional | MAC address. Required on first ingest (all three identity fields required together). |
| `samples` | `PingSampleIngest[]` | Yes | Array of 1–1000 ping samples. |

### `PingSampleIngest` Shape

```typescript
interface PingSampleIngest {
  targetHost: string;           // Target host or IP being pinged
  timestampMs: number;          // Unix epoch milliseconds
  latencyMs: number | null;    // Round-trip latency in ms (required for "success")
  status: "success" | "timeout" | "error";
  resolvedAddress: string | null; // Resolved IP (required for "success")
  error?: string | null;        // Optional error message
}
```

## Response

### Success (201 — All Accepted)

```json
{
  "accepted": 50,
  "duplicate": 0,
  "rejected": 0
}
```

### Success (200 — All Duplicates)

```json
{
  "accepted": 0,
  "duplicate": 50,
  "rejected": 0
}
```

### Success (200 — All Rejected)

```json
{
  "accepted": 0,
  "duplicate": 0,
  "rejected": 50,
  "rejections": [
    {
      "index": 0,
      "reason": "timestampMs must be a positive integer",
      "code": "INVALID_TIMESTAMP",
      "sample": { "targetHost": "8.8.8.8", "timestampMs": -1, "status": "success" }
    }
  ]
}
```

### Mixed (207 — Some Accepted, Some Duplicate/Rejected)

```json
{
  "accepted": 45,
  "duplicate": 3,
  "rejected": 2,
  "rejections": [
    {
      "index": 47,
      "reason": "status must be one of: success, timeout, error",
      "code": "INVALID_STATUS",
      "sample": { "targetHost": "8.8.8.8", "status": "unknown" }
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `accepted` | `number` | Samples newly inserted into the database |
| `duplicate` | `number` | Samples that matched an existing row (ignored via `INSERT OR IGNORE`) |
| `rejected` | `number` | Samples that failed validation (unique sample count, not rejection count — a sample with 2 validation failures counts as 1 rejected) |
| `rejections` | `Rejection[]` | Detailed per-sample rejection info. Only present when `rejected > 0`. |

### `Rejection` Shape

```typescript
interface Rejection {
  index: number;                     // Position in the original batch
  reason: string;                    // Human-readable reason
  code: string;                      // Machine-readable error code
  sample: Partial<PingSampleIngest>; // The offending sample
}
```

### Error (400 — Bad Request)

```json
{
  "error": "clientSlug is required",
  "code": "MISSING_CLIENT_SLUG"
}
```

```json
{
  "error": "Samples array is required and must contain at least 1 item",
  "code": "EMPTY_SAMPLES"
}
```

### Error (401 — Unknown Client)

```json
{
  "error": "Unknown client slug",
  "code": "UNKNOWN_CLIENT"
}
```

**Note:** Returned when the `clientSlug` is not found in the database AND no registration data (`username`, `hostname`, `mac_address`) was provided.

### Error (413 — Payload Too Large)

```json
{
  "error": "Batch exceeds maximum of 1000 samples",
  "code": "BATCH_TOO_LARGE"
}
```

### Error (500 — Database Error)

```json
{
  "error": "Database error during ingest",
  "code": "DATABASE_ERROR"
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| **201** | All samples accepted, no duplicates |
| **200** | All duplicates or all rejected (no new samples inserted) |
| **207** | Mixed results (some accepted, some duplicate/rejected) |
| **400** | Missing `clientSlug` or empty `samples` array |
| **401** | Unknown `clientSlug` with no registration data provided |
| **413** | Batch exceeds `INGEST_MAX_SAMPLES` (default 1000) |
| **500** | Database error during ingest |

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MISSING_CLIENT_SLUG` | 400 | `clientSlug` field is missing or empty |
| `EMPTY_SAMPLES` | 400 | `samples` array is missing or empty |
| `BATCH_TOO_LARGE` | 413 | Batch exceeds `INGEST_MAX_SAMPLES` limit |
| `UNKNOWN_CLIENT` | 401 | Client slug not found and no registration data |
| `DATABASE_ERROR` | 500 | Database error during ingest |

## Validation Rules

Each sample is validated against 6 business rules (see [ping-validation.md](../utils/ping-validation.md)):

| Rule | Rejection Code | Description |
|------|----------------|-------------|
| 1 | `MISSING_TARGET_HOST` | `targetHost` is required and non-empty |
| 2 | `INVALID_TIMESTAMP` | `timestampMs` must be a positive integer |
| 3 | `FUTURE_TIMESTAMP` | `timestampMs` must not exceed 5-minute future window |
| 4 | `INVALID_STATUS` | `status` must be `"success"`, `"timeout"`, or `"error"` |
| 5 | `MISSING_LATENCY` / `INVALID_LATENCY` | `latencyMs` required and positive for `"success"` |
| 6 | `MISSING_RESOLVED_ADDRESS` | `resolvedAddress` required for `"success"` |

Validation is **accumulative** — a single sample can have multiple rejection reasons.

## Ingest Pipeline

```
1. Parse request body
2. Validate top-level fields (clientSlug, samples array)
3. Check batch size limit
4. Resolve client (lookup by slug, or auto-register if identity fields present)
5. Validate each sample (collect rejections)
6. Within a single database transaction:
   a. Auto-create monitors for new target hosts
   b. Insert valid samples (INSERT OR IGNORE for dedup)
   c. Update monitor latest state
   d. Update client last_synced_at_ms
7. Return result with HTTP status code
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `INGEST_MAX_SAMPLES` | `1000` | Maximum samples per batch |
| `INGEST_FUTURE_WINDOW_MS` | `300000` (5 minutes) | Maximum allowed future timestamp |

## Performance

- **Target:** 1000 samples in under 200ms
- Transaction is a single `db.transaction()` call — atomic with rollback on any error
- `INSERT OR IGNORE` uses the unique index on `(monitor_id, timestamp_ms, resolved_address)`
- No WebSocket broadcast is triggered yet (planned for F7)
- Quality classifier is not yet invoked (planned for F12)

## Edge Cases

- **First-time client:** If `clientSlug` is unknown but `username`, `hostname`, and `mac_address` are all provided, the client is auto-registered via `upsertClient()`. All three fields are required — providing only one or two is insufficient.
- **Mixed valid/invalid batch:** Valid samples are ingested; invalid ones are counted as rejected. The response includes rejection details for each.
- **All duplicates:** If every sample already exists (same `monitor_id`, `timestamp_ms`, `resolved_address`), the response returns `accepted: 0`, `duplicate: N`, `rejected: 0` with status 200.
- **Transaction rollback:** If the database errors during the transaction, the entire batch rolls back. No partial inserts. The API returns 500.
- **Monitor auto-creation:** A new monitor is created for every `(client_id, target_host)` pair that doesn't exist. Initial `quality_state` is `'warmingUp'`.

## Example Usage

```bash
# Basic ingest
curl -X POST http://localhost:3000/api/ping/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "clientSlug": "alice-desktop-00bb11cc22",
    "samples": [
      {
        "targetHost": "8.8.8.8",
        "timestampMs": 1725200400000,
        "latencyMs": 12.5,
        "status": "success",
        "resolvedAddress": "8.8.8.8"
      }
    ]
  }'

# First-time client registration
curl -X POST http://localhost:3000/api/ping/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "clientSlug": "bob-laptop-aa33bb44cc55",
    "username": "bob",
    "hostname": "laptop",
    "mac_address": "11:22:33:44:55:66",
    "samples": [
      {
        "targetHost": "1.1.1.1",
        "timestampMs": 1725200400000,
        "latencyMs": 8.2,
        "status": "success",
        "resolvedAddress": "1.1.1.1"
      }
    ]
  }'

# Check rejection details
curl -s -X POST http://localhost:3000/api/ping/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "clientSlug": "alice-desktop-00bb11cc22",
    "samples": [
      {
        "targetHost": "",
        "timestampMs": -1,
        "status": "invalid"
      }
    ]
  }' | jq '.rejections'
```

## Related

- [Ping Validation Utility](../utils/ping-validation.md) — Sample-level validation rules
- [Ping Ingest Engine](../utils/ping-ingest.md) — Core ingest pipeline (transaction, dedup, monitor auto-create)
- [Shared Types](../shared/types.md) — `IngestPayload`, `PingSampleIngest`, `IngestResponse`, `Rejection`
- [Database Schema](../database/schema.md) — `ping_samples` table, unique constraint, indexes
- [Client Utilities](../utils/client.md) — `getClientBySlug()`, `upsertClient()`, `generateSlug()`
- [Feature F3 Specification](../../requirements/features/feature-0003-ping-ingest.md) — Original requirements
- [Feature F4 Specification](../../requirements/features/feature-0004-client-sync.md) — Client auto-registration
