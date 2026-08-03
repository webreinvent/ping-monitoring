# Implementation Plan — M1-T6: Ping Data Ingest Endpoint Tests

## Executive Summary

The **implementation code is already complete**. All 4 core files exist and pass the acceptance criteria:
- `server/api/ping/ingest.post.ts` — Route handler
- `server/utils/ping-types.ts` — TypeScript types
- `server/utils/ping-validation.ts` — 7 validation rules
- `server/utils/ping-ingest.ts` — Core ingest engine (transactional, dedup, auto-create)

**The gap is test coverage.** This plan defines the ordered sequence for writing comprehensive tests.

---

## Sequence

### Phase 1: Validation Tests (no DB needed — pure unit tests)

**Step 1:** `server/utils/ping-validation.test.ts`
- Test each of the 7 validation rules individually
- Test valid samples (all 3 statuses: success, timeout, error)
- Test that multiple rejections can accumulate on a single sample
- Test that `valid` is `false` when any rejection exists
- Test that `valid` is `true` when no rejections exist

**Step 2:** `server/utils/ping-validation.edge-cases.test.ts`
- Boundary: timestamp exactly at the future window edge (should pass)
- Boundary: timestamp 1ms beyond the future window (should fail)
- Boundary: timestampMs = 0 (should fail as not positive)
- Boundary: timestampMs = 1 (should pass as minimum positive)
- Boundary: latencyMs = 0 (should fail as not positive)
- Boundary: latencyMs = 0.001 (should pass as minimum positive)
- Boundary: latencyMs = Infinity (should fail)
- Boundary: latencyMs = NaN (should fail)
- Boundary: targetHost with only whitespace (should fail)
- Boundary: resolvedAddress with only whitespace (should fail)
- Edge: status = "SUCCESS" (uppercase — should fail)
- Edge: status = null (should fail)
- Edge: status = "" (should fail)
- Edge: sample with all fields as null/undefined
- Edge: sample with extra unknown fields (should not cause errors)
- Edge: future window env override (INGEST_FUTURE_WINDOW_MS = 0)

### Phase 2: Ingest Engine Tests (DB mocked)

**Step 3:** `server/utils/ping-ingest.test.ts`
- Test `ingestPingBatch()` with mocked `getDb()` and `getClientBySlug()`
- Test client lookup failure returns null (401 path)
- Test client auto-registration when identity provided
- Test validation phase correctly separates valid/rejected samples
- Test rejected count is based on unique sample indices (not rejection count)
- Test that empty validSamples skips ingest phase gracefully
- Test that rejections array is only populated when rejected > 0
- Test that rejections are undefined when all samples are valid
- Test BATCH_TOO_LARGE and EMPTY_SAMPLES error paths
- Test `ingestSamples()` with mocked DB — verify INSERT OR IGNORE behavior
- Test monitor auto-creation via `ensureMonitor()`
- Test monitor latest state update
- Test client `last_synced_at_ms` update
- Test transaction rollback on database error
- Test that `db.transaction()` wraps all operations

**Step 4:** `server/utils/ping-ingest.integration.test.ts`
- Integration test with a real in-memory SQLite database
- Test full pipeline: client lookup → validation → monitor auto-create → insert → status codes
- Test with a batch of mixed valid/invalid samples
- Test dedup: second batch of identical samples returns all duplicates
- Test monitor auto-creation for new target hosts
- Test monitor latest state update with correct values
- Test client `last_synced_at_ms` update
- Test transaction rollback on DB error
- Test performance: 1000 samples in under 200ms (assertive, not blocking)

### Phase 3: Route Handler Tests

