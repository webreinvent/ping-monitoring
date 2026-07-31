---
taskId: M1-T12
milestone: M1
title: Implement rate limiting middleware
priority: Medium
status: "Not Started"
estimatedEffort: "1-2 hours"
features:
  - F13
---

# Task M1-T12 — Implement rate limiting middleware

> **Milestone:** M1 (Backend Platform)
> **Priority:** Medium
> **Status:** Not Started
> **Estimated Effort:** 1-2 hours

## Description

Add per-IP rate limiting middleware to protect API endpoints from excessive requests. The ingest endpoint allows 100 requests/minute; all other endpoints are limited to 60 requests/minute. Returns HTTP 429 with Retry-After header when exceeded.

## Task Goals

- Create Nitro middleware with sliding window rate limiting
- Use in-memory LRU map (no Redis)
- Apply different limits for ingest vs other endpoints
- Return 429 with correct error shape and Retry-After header

## Implementation Plan

### Steps

1. Create `server/middleware/rateLimit.ts`:
   - Extract client IP from `req.ip` or `req.socket.remoteAddress`
   - Maintain in-memory `Map<string, number[]>` keyed by IP
   - Sliding window: count requests within rolling 60-second window
   - Evict stale entries on each request
   - Limit: 100/min for `/api/ping/ingest`, 60/min for all others
   - Return 429 with `{ error: "rate_limit_exceeded", retryAfter: <seconds> }` and `Retry-After` header
2. Configure middleware to run before route handlers
3. Verify: rate limit enforced, correct limits per endpoint

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `nuxt` | Nitro middleware patterns | Middleware creation |
| `filesystem` (MCP) | File creation | Writing files |

## Acceptance Criteria

- [ ] Rate limiting middleware runs before route handlers
- [ ] Ingest endpoint limited to 100 requests/minute per IP
- [ ] All other endpoints limited to 60 requests/minute per IP
- [ ] 429 response includes `retryAfter` and `Retry-After` header
- [ ] Each IP tracked independently
- [ ] Sliding window (not fixed window)
- [ ] Stale entries evicted to bound memory

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] Rate limit enforced correctly
- [ ] 429 response shape matches spec
- [ ] Different limits for ingest vs other endpoints

## Dependencies

- **Requires:** M1-T1 (Nuxt project)
- **Blocks:** None

## Documentation References

- F13: [Rate limiting](../../requirements/features/feature-00013-rate-limiting.md)
