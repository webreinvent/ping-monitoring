# Utility: Monitors List Query

**File:** `server/utils/monitors.ts`
**Features:** F5 (Monitors list API)

## Purpose

Core query function that fetches all monitors with their latest state, joined with client information. Uses a single SQL query with a CTE (Common Table Expression) and `ROW_NUMBER()` window function to efficiently get the most recent ping sample per monitor without N+1 queries.

Designed for **internal use only** — called by the API layer (`server/api/monitors.get.ts`).

## API

### `getAllMonitorsWithLatestState(): MonitorListItem[]`

```typescript
import { getAllMonitorsWithLatestState } from "~/server/utils/monitors";
import type { MonitorListItem } from "~/shared/types";

// Returns all monitors with latest state, sorted by recency
const monitors: MonitorListItem[] = getAllMonitorsWithLatestState();

// Example result:
// [
//   {
//     id: 1,
//     clientSlug: "alice-desktop-aa00bb11cc22",
//     clientName: "Alice's Desktop",
//     targetHost: "8.8.8.8",
//     targetName: "Google DNS",
//     status: "up",
//     latencyMs: 14.2,
//     qualityState: "veryHigh",
//     qualityStateUpdatedAtMs: 1725200400500,
//     lastSeenMs: 1725200400000,
//     createdAt: "2023-11-14T22:13:20.000Z"
//   }
// ]
```

#### Parameters

None. Uses the database connection from `getDb()`.

#### Returns

`MonitorListItem[]` — Array of monitors sorted by `lastSeenMs DESC, id ASC`.

- Returns an **empty array** when no monitors exist.
- Monitors with no samples have `null` for `status`, `latencyMs`, and `lastSeenMs`.
- `targetName` falls back to `targetHost` when the database column is `null`.

#### Throws

| Error | Condition |
|-------|-----------|
| `DatabaseError` | SQLite query fails (missing tables, corruption, connection loss) |

## SQL Query

The query uses a CTE with `ROW_NUMBER()` to get the latest sample per monitor:

```sql
WITH latest_samples AS (
  SELECT
    monitor_id,
    status,
    latency_ms,
    timestamp_ms,
    ROW_NUMBER() OVER (
      PARTITION BY monitor_id
      ORDER BY timestamp_ms DESC
    ) AS rn
  FROM ping_samples
)
SELECT
  m.id,
  c.slug AS client_slug,
  c.name AS client_name,
  m.target_host,
  m.target_name,
  ls.status AS last_status,
  ls.latency_ms AS last_latency_ms,
  ls.timestamp_ms AS last_seen_ms,
  m.quality_state,
  m.created_at
FROM monitors m
INNER JOIN clients c ON m.client_id = c.id
LEFT JOIN latest_samples ls ON m.id = ls.monitor_id AND ls.rn = 1
ORDER BY
  COALESCE(ls.timestamp_ms, 0) DESC,
  m.id ASC
```

### Query Design Decisions

| Decision | Rationale |
|----------|-----------|
| **CTE with ROW_NUMBER()** | Gets exactly one row per monitor (the latest sample) in a single pass. More efficient than correlated subqueries for large tables. |
| **INNER JOIN clients** | Every monitor must have a valid client (FK constraint). No risk of NULL joins. |
| **LEFT JOIN latest_samples** | Monitors with no samples still appear — their latest state fields are `null`. |
| **COALESCE(timestamp_ms, 0)** | Ensures monitors with no samples (NULL `timestamp_ms`) sort last. |
| **id ASC tiebreaker** | Deterministic ordering when two monitors share the same `lastSeenMs`. |

## Internal Functions

### `mapSampleStatus(status: string | null): "up" | "down" | null`

Maps the raw ping sample status to the API contract status.

```typescript
// Internal — not exported
function mapSampleStatus(status: string | null): "up" | "down" | null
```

| Input (DB value) | Output (API value) |
|-----------------|-------------------|
| `"success"` | `"up"` |
| `"timeout"` | `"down"` |
| `"error"` | `"down"` |
| `null` | `null` |

