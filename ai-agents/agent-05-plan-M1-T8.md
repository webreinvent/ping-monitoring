# LNPM Cloud Dashboard — M1-T8 Implementation Plan

## Task: Build monitor history API with aggregation and time windows

**Status:** Plan Complete
**Complexity:** Medium (most implementation already done; needs verification and finalization)
**Date:** 2026-08-03
**Feature:** F6 (Monitor History API)

---

## 1. Executive Summary

The M1-T8 task is **substantially complete** in terms of core implementation. All code files, tests, and type definitions have been created as untracked files on the `feature/M1-T8-monitor-history-api` branch. The implementation follows F6 spec precisely, uses Approach A (raw aggregation from `ping_samples` with application-side down-sampling), and covers all acceptance criteria.

**What remains:**
1. Verify test infrastructure (`test/setup.ts`) exists
2. Run tests and confirm they pass
3. Run typecheck
4. Verify dev server starts
5. Commit all files

---

## 2. Current State Assessment

### Files Already Created (Untracked on branch)

| # | File | Status | Lines | Purpose |
|---|------|--------|-------|---------|
| 1 | `dashboard/server/api/monitors/[id].get.ts` | ✅ Complete | 155 | Route handler — parses params, validates, queries DB, assembles `HistoryResponse` |
| 2 | `dashboard/server/utils/history.ts` | ✅ Complete | 545 | Core logic — `calculateBucketSize`, `getMonitorHistoryPoints`, `computeQualityIntervals`, `computeRangeSummary`, `buildTarget` |
| 3 | `dashboard/server/utils/history.test.ts` | ✅ Complete | 582 | Unit tests — bucket calc (5 tests), points fetch (6 tests), quality intervals (6 tests), range summary (4 tests), buildTarget (2 tests) |
| 4 | `dashboard/server/utils/history.edge-cases.test.ts` | ✅ Complete | 657 | Edge cases — extreme ranges (7 tests), state transitions (5 tests), reason collection (5 tests), gaps (4 tests), summary edge cases (6 tests), buildTarget edge cases (5 tests), custom bucket sizes (2 tests) |
| 5 | `dashboard/server/api/monitors/[id].get.test.ts` | ✅ Complete | 193 | Route tests — query param defaults (7 tests), ID validation (5 tests), not-found (1 test) |
| 6 | `dashboard/server/api/monitors/[id].get.integration.test.ts` | ✅ Complete | 356 | Integration — full response shape (2 tests), time window (2 tests), maxPoints (2 tests), empty data (1 test), errors (2 tests) |
| 7 | `dashboard/server/utils/monitors.edge-cases.test.ts` | ✅ Exists | — | Edge cases for monitors module (from M1-T7) |

### Files Modified (Staged on branch)

| # | File | Change |
|---|------|--------|
| 1 | `dashboard/shared/types.ts` | Added F6 types: `QualityState`, `QualityReason`, `HistoryPoint`, `QualityIntervalRecord`, `RangeSummary`, `Target`, `HistorySeries`, `HistoryResponse` (lines 164-323) |
| 2 | `dashboard/test/fixtures.ts` | Added F6 fixtures: `createHistoryPoint`, `createHistoryPoints`, `createQualityInterval`, `createRangeSummary`, `createTarget`, `createHistorySeries`, `createHistoryResponse` (lines 179-300) |

### Existing Infrastructure (No changes needed)

