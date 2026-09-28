---
id: F6
name: Monitor History API
phase: MVP
priority: Critical
effort: Medium
dependencies: [F1, F3, F5]
---

# F6: Monitor History API

## Description

Provide a REST endpoint that returns historical ping data for a single monitor, formatted as a `HistoryResponse` matching the existing LNPM chart contract consumed by the uPlot-based `LatencyChart` component. This enables the per-monitor detailed chart view in the web dashboard.

The endpoint queries `ping_samples` for the specified time window, aggregates them into time-bucketed `HistoryPoint` records, computes quality intervals, and returns a single-element `series` array wrapped in a `HistoryResponse`.

## Acceptance Criteria

### AC1: Valid monitor returns history data

- **Given** a monitor with `id` = 42 exists in the database
- **And** `ping_samples` rows exist for that monitor between `2026-07-30T00:00:00Z` and `2026-07-31T00:00:00Z`
- **When** `GET /api/monitors/42?fromMs=1753852800000&toMs=1753939200000` is issued
- **Then** the response is a 200 OK with a valid `HistoryResponse` JSON body
- **And** `response.fromMs` equals `1753852800000`
- **And** `response.toMs` equals `1753939200000`
- **And** `response.series` has exactly one element
- **And** `response.series[0].target.id` equals `"42"`
- **And** `response.series[0].points` is a non-empty array of `HistoryPoint` objects

### AC2: Query parameters control the time window

- **Given** a monitor with `id` = 42 and ping samples spanning the last 24 hours
- **When** `GET /api/monitors/42?fromMs=1753852800000&toMs=1753896000000&maxPoints=200` is issued
- **Then** the returned `points` only contain `timestampMs` values within the requested range
- **And** the total number of points does not exceed `maxPoints` (the server down-samples by increasing bucket size)

### AC3: Missing fromMs uses a default window

- **Given** a monitor with `id` = 42
- **When** `GET /api/monitors/42` is issued with no query parameters
- **Then** the response covers the last 1 hour by default
- **And** `response.toMs` equals the current server time (within 5 seconds)
- **And** `response.fromMs` equals `toMs - 3_600_000`

### AC4: Non-existent monitor returns 404

- **Given** no monitor with `id` = 9999 exists
- **When** `GET /api/monitors/9999` is issued
- **Then** the response is 404 Not Found
- **And** the body contains `{ "error": "monitor_not_found" }`

### AC5: Invalid query parameters return 400

- **Given** a valid monitor with `id` = 42
- **When** `GET /api/monitors/42?fromMs=9999999999999&toMs=100` is issued (fromMs > toMs)
- **Then** the response is 400 Bad Request
- **And** the body contains an error message indicating `fromMs` must be less than `toMs`

### AC6: maxPoints cap enforced

- **Given** a monitor with `id` = 42 and 10,000 samples in the requested range
- **When** `GET /api/monitors/42?fromMs=...&toMs=...&maxPoints=100` is issued
- **Then** the response contains at most 100 `HistoryPoint` entries in `series[0].points`
- **And** the `bucketMs` value reflects the coarser aggregation needed to fit 100 points

### AC7: Empty result for no data in range

- **Given** a monitor with `id` = 42 but no samples in the requested range
- **When** `GET /api/monitors/42?fromMs=...&toMs=...` is issued
- **Then** the response is 200 OK
- **And** `response.series[0].points` is an empty array
- **And** `response.series[0].intervals` is an empty array
- **And** `response.series[0].summary.sampleCount` is 0

## Implementation Notes

### Files to create or modify

| File | Purpose |
|------|---------|
| `server/routes/api/monitors/[id].ts` | New route handler for `GET /api/monitors/:id` |
| `server/db/queries/history.ts` | New SQL queries for history aggregation |

### Aggregation strategy

The LNPM chart component (`src/chart.ts`) expects `HistoryPoint` data at minute-level granularity. The backend MUST aggregate raw `ping_samples` into per-minute buckets before returning:

```sql
SELECT
  strftime('%s', datetime(timestamp_ms / 1000, 'unixepoch'), 'start of minute') * 1000 AS timestamp_ms,
  COUNT(*) AS sample_count,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
  AVG(CASE WHEN latency_ms IS NOT NULL THEN latency_ms END) AS average_latency_ms,
  MIN(latency_ms) AS minimum_latency_ms,
  MAX(latency_ms) AS maximum_latency_ms,
  SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failure_count
FROM ping_samples
WHERE monitor_id = ?
  AND timestamp_ms >= ?
  AND timestamp_ms < ?
GROUP BY timestamp_ms
ORDER BY timestamp_ms ASC
```

