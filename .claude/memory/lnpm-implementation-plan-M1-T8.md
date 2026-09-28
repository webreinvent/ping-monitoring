# LNPM Cloud Dashboard — M1-T8 Implementation Plan (Memory)

**Date:** 2026-08-03
**Task:** M1-T8: Build monitor history API with aggregation and time windows
**Status:** Plan Complete
**Complexity:** Medium

## Summary

Implementation is **substantially complete**. All code files, tests, and type definitions exist as untracked files on `feature/M1-T8-monitor-history-api` branch.

## Agent 07 Action Items (5 steps)

1. **Verify test/setup.ts exists** — referenced by vitest.config.ts; create if missing
2. **Run tests:** `cd dashboard && npx vitest run` (~70 tests across 4 files)
3. **Run typecheck:** `cd dashboard && npx nuxi typecheck`
4. **Verify dev server:** `cd dashboard && timeout 15 npx nuxi dev 2>&1 || true`
5. **Commit:** `git add` + `git commit -m "feat(M1-T8): [M1-T8] Build monitor history API with aggregation and time windows"`

## Files to Commit (11 total)

**New (7):**
- `dashboard/server/api/monitors/[id].get.ts` (155 lines — route handler)
- `dashboard/server/api/monitors/[id].get.test.ts` (193 lines — route unit tests)
- `dashboard/server/api/monitors/[id].get.integration.test.ts` (356 lines — integration tests)
- `dashboard/server/utils/history.ts` (545 lines — core logic)
- `dashboard/server/utils/history.test.ts` (582 lines — unit tests)
- `dashboard/server/utils/history.edge-cases.test.ts` (657 lines — edge case tests)
- `dashboard/server/utils/monitors.edge-cases.test.ts` (from M1-T7)

**Modified (2):**
- `dashboard/shared/types.ts` (added F6 types: QualityState, QualityReason, HistoryPoint, QualityIntervalRecord, RangeSummary, Target, HistorySeries, HistoryResponse)
- `dashboard/test/fixtures.ts` (added F6 fixtures: createHistoryPoint, createHistoryPoints, createQualityInterval, createRangeSummary, createTarget, createHistorySeries, createHistoryResponse)

## Acceptance Criteria Status

All 8 acceptance criteria satisfied by existing implementation:
- AC1: HistoryResponse with full shape — `[id].get.ts` lines 96-123
- AC2: Time window params — `history.ts` SQL WHERE clause
- AC3: Default 1-hour window — `[id].get.ts` lines 41-44
- AC4: 404 for missing monitor — `[id].get.ts` lines 82-93
- AC5: 400 for invalid params — `[id].get.ts` lines 73-78
- AC6: maxPoints down-sampling — `calculateBucketSize()` in `history.ts`
- AC7: Empty data returns 200 — empty SQL result → empty arrays
- Type safety: F6 HistoryResponse match — `shared/types.ts` defines all types

## Approach

Approach A: Raw aggregation from `ping_samples` with application-side down-sampling. SQL `GROUP BY` on truncated timestamps, quality intervals and range summary computed in JS. Uses existing `idx_ping_monitor_time` composite index.

## Branch

`feature/M1-T8-monitor-history-api` (created from `feature/M1-T7-monitors-list-api`, HEAD at 713b8e9)

## Next Agent

Agent 06 (Audit & Present Plan), then Agent 07 (Execute Implementation)
