---
taskId: M1-T5
milestone: M1
title: Implement client identity: slug generation, registration, upsert
priority: Critical
status: "🟢 Complete"
estimatedEffort: "3-4 hours"
features:
  - F2
---

# Task M1-T5 — Implement client identity: slug generation, registration, upsert

> **Milestone:** M1 (Backend Platform)
> **Priority:** Critical
> **Status:** 🟢 Complete
> **Estimated Effort:** 3-4 hours

## Description

Build the client identity system: auto-generate unique slugs from username + hostname + MAC address, register new clients on first ingest, and match existing clients by slug. This is the foundation for all client identification in the system.

## Task Goals

- Implement slug generation logic with proper formatting and validation
- Create client upsert function using `INSERT OR IGNORE` with ON CONFLICT
- Create `GET /api/clients/:slug` endpoint
- Create `PUT /api/clients/:slug/name` endpoint (F11 backend)

## Acceptance Criteria

- [x] `generateSlug()` produces URL-safe slugs matching format `<username>-<hostname>-<truncated-mac>`
- [x] Slug is deterministic: same inputs always produce same slug
- [x] `upsertClient()` creates new client on first call, no-op on subsequent calls
- [x] `GET /api/clients/:slug` returns full client record
- [x] `PUT /api/clients/:slug/name` updates name, returns updated record
- [x] Name validation: rejects empty, whitespace-only, or >100 char names
- [x] 404 for non-existent slug on both endpoints
- [x] Response shapes match F2 API contract

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors and health endpoint returns 200

## Testing Checklist

- [x] Slug generation produces correct format
- [x] Upsert is idempotent (no duplicate records)
- [x] Name editing validates input
- [x] API endpoints return correct shapes

## Dependencies

- **Requires:** M1-T3 (database schema)
- **Blocks:** M1-T6

## Documentation References

- F2: [Client registration & identity](../../requirements/features/feature-0002-client-identity.md)
- F11: [Dashboard client name editing](../../requirements/features/feature-00011-edit-client-name.md)
