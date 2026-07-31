---
id: F5
name: Monitors list API
phase: MVP
priority: Critical
effort: Small
dependencies: [F1, F2, F3]
---

# F5: Monitors list API

## Description
Expose `GET /api/monitors` to return every monitor with its latest state (current up/down status, quality state, last seen time). Results are sorted by recency so the most recently active monitors appear first. This is the primary data source for the dashboard sidebar and the "All Monitors" view.

## Acceptance Criteria

- **Given** the database contains monitors and ping samples, **When** a GET request is made to `/api/monitors`, **Then** the response returns an array of monitor records each enriched with the latest ping state.
- **Given** a monitor has no ping samples, **When** it is included in the list, **Then** its latest state fields (`status`, `latencyMs`, `qualityState`, `lastSeenMs`) are `null`.
- **Given** multiple monitors share the same `lastSeenMs`, **When** the list is returned, **Then** they are ordered by `monitors.id` ascending as a stable tiebreaker.
- **Given** no monitors exist in the database, **When** the endpoint is called, **Then** it returns an empty array with a 200 status.
- **Given** the endpoint is called, **When** the response is received, **Then** results are sorted by `lastSeenMs` descending (most recent first).

## Implementation Notes

- Create a Nitro route handler at `server/api/monitors.get.ts`.
- Use a single SQL query that joins `monitors` with a subquery fetching the latest `ping_sample` per monitor (via `ROW_NUMBER() OVER (PARTITION BY monitor_id ORDER BY timestamp_ms DESC)` or a correlated `WHERE timestamp_ms = (SELECT MAX(...) WHERE ...)`).
- Include `clients` table to resolve `client_id` into `clientSlug` and `clientName` so the frontend does not need a second fetch.
- Quality state (`qualityState`) is computed server-side from a sliding window of recent samples (see F12). For F5 MVP, default to `"unknown"` until F12 is implemented; add the column in the response shape now so the contract is stable.
- Sort clause: `ORDER BY lastSeenMs DESC, monitors.id ASC`.
- Cache: no server-side cache for this endpoint — it is small (tens to low hundreds of rows) and called frequently by the dashboard. F7 (WebSocket) will push incremental updates instead of polling this endpoint.

## Data Model Changes

No new tables or columns. Reuses existing schema:

- `monitors` — `id`, `client_id`, `target_host`, `target_name`, `created_at`, `updated_at`
- `ping_samples` — `id`, `monitor_id`, `timestamp_ms`, `latency_ms`, `status`, `resolved_address`, `error`, `created_at`
- `clients` — `id`, `slug`, `name`, `username`, `hostname`, `mac_address`, `created_at`, `updated_at`

## API Contract

**Request**

```
GET /api/monitors
```

No query parameters. No authentication required for MVP (open read).

**Response**

```
Status: 200 OK
Content-Type: application/json
```

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
      "qualityState": "unknown",
      "lastSeenMs": 1722364800000,
      "createdAt": "2026-07-01T12:00:00Z"
    }
  ]
}
```

**Response fields**

| Field | Type | Description |
|---|---|---|
| `id` | number | Monitor primary key |
| `clientSlug` | string | Immutable client identifier |
| `clientName` | string | Human-readable client display name |
| `targetHost` | string | The monitored host (IP or hostname) |
| `targetName` | string | Human-readable target label |
| `status` | `"up" \| "down" \| null` | Latest ping status from the most recent sample |
| `latencyMs` | `number \| null` | Latency of the most recent sample |
| `qualityState` | `"good" \| "degraded" \| "poor" \| "unknown"` | Computed quality state (default `"unknown"` until F12) |
| `lastSeenMs` | `number \| null` | Timestamp of the most recent sample in milliseconds |
| `createdAt` | string | ISO 8601 timestamp when the monitor was created |

**Error responses**

| Status | Description |
|---|---|
| 500 | Internal server error (database unavailable) |
