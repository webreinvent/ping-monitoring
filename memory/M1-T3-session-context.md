---
name: M1-T3-session-context
description: M1-T3 task scope — database schema migrations (5 migration files, 4 tables, 8 indexes)
metadata:
  type: project
---

# M1-T3: Implement all database schema migrations

## Objective
Create 5 SQL migration files in `dashboard/schema/migrations/` that define 4 database tables and 8 indexes for the LNPM Cloud Dashboard. Migrations are executed by the existing M1-T2 migration runner on server startup.

## Current State
The 5 migration files were **already created as part of M1-T2** (database plugin). They exist at `dashboard/schema/migrations/` and match the data models spec.

## Files Already in Place
- `dashboard/schema/migrations/001_create_clients.sql` — clients table (8 columns)
- `dashboard/schema/migrations/002_create_monitors.sql` — monitors with FK to clients CASCADE DELETE, UNIQUE(client_id, target_host)
- `dashboard/schema/migrations/003_create_ping_samples.sql` — ping_samples with FK to monitors CASCADE DELETE, UNIQUE dedup
- `dashboard/schema/migrations/004_create_minute_rollups.sql` — minute_rollups with FK to monitors CASCADE DELETE
- `dashboard/schema/migrations/005_create_indexes.sql` — all 8 indexes
- `dashboard/schema/index.sql` — assembled full schema reference

## What Needs Verification
The migrations match the spec, but the task requires:
1. F9 sync columns (`sync_enabled`, `sync_interval_min`, `backend_url`, `last_synced_at_ms`) on `clients` — **not yet in migration 001**
2. Verifying migrations execute without errors on fresh database
3. `npx nuxi typecheck` passes

## Gap: F9 sync columns missing from clients migration
The current `001_create_clients.sql` does NOT include the F9 sync columns specified in `feature-0009-client-settings.md`. Either a separate migration (006) or ALTER TABLE is needed.

[[M1-T2-session-context]] — the previous task that created these files
[[task-complete]] — M1-T2 completion summary
