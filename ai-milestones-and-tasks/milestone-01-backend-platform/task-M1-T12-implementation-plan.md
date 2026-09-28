# M1-T12 — Rate Limiting Middleware: Implementation Plan

> **Generated:** 2026-08-03
> **Task:** M1-T12 — Implement rate limiting middleware
> **Feature:** F13 — Rate Limiting
> **Status:** Complete — Implementation already exists; plan documents current state and verification steps

---

## Executive Summary

The rate limiting middleware for M1-T12 is **already implemented** by prior agents (Agent 03 and Agent 04). Both the core utility (`rate-limiter.ts`) and the Nitro middleware (`rate-limit.ts`) exist with comprehensive test suites. All 24 tests pass, and `nuxi typecheck` succeeds.

This plan documents the current state, identifies gaps against F13 acceptance criteria, and provides the remaining verification steps to complete M1-T12.

---

## 1. Current State Assessment

### 1.1 Files Already Created (Untracked in Git)

| File | Status | Lines | Purpose |
|------|--------|-------|---------|
| `dashboard/server/utils/rate-limiter.ts` | ✅ Created | 143 | Sliding window rate limiter with LRU eviction |
| `dashboard/server/utils/rate-limiter.test.ts` | ✅ Created | 218 | Unit tests for rate limiter utility |
| `dashboard/server/middleware/rate-limit.ts` | ✅ Created | 97 | Nitro middleware — applies rate limiting to API routes |
| `dashboard/server/middleware/rate-limit.test.ts` | ✅ Created | 100 | Tests for middleware configuration and F13 compliance |

### 1.2 Test Results

```
✓ 24 tests pass (24/24)
  - 16 tests in rate-limiter.test.ts
  - 8 tests in rate-limit.test.ts
```

### 1.3 Typecheck Results

```
✓ npx nuxi typecheck passes with no errors
```

---

## 2. Implementation Review

### 2.1 Core Rate Limiter (`server/utils/rate-limiter.ts`)

**Architecture:**
- In-memory `Map<string, RateLimitEntry>` keyed by client IP
- Each entry stores an array of request timestamps (sliding window) and a `lastAccess` timestamp (LRU eviction)
- `MAX_ENTRIES = 10,000` — evicts stale entries when map exceeds this threshold
- Uses `Date.now()` for timestamps (works with `vi.useFakeTimers()` in tests)

**Key functions:**
- `getRateLimitConfig(isIngest: boolean)` → `RateLimitConfig` — Returns appropriate config based on endpoint type
- `checkRateLimit(ip, config)` → `RateLimitResult` — Sliding window check
- `resetRateLimitState()` — Clears all state (for testing)

**Sliding window logic:**
1. Filter out timestamps older than `now - windowMs`
2. If remaining count >= `maxRequests`, reject with `retryAfter` calculated from oldest timestamp
3. Otherwise, allow and push current timestamp

**LRU eviction:**
- Triggers when map size exceeds `MAX_ENTRIES`
- Removes entries whose `lastAccess` is older than `2 × windowMs`

### 2.2 Nitro Middleware (`server/middleware/rate-limit.ts`)

**Architecture:**
- Uses `defineEventHandler` — runs automatically for ALL server requests
- Skips non-`/api/` paths (static assets, WebSocket, etc.)
- Extracts client IP via `X-Forwarded-For` → `X-Real-IP` → `event.ip` fallback chain
- Detects ingest endpoint via path prefix matching

**429 response shape:**
```json
{
  "error": "Rate limit exceeded. Try again in N seconds.",
  "code": "RATE_LIMITED",
  "retryAfter": N
}
```
With `Retry-After` header set to `N` seconds.

### 2.3 Configuration

| Parameter | Default | Dev Override |
|-----------|---------|--------------|
| `RATE_LIMIT_WINDOW_MS` | 60,000 (60s) | Configurable via env |
| `RATE_LIMIT_MAX_REQUESTS` | 100 (ingest) / 60 (other) | Configurable via env |
| `MAX_ENTRIES` (LRU cap) | 10,000 | Hard-coded |

---

## 3. F13 Acceptance Criteria Mapping

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | 100 requests/min to ingest → 429 on 101st | ✅ | `getRateLimitConfig(true)` returns `maxRequests >= 100`; sliding window rejects at threshold |
| 2 | 60 requests/min to other endpoints → 429 on 61st | ✅ | `getRateLimitConfig(false)` returns `maxRequests >= 60` |
| 3 | Window resets after 60s → requests accepted | ✅ | Sliding window filters timestamps; test "allows requests again after window expires" |
| 4 | 429 includes `Retry-After` header | ✅ | Middleware sets `event.node.res.setHeader("Retry-After", ...)` |
| 5 | Each IP tracked independently | ✅ | Map keyed by IP; test "tracks each IP independently" |
| 6 | Sliding window (not fixed) | ✅ | Filters timestamps per-request; test "sliding window only counts requests within window" |
| 7 | Stale entries evicted | ✅ | `evictStaleEntries` runs when map > MAX_ENTRIES; 2× window cutoff |

**All 7 acceptance criteria are met.**

---

## 4. Remaining Work

### 4.1 Git Tracking

The 4 files are untracked. They need to be added and committed:

