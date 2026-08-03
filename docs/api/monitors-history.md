# API: Monitor History

**Endpoint:** `GET /api/monitors/:id`
**File:** `server/api/monitors/[id].get.ts`
**Features:** F6 (Monitor History API)

## Purpose

Returns historical ping data for a single monitor, formatted as a `HistoryResponse` matching the LNPM chart contract consumed by uPlot. Supports time window queries, down-sampling via `maxPoints`, and computes quality intervals and range summaries for chart rendering and analytics.

This is the primary data source for the per-monitor detailed chart view in the web dashboard.

## Request

- **Method:** GET
- **Path:** `/api/monitors/:id`
- **Authentication:** None (publicly accessible — MVP)
- **Headers:** None required

### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `number` | Yes | Monitor primary key ID |

### Query Parameters

| Name | Type | Required | Default | Max | Description |
|------|------|----------|---------|-----|-------------|
| `fromMs` | `number` (epoch ms) | No | `now - 1 hour` | — | Start of time range (exclusive) |
| `toMs` | `number` (epoch ms) | No | `now` | — | End of time range (inclusive) |
| `maxPoints` | `number` | No | `2000` | `5000` | Maximum data points to return; server aggregates to fit |

## Response

### Success (200 OK)

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

### Response Shape

| Field | Type | Description |
|-------|------|-------------|
| `fromMs` | `number` | Start of time range in epoch ms (exclusive) |
| `toMs` | `number` | End of time range in epoch ms (inclusive) |
| `bucketMs` | `number` | Bucket size in ms used for aggregation — reflects down-sampling decisions |
| `series` | `HistorySeries[]` | Array of history series (single element for single-monitor view) |

### `HistorySeries` Object

| Field | Type | Description |
|-------|------|-------------|
| `target` | `Target` | Monitor metadata (ID, name, host, thresholds) |
| `points` | `HistoryPoint[]` | Aggregated time-bucketed data points |
| `intervals` | `QualityIntervalRecord[]` | Quality classification intervals for chart coloring |
| `summary` | `RangeSummary` | Aggregate statistics over the full time range |

### `HistoryPoint` Object

| Field | Type | Description |
|-------|------|-------------|
| `timestampMs` | `number` | Epoch ms of the bucket start |
| `averageLatencyMs` | `number \| null` | Average latency across success samples in the bucket |
| `minimumLatencyMs` | `number \| null` | Minimum latency across all samples in the bucket |
| `maximumLatencyMs` | `number \| null` | Maximum latency across all samples in the bucket |
| `sampleCount` | `number` | Total number of samples in this bucket |
| `failureCount` | `number` | Number of failed (timeout/error) samples in this bucket |

### `QualityIntervalRecord` Object

| Field | Type | Description |
|-------|------|-------------|
| `startMs` | `number` | Epoch ms of interval start |
| `endMs` | `number \| null` | Epoch ms of interval end, or `null` for the open-ended final interval |
| `state` | `QualityState` | Quality classification (see below) |
| `reasons` | `QualityReason[]` | Reasons for the classification |

### `RangeSummary` Object

| Field | Type | Description |
|-------|------|-------------|
| `sampleCount` | `number` | Total number of samples in the range |
| `successCount` | `number` | Number of successful samples |
| `failureCount` | `number` | Number of failed samples |
| `packetLossPercent` | `number` | Packet loss percentage (0-100) |
| `averageLatencyMs` | `number \| null` | Average latency across success samples |
| `minimumLatencyMs` | `number \| null` | Minimum latency across all samples |
| `maximumLatencyMs` | `number \| null` | Maximum latency across all samples |
| `p95LatencyMs` | `number \| null` | 95th percentile latency |
| `stableMs` | `number` | Milliseconds spent in stable state (low/medium/warmingUp) |
| `unstableMs` | `number` | Milliseconds spent in unstable state (high/veryHigh/unstable) |
| `disconnectedMs` | `number` | Milliseconds with no data (disconnected gaps) |
| `stablePercent` | `number` | Percentage of range that is stable (0-100) |
| `unstablePercent` | `number` | Percentage of range that is unstable (0-100) |
| `disconnectedPercent` | `number` | Percentage of range that is disconnected (0-100) |

### Quality States

| State | Condition | Chart Color |
|-------|-----------|-------------|
| `warmingUp` | First 30s or fewer than 5 cumulative samples | Grey |
| `low` | packetLoss < 1%, avgLatency < 50ms | Green |
| `medium` | packetLoss < 5%, avgLatency < 100ms | Light green |
| `high` | packetLoss < 10%, avgLatency < 200ms | Yellow |
| `veryHigh` | packetLoss < 10%, avgLatency >= 200ms | Orange |
| `unstable` | packetLoss >= 10% | Red |
| `disconnected` | Gap between points > 2× bucket size | Grey (no data) |

### Quality Reasons

| Reason | Triggered When |
|--------|---------------|
| `packetLoss` | packetLoss >= 10% |
| `highLatency` | averageLatencyMs >= 200ms |
| `insufficientSamples` | sample count < 5 (warming up) |

### Error: Monitor Not Found (404)

```json
{
  "message": "monitor_not_found",
  "data": {
    "error": "monitor_not_found",
    "code": "MONITOR_NOT_FOUND"
  }
}
```

Returned when:
- Monitor ID does not exist in the database
- Monitor ID is not a valid positive integer
- `id` parameter is missing from the URL

### Error: Invalid Query Parameters (400)

```json
{
  "message": "fromMs must be less than toMs",
  "data": {
    "error": "invalid_query_params",
    "code": "INVALID_QUERY_PARAMS",
    "message": "fromMs must be less than toMs"
  }
}
```