**Step 5:** `server/api/ping/ingest.post.test.ts`
- Test request parsing and body validation
- Test missing clientSlug → 400 with MISSING_CLIENT_SLUG
- Test empty samples array → 400 with EMPTY_SAMPLES
- Test oversized batch (>1000) → 413 with BATCH_TOO_LARGE
- Test unknown client → 401 with UNKNOWN_CLIENT
- Test all samples accepted → 201
- Test all duplicates → 200
- Test mixed (accepted + duplicate + rejected) → 207
- Test database error → 500 with DATABASE_ERROR
- Test response shape matches F3 contract (accepted, duplicate, rejected, rejections)
- Test client auto-registration path (first ingest with identity fields)

**Step 6:** `server/api/ping/ingest.post.integration.test.ts`
- Integration test with real in-memory SQLite DB
- Test full request→response cycle through the handler
- Test with a real `readBody()` mock
- Test status code is correctly set via `setResponseStatus`
- Test error responses match API design error shape
- Test the `sendResponse()` helper sets correct status codes

### Phase 7: Cleanup & Verification

**Step 7:** Run full test suite
- `npx vitest run` — all tests pass
- `npx nuxi typecheck` — no TypeScript errors
- `npx nuxi dev` — starts without errors

---

## File Inventory

### Files to CREATE: 6

| # | File | Description | Phase |
|---|------|-------------|-------|
| 1 | `server/utils/ping-validation.test.ts` | Unit tests for 7 validation rules | Phase 1 |
| 2 | `server/utils/ping-validation.edge-cases.test.ts` | Edge case tests (boundaries, nulls, types) | Phase 1 |
| 3 | `server/utils/ping-ingest.test.ts` | Unit tests for ingest engine (mocked DB) | Phase 2 |
| 4 | `server/utils/ping-ingest.integration.test.ts` | Integration tests with real SQLite | Phase 2 |
| 5 | `server/api/ping/ingest.post.test.ts` | Unit tests for route handler | Phase 3 |
| 6 | `server/api/ping/ingest.post.integration.test.ts` | Integration tests for route handler | Phase 3 |

### Files to MODIFY: 0

All implementation files are complete. No modifications needed.

### Files to DELETE: 0

No files to delete.

### Existing files (reference only):

| File | Purpose | Status |
|------|---------|--------|
| `server/api/ping/ingest.post.ts` | Route handler | ✅ Complete |
| `server/utils/ping-types.ts` | TypeScript types | ✅ Complete |
| `server/utils/ping-validation.ts` | Sample validation (7 rules) | ✅ Complete |
| `server/utils/ping-ingest.ts` | Core ingest engine | ✅ Complete |
| `server/utils/db.ts` | `getDb()` helper | ✅ Complete |
| `server/utils/client.ts` | Client CRUD + slug generation | ✅ Complete |
| `server/utils/logger.ts` | Structured logger | ✅ Complete |
| `server/plugins/database.ts` | SQLite init + migrations | ✅ Complete |
| `schema/index.sql` | Full schema | ✅ Complete |
| `schema/migrations/*.sql` | 5 migration files | ✅ Complete |
| `shared/types.ts` | Shared types (stale ingest types) | ⚠️ Pre-existing issue |
| `test/fixtures.ts` | Test fixtures | ✅ Complete |
| `test/setup.ts` | Test setup | ✅ Complete |
| `vitest.config.ts` | Vitest configuration | ✅ Complete |

---

## Dependency Graph

```
Phase 1: Validation tests (no dependencies)
  ├── ping-validation.test.ts
  └── ping-validation.edge-cases.test.ts

Phase 2: Ingest engine tests (depends on Phase 1 validation)
  ├── ping-ingest.test.ts (mocked DB, depends on validation tests)
  └── ping-ingest.integration.test.ts (real DB, depends on validation tests)

Phase 3: Route handler tests (depends on Phase 2)
  ├── ingest.post.test.ts (mocked ingest engine)
  └── ingest.post.integration.test.ts (real DB + handler)

Phase 4: Verification
  └── Full test suite run + typecheck
```

### Parallelizable Work

