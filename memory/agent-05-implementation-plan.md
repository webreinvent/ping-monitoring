---
name: agent-05-implementation-plan
description: Agent 05 comprehensive implementation plan for LNPM Cloud Dashboard — M2-T2 and full project
metadata:
  type: project
  task: M2-T2
  hook: Implementation plan for M2-T2 monitors list composable and sidebar components
---

## Agent 05: Implementation Plan — M2-T2 Monitors List + Sidebar

### Status: COMPLETE — M2-T2 is fully implemented; all 19 project tasks are done

### Skills Invoked
- ui-ux-pro-max — Monitoring dashboard design patterns (Real-Time / Operations Landing pattern, dark mode, density 8/10)
- brainstorming — Not available in session; approached via agent analysis
- sequential-thinking — Not available as MCP server; decomposed via structured analysis
- nuxt — Not available as skill; referenced from nuxt.config.ts and ADRs

### Key Finding: M2-T2 is Already Complete

All acceptance criteria for M2-T2 are satisfied:
- [x] `useMonitors` fetches and groups monitors by client
- [x] Sidebar renders client groups with monitors
- [x] Client groups are collapsible
- [x] MonitorRow shows status dot, name, and toggle
- [x] Clicking monitor navigates to detail view
- [x] Status dot colors match spec (green/yellow/red/gray via CSS classes)
- [x] Toggle shows/hides monitor in all-monitors chart

### Implementation Sequence (10 Phases, Actual Completion Order)

| Phase | Task(s) | Files | Status |
|-------|---------|-------|--------|
| 1 | M1-T1: Nuxt 4 + Nitro setup | nuxt.config.ts, package.json | ✅ |
| 2 | M1-T2: Database plugin | server/plugins/database.ts, server/utils/db.ts | ✅ |
| 3 | M1-T3: Schema migrations | schema/migrations/*.sql | ✅ (6 migrations) |
| 4 | M1-T5: Client identity | server/utils/client.ts | ✅ |
| 5 | M1-T6: Ping ingest | server/utils/ping-ingest.ts, ping-validation.ts | ✅ |
| 6 | M1-T7: Monitors list API | server/api/monitors.get.ts, server/utils/monitors.ts | ✅ |
| 7 | M1-T8: History API | server/api/monitors/[id].get.ts, server/utils/history.ts | ✅ |
| 8 | M1-T9: WebSocket | server/ws/ping.ts | ✅ |
| 9 | M1-T10: Quality classifier | server/utils/quality-classifier.ts, quality-states.ts | ✅ |
| 10 | M1-T4: Health check | server/api/health.get.ts | ✅ |
| 11 | M1-T11: Retention | server/plugins/retention.ts, server/utils/retention.ts | ✅ |
| 12 | M1-T12: Rate limiting | server/middleware/rate-limit.ts, server/utils/rate-limiter.ts | ✅ |
| 13 | M2-T1: Dashboard shell | app/layouts/default.vue, app.vue | ✅ |
| 14 | M2-T2: Monitors + Sidebar (THIS TASK) | useMonitors.ts, DashboardSidebar.vue, ClientGroup.vue, MonitorRow.vue, StatusDot.vue | ✅ |
| 15 | M2-T3: All-monitors chart | AllMonitorsChart.vue, LatencyChart.vue | ✅ |
| 16 | M2-T4: Monitor detail view | MonitorHeader.vue, MonitorSummary.vue | ✅ |
| 17 | M2-T5: WebSocket live | useWebSocket.ts | ✅ |
| 18 | M2-T6: Client settings | ClientInfo.vue, SyncSettingsForm.vue | ✅ |
| 19 | M2-T7: Client name editing | ClientGroup.vue inline edit | ✅ |

### M2-T2 File Inventory

**Core files for M2-T2:**
| File | Purpose |
|------|---------|
| `dashboard/shared/types.ts` | MonitorListItem, MonitorsListResponse, QualityState |
| `dashboard/server/api/monitors.get.ts` | GET /api/monitors endpoint |
| `dashboard/server/utils/monitors.ts` | getAllMonitorsWithLatestState() |
| `dashboard/server/utils/quality-states.ts` | Quality state color mappings |
| `dashboard/server/utils/ping-types.ts` | Ingest payload types |
| `dashboard/app/composables/useMonitors.ts` | Fetch + group + toggle with localStorage |
| `dashboard/app/composables/useResponsiveSidebar.ts` | Mobile/desktop sidebar state |
| `dashboard/app/components/DashboardSidebar.vue` | Responsive sidebar wrapper |
| `dashboard/app/components/shared/SidebarContent.vue` | Client groups renderer |
| `dashboard/app/components/sidebars/ClientGroup.vue` | Collapsible group with inline edit |
| `dashboard/app/components/sidebars/MonitorRow.vue` | Monitor row with NuxtLink, StatusDot, toggle |
| `dashboard/app/components/shared/StatusDot.vue` | Quality state color indicator |
| `dashboard/app/assets/css/dashboard.css` | Sidebar, status dot, responsive CSS |

### Dependency Graph

```
M1-T1 ──→ M1-T2 ──→ M1-T3 ──→ M1-T5 ──→ M1-T6 ──→ M1-T7 ──→ M2-T7
  │           │                                    │         │
  │           │                                    │         └── M2-T2 ──→ M2-T3
  │           │                                    │              │
  │           │                                    │              ├── M2-T4
  │           │                                    │              │
  │           │                                    ├── M1-T8 ──────┘
  │           │                                    │
  │           │                           M1-T9 ──→ M2-T5
  │           │
  ├── M1-T4  │
  └── M1-T12 │
             │
             ├── M1-T10 (quality) ──→ M2-T2
             └── M1-T11 (retention)
```

**Parallelizable work:**
- M1-T4, M1-T12, M2-T1 can run in parallel after M1-T1
- M1-T10, M1-T11 can run in parallel after M1-T6
- M2-T3, M2-T4, M2-T6 can run in parallel after M2-T2 + M1-T8

### Risk Assessment

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| Type divergence (desktop vs dashboard) | Medium | history.ts transforms cloud data to HistoryResponse | ✅ Resolved |
| WebSocket reconnection | Medium | Exponential backoff in useWebSocket | ✅ Implemented |
| SQLite concurrency | Low | WAL mode + better-sqlite3 sync API | ✅ Mitigated |
| Chart performance | Low | uPlot canvas handles 1000s of points | ✅ |
| i18n not implemented | Low | Deferred, desktop i18n.ts available | Noted |
| LRU cache not implemented | Low | ADR-003 defined | Noted |

### Complexity: Medium

### Next agent: Agent 06 (Audit & Present Plan)
