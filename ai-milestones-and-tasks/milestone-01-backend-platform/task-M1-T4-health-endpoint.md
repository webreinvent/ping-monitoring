---
taskId: M1-T4
milestone: M1
title: Build health check endpoint with server metrics
priority: Critical
status: "🟢 Complete"
estimatedEffort: "1-2 hours"
features:
  - F1
  - F14
---

# Task M1-T4 — Build health check endpoint with server metrics

> **Milestone:** M1 (Backend Platform)
> **Priority:** Critical
> **Status:** 🟢 Complete
> **Estimated Effort:** 1-2 hours

## Description

Create the `GET /api/health` endpoint that returns comprehensive server health metrics: status, timestamp, uptime, version, database file size, monitor count, sample count, and last ingest time. This serves both the basic health check (F1) and the extended metrics (F14).

## Task Goals

- Implement `GET /api/health` route handler
- Return basic metrics: status, timestamp, uptime, version
- Return extended metrics: db_path, db_size_bytes, monitor_count, sample_count, last_ingest_time
- Ensure public access (no authentication required)

## Acceptance Criteria

- [x] `GET /api/health` returns 200 OK with JSON
- [x] Response contains `status`, `timestamp`, `uptime`, `version`
- [x] Response contains `db_path`, `db_size_bytes`, `monitor_count`, `sample_count`, `last_ingest_time`
- [x] Works with no authentication
- [x] Returns 0 counts and null last_ingest_time when database is empty
- [x] Response time under 100ms
- [x] Response shape matches F14 API contract exactly

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors and health endpoint returns 200

## Testing Checklist

- [x] Health endpoint returns 200 with correct shape
- [x] Empty database returns 0 counts and null
- [x] Response time under 100ms

## Dependencies

- **Requires:** M1-T1 (Nuxt project), M1-T2 (database plugin)
- **Blocks:** None

## Documentation References

- F1: [Backend project setup](../../requirements/features/feature-0001-backend-setup.md)
- F14: [Health check endpoint](../../requirements/features/feature-00014-health-check.md)
