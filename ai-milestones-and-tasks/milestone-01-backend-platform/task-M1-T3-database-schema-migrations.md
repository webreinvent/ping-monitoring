---
taskId: M1-T3
milestone: M1
title: Implement all database schema migrations
priority: Critical
status: "Not Started"
estimatedEffort: "2-3 hours"
features:
  - F1
  - F2
  - F3
---

# Task M1-T3 — Implement all database schema migrations

> **Milestone:** M1 (Backend Platform)
> **Priority:** Critical
> **Status:** Not Started
> **Estimated Effort:** 2-3 hours

## Description

Create all SQL migration files for the 4 database tables (clients, monitors, ping_samples, minute_rollups) and 8 indexes defined in the data models specification. These migrations will be executed by the migration runner from M1-T2 on server startup.

## Task Goals

- Create 5 migration files matching the data models specification
- Define all 4 tables with correct columns, types, constraints, and defaults
- Create all 8 indexes
- Ensure migrations execute in the correct order with foreign key dependencies

## Implementation Plan

### Steps

1. Create `schema/migrations/001_create_clients.sql`:
   - `clients` table with columns: `id`, `slug` (UNIQUE), `name`, `username`, `hostname`, `mac_address`, `created_at`, `updated_at`
   - Include F9 columns: `sync_enabled`, `sync_interval_min`, `backend_url`, `last_synced_at_ms`
2. Create `schema/migrations/002_create_monitors.sql`:
   - `monitors` table with columns: `id`, `client_id` (FK), `target_host`, `target_name`, `quality_state`, `state_since_ms`, `last_seen_ms`, `last_status`, `last_latency_ms`, `created_at`, `updated_at`
   - UNIQUE(client_id, target_host)
   - Include F12 columns: `quality_state` (already defined), `quality_state_updated_at`
3. Create `schema/migrations/003_create_ping_samples.sql`:
   - `ping_samples` table with columns: `id`, `monitor_id` (FK), `timestamp_ms`, `latency_ms`, `status`, `resolved_address`, `error`, `created_at`
   - UNIQUE(monitor_id, timestamp_ms, resolved_address)
4. Create `schema/migrations/004_create_minute_rollups.sql`:
   - `minute_rollups` table with columns: `monitor_id` (FK), `timestamp_ms`, `sample_count`, `success_count`, `failure_count`, `avg_latency`, `min_latency`, `max_latency`, `p95_latency`, `created_at`
   - UNIQUE(monitor_id, timestamp_ms)
5. Create `schema/migrations/005_create_indexes.sql`:
   - All 8 indexes from data models spec
6. Verify: migrations execute cleanly on fresh database

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `postgresql-table-design` | Table design principles | Schema design |
| `filesystem` (MCP) | File creation | Writing SQL files |

## Acceptance Criteria

- [ ] 5 migration files created in `schema/migrations/`
- [ ] `clients` table has all columns including F9 sync columns
- [ ] `monitors` table has FK to clients, unique constraint, quality state columns
- [ ] `ping_samples` table has FK to monitors, unique dedup constraint
- [ ] `minute_rollups` table has FK to monitors, unique constraint
- [ ] All 8 indexes created: idx_clients_slug, idx_clients_mac, idx_monitors_client, idx_monitors_last_seen, idx_monitors_client_target, idx_ping_monitor_time, idx_ping_status, idx_rollup_monitor_time
- [ ] Foreign keys enforced (CASCADE DELETE)
- [ ] All migrations execute without errors on fresh database
- [ ] Schema matches data models specification exactly

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] Migrations execute on server startup via M1-T2 migration runner

## Testing Checklist

- [ ] All 5 migration files execute without SQL errors
- [ ] Tables created with correct column types
- [ ] Constraints enforced (UNIQUE, FK CASCADE)
- [ ] Indexes created and query planner uses them

## Dependencies

- **Requires:** M1-T2 (database plugin and migration runner)
- **Blocks:** M1-T5, M1-T6

## Documentation References

- [Data Models](../../requirements/data-models/data-models.md) — Tables, Indexes, Migration Order
- F2: [Client identity](../../requirements/features/feature-0002-client-identity.md) — Data model
- F3: [Ping ingest](../../requirements/features/feature-0003-ping-ingest.md) — Data model
- F9: [Client settings](../../requirements/features/feature-0009-client-settings.md) — Data model
- F12: [Quality classifier](../../requirements/features/feature-00012-quality-classifier.md) — Data model
