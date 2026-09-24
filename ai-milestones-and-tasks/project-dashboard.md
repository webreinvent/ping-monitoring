---
type: project-dashboard
version: "1.0"
project: "LNPM Cloud Dashboard"
lastUpdated: "2026-09-25"
---

# LNPM Cloud Dashboard — Project Dashboard

## Milestones

| ID | Title | Status | Priority | Estimated Effort | Tasks Complete | Dependencies |
|----|-------|--------|----------|-----------------|----------------|--------------|
| M1 | [Backend Platform](./milestone-01-backend-platform/README.md) | 🟢 Complete | Critical | 12-15 days | 11/12 | None |
| M2 | [Dashboard UI](./milestone-02-dashboard-ui/README.md) | 🟢 Complete | High | 5-7 days | 9/9 | M1 |
| M3 | [Tauri Client Enhancement](./milestone-03-tauri-client-enhancement/README.md) | ⚪ Not Started | High | 6-9 days | 0/2 | M1, M2 (complete) |

## Tasks

| ID | Title | Status | Priority | Estimated Effort | Milestone | Dependencies |
|----|-------|--------|----------|-----------------|-----------|--------------|
| M1-T1 | Setup Nuxt 4 + Nitro project with persistent runtime | 🟢 Complete | Critical | 2-3 hours | M1 | None |
| M1-T2 | Create SQLite database plugin with WAL mode and migration runner | 🟢 Complete | Critical | 2-3 hours | M1 | M1-T1 |
| M1-T3 | Implement all database schema migrations | 🟢 Complete | Critical | 2-3 hours | M1 | M1-T2 |
| M1-T4 | Build health check endpoint with server metrics | 🟢 Complete | Critical | 1-2 hours | M1 | M1-T1, M1-T2 |
| M1-T5 | Implement client identity: slug generation, registration, upsert | 🟢 Complete | Critical | 3-4 hours | M1 | M1-T3 |
| M1-T6 | Build ping data ingest endpoint with validation and dedup | 🟢 Complete | Critical | 4-6 hours | M1 | M1-T3, M1-T5 |
| M1-T7 | Implement monitors list API with client join and latest state | 🟢 Complete | Critical | 2-3 hours | M1 | M1-T6 |
| M1-T8 | Build monitor history API with aggregation and time windows | 🟢 Complete | Critical | 4-6 hours | M1 | M1-T6, M1-T7 |
| M1-T9 | Create WebSocket live broadcast with subscription management | 🟢 Complete | High | 4-6 hours | M1 | M1-T6, M1-T8 |
| M1-T10 | Implement backend quality classifier with post-ingest trigger | 🟢 Complete | High | 3-4 hours | M1 | M1-T6 |
| M1-T11 | Add data retention cleanup background task | Not Started | Medium | 2-3 hours | M1 | M1-T6 |
| M1-T12 | Implement rate limiting middleware | 🟢 Complete | Medium | 1-2 hours | M1 | M1-T1 |
| M2-T1 | Build dashboard shell with layout, sidebar structure, and routing | 🟢 Complete | Critical | 2-3 hours | M2 | M1 |
| M2-T2 | Create monitors list composable and sidebar components | 🟢 Complete | Critical | 3-4 hours | M2 | M2-T1 |
| M2-T3 | Implement all-monitors combined uPlot chart | 🟢 Complete | Critical | 4-6 hours | M2 | M2-T2, M1-T8 |
| M2-T4 | Build per-monitor detail view with chart and metrics | 🟢 Complete | Critical | 3-4 hours | M2 | M2-T2, M1-T8 |
| M2-T5 | Implement WebSocket composable with live chart updates | 🟢 Complete | High | 3-4 hours | M2 | M2-T3, M1-T9 |
| M2-T6 | Add client settings page with sync controls and status indicator | 🟢 Complete | High | 3-4 hours | M2 | M2-T2, M1-T5 |
| M2-T7 | Implement inline client name editing with WebSocket broadcast | 🟢 Complete | Medium | 1-2 hours | M2 | M2-T2, M1-T5, M2-T5 |
| M2-T8 | Display Nitro API endpoint in dashboard header for Tauri client setup | 🟢 Complete | Medium | 2-3 hours | M2 | M2-T1, M1-T6 |
| M2-T9 | Add dashboard ingest endpoint with sync icon and pause toggle | 🟢 Complete | High | 6-10 hours | M2 | M1 |
| M3-T1 | Match Tauri uPlot chart with dashboard chart (palette, line-only, thresholds, quality bands) | ⚪ Not Started | High | 4-6 hours | M3 | None |
| M3-T2 | Fix Tauri slug generation to match dashboard 10-hex-char MAC algorithm | ⚪ Not Started | High | 2-3 hours | M3 | None |

## Features Coverage

| ID | Feature | Phase | Priority | Milestone | Tasks |
|----|---------|-------|----------|-----------|-------|
| F1 | Backend project setup | MVP | Critical | M1 | M1-T1, M1-T2 |
| F2 | Client registration & identity | MVP | Critical | M1 | M1-T5 |
| F3 | Ping data ingest endpoint | MVP | Critical | M1 | M1-T6 |
| F4 | LNPM client sync service | MVP | Critical | M2 | M2-T9 |
| F5 | Monitors list API | MVP | Critical | M1 | M1-T7 |
| F6 | Monitor history API | MVP | Critical | M1 | M1-T8 |
| F7 | WebSocket live broadcast | MVP | High | M1 | M1-T9 |
| F8 | Web dashboard UI | MVP | High | M2 | M2-T1, M2-T2, M2-T3, M2-T4, M2-T5, M2-T8 |
| F9 | Client settings UI | MVP | High | M2 | M2-T6 |
| F10 | Data retention cleanup | Enhancement | Medium | M1 | M1-T11 |
| F11 | Dashboard client name editing | Enhancement | Medium | M2 | M2-T7 |
| F12 | Backend quality classifier | Enhancement | Medium | M1 | M1-T10 |
| F13 | Rate limiting | Enhancement | Medium | M1 | M1-T12 |
| F14 | Health check endpoint | Growth | Low | M1 | M1-T4 |

## Progress

- **Overall:** 20/23 tasks complete (87%)
- **M1 Backend Platform:** 11/12 tasks complete (92%)
- **M2 Dashboard UI:** 9/9 tasks complete (100%)
- **M3 Tauri Client Enhancement:** 0/2 tasks complete (0%)
- **Total Estimated Effort:** 23-31 days

## Execution Order

```
M1-T1 -> M1-T2 -> M1-T3 -> M1-T4
                          |
                          v
                     M1-T5 -> M1-T6 -> M1-T7 -> M1-T8
                          |       |        |       |
                          v       v        v       v
                        (F2)   M1-T9   M1-T7   M1-T8
                                 |
M1-T6 -> M1-T10 (quality)       v
M1-T6 -> M1-T11 (retention)  M1-T9 (WS)
M1-T1 -> M1-T12 (rate limit)

After M1 complete:

M2-T1 -> M2-T2 -> M2-T3 (all-monitors chart)
                  |        |
                  v        v
                 M2-T4 (detail)
                 M2-T5 (WS live) <- M1-T9
                 M2-T6 (settings)
                 M2-T7 (name edit)
                 M2-T8 (header API endpoint)
                 M2-T9 (dashboard ingest endpoint + sync icon + pause) <- M1

After M2 complete (Tauri client side, independent):

M3-T1 (chart match)  M3-T2 (slug fix)
```