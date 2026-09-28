---
taskId: M1-T2
milestone: M1
title: Create SQLite database plugin with WAL mode and migration runner
priority: Critical
status: "🟢 Complete"
estimatedEffort: "2-3 hours"
features:
  - F1
---

# Task M1-T2 — Create SQLite database plugin with WAL mode and migration runner

> **Milestone:** M1 (Backend Platform)
> **Priority:** Critical
> **Status:** 🟢 Complete
> **Estimated Effort:** 2-3 hours

## Description

Build the SQLite database initialization plugin using `better-sqlite3` with WAL mode, a migration runner that executes SQL files on startup, and a typed database helper for use by all API routes.

## Task Goals

- Create Nitro plugin (`server/plugins/database.ts`) that initializes SQLite on server start
- Enable WAL mode, foreign keys, and recommended pragmas
- Build a migration runner that executes SQL files from `schema/migrations/` in order
- Export a typed database helper (`server/utils/db.ts`) for use across the codebase

## Acceptance Criteria

- [x] Database plugin initializes SQLite connection on server start
- [x] WAL mode is enabled (`PRAGMA journal_mode = WAL` returns `wal`)
- [x] Foreign keys are enforced (`PRAGMA foreign_keys = ON`)
- [x] Recommended pragmas are set (cache_size, busy_timeout, synchronous)
- [x] Migration runner executes all SQL files in `schema/migrations/` in order
- [x] Migration runner logs each migration result
- [x] `getDb()` exports a singleton connection accessible from any route
- [x] Database closes cleanly on server shutdown
- [x] Database file created at configured `DATABASE_PATH`

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors

## Testing Checklist

- [x] Database file created at expected path
- [x] WAL mode confirmed via PRAGMA check
- [x] Migration files execute without errors
- [x] `getDb()` returns valid connection from any import

## Dependencies

- **Requires:** M1-T1 (Nuxt project setup)
- **Blocks:** M1-T3

## Documentation References

- F1: [Backend project setup](../../requirements/features/feature-0001-backend-setup.md)
- [Data Models](../../requirements/data-models/data-models.md) — SQLite Configuration, Migration Order
