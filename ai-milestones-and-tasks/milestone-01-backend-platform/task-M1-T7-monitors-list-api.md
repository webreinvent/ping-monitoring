---
taskId: M1-T7
milestone: M1
title: Implement monitors list API with client join and latest state
priority: Critical
status: "🟢 Complete"
estimatedEffort: "2-3 hours"
features:
  - F5
---

# Task M1-T7 — Implement monitors list API with client join and latest state

> **Milestone:** M1 (Backend Platform)
> **Priority:** Critical
> **Status:** 🟢 Complete
> **Estimated Effort:** 2-3 hours

## Description

Build `GET /api/monitors` endpoint that returns all monitors with their latest state, joined with client information. This is the primary data source for the dashboard sidebar and all-monitors view.

## Task Goals

- Create `GET /api/monitors` route handler
- Join monitors with clients table for client slug/name
- Include cached latest state from monitor row (last_seen_ms, last_status, last_latency_ms, quality_state)
- Sort by recency with stable tiebreaker
- Return empty array when no monitors exist

## Acceptance Criteria

- [x] Returns array of monitors with client slug, client name, and latest state
- [x] Results sorted by lastSeenMs DESC, id ASC
- [x] Empty database returns empty array with 200 status
- [x] Monitors with no samples have null latest state fields
- [x] Response shape matches F5 API contract exactly
- [x] Single SQL query (no N+1)

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors

## Testing Checklist

- [x] API endpoint returns correct shape
- [x] Sort order is correct
- [x] Empty DB returns empty array

## Dependencies

- **Requires:** M1-T6 (ingest — monitors exist)
- **Blocks:** M1-T8

## Documentation References

- F5: [Monitors list API](../../requirements/features/feature-0005-monitors-list.md)
