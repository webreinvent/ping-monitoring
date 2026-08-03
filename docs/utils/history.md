# Utility: History Aggregation Engine

**File:** `server/utils/history.ts`
**Features:** F6 (Monitor History API)

## Purpose

Core utility module for aggregating raw `ping_samples` into chart-ready `HistoryResponse` data. Provides functions for bucket size calculation, SQL aggregation, quality interval classification, range summary computation, and target metadata assembly.

Designed for **internal use by the API layer** — not exposed as standalone endpoints. The API handler (`server/api/monitors/[id].get.ts`) orchestrates these functions in a pipeline.

## Public API

### `calculateBucketSize(fromMs, toMs, maxPoints): number`

Calculates the optimal bucket size to fit within `maxPoints` for the given time range.

```typescript
import { calculateBucketSize } from "~/server/utils/history";

// 1 hour range, 2000 max points → 60s buckets
const bucket = calculateBucketSize(
  Date.now() - 3_600_000,
  Date.now(),
  2000
);
// bucket = 60000

// 24 hour range, 100 max points → 900s buckets
const bucket24h = calculateBucketSize(
  Date.now() - 86_400_000,
  Date.now(),
  100
);
// bucket24h = 900000
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `fromMs` | `number` | Start of time range (epoch ms) |
| `toMs` | `number` | End of time range (epoch ms) |
| `maxPoints` | `number` | Maximum number of buckets to return |

#### Returns

`number` — Bucket size in milliseconds, selected from clean sizes: `[1000, 5000, 10000, 30000, 60000, 300000, 900000, 1800000, 3600000]`

#### Algorithm

1. Iterates through `CLEAN_BUCKET_SIZES` starting from 60,000ms (1 minute)
2. Calculates expected bucket count: `Math.ceil((toMs - fromMs) / bucketMs)`
3. Returns the first bucket size where expected count ≤ `maxPoints`
4. Falls back to the largest size (3,600,000ms) if no bucket fits

---

### `getMonitorHistoryPoints(monitorId, fromMs, toMs, bucketMs): HistoryPoint[]`

Fetches aggregated history points from `ping_samples` for a monitor in a time range. Uses `GROUP BY` on truncated timestamps to produce time-bucketed records.

```typescript
import { getMonitorHistoryPoints } from "~/server/utils/history";

const points = getMonitorHistoryPoints(42, fromMs, toMs, 60000);
// Returns array of HistoryPoint objects, one per bucket
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `monitorId` | `number` | Monitor primary key |
| `fromMs` | `number` | Start of time range (epoch ms, exclusive) |
| `toMs` | `number` | End of time range (epoch ms, inclusive) |
| `bucketMs` | `number` | Bucket size in milliseconds |

#### Returns

`HistoryPoint[]` — Array of aggregated points sorted by `timestampMs ASC`. Returns empty array when no data exists in the range.

#### SQL Query

```sql
SELECT
  CAST(floor(timestamp_ms / :bucketMs) * :bucketMs AS INTEGER) AS timestamp_ms,
  COUNT(*) AS sample_count,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
  SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failure_count,
  AVG(CASE WHEN latency_ms IS NOT NULL THEN latency_ms END) AS average_latency_ms,
  MIN(latency_ms) AS minimum_latency_ms,
  MAX(latency_ms) AS maximum_latency_ms
FROM ping_samples
WHERE monitor_id = :monitor_id
  AND timestamp_ms > :fromMs
  AND timestamp_ms <= :toMs
GROUP BY CAST(floor(timestamp_ms / :bucketMs) * :bucketMs AS INTEGER)
ORDER BY timestamp_ms ASC
```

---

### `computeQualityIntervals(points, bucketMs?): QualityIntervalRecord[]`

Computes quality intervals from aggregated history points. Iterates through points, classifies each, and merges consecutive points with the same state into intervals.

