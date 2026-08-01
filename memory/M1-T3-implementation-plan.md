---
name: M1-T3-implementation-plan
description: M1-T3 implementation plan — 5 migrations, F9 sync columns, schema verification
metadata:
  type: project
---

# M1-T3 Implementation Plan — Database Schema Migrations

## Status: Ready to Execute

The 5 migration files already exist with F9 sync columns added. This plan documents the verification and finalization steps.

## Current State

- `001_create_clients.sql` — 12 columns (8 base + 4 F9 sync columns). F9 columns already added.
- `002_create_monitors.sql` — 11 columns, FK to clients, UNIQUE(client_id, target_host). Matches spec.
- `003_create_ping_samples.sql` — 8 columns, FK to monitors, UNIQUE dedup. Matches spec.
- `004_create_minute_rollups.sql` — 10 columns, FK to monitors, UNIQUE(monitor_id, timestamp_ms). Matches spec.
- `005_create_indexes.sql` — 9 indexes (8 spec + 1 F9). All present.
- `index.sql` — Assembled full schema, updated to reflect F9 changes.

## Sequence

### 1. Verify `001_create_clients.sql` against spec

**File:** `dashboard/schema/migrations/001_create_clients.sql`
**Status:** Already updated with F9 columns

All 12 columns verified: id, slug, name, username, hostname, mac_address, sync_enabled, sync_interval_min, backend_url, last_synced_at_ms, created_at, updated_at.

### 2. Verify `002_create_monitors.sql` against spec

**File:** `dashboard/schema/migrations/002_create_monitors.sql`
**Status:** Matches spec

All 11 columns verified. FK→clients(id) ON DELETE CASCADE. UNIQUE(client_id, target_host).

### 3. Verify `003_create_ping_samples.sql` against spec

**File:** `dashboard/schema/migrations/003_create_ping_samples.sql`
**Status:** Matches spec

All 8 columns verified. FK→monitors(id) ON DELETE CASCADE. UNIQUE(monitor_id, timestamp_ms, resolved_address).

### 4. Verify `004_create_minute_rollups.sql` against spec

**File:** `dashboard/schema/migrations/004_create_minute_rollups.sql`
**Status:** Matches spec

All 10 columns verified. FK→monitors(id) ON DELETE CASCADE. UNIQUE(monitor_id, timestamp_ms).

### 5. Verify `005_create_indexes.sql` — All 9 indexes

**File:** `dashboard/schema/migrations/005_create_indexes.sql`
**Status:** All 9 indexes present

idx_clients_slug, idx_clients_mac, idx_clients_last_synced (F9), idx_monitors_client, idx_monitors_last_seen, idx_monitors_client_target, idx_ping_monitor_time, idx_ping_status, idx_rollup_monitor_time.

### 6. Verify `index.sql` Assembled Schema

**File:** `dashboard/schema/index.sql`
**Status:** Updated to match migrations 001-005 including F9 changes

### 7. Verify Migration Order (FK Dependencies)

001 → 002 → 003 → 004 → 005

- 001: No FK deps (base table)
- 002: FK→clients(id), requires 001
- 003: FK→monitors(id), requires 002
- 004: FK→monitors(id), requires 002
- 005: Indexes all 4 tables, requires 001-004

### 8. Verify Foreign Key CASCADE DELETE

- monitors.client_id → clients(id) ON DELETE CASCADE ✅
- ping_samples.monitor_id → monitors(id) ON DELETE CASCADE ✅
- minute_rollups.monitor_id → monitors(id) ON DELETE CASCADE ✅

### 9. Verify UNIQUE Constraints

- clients.slug: NOT NULL UNIQUE ✅
- monitors(client_id, target_host): UNIQUE ✅
- ping_samples(monitor_id, timestamp_ms, resolved_address): UNIQUE ✅
- minute_rollups(monitor_id, timestamp_ms): UNIQUE ✅

### 10. Verify `npx nuxi typecheck`

Run typecheck to ensure no TypeScript errors in the dashboard project.

## File Inventory

### Files Modified (3)
1. `dashboard/schema/migrations/001_create_clients.sql` — Added F9 sync columns (sync_enabled, sync_interval_min, backend_url, last_synced_at_ms)
2. `dashboard/schema/migrations/005_create_indexes.sql` — Added idx_clients_last_synced index (F9)
3. `dashboard/schema/index.sql` — Updated assembled schema with F9 changes

### Files Unchanged (No modifications needed)
4. `dashboard/schema/migrations/002_create_monitors.sql`
5. `dashboard/schema/migrations/003_create_ping_samples.sql`
6. `dashboard/schema/migrations/004_create_minute_rollups.sql`
7. `dashboard/server/plugins/database.ts` — Migration runner
8. `dashboard/server/plugins/database.test.ts` — Unit tests
9. `dashboard/server/plugins/database.integration.test.ts` — Integration tests

## Dependencies

- **Requires:** M1-T2 (database plugin + migration runner) ✅ Complete
- **Blocks:** M1-T5, M1-T6

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| better-sqlite3 segfaults in container | Cannot run integration tests with real SQLite | Existing tests use mocks; SQL syntax verified manually |
| Migration order wrong | FK constraint violation on startup | Verified FK dependency chain |

## Complexity: Low

The migration files already exist and are correct. This task is primarily verification.

[[M1-T3-session-context]] — task context
[[M1-T3-code-analysis]] — code analysis with gap findings
[[decisions-made]] — M1-T2 decisions (F9 columns in 001, not separate migration)
[[patterns-established]] — SQL conventions
