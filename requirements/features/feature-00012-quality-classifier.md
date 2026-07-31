---
id: F12
name: Backend quality classifier
phase: Enhancement
priority: Medium
effort: Medium
dependencies: [F3, F5, F6]
---

# F12: Backend quality classifier

## Description
A backend service that analyzes raw ping samples in a sliding time window and computes a quality state for each monitor. The quality state summarizes the health of a connection into one of six discrete values: **Low**, **Medium**, **High**, **VeryHigh**, **Unstable**, or **Disconnected**. Results are stored on the monitor record so the dashboard and APIs can display the current quality without re-computing on every request.

The classifier runs as a post-ingest step: after each successful batch insert (F3), the affected monitors are re-evaluated. A background sweep re-evaluates all monitors every 60 seconds to keep stale states fresh.

## Acceptance Criteria

### Given recent samples exist for a monitor
- **When** the last 5 minutes contain at least 10 samples
- **And** packet loss is 0% with average latency under 50 ms
- **Then** the quality state is `VeryHigh`

### Given recent samples exist for a monitor
- **When** the last 5 minutes contain at least 10 samples
- **And** packet loss is 0% with average latency between 50 ms and 150 ms
- **Then** the quality state is `High`

### Given recent samples exist for a monitor
- **When** the last 5 minutes contain at least 10 samples
- **And** packet loss is between 1% and 10% with average latency between 150 ms and 300 ms
- **Then** the quality state is `Medium`

### Given recent samples exist for a monitor
- **When** the last 5 minutes contain at least 10 samples
- **And** packet loss exceeds 10% or average latency exceeds 300 ms
- **Then** the quality state is `Low`

### Given recent samples show high variance
- **When** the coefficient of variation (stddev / mean) of latency in the last 5 minutes exceeds 0.5
- **And** packet loss is under 10%
- **Then** the quality state is `Unstable` regardless of average latency tier

### Given no recent samples exist for a monitor
- **When** no samples arrive in the last 5 minutes
- **And** the monitor had samples within the last hour
- **Then** the quality state is `Disconnected`

### Given a monitor has no samples at all
- **When** a monitor has zero samples in the database
- **Then** the quality state is `Disconnected`

### Given a batch of samples is ingested
- **When** POST /api/ping/ingest succeeds for one or more monitors
- **Then** the quality state for each affected monitor is recalculated and persisted before the response returns

### Given the monitors list API is called
- **When** GET /api/monitors is called
- **Then** each monitor in the response includes `quality_state` and `quality_state_updated_at` fields

### Given the monitor history API is called
- **When** GET /api/monitors/:id is called
- **Then** the response includes the current `quality_state` in the monitor metadata

### Given a background sweep runs
- **When** 60 seconds elapse since the last evaluation for a monitor with recent activity
- **Then** the quality state is refreshed

## Implementation Notes

### Classification algorithm
1. **Gather window**: Fetch all `ping_samples` for the monitor where `timestamp_ms >= now - 5 min`.
2. **Compute metrics**:
   - `sample_count` — total samples in window
   - `success_count` — samples where `status = 'success'`
   - `packet_loss` — `(1 - success_count / sample_count) * 100`
   - `avg_latency` — average of `latency_ms` for successful samples
   - `stddev_latency` — standard deviation of `latency_ms` for successful samples
   - `cv` — `stddev_latency / avg_latency` (coefficient of variation)
3. **Determine state** (applied in order, first match wins):
   - If `sample_count < 10` and no samples in window: `Disconnected`
   - If `cv > 0.5` and `packet_loss < 10`: `Unstable`
   - If `packet_loss == 0` and `avg_latency < 50`: `VeryHigh`
   - If `packet_loss == 0` and `avg_latency < 150`: `High`
   - If `packet_loss <= 10` and `avg_latency <= 300`: `Medium`
   - Otherwise: `Low`

