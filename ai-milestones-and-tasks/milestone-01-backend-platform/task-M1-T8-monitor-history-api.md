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

## Implementation Plan

### Steps

1. Create `server/api/monitors/[id].get.ts`:
   - Parse path param `id` and query params `fromMs`, `toMs`, `maxPoints`
   - Default: last 1 hour, maxPoints=2000
   - Validate: fromMs < toMs, maxPoints <= 5000
2. Create `server/utils/history-queries.ts`:
   - SQL for minute-level aggregation (GROUP BY truncated timestamp)
   - Down-sampling: increase bucket size when count > maxPoints
   - Bucket sizes: [1000, 5000, 10000, 30000, 60000, 300000, 900000, 1800000, 3600000]
3. Implement quality interval computation:
   - Sliding window classifier on aggregated points
   - States: warmingUp, low, medium, high, veryHigh, unstable, disconnected
4. Implement range summary computation:
   - sampleCount, successCount, failureCount, packetLossPercent
   - avg/min/max/p95 latency
   - stableMs, unstableMs, disconnectedMs, percentages
5. Return `HistoryResponse` shape matching F6 API contract
6. Handle edge cases: 404 for unknown monitor, 400 for invalid params, empty points for no data

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `sequential-thinking` | Aggregation + down-sampling logic | Complex SQL |
| `nuxt` | Nitro API route patterns | Route creation |
| `filesystem` (MCP) | File creation | Writing files |

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