- Phase 1 files can be written in parallel (no inter-dependencies)
- Phase 2 files can be written in parallel (both depend only on Phase 1)
- Phase 3 files can be written in parallel (both depend only on Phase 2)
- Each phase must complete before the next begins

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **better-sqlite3 segfault in Vitest** | High | High | Use `vi.mock()` for `getDb()` in unit tests; use in-memory DB only in integration tests with proper setup |
| **Stale shared/types.ts** | Medium | Low | Actual types in `server/utils/ping-types.ts` are correct; don't modify `shared/types.ts` as part of this task |
| **Transaction rollback not working** | Low | High | Test with intentional DB errors to verify rollback behavior |
| **Performance target not met (200ms for 1000 samples)** | Low | Medium | Use prepared statements (already done); test with realistic batch sizes |
| **Dedup count incorrect** | Low | High | better-sqlite3 `changes` property correctly distinguishes INSERT vs IGNORE; verify with test |
| **Env variable not respected in tests** | Medium | Low | Mock `process.env` values in test setup where needed |
| **Test isolation failures** | Low | Medium | `test/setup.ts` already clears `globalThis.__db` before each test; ensure mocks are cleared |

---

## Testing Strategy

### Mocking Approach

**Unit tests:** Mock `getDb()` to return a controlled mock database object. Pattern follows existing `client.integration.test.ts`:
```ts
vi.mock("./db", () => ({ getDb: vi.fn() }));
```

**Integration tests:** Use a real in-memory SQLite database:
```ts
const db = new Database(":memory:");
// Run migrations on the in-memory DB
globalThis.__db = db;
```

### Test Pattern

Follow the existing project patterns:
- `*.test.ts` for unit tests (mocked dependencies)
- `*.edge-cases.test.ts` for boundary/edge case coverage
- `*.integration.test.ts` for real database tests
- Use `describe`/`it`/`expect` (Vitest)
- No globals except those from `test/setup.ts`

### Coverage Target

- **ping-validation.ts:** 100% line coverage (all 7 rules + helper)
- **ping-ingest.ts:** 95%+ line coverage (all paths including error handling)
- **ingest.post.ts:** 90%+ line coverage (all status code paths)

---

## Acceptance Criteria Mapping

| AC # | Criterion | Covered By |
|------|-----------|------------|
| 1 | Valid batch returns correct counts | `ping-ingest.test.ts`, `ingest.post.test.ts` |
| 2 | Oversized batch → 413 | `ingest.post.test.ts` |
| 3 | Empty batch → 400 | `ingest.post.test.ts` |
| 4 | Unknown client → 401 | `ingest.post.test.ts`, `ping-ingest.test.ts` |
| 5 | Validates each sample (7 rules) | `ping-validation.test.ts`, `ping-validation.edge-cases.test.ts` |
| 6 | Dedup via INSERT OR IGNORE | `ping-ingest.test.ts`, `ping-ingest.integration.test.ts` |
| 7 | Monitor auto-creation | `ping-ingest.test.ts`, `ping-ingest.integration.test.ts` |
| 8 | Correct HTTP status codes (201/200/207/400/401/413) | `ingest.post.test.ts` |
| 9 | Transactional rollback | `ping-ingest.integration.test.ts` |
| 10 | Monitor latest state update | `ping-ingest.test.ts`, `ping-ingest.integration.test.ts` |
| 11 | 1000 samples in under 200ms | `ping-ingest.integration.test.ts` (assertive) |

---

## Complexity: Medium

The implementation is complete and well-structured. The test writing is straightforward but requires careful mocking of the database layer to avoid better-sqlite3 segfaults in test workers. The existing test patterns (mock DB + in-memory DB) provide a solid foundation.

---

## Next Agent: Agent 07 (Implement Tests)

Agent 07 will:
1. Create all 6 test files following this plan
2. Run `npx vitest run` to verify all tests pass
3. Run `npx nuxi typecheck` to verify no TypeScript errors
4. Run `npx nuxi dev` to verify the server starts

---

## Plan saved to memory: ✅