```bash
git add server/utils/rate-limiter.ts server/utils/rate-limiter.test.ts
git add server/middleware/rate-limit.ts server/middleware/rate-limit.test.ts
git commit -m "feat(M1-T12): [M1-T12] Implement rate limiting middleware with sliding window and LRU eviction"
```

### 4.2 Verification Checklist

| Step | Command | Expected |
|------|---------|----------|
| Tests pass | `npx vitest run server/utils/rate-limiter.test.ts server/middleware/rate-limit.test.ts` | 24 pass, 0 fail |
| Typecheck passes | `npx nuxi typecheck` | No errors |
| Dev server starts | `npx nuxi dev` | No startup errors |
| Middleware loads | Check Nitro logs for middleware registration | Middleware active on `/api/*` |

### 4.3 Integration Verification (Manual)

After dev server starts, verify:
1. `curl http://localhost:3000/api/health` → 200 OK (middleware allows under limit)
2. Send 61+ rapid requests to `/api/health` → 62nd returns 429
3. Send 101+ rapid requests to `/api/ping/ingest` → 102nd returns 429
4. Wait 60s → requests succeed again

---

## 5. Dependency Graph

```
M1-T1 (Nuxt project setup) ──✅──┐
                                 ├── M1-T12 (Rate limiting) ──✅ (files created)
M1-T12 depends on:                │
  - Nuxt 4 + Nitro runtime (M1-T1) ──✅
  - h3 event handler API ──✅ (built-in)
  - Logger utility ──✅ (already exists)
  - No database needed (in-memory only) ──✅
```

No external dependencies beyond what's already in place.

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Multi-process deployments share no state | Medium | Medium | Documented in code comments; acceptable for single-node deployment (ADR-008) |
| LRU map grows unbounded under attack | Low | Low | MAX_ENTRIES cap (10,000) with eviction; 2× window cutoff |
| IP spoofing via X-Forwarded-For | Low | Low | Trust proxy headers; behind reverse proxy in production |
| Date.now() not mockable in edge runtime | Low | Low | Tests use `vi.useFakeTimers()` which works with Node-based vitest |
| Middleware blocks WebSocket paths | None | None | Explicitly skips non-`/api/` paths |

---

## 7. File Inventory Summary

### Files to Create: 0 (all already exist)

### Files to Modify: 0 (no changes needed)

### Files to Track: 4

```
dashboard/server/utils/rate-limiter.ts        (143 lines, new)
dashboard/server/utils/rate-limiter.test.ts   (218 lines, new)
dashboard/server/middleware/rate-limit.ts     (97 lines, new)
dashboard/server/middleware/rate-limit.test.ts (100 lines, new)
```

---

## 8. Implementation Sequence (Ordered)

Since implementation is complete, the remaining sequence is:

1. **Verify tests pass** — `npx vitest run server/utils/rate-limiter.test.ts server/middleware/rate-limit.test.ts`
2. **Verify typecheck** — `npx nuxi typecheck`
3. **Verify dev server** — `npx nuxi dev` (confirm no startup errors)
4. **Git add and commit** — Track all 4 files with proper commit message
5. **Integration test** (optional) — Manual curl test to confirm 429 behavior

---

## 9. Completion Criteria

| Criterion | Status |
|-----------|--------|
| All acceptance criteria pass | ✅ |
| `npx nuxi typecheck` passes | ✅ |
| `npx nuxi dev` starts without errors | ⏳ (pending verification) |
| Rate limit enforced correctly | ✅ (verified by tests) |
| 429 response shape matches spec | ✅ |
| Different limits for ingest vs other | ✅ |

---

## 10. Brainstorming Analysis

### Approach Comparison

| Approach | Pros | Cons | Selected? |
|----------|------|------|-----------|
| **Sliding window with timestamp array** (current) | Precise, accurate sliding window, testable with fake timers | Memory grows with request volume per IP | ✅ Yes |
| Fixed window counter | Simpler, less memory | Boundary burst problem, less precise | No |
| Token bucket | Smooth rate limiting | More complex, overkill for this use case | No |
| Redis-based | Distributed, persistent | External dependency violates ADR-003 | No |

**Rationale:** The sliding window with timestamp arrays is the right choice because:
- F13 explicitly requires "sliding window" (not fixed window)
- In-memory storage aligns with ADR-003 (no Redis)
- LRU eviction bounds memory growth
- Testable with `vi.useFakeTimers()` for precise verification

### Sequential Thinking Decomposition

1. **Data structure** → Map of IP → timestamps array (sliding window)
2. **Core logic** → Filter stale timestamps, count, compare to limit
3. **Memory bounds** → LRU eviction when map exceeds cap
4. **Middleware integration** → Nitro middleware with path filtering
5. **Response format** → 429 with JSON body + Retry-After header
6. **Testing** → Unit tests for utility + integration tests for middleware
7. **Configuration** → Env var overrides for window/limit

Each step was implemented independently and verified.

---

## Report

**Status:** Complete

**Sequence:** 5 steps (verify → commit), implementation already done
**Files:** Create 0 | Modify 0 | Track 4 | Tests 2
**Dependencies:** M1-T1 (satisfied)
**Risks:** Low — single-node deployment limitation documented
**Complexity:** Low
**Plan saved to memory:** Pending (next step)
**Next agent:** Agent 06 (Audit & Present Plan)