The `GROUP BY` on the truncated timestamp produces one row per minute, matching the `minute_rollups` table schema.

### Down-sampling for maxPoints

When the raw minute-level bucket count exceeds `maxPoints`, increase the bucket size:

1. Start with `bucketMs = 60_000` (1 minute)
2. If bucket count > `maxPoints`, try `bucketMs = 5 * 60_000`, then `15 * 60_000`, etc.
3. Use the same clean sizes as the frontend `getBucketSize()` in `src/chart.ts`: `[1000, 5000, 10000, 30000, 60000, 300000, 900000, 1800000, 3600000]`
4. Return the chosen `bucketMs` in the response so the frontend knows the granularity

### Quality intervals computation

Compute `QualityIntervalRecord` entries from the aggregated points using a sliding-window classifier (same thresholds as F12, but computed inline for MVP):

- **warmingUp**: first 30 seconds of data or fewer than 5 samples
- **low**: packetLoss < 1%, avgLatency < 50ms
- **medium**: packetLoss < 5%, avgLatency < 100ms
- **high**: packetLoss < 10%, avgLatency < 200ms
- **veryHigh**: packetLoss < 10%, avgLatency >= 200ms
- **unstable**: packetLoss >= 10% or high jitter
- **disconnected**: no samples in the interval

### Range summary computation

Compute `RangeSummary` from the full result set:

```ts
summary = {
  sampleCount: totalSamples,
  successCount: totalSuccesses,
  failureCount: totalSamples - totalSuccesses,
  packetLossPercent: (totalFailures / totalSamples) * 100,
  averageLatencyMs: avg(all latencies),
  minimumLatencyMs: min(all latencies),
  maximumLatencyMs: max(all latencies),
  p95LatencyMs: p95(all latencies),
  stableMs: sum of ms in low/medium state intervals,
  unstableMs: sum of ms in high/veryHigh/unstable state intervals,
  disconnectedMs: sum of ms in disconnected state intervals,
  stablePercent: (stableMs / totalTime) * 100,
  unstablePercent: (unstableMs / totalTime) * 100,
  disconnectedPercent: (disconnectedMs / totalTime) * 100,
}
```

### Query parameter defaults

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `fromMs` | number | `nowMs - 3_600_000` | — | Start of time range (exclusive) |
| `toMs` | number | `nowMs` | — | End of time range (inclusive) |
| `maxPoints` | number | `2000` | `5000` | Maximum data points to return |

### Performance considerations

- SQLite `ping_samples` table MUST have a composite index on `(monitor_id, timestamp_ms)` — this is already required by F3 (ingest)
- WAL mode (from F1) ensures concurrent reads during writes
- No LRU cache for history queries (too many unique time windows) — rely on SQLite's B-tree performance
- The 5-minute future window on `timestampMs` from F3 limits the upper bound

## Data Model Changes

No new tables or columns. This feature reads from existing tables:

- `monitors` — to resolve `:id` and fetch target metadata
- `ping_samples` — source data for aggregation
- `minute_rollups` — MAY be used as a pre-aggregated source when available (optional optimization; raw aggregation is the baseline)

Index required (created by F1/F3):

```sql
CREATE INDEX IF NOT EXISTS idx_ping_samples_monitor_timestamp
ON ping_samples (monitor_id, timestamp_ms);
```

## API Contract

### Request

```
GET /api/monitors/:id
```

**Path parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string (UUID or integer) | Yes | Monitor unique identifier |

**Query parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `fromMs` | integer (epoch ms) | No | `now - 1 hour` | Start of time range (exclusive) |
| `toMs` | integer (epoch ms) | No | `now` | End of time range (inclusive) |
| `maxPoints` | integer | No | `2000` | Max data points; server aggregates to fit |

**Example request:**

```
GET /api/monitors/42?fromMs=1753852800000&toMs=1753939200000&maxPoints=500
```

### Response

**Success (200 OK):**

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

**Not found (404):**

```json
{
  "error": "monitor_not_found"
}
```

**Bad request (400):**

```json
{
  "error": "invalid_query_params",
  "message": "fromMs must be less than toMs"
}
```

### Response type (TypeScript — matches `src/types.ts`)

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
```
