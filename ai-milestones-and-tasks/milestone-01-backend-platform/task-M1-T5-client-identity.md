---
taskId: M1-T5
milestone: M1
title: Implement client identity: slug generation, registration, upsert
priority: Critical
status: "Not Started"
estimatedEffort: "3-4 hours"
features:
  - F2
---

# Task M1-T5 — Implement client identity: slug generation, registration, upsert

> **Milestone:** M1 (Backend Platform)
> **Priority:** Critical
> **Status:** Not Started
> **Estimated Effort:** 3-4 hours

## Description

Build the client identity system: auto-generate unique slugs from username + hostname + MAC address, register new clients on first ingest, and match existing clients by slug. This is the foundation for all client identification in the system.

## Task Goals

- Implement slug generation logic with proper formatting and validation
- Create client upsert function using `INSERT OR IGNORE` with ON CONFLICT
- Create `GET /api/clients/:slug` endpoint
- Create `PUT /api/clients/:slug/name` endpoint (F11 backend)

## Implementation Plan

### Steps

1. Create `server/utils/client.ts`:
   - `generateSlug(username, hostname, macAddress)`:
     - Concatenate username, hostname, last 10 hex chars of MAC (colons removed)
     - Lowercase all segments
     - Replace spaces/underscores with hyphens
     - Truncate to 64 chars
   - `defaultName(username, hostname)`: format as `username@hostname`
   - `upsertClient(slug, name, username, hostname, macAddress)`: `INSERT OR IGNORE ... ON CONFLICT(slug) DO UPDATE SET updated_at = ...`
   - `getClientBySlug(slug)`: single query lookup
   - `updateClientName(slug, name)`: validate 1-100 chars, update name column
2. Create `server/api/clients/[slug].get.ts`:
   - Return client record by slug
   - 404 if not found
3. Create `server/api/clients/[slug].name.put.ts`:
   - Accept `{ name }` in request body
   - Validate: non-empty, 1-100 chars
   - Update name, return updated client
   - 400 on invalid, 404 on not found
4. Verify: slug generation matches spec, upsert is idempotent

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `nuxt` | Nitro API route patterns | Route creation |
| `filesystem` (MCP) | File creation | Writing files |

## Acceptance Criteria

- [ ] `generateSlug()` produces URL-safe slugs matching format `<username>-<hostname>-<truncated-mac>`
- [ ] Slug is deterministic: same inputs always produce same slug
- [ ] `upsertClient()` creates new client on first call, no-op on subsequent calls
- [ ] `GET /api/clients/:slug` returns full client record
- [ ] `PUT /api/clients/:slug/name` updates name, returns updated record
- [ ] Name validation: rejects empty, whitespace-only, or >100 char names
- [ ] 404 for non-existent slug on both endpoints
- [ ] Response shapes match F2 API contract

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors and health endpoint returns 200

## Testing Checklist

- [ ] Slug generation produces correct format
- [ ] Upsert is idempotent (no duplicate records)
- [ ] Name editing validates input
- [ ] API endpoints return correct shapes

## Dependencies

- **Requires:** M1-T3 (database schema)
- **Blocks:** M1-T6

## Documentation References

- F2: [Client registration & identity](../../requirements/features/feature-0002-client-identity.md)
- F11: [Dashboard client name editing](../../requirements/features/feature-00011-edit-client-name.md)
