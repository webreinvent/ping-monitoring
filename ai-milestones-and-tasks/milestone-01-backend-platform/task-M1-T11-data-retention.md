---
taskId: M1-T11
milestone: M1
title: Add data retention cleanup background task
priority: Medium
status: "Not Started"
estimatedEffort: "2-3 hours"
features:
  - F10
---

# Task M1-T11 — Add data retention cleanup background task

> **Milestone:** M1 (Backend Platform)
> **Priority:** Medium
> **Status:** Not Started
> **Estimated Effort:** 2-3 hours

## Description

Implement a scheduled background task that periodically purges old ping samples and rollup data beyond configurable retention periods. Prevents unbounded SQLite growth while preserving recent data for active monitoring.

## Task Goals

- Create retention cleanup plugin with configurable schedule
- Delete old `ping_samples` and `minute_rollups` rows
- Log statistics (deleted counts, duration)
- Support runtime config via environment variables

## Acceptance Criteria

- [ ] Cleanup runs on configurable interval (default 60 minutes)
- [ ] Deletes raw samples older than `RETENTION_SAMPLE_DAYS` (default 30)
- [ ] Deletes rollups older than `RETENTION_ROLLUP_DAYS` (default 90)
- [ ] Logs deletion counts and duration
- [ ] `RETENTION_ENABLED=false` skips cleanup
- [ ] Failure in one cycle doesn't crash server
- [ ] Uses single transaction for atomicity

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] Cleanup runs on schedule
- [ ] Old data deleted correctly
- [ ] Config honored

## Dependencies

- **Requires:** M1-T6 (ingest — data source)
- **Blocks:** None

## Documentation References

- F10: [Data retention cleanup](../../requirements/features/feature-00010-data-retention.md)