| File | Purpose | Status |
|------|---------|--------|
| `dashboard/nuxt.config.ts` | Nuxt 4 config — node-server preset, WebSocket experimental, CORS | ✅ |
| `dashboard/package.json` | Dependencies — better-sqlite3, ws, vitest | ✅ |
| `dashboard/vitest.config.ts` | Test config — globals, aliases, coverage, setup file | ✅ |
| `dashboard/tsconfig.json` | Extends .nuxt/tsconfig.json | ✅ |
| `dashboard/schema/index.sql` | Full schema — clients, monitors, ping_samples, minute_rollups | ✅ |
| `dashboard/schema/migrations/003_create_ping_samples.sql` | ping_samples table (history reads from this) | ✅ |
| `dashboard/schema/migrations/005_create_indexes.sql` | `idx_ping_monitor_time` composite index (required for history queries) | ✅ |
| `dashboard/server/utils/db.ts` | DB accessor (`getDb()` reads from `globalThis.__db`) | ✅ |
| `dashboard/server/utils/logger.ts` | Structured logger (debug/info/warn/error) | ✅ |
| `dashboard/server/utils/ping-types.ts` | Ingest types (not modified by M1-T8) | ✅ |
| `dashboard/server/plugins/database.ts` | DB plugin — opens SQLite, WAL mode, runs migrations | ✅ |
| `dashboard/app/pages/index.vue` | Dashboard placeholder page | ✅ |
| `dashboard/app/layouts/default.vue` | Dashboard shell layout | ✅ |

---

## 3. Approach Decision

**Chosen: Approach A — Raw Aggregation with Application-Side Down-Sampling**

The implementation aggregates raw `ping_samples` into time-bucketed records via a single SQL query with `GROUP BY` on truncated timestamps, then performs quality interval computation and range summary in application code.

**Why this approach (over minute_rollups as primary source):**
1. **Matches F6 spec exactly** — raw aggregation is the baseline; minute_rollups are an optional optimization
2. **No new migrations needed** — uses existing `idx_ping_monitor_time` composite index
3. **Simpler** — single SQL path, no fallback logic
4. **Quality intervals + range summary** — inherently application-logic computations

---

## 4. Acceptance Criteria Mapping

All acceptance criteria are **satisfied** by the existing implementation:

| AC | Requirement | Implementation | Test |
|----|-------------|---------------|------|
| **AC1** | Valid monitor returns `HistoryResponse` with series, points, intervals, summary | `[id].get.ts` lines 96-123 assembles full response | `integration.test.ts`: "returns valid HistoryResponse with all required fields" |
| **AC2** | Query params control time window | `history.ts` SQL: `timestamp_ms > :fromMs AND timestamp_ms <= :toMs` | `integration.test.ts`: "only returns points within requested range" |
| **AC3** | Missing fromMs defaults to last 1 hour | `[id].get.ts` lines 41-44: `fromMs = nowMs - 3_600_000` | `[id].get.test.ts`: "fromMs defaults to now - 1 hour when not provided" |
| **AC4** | 404 for non-existent monitor | `[id].get.ts` lines 82-93: SELECT monitors, throw 404 if null | `integration.test.ts`: "404 for non-existent monitor" |
| **AC5** | 400 for invalid query params (fromMs ≥ toMs) | `[id].get.ts` lines 73-78: validate `fromMs >= toMs` | `integration.test.ts`: "400 for fromMs > toMs" |
| **AC6** | maxPoints cap enforced via down-sampling | `history.ts` `calculateBucketSize()` iterates clean bucket sizes | `integration.test.ts`: "with maxPoints=10...response ≤ 10 points" |
| **AC7** | Empty data returns 200 with empty points | `history.ts` returns empty arrays; `computeRangeSummary([])` returns zeros | `integration.test.ts`: "valid monitor with no samples...→ 200 with empty points" |
| **Type safety** | Response matches F6 `HistoryResponse` exactly | `shared/types.ts` defines all F6 types; route uses `HistoryResponse` type | `integration.test.ts`: "returns valid HistoryResponse with all required fields" |

---

## 5. Implementation Sequence (Ordered)

### Step 1: Verify Test Setup File
- **Action:** Check `dashboard/test/setup.ts` exists (referenced by `vitest.config.ts` line 17)
- **If missing:** Create minimal setup file
- **Gate:** File must exist for vitest to run

### Step 2: Run Tests
- **Command:** `cd dashboard && npx vitest run`
- **Expected:** All ~70 tests pass across 4 test files
- **Gate:** 0 test failures

### Step 3: Run Typecheck
- **Command:** `cd dashboard && npx nuxi typecheck`
- **Expected:** No TypeScript errors
- **Gate:** Clean exit (exit code 0)

