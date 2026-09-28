---
taskId: M1-T8
milestone: M1
title: Build monitor history API with aggregation and time windows
priority: Critical
status: "🟢 Complete"
estimatedEffort: "4-6 hours"
features:
  - F6
---

# Task M1-T8 — Build monitor history API with aggregation and time windows

> **Milestone:** M1 (Backend Platform)
> **Priority:** Critical
> **Status:** 🟢 Complete
> **Estimated Effort:** 4-6 hours

## Description

Build `GET /api/monitors/:id` endpoint that returns historical ping data formatted as `HistoryResponse` for uPlot charts. Supports time window queries, down-sampling via maxPoints, and computes quality intervals and range summaries.

## Task Goals

- Create `GET /api/monitors/:id` route handler
- Aggregate raw `ping_samples` into minute-bucketed `HistoryPoint` records
- Support `fromMs`, `toMs`, `maxPoints` query parameters with defaults
- Compute quality intervals from aggregated points
- Compute range summary (packet loss, latency stats, stable/unstable percent)
- Down-sample when point count exceeds maxPoints

## Acceptance Criteria

- [x] Returns `HistoryResponse` with series, points, intervals, and summary
- [x] Time window defaults to last 1 hour when no params provided
- [x] `maxPoints` enforced: server down-samples by increasing bucket size
- [x] 404 for non-existent monitor
- [x] 400 for invalid query params (fromMs > toMs)
- [x] Empty points array when no data in range (still returns 200)
- [x] Response shape matches F6 `HistoryResponse` type exactly
- [x] Quality intervals computed correctly from aggregated data

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors

## Testing Checklist

- [x] History endpoint returns correct shape
- [x] Time window params work
- [x] maxPoints cap enforced
- [x] 404 for unknown monitor
- [x] Empty data returns empty points

## Dependencies

- **Requires:** M1-T6 (ingest — samples exist), M1-T7 (monitors list)
- **Blocks:** M1-T9

## Documentation References

- F6: [Monitor history API](../../requirements/features/feature-0006-monitor-history.md)
- [Data Models](../../requirements/data-models/data-models.md) — HistoryResponse Format
