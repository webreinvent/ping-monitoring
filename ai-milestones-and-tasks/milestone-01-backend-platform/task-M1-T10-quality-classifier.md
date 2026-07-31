---
taskId: M1-T10
milestone: M1
title: Implement backend quality classifier with post-ingest trigger
priority: High
status: "Not Started"
estimatedEffort: "3-4 hours"
features:
  - F12
---

# Task M1-T10 — Implement backend quality classifier with post-ingest trigger

> **Milestone:** M1 (Backend Platform)
> **Priority:** High
> **Status:** Not Started
> **Estimated Effort:** 3-4 hours

## Description

Build the backend quality classifier that analyzes raw ping samples in a 5-minute sliding window and computes a quality state (VeryHigh, High, Medium, Low, Unstable, Disconnected) for each monitor. Runs post-ingest and as a background sweep every 60 seconds.

## Task Goals

- Implement classification algorithm with 6 quality states
- Post-ingest trigger: classify affected monitors after each batch
- Background sweep: re-evaluate all active monitors every 60 seconds
- Persist quality state on monitor row
- Update monitors list API response with quality_state

## Acceptance Criteria

- [ ] `classifyMonitor()` computes correct quality state from 5-minute window
- [ ] States applied in correct priority order: disconnected -> unstable -> veryHigh -> high -> medium -> low
- [ ] Post-ingest classification runs for each affected monitor
- [ ] Background sweep runs every 60 seconds
- [ ] Quality state persisted on monitor row
- [ ] `GET /api/monitors` includes quality_state field
- [ ] `GET /api/monitors/:id` includes quality_state in monitor metadata
- [ ] WebSocket sample messages include quality_state

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] Classification algorithm correct for each state
- [ ] Post-ingest trigger works
- [ ] Background sweep runs on schedule
- [ ] State persisted in database

## Dependencies

- **Requires:** M1-T6 (ingest — sample source)
- **Blocks:** None

## Documentation References

- F12: [Backend quality classifier](../../requirements/features/feature-00012-quality-classifier.md)
