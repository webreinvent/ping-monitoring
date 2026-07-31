---
taskId: M1-T8
milestone: M1
title: Build monitor history API with aggregation and time windows
priority: Critical
status: "Not Started"
estimatedEffort: "4-6 hours"
features:
  - F6
---

# Task M1-T8 — Build monitor history API with aggregation and time windows

> **Milestone:** M1 (Backend Platform)
> **Priority:** Critical
> **Status:** Not Started
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

- [ ] Returns `HistoryResponse` with series, points, intervals, and summary
- [ ] Time window defaults to last 1 hour when no params provided
- [ ] `maxPoints` enforced: server down-samples by increasing bucket size
- [ ] 404 for non-existent monitor
- [ ] 400 for invalid query params (fromMs > toMs)
- [ ] Empty points array when no data in range (still returns 200)
- [ ] Response shape matches F6 `HistoryResponse` type exactly
- [ ] Quality intervals computed correctly from aggregated data

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] History endpoint returns correct shape
- [ ] Time window params work
- [ ] maxPoints cap enforced
- [ ] 404 for unknown monitor
- [ ] Empty data returns empty points

## Dependencies

- **Requires:** M1-T6 (ingest — samples exist), M1-T7 (monitors list)
- **Blocks:** M1-T9

## Documentation References

- F6: [Monitor history API](../../requirements/features/feature-0006-monitor-history.md)
- [Data Models](../../requirements/data-models/data-models.md) — HistoryResponse Format
