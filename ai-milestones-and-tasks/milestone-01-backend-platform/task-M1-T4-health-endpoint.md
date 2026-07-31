---
taskId: M1-T4
milestone: M1
title: Build health check endpoint with server metrics
priority: Critical
status: "Not Started"
estimatedEffort: "1-2 hours"
features:
  - F1
  - F14
---

# Task M1-T4 — Build health check endpoint with server metrics

> **Milestone:** M1 (Backend Platform)
> **Priority:** Critical
> **Status:** Not Started
> **Estimated Effort:** 1-2 hours

## Description

Create the `GET /api/health` endpoint that returns comprehensive server health metrics: status, timestamp, uptime, version, database file size, monitor count, sample count, and last ingest time. This serves both the basic health check (F1) and the extended metrics (F14).

## Task Goals

- Implement `GET /api/health` route handler
- Return basic metrics: status, timestamp, uptime, version
- Return extended metrics: db_path, db_size_bytes, monitor_count, sample_count, last_ingest_time
- Ensure public access (no authentication required)

## Acceptance Criteria

- [ ] `GET /api/health` returns 200 OK with JSON
- [ ] Response contains `status`, `timestamp`, `uptime`, `version`
- [ ] Response contains `db_path`, `db_size_bytes`, `monitor_count`, `sample_count`, `last_ingest_time`
- [ ] Works with no authentication
- [ ] Returns 0 counts and null last_ingest_time when database is empty
- [ ] Response time under 100ms
- [ ] Response shape matches F14 API contract exactly

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors and health endpoint returns 200

## Testing Checklist

- [ ] Health endpoint returns 200 with correct shape
- [ ] Empty database returns 0 counts and null
- [ ] Response time under 100ms

## Dependencies

- **Requires:** M1-T1 (Nuxt project), M1-T2 (database plugin)
- **Blocks:** None

## Documentation References

- F1: [Backend project setup](../../requirements/features/feature-0001-backend-setup.md)
- F14: [Health check endpoint](../../requirements/features/feature-00014-health-check.md)
