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
