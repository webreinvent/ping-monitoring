# LNPM Cloud Dashboard — Implementation Plan (M1-T7)

## Summary

Implement `GET /api/monitors` endpoint returning all monitors with latest state, joined with client info. Single SQL query (CTE + ROW_NUMBER). No N+1.

## Approach: Single SQL Query with CTE/ROW_NUMBER()

```sql
WITH latest_samples AS (
  SELECT monitor_id, status, latency_ms, timestamp_ms,
    ROW_NUMBER() OVER (PARTITION BY monitor_id ORDER BY timestamp_ms DESC) AS rn
  FROM ping_samples
)
SELECT m.id, c.slug AS client_slug, c.name AS client_name,
  m.target_host, m.target_name, ls.status, ls.latency_ms, ls.timestamp_ms,
  m.quality_state, m.created_at
FROM monitors m
INNER JOIN clients c ON m.client_id = c.id
LEFT JOIN latest_samples ls ON m.id = ls.monitor_id AND ls.rn = 1
ORDER BY COALESCE(ls.timestamp_ms, 0) DESC, m.id ASC
```

## Files to CREATE (4)

1. `dashboard/server/utils/monitors.ts` — getAllMonitorsWithLatestState()
2. `dashboard/server/api/monitors.get.ts` — GET /api/monitors route
3. `dashboard/server/api/monitors.get.test.ts` — Unit tests
4. `dashboard/server/api/monitors.get.integration.test.ts` — Integration tests

## Files to MODIFY (2)

1. `dashboard/shared/types.ts` — Add MonitorListItem, MonitorsListResponse
2. `dashboard/test/fixtures.ts` — Add createMonitorListItem factory

## API Response Shape (F5 Contract)

```json
{
  "monitors": [{
    "id": 1,
    "clientSlug": "alice-desktop-aa00bb11cc22",
    "clientName": "Alice's Desktop",
    "targetHost": "8.8.8.8",
    "targetName": "Google DNS",
    "status": "up" | "down" | null,
    "latencyMs": 14.2 | null,
    "qualityState": "good" | "degraded" | "poor" | "unknown",
    "lastSeenMs": 1722364800000 | null,
    "createdAt": "2026-07-01T12:00:00Z"
  }]
}
```

## Key Mapping Rules

- DB `status` ("success"/"timeout"/"error") → API `status` ("up"/"down"/null)
- DB `target_name` NULL → API `targetName` = `targetHost`
- DB `quality_state` default "warmingUp" → API `qualityState` "unknown"
- DB timestamps (epoch ms) → API `createdAt` ISO 8601

## Existing Patterns to Follow

- API routes: `defineEventHandler` with try/catch, `createError` for 500
- Database: `getDb()` from `./db`, `as Array<...>` type assertion
- Tests: vitest, `beforeEach` deletes `globalThis.__db`
- Logging: `info`/`error` from `./logger`

## Full plan file

`/Users/pk/Projects/ping-monitoring/ai-agents/agent-05-implementation-plan.md`
