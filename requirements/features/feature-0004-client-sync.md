---
id: F4
name: LNPM client sync service
phase: MVP
priority: Critical
effort: Medium
dependencies: [F2, F3]
---

# F4: LNPM client sync service

## Description

Client-side synchronization service that bridges the LNPM desktop client with the cloud dashboard. It buffers ping samples locally, batches them for efficiency, and POSTs them to the backend ingest endpoint (F3). Tracks sync state via `cloud_synced_at_ms` to ensure no data loss on restart or network failure. Implements a startup sync to recover any unsent samples from the previous session.

## Acceptance Criteria

### Given a client has collected 10 or more unsynced ping samples
- When the batch timer has not yet fired
- Then the client immediately POSTs all buffered samples to the ingest endpoint

### Given a client has collected fewer than 10 unsynced samples and 5 seconds have elapsed
- When the 5-second batch timer fires
- Then the client POSTs all buffered samples to the ingest endpoint

### Given a client has collected fewer than 10 samples and less than 5 seconds have elapsed
- When the next sample arrives
- Then the client adds it to the buffer and waits for the batch threshold or timer

### Given a POST to the ingest endpoint succeeds (HTTP 2xx)
- When the response is received
- Then the client marks all samples in that batch with `cloud_synced_at_ms` set to the current timestamp
- And clears the local buffer for those samples

### Given a POST to the ingest endpoint fails (network error, 5xx, or timeout)
- When the failure occurs
- Then the client retains all samples in the local buffer with `cloud_synced_at_ms` unchanged
- And retries the batch with exponential backoff (3 attempts: 1s, 2s, 4s)
- After 3 failed retries the client logs the failure and keeps samples for the next sync cycle

### Given the client application starts up
- When the sync service initializes
- Then it queries the local store for all samples where `cloud_synced_at_ms` IS NULL and `timestamp_ms` >= (now - 1 hour)
- And POSTs them in batches to the ingest endpoint before resuming normal buffered sync

### Given the client has no unsynced samples from the startup window
- When the sync service initializes
- Then it begins normal buffered sync immediately without a startup POST

### Given the client is running in persistent sync mode
- When `syncIntervalMin` elapses
- Then the client queries for any samples where `cloud_synced_at_ms` IS NULL and POSTs them
- This covers any samples missed by the normal batch buffer (e.g., buffer overflow edge cases)

## Implementation Notes

### Client-side components (desktop client, not in this repo)

- **BatchBuffer**: In-memory queue holding unsynced samples. Triggers flush on count >= 10 or timer >= 5s (whichever first). Timer resets after each flush.
- **SyncService**: Orchestrates batch POSTs to `POST /api/ping/ingest`. Manages `cloud_synced_at_ms` tracking, retry logic with exponential backoff, and startup recovery.
- **RetryPolicy**: 3 attempts with exponential backoff: 1s, 2s, 4s. After exhaustion, samples remain in local store for next cycle.

### Backend integration (this repo)

- Sync service POSTs to `POST /api/ping/ingest` (F3).
- Backend validates, deduplicates via `INSERT OR IGNORE`, and returns success.
- Client marks `cloud_synced_at_ms` only on successful response.
- No new backend endpoints are required for F4 — it consumes F3's ingest endpoint.

### Local storage (client-side)

- Each sample carries a `cloud_synced_at_ms` field (nullable integer, milliseconds since epoch).
- Startup query: `SELECT * FROM ping_samples WHERE cloud_synced_at_ms IS NULL AND timestamp_ms >= (now_ms - 3600000)`.
- Sync interval query: `SELECT * FROM ping_samples WHERE cloud_synced_at_ms IS NULL`.

### Configuration

- `syncIntervalMin`: Configurable interval (minutes) for periodic sync sweeps. Default: 5 minutes.
- `maxBatchSize`: Maximum samples per POST. Default: 1000 (matches F3 ingest limit).
- `batchThreshold`: Samples that trigger immediate flush. Default: 10.
- `batchTimeoutMs`: Time that triggers flush regardless of count. Default: 5000ms.
- `retryAttempts`: Number of retry attempts. Default: 3.
- `retryBaseDelayMs`: Base delay for exponential backoff. Default: 1000ms.

## Data Model Changes

No backend schema changes. Client-side local store extends `ping_samples` with:

```
cloud_synced_at_ms INTEGER NULL
```

This field exists on the client's local SQLite store only. It tracks which samples have been successfully synced to the cloud backend. The backend's `ping_samples` table uses `INSERT OR IGNORE` (F3) for deduplication, so resending already-ingested samples is safe.

## API Contract

F4 consumes the F3 ingest endpoint. No new endpoints are introduced.

### POST /api/ping/ingest (consumed by F4, defined in F3)

**Request:**
```json
{
  "clientId": "<client UUID or slug>",
  "clientSlug": "<client slug>",
  "samples": [
    {
      "timestampMs": 1700000000000,
      "latencyMs": 25.3,
      "status": "success",
      "resolvedAddress": "93.184.216.34",
      "error": null
    }
  ]
}
```

**Response (2xx):**
```json
{
  "ingested": 8,
  "duplicates": 2
}
```

**Error responses:**
- `400`: Validation error (malformed payload, exceeds 1000 samples, timestamp out of window)
- `401`: Invalid or missing client identity
- `429`: Rate limited
- `5xx`: Server error (client will retry)

### Sync flow

1. Client collects samples locally, marking `cloud_synced_at_ms = NULL`.
2. BatchBuffer accumulates samples until count >= 10 or 5s elapsed.
3. SyncService POSTs batch to `/api/ping/ingest`.
4. On success, client updates `cloud_synced_at_ms = now()` for all samples in the batch.
5. On failure, client retries with exponential backoff (3x: 1s, 2s, 4s).
6. On startup, client syncs all unsynced samples from the last hour before entering normal mode.
7. Every `syncIntervalMin`, client performs a sweep for any remaining unsynced samples.
