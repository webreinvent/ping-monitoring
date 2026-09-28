---
id: F3
name: Ping Data Ingest Endpoint
phase: MVP
priority: Critical
effort: Medium
dependencies: [F1, F2]
---

# F3: Ping Data Ingest Endpoint

## Description
Batch ingest endpoint for raw ping samples from LNPM clients. Accepts a batch of ping samples, validates each sample against business rules, deduplicates using `INSERT OR IGNORE` on a unique compound key, and returns counts of accepted, duplicate, and rejected samples. This is the primary data ingestion path for all ping telemetry entering the system.

## Acceptance Criteria

### Scenario: Successful batch ingest with mixed results
- **Given** a registered client with valid `clientSlug`
- **When** the client POSTs a batch of 50 ping samples where 5 have timestamps already in the database and 2 fail validation
- **Then** the response returns `accepted: 43`, `duplicate: 5`, `rejected: 2` with a `207 Multi-Status` status code

### Scenario: All samples accepted
- **Given** a registered client with valid `clientSlug`
- **When** the client POSTs a batch of 100 unique, valid ping samples
- **Then** the response returns `accepted: 100`, `duplicate: 0`, `rejected: 0` with a `201 Created` status code

### Scenario: Duplicate batch rejected
- **Given** a registered client that previously ingested a batch of samples
- **When** the client POSTs the exact same batch again (e.g., retry after network timeout)
- **Then** all samples are classified as duplicates, response returns `accepted: 0`, `duplicate: N`, `rejected: 0` with a `200 OK` status code

### Scenario: Oversized batch rejected
- **Given** any client
- **When** the client POSTs a batch with more than 1000 samples
- **Then** the entire request is rejected with `413 Payload Too Large` and an error message: `"Batch exceeds maximum of 1000 samples"`

### Scenario: Unknown client rejected
- **Given** no client record matching the provided `clientSlug`
- **When** the client POSTs a batch of samples
- **Then** the entire request is rejected with `401 Unauthorized` and an error message: `"Unknown client slug"`

### Scenario: Empty batch rejected
- **Given** any client
- **When** the client POSTs a request with an empty `samples` array
- **Then** the request is rejected with `400 Bad Request` and an error message: `"Samples array is required and must contain at least 1 item"`

### Scenario: Invalid sample fields rejected
- **Given** a valid client
- **When** the client POSTs a batch containing samples with missing required fields (e.g., `timestampMs`, `status`)
- **Then** each invalid sample is counted in `rejected`, valid samples are still processed, and rejection reasons are included in the response

### Scenario: Future timestamp rejected
- **Given** a valid client
- **When** the client POSTs a sample with `timestampMs` more than 5 minutes in the future
- **Then** the sample is counted in `rejected` with reason `"Timestamp exceeds 5-minute future window"`

### Scenario: Monitor auto-creation on first sample
- **Given** a registered client but no existing monitor for the sample's `targetHost`
- **When** the client POSTs a ping sample for a new target host
- **Then** a new `monitors` record is created with `target_host` set to the sample's `targetHost` and a default `target_name`

### Scenario: Transactional integrity
- **Given** a batch of 100 samples
- **When** a database error occurs during ingestion after processing 50 samples
- **Then** the transaction is rolled back, no partial data is committed, and a `500 Internal Server Error` is returned

## Implementation Notes

### Files
- `server/api/ping/ingest.post.ts` — Main route handler
- `server/utils/ping-validation.ts` — Sample validation logic
- `server/utils/ping-ingest.ts` — Core ingest engine (dedup, upsert, monitor auto-creation)
- `server/utils/ping-types.ts` — Shared TypeScript types for ingest payload and response

### Deduplication Strategy
- Use a compound unique index on `ping_samples(monitor_id, timestamp_ms, resolved_address)` — the combination of monitor, exact timestamp, and resolved IP address identifies a unique ping event
- `INSERT OR IGNORE` into `ping_samples` with the unique index handles dedup natively
- After insert, compare `db.changes` (from better-sqlite3) to determine how many rows were actually inserted vs ignored
- Track pre-insert row count per sample to attribute duplicates accurately

