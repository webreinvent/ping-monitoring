# Utility: Quality Classifier

**File:** `server/utils/quality-classifier.ts`
**Feature:** F12 (Backend quality classifier)

## Purpose

Core classification engine that analyzes raw ping samples in a 5-minute sliding window and computes a quality state for each monitor. The quality state summarizes the health of a connection into one of seven discrete values.

The classifier:
1. Queries aggregated metrics from `ping_samples` using a single SQL query
2. Applies the classification algorithm (first match wins)
3. Persists the result to the `monitors` row
4. Returns the result including change detection metadata

## API

### `classifyMonitor(monitorId: number): ClassifyResultWithDiff`

Classify a single monitor's quality based on its recent ping samples. Persists result to the monitor row.

```typescript
import { classifyMonitor } from "~/server/utils/quality-classifier";

const result = classifyMonitor(42);
console.log(result.qualityState);    // "veryHigh"
console.log(result.packetLoss);      // 0
console.log(result.avgLatency);      // 12.5
console.log(result.stateChanged);    // true
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `monitorId` | `number` | The monitor ID to classify |

#### Returns

`ClassifyResultWithDiff` — Extended classification result:

| Field | Type | Description |
|-------|------|-------------|
| `qualityState` | `QualityState` | Computed quality state |
| `qualityStateUpdatedAtMs` | `number` | Epoch ms of classification |
| `sampleCount` | `number` | Samples in the 5-minute window |
| `packetLoss` | `number` | Packet loss percentage (0-100) |
| `avgLatency` | `number` | Average latency in ms (of success samples) |
| `cv` | `number` | Coefficient of variation (stddev/mean) |
| `previousState` | `string \| null` | Previous quality state from the DB row |
| `stateChanged` | `boolean` | `true` if the new state differs from previous |

### `classifyMonitorsBatch(monitorIds: number[]): Map<number, QualityState>`

Bulk classify multiple monitors. Returns only monitors whose state actually changed.

```typescript
import { classifyMonitorsBatch } from "~/server/utils/quality-classifier";

const changes = classifyMonitorsBatch([1, 42, 100]);
// Returns: Map { 42 => "veryHigh" } (only changed monitors)
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `monitorIds` | `number[]` | Array of monitor IDs to classify |

#### Returns

`Map<number, QualityState>` — Map of monitor IDs to their new quality state, **only for monitors whose state changed**. Empty map if no changes.

#### Behavior

- **Error tolerance:** Individual monitor failures are caught and logged (via `logError`) but do not abort the batch. Other monitors in the batch are still classified.
- **Change detection:** Only monitors whose state changed are included in the returned map.
- **Logging:** Logs `info` level on state changes (with metrics) and `debug` level when unchanged.

## Classification Algorithm

The algorithm uses a **5-minute sliding window** and applies rules in priority order (first match wins):

```
1. Disconnected
   └─ No samples in 5-min window AND (no samples ever OR last sample > 5 min ago)
   └─ Only if last sample was within 1 hour (otherwise: warmingUp)

2. WarmingUp
   └─ Fewer than 10 samples in 5-min window

3. Unstable
   └─ cv > 0.5 AND packet_loss < 10%

4. VeryHigh
   └─ packet_loss == 0% AND avg_latency < 50ms

5. High
   └─ packet_loss == 0% AND avg_latency < 150ms

6. Medium
   └─ packet_loss <= 10% AND avg_latency <= 300ms

7. Low
   └─ Everything else (high packet loss or high latency)
```

### Decision Flow Chart

```
                        ┌─ sampleCount === 0 ─┐
                        │                     │
                ┌───────┴───────┐             │
                │                │             │
          lastSampleMs = null  lastSampleMs > 1hr ago
                │                │             │
                ▼                ▼             │
          "disconnected"    "warmingUp"        │
                │                                 │
                │   lastSampleMs < 1hr ago        │
                └──────────┬──────────────────────┘
                           │
                    "disconnected" or "warmingUp"
                           │
                           │  sampleCount > 0
                           ▼
                  sampleCount < 10?
                           │
                  ┌────────┴────────┐
                  │                 │
               "warmingUp"         │
                                   ▼
                        cv > 0.5 AND packetLoss < 10%?
                                   │
                        ┌───────────┴───────────┐
                        │                       │
                   "unstable"                   │
                                               ▼
                                    packetLoss == 0 AND avgLatency < 50?
                                               │
                                    ┌──────────┴──────────┐
                                    │                     │
                               "veryHigh"                 │
                                                          ▼
                                           packetLoss == 0 AND avgLatency < 150?
                                                          │
                                           ┌──────────────┴──────────────┐
                                           │                             │
                                      "high"                              │
                                                                           ▼
                                                packetLoss <= 10 AND avgLatency <= 300?
                                                                           │
                                              ┌────────────────────────────┴┐
                                              │                             │
                                         "medium"                         "low"
```

