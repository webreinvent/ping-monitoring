---
taskId: M1-T6
milestone: M1
title: Build ping data ingest endpoint with validation and dedup
priority: Critical
status: "Not Started"
estimatedEffort: "4-6 hours"
features:
  - F3
  - F4
---

# Task M1-T6 — Build ping data ingest endpoint with validation and dedup

> **Milestone:** M1 (Backend Platform)
> **Priority:** Critical
> **Status:** Not Started
> **Estimated Effort:** 4-6 hours

## Description

Build the `POST /api/ping/ingest` endpoint: the primary data ingestion path for all ping telemetry. Accepts batches of up to 1000 samples, validates each against business rules, deduplicates using `INSERT OR IGNORE`, auto-creates monitors for new targets, and returns counts of accepted/duplicate/rejected samples.

## Task Goals

- Implement batch ingest route handler with full validation
- Implement sample-level validation (timestamp, latency, status, resolved address)
- Implement dedup via unique index + `INSERT OR IGNORE`
- Auto-create monitors for new (client_id, target_host) pairs
- Return correct HTTP status codes and response shapes
- Update monitor latest state and client `last_synced_at_ms` after ingest
- Trigger quality classifier for affected monitors (F12 hook)
- Emit WebSocket broadcast for new samples (F7 hook)

## Implementation Plan

### Steps

1. Create `server/utils/ping-types.ts`:
   - Define TypeScript interfaces: `IngestPayload`, `PingSampleIngest`, `IngestResponse`, `Rejection`
2. Create `server/utils/ping-validation.ts`:
   - `validateSample(sample)`: check all rules per F3 spec
   - `validateBatch(payload)`: check clientSlug, sample count (1-1000), non-empty
3. Create `server/utils/ping-ingest.ts`:
   - `ingestBatch(payload)`: main engine
   - Wrap in SQLite transaction
   - Upsert client (M1-T5)
   - Auto-create monitors for unknown targets
   - `INSERT OR IGNORE` for each sample
   - Track accepted/duplicate/rejected counts
   - Update monitor latest state (`last_seen_ms`, `last_status`, `last_latency_ms`)
   - Update client `last_synced_at_ms`
4. Create `server/api/ping/ingest.post.ts`:
   - Parse request body, validate batch
   - Call `ingestBatch()`
   - Return correct status code (201/200/207/400/401/413)
   - Fire-and-forget WebSocket broadcast (F7 hook)
   - Fire-and-forget quality classification (F12 hook)
5. Verify: ingest is idempotent, dedup works, response shape matches spec

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `sequential-thinking` | Complex ingest logic | Validation + dedup flow |
| `nuxt` | Nitro API route patterns | Route creation |
| `filesystem` (MCP) | File creation | Writing files |

## Acceptance Criteria

- [ ] Accepts valid batch of samples, returns accepted/duplicate/rejected counts
- [ ] Rejects oversized batches (>1000) with 413
- [ ] Rejects empty batches with 400
- [ ] Rejects unknown clientSlug with 401
- [ ] Validates each sample: timestamp, latency, status, resolved address
- [ ] Deduplicates via `INSERT OR IGNORE` on unique index
- [ ] Auto-creates monitors for new target hosts
- [ ] Returns correct HTTP status codes: 201 (all accepted), 200 (all dupes), 207 (mixed), 400/401/413 (errors)
- [ ] Transactional: database error rolls back entire batch
- [ ] Updates monitor latest state after ingest
- [ ] Ingest target: 1000 samples in under 200ms

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] Valid batch ingest returns correct counts
- [ ] Duplicate batch returns all duplicates
- [ ] Oversized batch rejected with 413
- [ ] Unknown client rejected with 401
- [ ] Invalid samples counted as rejected
- [ ] Monitor auto-creation works for new targets
- [ ] Response shape matches F3 API contract

## Dependencies

- **Requires:** M1-T3 (schema), M1-T5 (client identity)
- **Blocks:** M1-T7, M1-T8, M1-T9

## Documentation References

- F3: [Ping data ingest endpoint](../../requirements/features/feature-0003-ping-ingest.md)
- F4: [LNPM client sync service](../../requirements/features/feature-0004-client-sync.md)