### Batch Processing
- Wrap entire batch in a single SQLite transaction (`db.transaction()`)
- Validate all samples first, collect rejections, then insert only valid samples
- Auto-create any new monitors within the same transaction before inserting samples
- Use parameterized prepared statements for bulk insert performance

### Validation Rules (per sample)
- `timestampMs`: Required, must be a positive integer, must not exceed 5 minutes into the future from server time
- `latencyMs`: Required for `status: "success"`, must be a positive number
- `status`: Required, must be one of `"success"`, `"timeout"`, `"error"`
- `resolvedAddress`: Required for `status: "success"`, optional for other statuses
- `error`: Optional, preferred for `status: "timeout"` or `status: "error"`

### Performance Considerations
- Single transaction per batch: better-sqlite3's sync nature means the entire batch commits atomically
- Prepared statements: compile once, execute N times within the transaction
- No row-by-row dedup check: rely on the unique index + `INSERT OR IGNORE` + `db.changes`
- Target: ingest 1000 samples in under 200ms

### Error Handling
- Client-level errors (unknown slug, oversized batch, empty batch) return early with clear HTTP status
- Sample-level errors are collected per-sample and reported in the response
- Database errors (lock, corrupt) return 500, caller should retry with backoff

## Data Model Changes

No new tables introduced by this feature. Uses existing tables from F1:

- `ping_samples` — Primary insert target
- `monitors` — Auto-created on first sample for a new `target_host`

### Unique Index (added)
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_ping_samples_dedup
  ON ping_samples (monitor_id, timestamp_ms, resolved_address);
```

This index enables the `INSERT OR IGNORE` dedup strategy. Added in the database initialization (F1), referenced by F3 ingest logic.

## API Contract

### Request
```
POST /api/ping/ingest
Content-Type: application/json
```

```json
{
  "clientSlug": "alice-desktop-aa00bb11cc22",
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
      "latencyMs": 8.5,
      "status": "success",
      "resolvedAddress": "1.1.1.1"
    }
  ]
}
```

#### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientSlug` | string | Yes | Immutable client identifier from F2 |
| `samples` | array | Yes | Array of ping samples (1–1000) |
| `samples[].targetHost` | string | Yes | Target host or IP being pinged |
| `samples[].timestampMs` | integer | Yes | Unix epoch milliseconds of the ping event |
| `samples[].latencyMs` | number | Conditional | Required if status is "success" |
| `samples[].status` | string | Yes | One of: "success", "timeout", "error" |
| `samples[].resolvedAddress` | string | Conditional | Required if status is "success" |
| `samples[].error` | string | No | Error message for timeout/error status |

### Response

#### Success — All samples accepted (`201 Created`)
```json
{
  "accepted": 50,
  "duplicate": 0,
  "rejected": 0
}
```

#### Mixed results (`207 Multi-Status`)
```json
{
  "accepted": 43,
  "duplicate": 5,
  "rejected": 2,
  "rejections": [
    {
      "index": 12,
      "reason": "Timestamp exceeds 5-minute future window",
      "sample": { "timestampMs": 9999999999999, ... }
    },
    {
      "index": 47,
      "reason": "Missing required field: latencyMs",
      "sample": { "status": "success", "latencyMs": null, ... }
    }
  ]
}
```

#### All duplicates (`200 OK`)
```json
{
  "accepted": 0,
  "duplicate": 50,
  "rejected": 0
}
```

#### Client-level error (`401` / `400` / `413`)
```json
{
  "error": "Unknown client slug",
  "code": "UNKNOWN_CLIENT"
}
```

#### Response status code mapping

| Condition | Status Code |
|-----------|-------------|
| All samples accepted, no duplicates | `201 Created` |
| Mix of accepted, duplicates, or rejections | `207 Multi-Status` |
| All samples duplicate, none accepted | `200 OK` |
| Unknown client slug | `401 Unauthorized` |
| Empty samples array | `400 Bad Request` |
| Batch exceeds 1000 samples | `413 Payload Too Large` |
| Database or server error | `500 Internal Server Error`