Returned when:
- `fromMs >= toMs` (invalid time range)
- `fromMs` or `toMs` are not valid finite numbers

### Error: Internal Server Error (500)

```json
{
  "message": "Internal server error",
  "data": {
    "error": "internal_server_error",
    "code": "DATABASE_ERROR"
  }
}
```

Returned when the database query fails (e.g., connection loss, corrupted database). Non-Nitro errors are caught and wrapped in this response.

## Processing Flow

The endpoint follows a 10-step pipeline:

```
1. Parse path parameter (monitor ID)
2. Parse query parameters (fromMs, toMs, maxPoints)
3. Validate query parameters (finite numbers, fromMs < toMs)
4. Verify monitor exists in database
5. Calculate optimal bucket size (auto down-sampling)
6. Fetch aggregated history points from ping_samples
7. Compute quality intervals from aggregated points
8. Compute range summary (reusing intervals)
9. Build target metadata from monitor + client rows
10. Assemble and return HistoryResponse
```

### Bucket Size Calculation

The `calculateBucketSize()` function selects the smallest bucket size from a predefined list that fits within `maxPoints`:

```
Clean bucket sizes (ms): [1000, 5000, 10000, 30000, 60000, 300000, 900000, 1800000, 3600000]
```

- Starts at 60,000ms (1 minute) and works upward
- Skips sub-minute buckets (sub-60s)
- If no bucket fits, returns the largest (3,600,000ms = 1 hour)

**Example:** For a 24-hour range with `maxPoints=200`, the algorithm calculates:
- 60s buckets → 1,440 points (exceeds 200)
- 300s buckets → 288 points (exceeds 200)
- 900s buckets → 96 points (fits!) → returns 900,000ms

## Empty Data Behavior

When a monitor has no samples in the requested time range:
- Returns **200 OK** (not an error)
- `points` is an empty array `[]`
- `intervals` is an empty array `[]`
- `summary` returns all-zero/null values

This is the expected behavior for:
- Newly created monitors (no samples yet)
- Monitors with no data in the requested time window

## Performance

- **Single SQL query** — Uses `GROUP BY` on truncated timestamps to aggregate in one query. No N+1.
- **Index-driven:** Relies on `idx_ping_samples_monitor_timestamp` composite index on `(monitor_id, timestamp_ms)`.
- **No caching:** Each unique time window is a new query. SQLite B-tree performance is sufficient for MVP datasets.
- **Target response time:** Under 200ms for typical time windows (1 hour to 24 hours).
- **Memory:** Aggregation happens in SQLite; JavaScript processes only the result set (typically < 5,000 rows).

## Example Usage

```bash
# Get last 1 hour of history (default)
curl http://localhost:3000/api/monitors/42

# Get 24 hours of history with max 500 points
curl "http://localhost:3000/api/monitors/42?fromMs=1753766400000&toMs=1753852800000&maxPoints=500"

# Get exact time window
curl "http://localhost:3000/api/monitors/42?fromMs=1753852800000&toMs=1753856400000"

# Pretty-print points count
curl -s "http://localhost:3000/api/monitors/42" | jq '.series[0].points | length'

# Check quality summary
curl -s "http://localhost:3000/api/monitors/42" | jq '.series[0].summary | { packetLossPercent, stablePercent, unstablePercent }'
```

## TypeScript Usage

```typescript
import type { HistoryResponse } from "~/shared/types";

// Fetch from client-side code
const response = await fetch("/api/monitors/42?maxPoints=1000");
const data = (await response.json()) as HistoryResponse;

// Access chart-ready data
const series = data.series[0];
console.log(`${series.points.length} points at ${data.bucketMs}ms granularity`);

// Access quality summary
const { stablePercent, packetLossPercent } = series.summary;
console.log(`Stability: ${stablePercent.toFixed(1)}%, Packet loss: ${packetLossPercent.toFixed(2)}%`);
```

## Edge Cases

- **Invalid monitor ID (non-numeric):** Returns 404 with `MONITOR_NOT_FOUND`.
- **Negative or zero monitor ID:** Returns 404 with `MONITOR_NOT_FOUND`.
- **`maxPoints` above 5000:** Capped to 5000 — the server enforces this limit.
- **`maxPoints` below 1 or non-finite:** Falls back to default (2000).
- **Time range spanning months/years:** Bucket size increases to fit `maxPoints` — the response still returns data but at coarse granularity (up to 1-hour buckets).
- **p95 latency approximation:** The `p95LatencyMs` in `RangeSummary` is computed from per-bucket averages (not individual samples) due to the aggregation. This is an approximation; true p95 requires individual sample latencies.
- **Quality intervals for empty data:** Returns empty array — no intervals to classify.

## Related

- [History Utility](../utils/history.md) — `calculateBucketSize()`, `getMonitorHistoryPoints()`, `computeQualityIntervals()`, `computeRangeSummary()`, `buildTarget()`
- [Shared Types](../shared/types.md) — `HistoryResponse`, `HistorySeries`, `HistoryPoint`, `QualityIntervalRecord`, `RangeSummary`, `Target`
- [Monitors List API](monitors.md) — `GET /api/monitors` (lists monitors; this endpoint provides detail)
- [Ping Ingest API](ping-ingest.md) — `POST /api/ping/ingest` (populates the data this endpoint reads)
- [Database Schema](../database/schema.md) — `ping_samples` table, `monitors` table
- [Feature F6 Specification](../../requirements/features/feature-0006-monitor-history.md) — Original requirements