### Execution model
- **Post-ingest trigger**: After `db_write_ping_samples` (F3) commits, call `classify_monitor(monitor_id)` for each distinct `monitor_id` in the batch. This is synchronous — the ingest response waits for classification.
- **Background sweep**: A `setInterval` timer (60 s) iterates all monitors that have samples within the last 10 minutes and re-classifies them. This catches stale states when no ingest traffic arrives.
- **SQL window query**: Use a single parameterized query per monitor:
  ```sql
  SELECT
    COUNT(*) AS sample_count,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
    AVG(CASE WHEN status = 'success' THEN latency_ms END) AS avg_latency,
    COUNT(CASE WHEN status = 'success' THEN latency_ms END) AS latency_count
  FROM ping_samples
  WHERE monitor_id = ? AND timestamp_ms >= ?
  ```
  Stddev requires a second pass or computing `SUM(latency_ms * latency_ms)` in the same query to derive variance.

### Files
- `src/quality-classifier.ts` — core classification logic, SQL queries, `classify_monitor()` function
- `src/quality-states.ts` — enum/const for quality state values, threshold constants
- `server/api/monitors/index.ts` — updated to include `quality_state` in list response (F5)
- `server/api/monitors/[id].ts` — updated to include `quality_state` in history response (F6)
- `server/routes/ping/ingest.ts` — updated to trigger classification after ingest (F3)

### Performance
- Window query touches at most 5 minutes of data per monitor. With a composite index on `(monitor_id, timestamp_ms)`, this is an efficient range scan.
- Post-ingest classification runs once per distinct monitor in the batch, not per sample.
- Background sweep filters to active monitors only (has samples in last 10 min) to avoid scanning dead rows.

### Threshold configuration
Threshold values (50 ms, 150 ms, 300 ms, 10% loss, 0.5 CV, 5 min window, 10 min sample threshold) are defined as named constants in `src/quality-states.ts` for easy tuning. A future enhancement could expose them via configuration or per-monitor settings.

## Data Model Changes

### monitors table — new columns
```sql
ALTER TABLE monitors ADD COLUMN quality_state TEXT NOT NULL DEFAULT 'Disconnected'
  CHECK (quality_state IN ('Low', 'Medium', 'High', 'VeryHigh', 'Unstable', 'Disconnected'));

ALTER TABLE monitors ADD COLUMN quality_state_updated_at INTEGER;
```

### New index
```sql
-- Composite index for the sliding window query (already needed for history queries)
CREATE INDEX IF NOT EXISTS idx_ping_samples_monitor_timestamp
  ON ping_samples(monitor_id, timestamp_ms);
```

### Updated monitors schema
```
monitors: {
  id,
  client_id,
  target_host,
  target_name,
  quality_state,           -- NEW: 'Low' | 'Medium' | 'High' | 'VeryHigh' | 'Unstable' | 'Disconnected'
  quality_state_updated_at, -- NEW: timestamp_ms of last classification
  created_at,
  updated_at
}
```

## API Contract

### GET /api/monitors — updated response
Each monitor in the array gains two fields:

```jsonc
{
  "id": 1,
  "client_id": "alice-desktop-aa00bb11cc22",
  "target_host": "8.8.8.8",
  "target_name": "Google DNS",
  "latest_latency_ms": 12,
  "latest_status": "success",
  "latest_timestamp_ms": 1722400000000,
  "quality_state": "VeryHigh",           // NEW
  "quality_state_updated_at": 1722400001000  // NEW
  // ... existing fields
}
```

### GET /api/monitors/:id — updated response
Monitor metadata section gains quality fields:

```jsonc
{
  "monitor": {
    "id": 1,
    "target_host": "8.8.8.8",
    "target_name": "Google DNS",
    "quality_state": "VeryHigh",         // NEW
    "quality_state_updated_at": 1722400001000  // NEW
  },
  "history": [ ... ]
}
```

### WebSocket — updated payload
Broadcast messages for new samples include the updated `quality_state` so clients can update the display without polling:

```jsonc
{
  "type": "sample",
  "monitor_id": 1,
  "latency_ms": 12,
  "status": "success",
  "timestamp_ms": 1722400000000,
  "quality_state": "VeryHigh"           // NEW
}
```

### Internal function signature
```typescript
function classifyMonitor(monitorId: number): {
  qualityState: QualityState,
  qualityStateUpdatedAtMs: number,
  // debug metrics (not persisted)
  sampleCount: number,
  packetLoss: number,
  avgLatency: number,
  cv: number
}
```