```typescript
import { computeQualityIntervals } from "~/server/utils/history";

const intervals = computeQualityIntervals(points, 60000);
// Returns array of QualityIntervalRecord objects
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `points` | `HistoryPoint[]` | — | Aggregated data points |
| `bucketMs` | `number` | `60000` | Bucket size for gap detection threshold |

#### Returns

`QualityIntervalRecord[]` — Array of quality intervals. Returns empty array when `points` is empty.

#### Classification Rules

| State | Condition |
|-------|-----------|
| `warmingUp` | Cumulative samples < 5 |
| `unstable` | packetLoss >= 10% (or no success samples / avgLatency is null) |
| `low` | packetLoss < 1% AND avgLatency < 50ms |
| `medium` | packetLoss < 5% AND avgLatency < 100ms |
| `high` | packetLoss < 10% AND avgLatency < 200ms |
| `veryHigh` | packetLoss < 10% AND avgLatency >= 200ms |
| `disconnected` | Gap between consecutive points > 2× bucket size |

#### Quality Reasons

| Reason | Triggered When |
|--------|---------------|
| `packetLoss` | packetLoss >= 10% |
| `highLatency` | averageLatencyMs >= 200ms |
| `insufficientSamples` | sampleCount < 5 during warming up |

#### Interval Merging

- Consecutive points with the same state are merged into a single interval
- Reasons are accumulated (deduplicated) across merged points
- Gap detection triggers a `disconnected` interval between the gap
- Final interval has `endMs = null` (open-ended)

---

### `computeRangeSummary(points, intervals?): RangeSummary`

Computes aggregate statistics over the full set of history points.

```typescript
import { computeRangeSummary } from "~/server/utils/history";

// With pre-computed intervals (efficient)
const summary = computeRangeSummary(points, intervals);

// Without intervals (recomputes internally — less efficient)
const summary = computeRangeSummary(points);
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `points` | `HistoryPoint[]` | — | Aggregated data points |
| `intervals` | `QualityIntervalRecord[]` | `[]` | Pre-computed quality intervals (optional; recomputed if empty) |

#### Returns

`RangeSummary` — Aggregate statistics object. Returns all-zero/null values when `points` is empty.

#### Computed Fields

| Field | Source |
|-------|--------|
| `sampleCount` | Sum of all `sampleCount` across points |
| `successCount` | `sampleCount - failureCount` |
| `failureCount` | Sum of all `failureCount` across points |
| `packetLossPercent` | `(failureCount / sampleCount) * 100` |
| `averageLatencyMs` | Mean of per-bucket average latencies (approximation) |
| `minimumLatencyMs` | Global minimum across all bucket `minimumLatencyMs` |
| `maximumLatencyMs` | Global maximum across all bucket `maximumLatencyMs` |
| `p95LatencyMs` | 95th percentile of per-bucket averages (approximation) |
| `stableMs` | Sum of ms in `low`, `medium`, `warmingUp` intervals |
| `unstableMs` | Sum of ms in `high`, `veryHigh`, `unstable` intervals |
| `disconnectedMs` | Sum of ms in `disconnected` intervals |
| `stablePercent` | `(stableMs / totalTimeMs) * 100` |
| `unstablePercent` | `(unstableMs / totalTimeMs) * 100` |
| `disconnectedPercent` | `(disconnectedMs / totalTimeMs) * 100` |

---

### `buildTarget(monitorRow, clientRow): Target`

Builds a `Target` metadata object from monitor and client database rows.

