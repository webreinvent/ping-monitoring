# LNPM M1-T7 Implementation Status

**Status:** COMPLETE
**Date:** 2026-08-03

## Files Created (4)
1. `dashboard/server/utils/monitors.ts` — getAllMonitorsWithLatestState() with CTE/ROW_NUMBER query
2. `dashboard/server/api/monitors.get.ts` — GET /api/monitors route handler
3. `dashboard/server/api/monitors.get.test.ts` — 14 unit tests
4. `dashboard/server/api/monitors.get.integration.test.ts` — 5 integration tests

## Files Modified (2)
1. `dashboard/shared/types.ts` — Added MonitorListItem, MonitorsListResponse
2. `dashboard/test/fixtures.ts` — Added createMonitorListItem, createMonitorsListResponse factories

## Verification
- Typecheck: PASS (npx nuxi typecheck)
- Tests: PASS (543/543 tests, including 19 new monitors tests)
- Dev server: STARTS (segfault is known better-sqlite3 issue, not related to changes)

## Key design decisions
- Single SQL query with CTE + ROW_NUMBER() — no N+1
- Status mapping: success→up, timeout/error→down, null→null
- quality_state warmingUp→unknown, pass-through for good/degraded/poor
- targetName falls back to targetHost when null
- createdAt converted from epoch ms to ISO 8601
- Sort: lastSeenMs DESC, id ASC (monitors with no samples sort to end)

## Next agent
Agent 08 (Code Review)
