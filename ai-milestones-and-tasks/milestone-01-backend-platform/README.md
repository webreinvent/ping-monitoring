---
milestoneId: M1
title: Backend Platform
category: Backend
priority: Critical
status: "In Progress"
estimatedEffort: "12-15 days"
dependencies: []
features:
  - F1
  - F2
  - F3
  - F4
  - F5
  - F6
  - F7
  - F10
  - F12
  - F13
  - F14
---

# Milestone M1 — Backend Platform

> **Category:** Backend
> **Priority:** Critical
> **Status:** In Progress
> **Estimated Effort:** 12-15 days
> **Dependencies:** None

## Objective

Build the complete backend foundation for the LNPM Cloud Dashboard: Nuxt 4 + Nitro persistent server, SQLite database with WAL mode, all API endpoints (ingest, monitors, history, health, client management), WebSocket live broadcast, plus server-side services (quality classifier, data retention, rate limiting). This milestone covers everything the frontend needs before any UI work can begin.

## Success Criteria

- [ ] Nitro server starts with persistent `node-server` runtime on port 3000
- [ ] SQLite database initialized with WAL mode, 4 tables, 8 indexes
- [ ] All 6 API endpoints respond correctly with documented response shapes
- [ ] WebSocket `/ws/ping` accepts subscriptions and broadcasts samples in real time
- [ ] Client auto-registration works on first ingest via slug generation
- [ ] Ping sample ingest validates, deduplicates, and stores batches of up to 1000
- [ ] Monitors list API returns monitors with latest state and client info
- [ ] Monitor history API returns aggregated HistoryResponse with time window support
- [ ] WebSocket pushes live samples to subscribed clients within 100ms of ingest
- [ ] Quality classifier evaluates monitors post-ingest and every 60s background sweep
- [ ] Data retention cleanup runs on schedule, deleting old samples and rollups
- [ ] Rate limiting middleware protects all endpoints (60/min default, 100/min ingest)
- [ ] Health endpoint returns comprehensive server metrics (DB size, counts, uptime)
- [ ] `npx nuxi typecheck` passes with no errors

## Tasks

- M1-T1 — Setup Nuxt 4 + Nitro project with persistent runtime (F1)
- M1-T2 — Create SQLite database plugin with WAL mode and migration runner (F1)
- M2-T3 — Implement all database schema migrations (F1, F2, F3)
- M1-T4 — Build health check endpoint with server metrics (F1, F14)
- M1-T5 — Implement client identity: slug generation, registration, upsert (F2)
- M1-T6 — Build ping data ingest endpoint with validation and dedup (F3)
- M1-T7 — Implement monitors list API with client join and latest state (F5)
- M1-T8 — Build monitor history API with aggregation and time windows (F6)
- M1-T9 — Create WebSocket live broadcast with subscription management (F7)
- M1-T10 — Implement backend quality classifier with post-ingest trigger (F12)
- M1-T11 — Add data retention cleanup background task (F10)
- M1-T12 — Implement rate limiting middleware (F13)

## Dependencies

- **Blocks:** M2 — Dashboard UI
- **Requires:** None