```typescript
import { buildTarget } from "~/server/utils/history";

const target = buildTarget(monitorRow, clientRow);
// Returns Target object with id, name, host, thresholds, etc.
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `monitorRow` | `MonitorRow` | Monitor row from DB (includes `target_host`, `target_name`, `created_at`) |
| `clientRow` | `ClientRow \| null` | Client row from DB (optional; not used in Target output) |

#### Returns

`Target` — Object matching the chart component's `Target` interface.

#### Default Values

| Field | Default | Source |
|-------|---------|--------|
| `id` | `String(monitorRow.id)` | Monitor primary key |
| `name` | `monitorRow.target_name ?? monitorRow.target_host` | Falls back to host if name is null |
| `host` | `monitorRow.target_host` | Direct from DB |
| `enabled` | `true` | Hardcoded (all monitors are enabled) |
| `addressFamily` | `"ipv4"` or `"ipv6"` | Detected from host containing `:` (IPv6 heuristic) |
| `intervalMs` | `1000` | Default ping interval |
| `timeoutMs` | `5000` | Default ping timeout |
| `thresholds` | `DEFAULT_THRESHOLDS` | Hardcoded quality thresholds |
| `createdAtMs` | `monitorRow.created_at` | From DB |
| `archivedAtMs` | `null` | Not yet supported |

#### Default Thresholds

```typescript
const DEFAULT_THRESHOLDS = {
  windowSeconds: 300,
  minimumSamples: 10,
  packetLossPercent: 1,
  jitterMs: 20,
  p95LatencyMs: 100,
  unstableForSeconds: 60,
  stableForSeconds: 30,
  outageFailures: 5,
  recoverySuccesses: 3,
};
```

## Internal Functions (Not Exported)

### `classifyPoint(point, cumulativeSamples, pointIndex): QualityState`

Classifies a single point's quality state based on packet loss and latency thresholds. See Classification Rules above.

### `collectReasons(point, state): QualityReason[]`

Collects quality reasons for a given state. Returns array of reason strings (e.g., `["packetLoss", "highLatency"]`).

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `CLEAN_BUCKET_SIZES` | `[1000, 5000, 10000, 30000, 60000, 300000, 900000, 1800000, 3600000]` | Allowed bucket sizes (ms) |
| `DEFAULT_BUCKET_MS` | `60000` | Default 1-minute bucket |
| `WARMING_UP_SECONDS` | `30` | Warming-up time threshold |
| `MIN_SAMPLES_FOR_WARMING` | `5` | Minimum cumulative samples to exit warming-up |
| `DEFAULT_THRESHOLDS` | (object) | Quality threshold defaults for Target |

## DB Row Types

### `MonitorRow`

```typescript
interface MonitorRow {
  id: number;
  client_id: number;
  target_host: string;
  target_name: string | null;
  quality_state: string;
  state_since_ms: number | null;
  last_seen_ms: number | null;
  last_status: string | null;
  last_latency_ms: number | null;
  created_at: number;
  updated_at: number;
}
```

### `ClientRow`

```typescript
interface ClientRow {
  id: number;
  slug: string;
  name: string;
  username: string;
  hostname: string;
  mac_address: string;
  sync_enabled: number;
  sync_interval_min: number;
  backend_url: string;
  last_synced_at_ms: number | null;
  created_at: number;
  updated_at: number;
}
```

### `AggregatedRow`

Internal type matching the SQL query output:

```typescript
interface AggregatedRow {
  timestamp_ms: number;
  sample_count: number;
  success_count: number;
  failure_count: number;
  average_latency_ms: number | null;
  minimum_latency_ms: number | null;
  maximum_latency_ms: number | null;
}
```

## Edge Cases

- **Empty points array:** `computeQualityIntervals()` and `computeRangeSummary()` both return empty/zero values without errors.
- **Gap detection:** When the gap between consecutive points exceeds 2× bucket size, a `disconnected` interval is inserted. The previous interval is closed at the gap start, and a new interval begins at the gap end.
- **Defensive copies:** `reasons` arrays in returned intervals are defensive copies (`[...currentReasons]`) to prevent external mutation.
- **p95 approximation:** `p95LatencyMs` is computed from per-bucket averages (not individual samples). This is a simplification; true p95 requires individual sample latencies.
- **Min/max accuracy:** `minimumLatencyMs` and `maximumLatencyMs` are computed from the SQL `MIN()`/`MAX()` aggregates — these ARE accurate individual sample extremes, not approximations.
- **Open-ended final interval:** The last interval always has `endMs = null`, indicating it extends to the present.
- **Warming up as stable:** Warming-up intervals count toward `stableMs` in range summary calculations (conservative default).

## Performance

- **Single SQL query** per history request — aggregation happens in SQLite, not JavaScript.
- **Linear iteration** for quality intervals — O(n) where n is the number of aggregated points (typically < 5,000).
- **p95 computation** sorts the per-bucket averages — O(n log n) on a small dataset.
- **No caching layer** — each unique time window re-executes the full pipeline.

## Related

- [Monitor History API](../api/monitors-history.md) — API endpoint that uses these functions
- [Shared Types](../shared/types.md) — `HistoryPoint`, `QualityIntervalRecord`, `RangeSummary`, `Target`, `QualityState`, `QualityReason`
- [DB Helper](db.md) — `getDb()` used by `getMonitorHistoryPoints()`
- [Feature F6 Specification](../../requirements/features/feature-0006-monitor-history.md) — Original requirements