### Metric Computation

Two SQL queries are executed per classification:

**Query 1: Aggregated window stats + current state** (single query, JOIN)

```sql
SELECT
  COUNT(ps.id) AS sample_count,
  SUM(CASE WHEN ps.status = 'success' THEN 1 ELSE 0 END) AS success_count,
  SUM(CASE WHEN ps.status = 'success' AND ps.latency_ms IS NOT NULL THEN ps.latency_ms END) AS sum_latency,
  SUM(CASE WHEN ps.status = 'success' AND ps.latency_ms IS NOT NULL THEN ps.latency_ms * ps.latency_ms END) AS sum_latency_sq,
  COUNT(CASE WHEN ps.status = 'success' AND ps.latency_ms IS NOT NULL THEN 1 END) AS latency_count,
  m.quality_state AS current_quality_state
FROM monitors m
LEFT JOIN ping_samples ps ON ps.monitor_id = m.id
  AND ps.timestamp_ms >= ?
WHERE m.id = ?
```

From this query:
- `packetLoss` = `(1 - success_count / sample_count) * 100`
- `avgLatency` = `sum_latency / latency_count`
- `variance` = `(sum_latency_sq / latency_count) - avgLatency^2`
- `stddev` = `sqrt(variance)`
- `cv` = `stddev / avgLatency` (coefficient of variation)

**Query 2: Last sample timestamp** (for disconnected detection)

```sql
SELECT MAX(timestamp_ms) AS last_sample_ms
FROM ping_samples
WHERE monitor_id = ?
```

### Persistence

The classifier persists results directly to the database:

```sql
UPDATE monitors
SET quality_state = ?, quality_state_updated_at = ?, updated_at = ?
WHERE id = ?
```

## Integration Points

### Post-Ingest Trigger

The classifier is invoked after each successful batch ingest in `server/utils/ping-ingest.ts`:

```typescript
// After transaction commits:
const monitorIds = new Set(/* monitor IDs from ingest */);
const changes = classifyMonitorsBatch([...monitorIds]);
```

- **Best-effort:** Failure does not break the ingest pipeline
- **Once per monitor:** Each distinct monitor is classified once, regardless of how many samples were ingested for it

### Background Sweep

The `quality-sweep` Nitro plugin runs `classifyMonitorsBatch` every 60 seconds on all monitors with recent samples (see [Quality Sweep Plugin](./quality-sweep.md)).

## Edge Cases

- **Monitor with no samples:** Returns `disconnected` state (no samples ever).
- **Monitor with samples but none in window:** If last sample is within 1 hour, returns `disconnected`; otherwise `warmingUp`.
- **Between pings:** If samples exist but none in the 5-minute window and last sample is recent (< 5 min), returns `warmingUp` (insufficient data).
- **All failures (0 success samples):** `avgLatency` is 0, `cv` is 0. The classifier falls through to `low` (since packet_loss > 0).
- **Single success sample:** `cv` is 0 (no variance). Falls through to latency-based classification.
- **Division by zero in CV:** When `avgLatency` is 0, `cv` is set to 0 (not NaN).
- **Variance underflow:** `Math.max(0, variance)` prevents `NaN` from negative variance (floating-point rounding).

## Performance

- **Two queries per monitor:** One aggregated JOIN query + one `MAX(timestamp_ms)` query. Both use the `idx_ping_samples_monitor_timestamp` index.
- **Batch optimization:** `classifyMonitorsBatch` detects state changes and only logs changes at `info` level.
- **No caching:** Each classification is a fresh query — results are persisted to the DB and read directly by API endpoints.

## Related

- [Quality States Constants](./quality-states.md) — Threshold constants used by the classifier
- [Quality Sweep Plugin](./quality-sweep.md) — Background re-evaluation timer
- [Ping Ingest Engine](./ping-ingest.md) — Post-ingest trigger point
- [Monitors List API](../api/monitors.md) — Reads `quality_state` from monitor rows
- [Monitor History API](../api/monitors-history.md) — Uses `quality_state` in `Target` metadata
- [WebSocket Broadcast](../websocket/broadcast.md) — Includes `quality_state` in messages
- [Shared Types](../shared/types.md) — `QualityState`, `ClassifyResult` type definitions
- [Feature F12 Specification](../../requirements/features/feature-00012-quality-classifier.md) — Original requirements
