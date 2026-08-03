# LNPM Cloud Dashboard — Task Complete: M1-T10

> Saved: 2026-08-03
> Task: M1-T10 (Backend quality classifier with post-ingest trigger)
> Features: F12
> Branch: feature/M1-T10-quality-classifier

## Summary

Implemented the backend quality classifier (F12) that analyzes raw ping samples in a 5-minute sliding window and computes a quality state (VeryHigh, High, Medium, Low, Unstable, Disconnected, WarmingUp) for each monitor. Runs post-ingest (after each batch) and as a background sweep every 60 seconds.

## Files Created (5)

| File | Purpose |
|------|---------|
| `dashboard/server/utils/quality-states.ts` | Constants, `mapQualityState()`, `QUALITY_COLORS` |
| `dashboard/server/utils/quality-classifier.ts` | `classifyMonitor()`, `classifyMonitorsBatch()` |
| `dashboard/server/plugins/quality-sweep.ts` | Background sweep Nitro plugin (60s interval) |
| `dashboard/schema/migrations/006_add_quality_state_updated_at.sql` | Migration: `quality_state_updated_at` column + legacy state mapping |
| `dashboard/test/quality-classifier.test.ts` | 19 unit tests for classification algorithm |

## Files Modified (7)

| File | Changes |
|------|---------|
| `dashboard/shared/types.ts` | Added `QualityState` type (7 states), `ClassifyResult` interface. Updated `MonitorListItem`, `WsMonitorState`, `Target`. |
| `dashboard/server/utils/monitors.ts` | Use shared `mapQualityState()`, added `quality_state_updated_at` |
| `dashboard/server/utils/ping-ingest.ts` | Post-ingest `classifyMonitorsBatch()` call after transaction |
| `dashboard/server/api/ping/ingest.post.ts` | Quality state in WebSocket broadcast |
| `dashboard/server/ws/ping.ts` | `qualityState` in `SampleMessage` and `SnapshotMessage` |
| `dashboard/server/utils/history.ts` | `buildTarget()` includes F12 quality state fields |
| `dashboard/test/fixtures.ts` | Updated to F12 types |

## Acceptance Criteria: All Met

- [x] `classifyMonitor()` computes correct quality state from 5-minute window
- [x] States in correct priority: disconnected → warmingUp → unstable → veryHigh → high → medium → low
- [x] Post-ingest classification for affected monitors
- [x] Background sweep every 60 seconds (configurable via `QUALITY_SWEEP_INTERVAL_MS`)
- [x] Quality state persisted on monitor row
- [x] `GET /api/monitors` includes `quality_state`
- [x] `GET /api/monitors/:id` includes `quality_state` in Target metadata
- [x] WebSocket sample messages include `quality_state`
- [x] `npx nuxi typecheck` passes
- [x] `npx nuxi dev` starts without errors

## Test Results

- **664 tests passing** across 38 files
- Typecheck: 0 errors
- Dev server: starts clean
- 19 new quality classifier tests: metrics computation, decision logic, boundary cases, priority ordering

## Classification Algorithm

1. **disconnected**: No samples in 5-min window AND last sample 5-60 min ago (or no samples ever)
2. **warmingUp**: Fewer than 10 samples in window (or last sample >1 hour ago)
3. **unstable**: CV > 0.5 AND packet_loss < 10%
4. **veryHigh**: packet_loss == 0% AND avg < 50ms
5. **high**: packet_loss == 0% AND avg < 150ms
6. **medium**: packet_loss ≤ 10% AND avg ≤ 300ms
7. **low**: Everything else

## Code Review (Agent 08)

- 4 issues found and fixed (sweep interval validation, 3 cosmetic blank lines)
- All 9 principles passed (DRY, KISS, YAGNI, SoC, SRP, SOLID, Security, Accessibility)
- No dead code, no complexity issues, typecheck clean
