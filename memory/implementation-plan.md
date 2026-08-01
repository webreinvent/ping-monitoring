---
name: implementation-plan
description: Complete implementation plan for LNPM Cloud Dashboard — 9 phases, 78 files to create, 6 to modify
metadata:
  type: project
  hook: Agent 05 implementation plan — file-by-file tasks, dependency order, and acceptance criteria
---

## Implementation Plan Summary

**9 Phases, 78 files to create, 6 to modify.**

### Phase breakdown:
1. **Project Foundation** (F1) — Schema migrations, database plugin, health endpoint, config updates
2. **Shared Types** — All TypeScript interfaces in `shared/types.ts`
3. **Business Logic** — Validation, client utils, ingest engine, cache, quality classifier, rate limiter
4. **API Routes** — Health, ingest, monitors, history, client endpoints
5. **WebSocket** — Real-time ping broadcast with topic subscriptions
6. **Frontend CSS/Assets** — Global CSS port from desktop, 5 locale files
7. **Composables** — 9 Vue 3 composables (useMonitors, useWebSocket, useChartSeries, etc.)
8. **Components** — 25 Vue components (layout, sidebar, chart, metrics, shared, modal)
9. **Tests** — 5 unit tests + 3 integration tests

### Critical Path:
Schema → Database → Types → Validation → Client → Ingest → API → WebSocket → Composables → Components → Page

### Key Dependencies:
- `better-sqlite3` (native module — may need rebuild)
- `uplot` (canvas-based charting — client-side only)
- Nitro native WebSocket (no Socket.io)

**Related:** [[ui-ux-design-decisions]], [[lnpm-cloud-dashboard-requirements]], [[lnpm-milestones-plan]]
