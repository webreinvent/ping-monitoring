# SyncService — Cloud Sync Background Task (M2-T9 / F4)

## Purpose

The `SyncService` manages the background sync of local ping samples to a user-configured LNPM Cloud Dashboard ingest endpoint. It batches unsynced samples, POSTs them with client identity headers, handles retries with exponential backoff, and emits real-time status events to the frontend.

## File

`src-tauri/src/sync.rs`

## Types

### SyncStatus

```rust
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SyncStatus {
    Off,      // No endpoint configured
    Paused,   // Endpoint configured but user paused sync
    Idle,     // Running, waiting for next batch
    Syncing,  // Currently POSTing to endpoint
    Success,  // Last sync completed successfully (auto-reverts to Idle)
    Error,    // Last sync failed after retries exhausted
}
```

### SyncEvent

Emitted to the frontend via `app.emit("sync-status-changed", &SyncEvent)`:

```rust
pub struct SyncEvent {
    pub status: SyncStatus,
    pub message: Option<String>,      // Error details or status message
    pub last_synced_at_ms: Option<i64>, // Timestamp of last successful sync
    pub pending_count: u32,           // Count of unsynced samples
}
```

### SyncResult

Returned by the ingest endpoint and by `trigger_now()`:

```rust
pub struct SyncResult {
    pub accepted: u32,    // New samples stored
    pub duplicate: u32,   // Samples already in database
    pub rejected: u32,    // Samples that failed validation
}
```

### SyncConfig

```rust
pub struct SyncConfig {
    pub endpoint: String,              // Dashboard ingest URL
    pub batch_threshold: usize,        // 10 — flush when buffer reaches this count
    pub batch_timeout_ms: u64,         // 5000 — flush timer (5 seconds)
    pub max_batch_size: usize,         // 1000 — cap per batch
    pub retry_attempts: u32,           // 3 — max retry count
    pub retry_base_delay_ms: u64,      // 1000 — exponential backoff base (1s, 2s, 4s)
    pub periodic_interval_min: u32,    // 5 — full sweep interval in minutes
}
```

Default: `SyncConfig::default()` sets all fields to the values above.

## API

### SyncService::new(database, app) → Self

Construct a new service. Takes a cloned `Database` and `AppHandle` for event emission.

### SyncService::start(config: SyncConfig)

Spawns a background `tokio::spawn` task that:
1. Polls for unsynced samples (last hour on batch timer, all on periodic sweep)
2. Builds an `IngestPayload` with cached `ClientIdentity` and sample batch
3. POSTs to the configured endpoint with 15s timeout
4. On success: marks samples synced, emits `Success` event
5. On failure: retries with exponential backoff (1s, 2s, 4s), then emits `Error`

Cancels any existing task before spawning a new one.

### SyncService::stop()

Cancels the background task via `JoinHandle::abort()`. Does NOT change status — the caller sets the appropriate status (Paused or Off) via `apply_settings()`.

### SyncService::trigger_now() → Result<SyncResult, String>

Synchronous one-shot sync for the "Sync now" button. Fetches all unsynced samples, POSTs immediately (ignoring batch threshold), and marks successful samples as synced. Emits `Syncing` then `Success`/error events.

### SyncService::status() → SyncEvent

Returns current status and pending sample count. Used by the `get_sync_status` IPC command.

### SyncService::apply_settings(&self, settings: &AppSettings)

Applies settings changes to the sync service:
- URL set + not paused → `start(config)` with updated endpoint
- Paused → `stop()` + emit `SyncStatus::Paused`
- No URL or empty → `stop()` + clear config + emit `SyncStatus::Off`

## ClientIdentity Discovery

Uses lazy initialization: discovered on first use, then cached.

- **username**: `whoami::username()` (cross-platform)
- **hostname**: `whoami::hostname()` (cross-platform)
- **mac_address**: `mac_address::get_mac_address()` (best-effort; returns `None` on failure)
- **slug**: `<username>-<hostname>-<5-char-mac-suffix>` — last 5 chars of MAC
- **MAC fallback**: Hex string from current timestamp modulo 0xFFFFFF if MAC unavailable

## IngestPayload Format

```json
{
  "clientSlug": "user-hostname-00bb1",
  "username": "user",
  "hostname": "hostname",
  "macAddress": "aa:00:bb:11:cc:22",
  "samples": [
    {
      "targetId": "uuid",
      "timestampMs": 1234567890000,
      "latencyMs": 20.5,
      "status": "{\"variant\":\"Success\"}",
      "resolvedAddress": "1.1.1.1",
      "error": null
    }
  ]
}
```

Note: `status` is serialized as a JSON string of the Rust enum (not a plain string) to match the F3 ingest endpoint contract.

## Retry Strategy

Exponential backoff with 3 attempts:
- Attempt 1: Immediate
- Attempt 2: After 1s delay
- Attempt 3: After 2s delay
- After attempt 3 failure: Samples remain `cloud_synced_at_ms IS NULL` for next sync cycle

## Database Integration

- **Query**: `database.unsynced_samples(since_ms)` — `SELECT ... WHERE cloud_synced_at_ms IS NULL AND timestamp_ms >= ?`
- **Mark synced**: `database.mark_samples_synced(target_ids, from_ms, to_ms, synced_at_ms)` — `UPDATE ... SET cloud_synced_at_ms = ? WHERE target_id = ? AND timestamp_ms BETWEEN ? AND ? AND cloud_synced_at_ms IS NULL`
- **Index**: `idx_ping_samples_unsynced` on `(cloud_synced_at_ms, timestamp_ms)` for efficient unsynced queries

## Frontend Integration

### Tauri Event
```typescript
listen<SyncEvent>("sync-status-changed", (event) => {
  // Update sync status icon: event.payload.status
  // Show pending count: event.payload.pendingCount
});
```

### IPC Commands
```typescript
import { api } from "./api";

// Get current status
const status = await api.getSyncStatus();

// Trigger immediate sync
const result = await api.triggerSyncNow();
// result: { accepted, duplicate, rejected }
```

## Edge Cases

1. **No unsynced samples**: Service skips batch, sleeps until next timer
2. **Endpoint unreachable**: 3 retries with backoff, then samples remain pending
3. **Empty response body on 2xx**: `SyncResult` defaults to `{ accepted: batch.len(), duplicate: 0, rejected: 0 }`
4. **MAC discovery fails**: Slug uses timestamp-based fallback; sync proceeds normally
5. **Settings changed while task running**: `apply_settings()` calls `stop()` then `start()` — clean restart
6. **Paused then unpaused**: `apply_settings()` restarts task with `Idle` status (not `Paused`)
