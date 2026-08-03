# API: Monitors List

**Endpoint:** `GET /api/monitors`
**File:** `server/api/monitors.get.ts`
**Features:** F5 (Monitors list API)

## Purpose

Returns all monitors with their latest state (current up/down status, quality state, last seen time), joined with client information. Results are sorted by recency so the most recently active monitors appear first. This is the primary data source for the dashboard sidebar and the "All Monitors" view.

## Request

- **Method:** GET
- **Path:** `/api/monitors`
- **Authentication:** None (publicly accessible — MVP)
- **Headers:** None required
- **Query parameters:** None
- **Request body:** None

## Response

### Success (200 OK)

```json
{
  "monitors": [
    {
      "id": 1,
      "clientSlug": "alice-desktop-aa00bb11cc22",
      "clientName": "Alice's Desktop",
      "targetHost": "8.8.8.8",
      "targetName": "Google DNS",
      "status": "up",
      "latencyMs": 14.2,
      "qualityState": "good",
      "lastSeenMs": 1725200400000,
      "createdAt": "2023-11-14T22:13:20.000Z"
    },
    {
      "id": 2,
      "clientSlug": "bob-laptop-22cc33dd44",
      "clientName": "Bob's Laptop",
      "targetHost": "1.1.1.1",
      "targetName": "Cloudflare",
      "status": "down",
      "latencyMs": null,
      "qualityState": "degraded",
      "lastSeenMs": 1725200399000,
      "createdAt": "2023-11-14T22:10:00.000Z"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Monitor primary key |
| `clientSlug` | `string` | Immutable client identifier (derived from username + hostname + MAC) |
| `clientName` | `string` | Human-readable client display name |
| `targetHost` | `string` | The monitored host (IP or hostname) |
| `targetName` | `string` | Human-readable target label (falls back to `targetHost` if not set) |
| `status` | `"up" \| "down" \| null` | Latest ping status — `"up"` (success), `"down"` (timeout/error), `null` (no samples yet) |
| `latencyMs` | `number \| null` | Latency of the most recent ping sample in ms, or `null` if no samples |
| `qualityState` | `"good" \| "degraded" \| "poor" \| "unknown"` | Computed quality state from monitor row (`"unknown"` for monitors still warming up) |
| `lastSeenMs` | `number \| null` | Epoch milliseconds timestamp of the most recent sample, or `null` |
| `createdAt` | `string` | ISO 8601 timestamp when the monitor was first created |

### Success — Empty Database (200 OK)

```json
{
  "monitors": []
}
```

No monitors exist in the database. Returns an empty array with a 200 status — not an error.

### Success — Monitor With No Samples (200 OK)

A monitor exists but has not received any ping samples yet (e.g., just auto-created during ingest):

```json
{
  "monitors": [
    {
      "id": 10,
      "clientSlug": "new-client",
      "clientName": "New Client",
      "targetHost": "new.target.com",
      "targetName": "New Target",
      "status": null,
      "latencyMs": null,
      "qualityState": "unknown",
      "lastSeenMs": null,
      "createdAt": "2023-11-14T22:13:20.000Z"
    }
  ]
}
```

### Error (500 — Internal Server Error)

```json
{
  "message": "Failed to fetch monitors list",
  "statusCode": 500
}
```

Returned when the database is unavailable or the query fails (e.g., missing tables, corruption).

## Sort Order

Results are sorted by:

1. **`lastSeenMs` DESC** — Most recently active monitors appear first
2. **`id` ASC** — Stable tiebreaker when two monitors share the same `lastSeenMs`

Monitors with no samples (`lastSeenMs = null`) appear last (due to `COALESCE(lastSeenMs, 0)` in the query).

## Status Mapping

The `status` field is derived from the ping sample status using these rules:

| Ping Sample `status` | API `status` |
|---------------------|-------------|
| `"success"` | `"up"` |
| `"timeout"` | `"down"` |
| `"error"` | `"down"` |
| `null` (no samples) | `null` |

## Quality State Mapping

The `qualityState` field maps from the monitor row's `quality_state` column:

| DB `quality_state` | API `qualityState` |
|--------------------|-------------------|
| `"good"` | `"good"` |
| `"degraded"` | `"degraded"` |
| `"poor"` | `"poor"` |
| `"warmingUp"` | `"unknown"` |
| (any other) | `"unknown"` |

## Performance

- **Single SQL query** — Uses a CTE with `ROW_NUMBER()` to fetch the latest sample per monitor in one query. No N+1.
- **Target response time:** Under 100ms for typical datasets (tens to low hundreds of monitors).
- **No server-side cache** — The endpoint is called frequently by the dashboard. F7 (WebSocket) will push incremental updates instead of requiring re-polling.
- **Indexes used:** `idx_ping_monitor_time` on `ping_samples(monitor_id, timestamp_ms)` and `idx_monitors_client` on `monitors(client_id)`.

## Example Usage

```bash
# Get all monitors
curl http://localhost:3000/api/monitors

# Pretty-print the response
curl -s http://localhost:3000/api/monitors | jq '.monitors[] | { id, targetName, status, latencyMs }'

# Check how many monitors are active
curl -s http://localhost:3000/api/monitors | jq '.monitors | length'

# Find monitors that are down
curl -s http://localhost:3000/api/monitors | jq '.monitors[] | select(.status == "down")'
```

## TypeScript Usage

```typescript
import type { MonitorsListResponse, MonitorListItem } from "~/shared/types";

// Fetch from client-side code
const response = await fetch("/api/monitors");
const data = (await response.json()) as MonitorsListResponse;

for (const monitor of data.monitors) {
  console.log(`${monitor.targetName}: ${monitor.status} (${monitor.latencyMs}ms)`);
}
```

## Related

- [Monitors Utility](../utils/monitors.md) — `getAllMonitorsWithLatestState()` query logic
- [Shared Types](../shared/types.md) — `MonitorListItem`, `MonitorsListResponse`
- [Database Schema](../database/schema.md) — `monitors`, `ping_samples`, `clients` tables
- [Ping Ingest API](ping-ingest.md) — `POST /api/ping/ingest` (populates the data this endpoint reads)
- [Feature F5 Specification](../../requirements/features/feature-0005-monitors-list.md) — Original requirements