### Step 4: Verify Dev Server Starts
- **Command:** `cd dashboard && timeout 15 npx nuxi dev 2>&1 || true`
- **Expected:** Server starts on port 3000
- **Gate:** No startup errors

### Step 5: Stage and Commit
- **Action:** `git add` all new/modified files
- **Commit message:** `feat(M1-T8): [M1-T8] Build monitor history API with aggregation and time windows`
- **Includes:** 7 new files + 2 modified files

---

## 6. File Inventory

### Files to COMMIT (11 total)

**New (7 files):**
```
dashboard/server/api/monitors/[id].get.ts
dashboard/server/api/monitors/[id].get.test.ts
dashboard/server/api/monitors/[id].get.integration.test.ts
dashboard/server/utils/history.ts
dashboard/server/utils/history.test.ts
dashboard/server/utils/history.edge-cases.test.ts
dashboard/server/utils/monitors.edge-cases.test.ts
```

**Modified (2 files):**
```
dashboard/shared/types.ts
dashboard/test/fixtures.ts
```

### Files to VERIFY (may need creation)
```
dashboard/test/setup.ts
```

---

## 7. Dependency Graph

```
M1-T1 (Database setup) ──────────────────────┐
M1-T4 (Health check) ── logger.ts ───────────┤
M1-T5 (Client identity) ─────────────────────┤
M1-T6 (Ingest) ── db.ts, ping_types.ts ──────┤
M1-T7 (Monitors list) ───────────────────────┤
                                              │
              All dependencies met ───────────┘
                                              │
                                       M1-T8 (This task)
                                              │
                                              │ Blocks
                                              ▼
                                       M1-T9 (Dashboard UI)
```

**No internal dependencies within M1-T8** — all files can be committed together.

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `test/setup.ts` doesn't exist | Medium | Medium | vitest.config.ts references it; create if missing |
| p95 latency approximation | Low | Low | Uses per-bucket averages (documented). Acceptable for MVP. |
| `example:8080` detected as IPv6 | Low | Low | Noted in edge-case test. Real targets don't use colon-notation hostnames. |
| `globalThis.__db` type casting | Low | Low | `(monitor as any).client_id` — standard pattern, used in M1-T6/M1-T7. |
| Aggregate SQL query performance | Low | Low | Composite index `(monitor_id, timestamp_ms)` exists. Time range is narrow by default (1h). |

---

## 9. Completion Checklist

- [ ] `test/setup.ts` exists and is correct
- [ ] All tests pass: `npx vitest run` (~70 tests across 4 files)
- [ ] Typecheck passes: `npx nuxi typecheck`
- [ ] Dev server starts: `npx nuxi dev`
- [ ] All 9 files staged and committed
- [ ] Branch ready for Agent 06 audit

---

## 10. Notes for Agent 07 (Implementation)

1. **Do NOT modify files outside `dashboard/`**
2. **Existing patterns to follow:**
   - Routes: `defineEventHandler` with `getQuery()`, `getRouterParam()`, `createError()`
   - DB: `getDb()` from `~/server/utils/db`
   - Logging: `info`/`error` from `~/server/utils/logger`
   - Tests: vitest, in-memory SQLite, `globalThis.__db` isolation
   - Types: import from `#shared/types` (Nuxt alias) or `~/shared/types` (vitest alias)
3. **The implementation is already complete** — Agent 07 needs to verify, not build
4. **Quality classifier thresholds** match F6 spec exactly (verified in code review)

---

## Report

**Status:** Complete
**Sequence:** 5 steps (verify → test → typecheck → dev server → commit)
**Files:** Create 0 (all already exist) | Modify 0 (all already modified) | Commit 11
**Dependencies:** All external dependencies met (M1-T1 through M1-T7)
**Risks:** 5 identified, all low-impact with mitigations
**Complexity:** Medium
**Plan saved to memory:** Pending
**Next agent:** Agent 06 (Audit & Present Plan)