### `mapQualityState(qualityState: string): QualityState`

Maps the monitor row's `quality_state` to the typed `QualityState`. Uses the shared `mapQualityState()` function from `server/utils/quality-states.ts`.

```typescript
// Import from shared quality-states module
import { mapQualityState } from "~/server/utils/quality-states";
```

| Input (DB value) | Output (API value) | Notes |
|-----------------|-------------------|-------|
| `"veryHigh"` | `"veryHigh"` | F12 value |
| `"high"` | `"high"` | F12 value |
| `"medium"` | `"medium"` | F12 value |
| `"low"` | `"low"` | F12 value |
| `"unstable"` | `"unstable"` | F12 value |
| `"disconnected"` | `"disconnected"` | F12 value |
| `"warmingUp"` | `"warmingUp"` | F12 value |
| (legacy/other) | `"warmingUp"` | Legacy fallback |

**Note:** Migration 006 mapped legacy values (`good` → `veryHigh`, `degraded` → `medium`, `poor` → `low`) to F12 equivalents. Any remaining unrecognized values fall back to `"warmingUp"`.

## Row Mapping

The query returns snake_case columns from SQLite which are mapped to camelCase API fields:

| DB Column | API Field | Transformation |
|-----------|----------|---------------|
| `m.id` | `id` | Direct |
| `c.slug` | `clientSlug` | Rename |
| `c.name` | `clientName` | Rename |
| `m.target_host` | `targetHost` | Rename |
| `m.target_name` | `targetName` | Rename + null fallback to `targetHost` |
| `ls.status` | `status` | Via `mapSampleStatus()` |
| `ls.latency_ms` | `latencyMs` | Rename |
| `ls.timestamp_ms` | `lastSeenMs` | Rename |
| `m.quality_state` | `qualityState` | Via `mapQualityState()` |
| `m.created_at` | `createdAt` | Converted to ISO 8601 via `new Date(created_at).toISOString()` |

## Edge Cases

- **Empty database:** Returns `[]`. No error is thrown — this is the normal state before any clients have ingested data.
- **Monitor with no samples:** The `LEFT JOIN` ensures the monitor still appears with `null` latest state fields. `qualityState` is `"warmingUp"` (the initial value set by monitor auto-creation).
- **Multiple samples at the same timestamp:** `ROW_NUMBER()` picks one deterministically — the tiebreaker is the natural row order.
- **`target_name` is null:** The mapped `targetName` falls back to `targetHost` (e.g., the IP address).
- **Unknown quality_state values:** Any value not in the F12 known set maps to `"warmingUp"`. This future-proofs the function against schema changes.

## Performance

- **Single query:** No N+1 — one SQL statement fetches all data.
- **Index-dependent:** Relies on `idx_ping_monitor_time` (`ping_samples(monitor_id, timestamp_ms)`) for the CTE window function.
- **Target response time:** Under 100ms for typical datasets.
- **Scaling:** The `ROW_NUMBER()` CTE scales well up to tens of thousands of samples per monitor. For very large datasets (millions of samples), consider adding a materialized view or cache layer.

## Future Hooks

| Hook | Feature | Status |
|------|---------|--------|
| Client filter | M1-T8 (Per-client monitors) | Not implemented — would add `WHERE c.slug = ?` |
| Status filter | Future | Not implemented — would add `WHERE ls.status = ?` |
| Pagination | Future | Not implemented — would add `LIMIT`/`OFFSET` |

## Related

- [Monitors List API](../api/monitors.md) — API endpoint that calls this function
- [Shared Types](../shared/types.md) — `MonitorListItem`, `QualityState` interfaces
- [Quality States Constants](./quality-states.md) — `mapQualityState()` function
- [DB Helper](../utils/db.md) — `getDb()` for database access
- [Database Schema](../database/schema.md) — `monitors`, `clients`, `ping_samples` tables
- [Feature F5 Specification](../../requirements/features/feature-0005-monitors-list.md) — Original requirements
- [Feature F12 Specification](../../requirements/features/feature-00012-quality-classifier.md) — Quality classifier
