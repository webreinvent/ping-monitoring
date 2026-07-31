---
taskId: M1-T2
milestone: M1
title: Create SQLite database plugin with WAL mode and migration runner
priority: Critical
status: "Not Started"
estimatedEffort: "2-3 hours"
features:
  - F1
---

# Task M1-T2 — Create SQLite database plugin with WAL mode and migration runner

> **Milestone:** M1 (Backend Platform)
> **Priority:** Critical
> **Status:** Not Started
> **Estimated Effort:** 2-3 hours

## Description

Build the SQLite database initialization plugin using `better-sqlite3` with WAL mode, a migration runner that executes SQL files on startup, and a typed database helper for use by all API routes.

## Task Goals

- Create Nitro plugin (`server/plugins/database.ts`) that initializes SQLite on server start
- Enable WAL mode, foreign keys, and recommended pragmas
- Build a migration runner that executes SQL files from `schema/migrations/` in order
- Export a typed database helper (`server/utils/db.ts`) for use across the codebase

## Implementation Plan

### Steps

1. Create `server/plugins/database.ts`:
   - Open SQLite database from `DATABASE_PATH` env var (default: `.data/lingering.db`)
   - Enable WAL mode: `PRAGMA journal_mode = WAL`
   - Set recommended pragmas: `synchronous = NORMAL`, `cache_size = -64000`, `foreign_keys = ON`, `busy_timeout = 5000`
   - Run migration runner
   - Close database on server shutdown
2. Create `server/utils/db.ts`:
   - Export singleton database connection
   - Provide typed helper functions for common operations
   - Export `getDb()` function for use in API routes
3. Create `schema/migrations/` directory with an empty initial migration file
4. Create migration runner that:
   - Reads all `.sql` files from `schema/migrations/` in alphabetical order
   - Executes each in a transaction
   - Logs success/failure for each migration
5. Verify: server starts, database file is created, WAL mode is active

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `nuxt` | Nitro plugin patterns | Plugin creation |
| `filesystem` (MCP) | File creation | Writing files |

## Acceptance Criteria

- [ ] Database plugin initializes SQLite connection on server start
- [ ] WAL mode is enabled (`PRAGMA journal_mode = WAL` returns `wal`)
- [ ] Foreign keys are enforced (`PRAGMA foreign_keys = ON`)
- [ ] Recommended pragmas are set (cache_size, busy_timeout, synchronous)
- [ ] Migration runner executes all SQL files in `schema/migrations/` in order
- [ ] Migration runner logs each migration result
- [ ] `getDb()` exports a singleton connection accessible from any route
- [ ] Database closes cleanly on server shutdown
- [ ] Database file created at configured `DATABASE_PATH`

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] Database file created at expected path
- [ ] WAL mode confirmed via PRAGMA check
- [ ] Migration files execute without errors
- [ ] `getDb()` returns valid connection from any import

## Dependencies

- **Requires:** M1-T1 (Nuxt project setup)
- **Blocks:** M1-T3

## Documentation References

- F1: [Backend project setup](../../requirements/features/feature-0001-backend-setup.md)
- [Data Models](../../requirements/data-models/data-models.md) — SQLite Configuration, Migration Order
