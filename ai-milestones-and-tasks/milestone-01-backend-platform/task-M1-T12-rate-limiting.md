---
taskId: M1-T12
milestone: M1
title: Implement rate limiting middleware
priority: Medium
status: "🟢 Complete"
estimatedEffort: "1-2 hours"
features:
  - F13
---

# Task M1-T12 — Implement rate limiting middleware

> **Milestone:** M1 (Backend Platform)
> **Priority:** Medium
> **Status:** 🟢 Complete
> **Estimated Effort:** 1-2 hours

## Description

Add per-IP rate limiting middleware to protect API endpoints from excessive requests. The ingest endpoint allows 100 requests/minute; all other endpoints are limited to 60 requests/minute. Returns HTTP 429 with Retry-After header when exceeded.

## Task Goals

- Create Nitro middleware with sliding window rate limiting
- Use in-memory LRU map (no Redis)
- Apply different limits for ingest vs other endpoints
- Return 429 with correct error shape and Retry-After header

## Acceptance Criteria

- [x] Rate limiting middleware runs before route handlers
- [x] Ingest endpoint limited to 100 requests/minute per IP
- [x] All other endpoints limited to 60 requests/minute per IP
- [x] 429 response includes `retryAfter` and `Retry-After` header
- [x] Each IP tracked independently
- [x] Sliding window (not fixed window)
- [x] Stale entries evicted to bound memory

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors

## Testing Checklist

- [x] Rate limit enforced correctly
- [x] 429 response shape matches spec
- [x] Different limits for ingest vs other endpoints

## Dependencies

- **Requires:** M1-T1 (Nuxt project)
- **Blocks:** None

## Documentation References

- F13: [Rate limiting](../../requirements/features/feature-00013-rate-limiting.md)
