# Task M1-T6 — Scope Analysis

## Objective
Build the `POST /api/ping/ingest` endpoint: the primary data ingestion path for all ping telemetry. Accepts batches of up to 1000 samples, validates each against business rules, deduplicates using `INSERT OR IGNORE`, auto-creates monitors for new targets, and returns counts of accepted/duplicate/rejected samples.

## Acceptance Criteria
- [x] Accepts valid batch of samples, returns accepted/duplicate/rejected counts
- [x] Rejects oversized batches (>1000) with 413
- [x] Rejects empty batches with 400
- [x] Rejects unknown clientSlug with 401
- [x] Validates each sample: timestamp, latency, status, resolved address
- [x] Deduplicates via `INSERT OR IGNORE` on unique index
- [x] Auto-creates monitors for new target hosts
- [x] Returns correct HTTP status codes: 201 (all accepted), 200 (all dupes), 207 (mixed), 400/401/413 (errors)
- [x] Transactional: database error rolls back entire batch
- [x] Updates monitor latest state after ingest
- [x] Ingest target: 1000 samples in under 200ms

## Current State (What Already Exists)

### Files that ALREADY EXIST and are IMPLEMENTED:

1. **`server/api/ping/ingest.post.ts`** — Route handler is fully implemented
   - Parses request body, validates top-level fields
   - Checks batch size (413), empty batch (400), missing clientSlug (400)
   - Calls `ingestPingBatch()` and maps results to HTTP status codes (201/200/207)
   - Returns IngestResponse with accepted/duplicate/rejected/rejections
   - Error handling with 500 fallback

2. **`server/utils/ping-types.ts`** — TypeScript types fully defined
   - `PingSampleIngest` — single sample shape
   - `IngestPayload` — full request payload with optional client identity
   - `Rejection` — per-sample rejection detail
   - `IngestResponse` — response with accepted/duplicate/rejected/rejections
   - `ValidationResult` — validation output shape

3. **`server/utils/ping-validation.ts`** — Sample validation fully implemented
   - `validateSample()` checks all 6 rules:
     - targetHost required and non-empty (MISSING_TARGET_HOST)
     - timestampMs positive integer (INVALID_TIMESTAMP)
     - timestampMs within 5-min future window (FUTURE_TIMESTAMP)
     - status one of success/timeout/error (INVALID_STATUS)
     - latencyMs required and positive for success (MISSING_LATENCY/INVALID_LATENCY)
     - resolvedAddress required for success (MISSING_RESOLVED_ADDRESS)

4. **`server/utils/ping-ingest.ts`** — Core ingest engine fully implemented
   - `ensureMonitor()` — auto-creates monitors via INSERT OR IGNORE
   - `ingestSamples()` — transactional batch insert with dedup
   - `ingestPingBatch()` — orchestrates client lookup, validation, insert
   - Updates monitor latest state (last_seen_ms, last_status, last_latency_ms)
   - Updates client `last_synced_at_ms` and `updated_at`

5. **Schema migrations** — All 5 migrations exist:
   - `001_create_clients.sql` — clients table with slug, name, identity fields
   - `002_create_monitors.sql` — monitors table with unique(client_id, target_host)
   - `003_create_ping_samples.sql` — ping_samples with unique(monitor_id, timestamp_ms, resolved_address)
   - `004_create_minute_rollups.sql` — minute_rollups table
   - `005_create_indexes.sql` — all performance indexes

6. **Supporting files:**
   - `server/utils/db.ts` — getDb() helper
   - `server/utils/client.ts` — generateSlug(), upsertClient(), getClientBySlug()
   - `server/plugins/database.ts` — SQLite init with WAL, pragma config, migration runner
   - `server/utils/logger.ts` — info/warn/error logger

### What the EXISTING IMPLEMENTATION does correctly:
- ✅ Batch size validation (413 for >1000)
- ✅ Empty batch rejection (400)
- ✅ Missing clientSlug rejection (400)
- ✅ Unknown client rejection (401) — with auto-registration if identity provided
- ✅ Per-sample validation (7 rules)
- ✅ Deduplication via INSERT OR IGNORE on unique index
- ✅ Monitor auto-creation for new (client_id, target_host)
- ✅ Transactional integrity (db.transaction wraps entire batch)
- ✅ Monitor latest state update (last_seen_ms, last_status, last_latency_ms)
- ✅ Client last_synced_at_ms update
- ✅ Correct HTTP status codes (201/200/207/400/401/413/500)
- ✅ Rejection details in response

### What's NOT yet implemented (out of scope for M1-T6 or future tasks):
- ❌ Quality classifier trigger (F12 hook) — mentioned in task goals but not yet in code
- ❌ WebSocket broadcast for new samples (F7 hook) — WS route exists but not wired to ingest
- ❌ Minute rollup computation on ingest
- ❌ Rate limiting (F13) — middleware not yet implemented

### Files to CREATE (for testing):
- `server/api/ping/ingest.post.test.ts` — Unit tests for the route handler
- `server/api/ping/ingest.post.integration.test.ts` — Integration tests with real DB
- `server/utils/ping-validation.test.ts` — Unit tests for validation rules
- `server/utils/ping-validation.edge-cases.test.ts` — Edge case tests
- `server/utils/ping-ingest.test.ts` — Unit tests for ingest engine
- `server/utils/ping-ingest.integration.test.ts` — Integration tests with DB

### Files to MODIFY:
- None — all implementation files already exist and are complete

### Files to DELETE:
- None

## Related Documentation
- F3: `requirements/features/feature-0003-ping-ingest.md` — Full feature spec
- F4: `requirements/features/feature-0004-client-sync.md` — Client sync (consumes F3)
- API Design: `requirements/api/api-design.md` — API contract (Section 5)
- Data Models: `requirements/data-models/data-models.md` — Schema + sample queries
- Architecture: `requirements/architecture.md` — ADRs, directory structure, tech stack

## Key Observations
1. **Implementation is complete** — The core ingest endpoint is fully implemented across 4 files. The code matches the F3 spec and API design document.
2. **No schema changes needed** — All tables and indexes are already created via migrations.
3. **The dedup index exists** — `UNIQUE(monitor_id, timestamp_ms, resolved_address)` is in migration 003.
4. **Client auto-registration works** — First ingest from a new client with identity fields auto-creates the client record.
5. **Tests are the main gap** — The implementation files exist but test coverage needs to be written for the ingest endpoint, validation, and ingest engine.
6. **TypeScript types in `shared/types.ts` are stale** — The `IngestResponse` and `IngestRequest` in `shared/types.ts` don't match the F3 spec. The actual types live in `server/utils/ping-types.ts`. This is a pre-existing issue not introduced by this task.

## Next Agent: Agent 03 (Analyze Related Code)
