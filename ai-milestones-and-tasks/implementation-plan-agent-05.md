---
title: LNPM - Agent 05 - Implementation Plan (Updated)
---

# LNPM Cloud Dashboard — Implementation Plan

## Purpose

Concrete, ordered implementation plan for the LNPM Cloud Dashboard. Every file and function is named. This plan is the definitive reference for Agent 07 (Implementation) and Agent 06 (Audit & Present).

## Scope

Covers the full MVP (F1-F9) plus enhancement features (F10-F14) within the `dashboard/` subdirectory. No source files outside `dashboard/` are modified.

## Current Status

**Phase 1 (M1-T1) is COMPLETE** — implemented and verified by Agents 07-10. See `memory/agent-05-implementation-plan.md` for the definitive updated plan with remaining work (73 files to create, 8 to modify, 10 phases).

---

## Implementation Sequence

### Phase 1: Project Foundation (F1)

**Goal:** Server starts, health check responds, database initializes on first access.

#### 1.1 — Schema: Database Migrations

Create the SQL migration files and master schema file.

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `dashboard/schema/migrations/001_create_clients.sql` | Create | CREATE TABLE clients + IF NOT EXISTS guard |
| 2 | `dashboard/schema/migrations/002_create_monitors.sql` | Create | CREATE TABLE monitors + FK to clients |
| 3 | `dashboard/schema/migrations/003_create_ping_samples.sql` | Create | CREATE TABLE ping_samples + dedup unique index |
| 4 | `dashboard/schema/migrations/004_create_minute_rollups.sql` | Create | CREATE TABLE minute_rollups + FK to monitors |
| 5 | `dashboard/schema/migrations/005_create_indexes.sql` | Create | All performance indexes (8 indexes across 4 tables) |
| 6 | `dashboard/schema/index.sql` | Create | Master schema file assembled from all migrations (for reference) |

#### 1.2 — Server: Database Plugin and Utility

| # | File | Action | Description |
|---|------|--------|-------------|
| 7 | `dashboard/server/utils/db.ts` | Create | `getDb()` — singleton better-sqlite3 connection with WAL mode, PRAGMAs, migration runner, export as Nitro event `useDb()` |
| 8 | `dashboard/server/plugins/database.ts` | Create | Nitro plugin (`nitro.plugins/` pattern) — initializes DB on server start, calls `runMigrations()`, logs connection |

**`server/utils/db.ts` exports:**
- `getDb(): Database` — singleton connection
- `runMigrations(): void` — reads `schema/migrations/*.sql` in order, executes each
- `closeDb(): void` — graceful shutdown

#### 1.3 — Server: Health Endpoint

| # | File | Action | Description |
|---|------|--------|-------------|
| 9 | `dashboard/server/api/health.get.ts` | Create | GET /api/health — returns status, timestamp, uptime, version, db_path, db_size_bytes, monitor_count, sample_count, last_ingest_time |

#### 1.4 — Configuration Updates

| # | File | Action | Description |
|---|------|--------|-------------|
| 10 | `dashboard/nuxt.config.ts` | Modify | Add `uplot` to CSS, ensure `imports.dirs` includes `shared`, add schema directory |
| 11 | `dashboard/package.json` | Modify | Add `uplot` dependency, remove `package-lock.json` (pnpm project) |
| 12 | `dashboard/.gitignore` | Modify | Add `.data/` directory to ignore |

---

### Phase 2: Shared Types

**Goal:** All TypeScript interfaces defined once, auto-imported across server and client.

#### 2.1 — Shared Types File

| # | File | Action | Description |
|---|------|--------|-------------|
| 13 | `dashboard/shared/types.ts` | Create | All shared interfaces — adapted from `src/types.ts` + API-specific types |

**Types to define (from `src/types.ts` + API design):**
- `ProbeStatus`, `QualityState`, `QualityReason`, `QualityThresholds`
- `Target`, `PingSample`, `QualityMetrics`, `LiveTargetStatus`, `DashboardSnapshot`
- `StateTransition`, `QualityTransitionEvent`
- `HistoryPoint`, `QualityIntervalRecord`, `RangeSummary`, `HistorySeries`, `HistoryResponse`
- `IngestPayload`, `PingSampleIngest`, `IngestResponse`, `Rejection`
- `MonitorListItem`, `ClientRecord`, `HealthResponse`
- `SubscribeMessage`, `UnsubscribeMessage`, `SubscribedMessage`, `UnsubscribedMessage`
- `SnapshotMessage`, `SampleMessage`, `ClientNameUpdatedMessage`
- `ErrorMessage` (global error format)

---

### Phase 3: Business Logic Layer

**Goal:** All services, validators, and utilities functional. API routes can call them directly.

#### 3.1 — Validation

| # | File | Action | Description |
|---|------|--------|-------------|
| 14 | `dashboard/server/utils/ping-validation.ts` | Create | `validateSample(sample, index)` — validates per-sample rules (timestamp, latency, status, resolvedAddress, targetHost). Returns `ValidationResult[]` with error codes. |

**Validation rules:**
- `timestampMs` must be positive integer → `INVALID_TIMESTAMP`
- `timestampMs` within 5-min future window → `FUTURE_TIMESTAMP`
- `latencyMs` required for `status === 'success'` → `MISSING_LATENCY`
- `latencyMs` must be positive number → `INVALID_LATENCY`
- `resolvedAddress` required for `status === 'success'` → `MISSING_RESOLVED_ADDRESS`
- `status` must be one of `'success' | 'timeout' | 'error'` → `INVALID_STATUS`
- `targetHost` required and non-empty → `MISSING_TARGET_HOST`

#### 3.2 — Client Utilities

| # | File | Action | Description |
|---|------|--------|-------------|
| 15 | `dashboard/server/utils/client.ts` | Create | `generateSlug(username, hostname, macAddress)` — slug generation. `upsertClient(db, slug, username, hostname, macAddress)` — INSERT OR IGNORE + ON CONFLICT update. `getClientBySlug(db, slug)` — lookup. |

#### 3.3 — Ping Ingest Engine

| # | File | Action | Description |
|---|------|--------|-------------|
| 16 | `dashboard/server/utils/ping-ingest.ts` | Create | `ingestBatch(db, payload)` — core ingest: validates, upserts client, auto-creates monitors, inserts samples via INSERT OR IGNORE, computes rollups, updates monitor state, returns IngestResponse. |

**Ingest flow:**
1. Validate payload structure (clientSlug, samples array)
2. Validate each sample via `ping-validation.ts`
3. Upsert client via `client.ts`
4. For each valid sample, find or create monitor (INSERT OR IGNORE on UNIQUE(client_id, target_host))
5. Insert samples via INSERT OR IGNORE (dedup)
6. Compute minute rollups for affected monitors
7. Update monitor last_seen_ms, last_status, last_latency_ms
8. Return IngestResponse with accepted/duplicate/rejected counts

#### 3.4 — Cache

| # | File | Action | Description |
|---|------|--------|-------------|
| 17 | `dashboard/server/utils/cache.ts` | Create | In-memory LRU cache for monitor state. `LruCache<K,V>` class with max size, get/set/delete, cleanup sweep. Export `monitorCache` singleton. |

#### 3.5 — Quality Classifier

| # | File | Action | Description |
|---|------|--------|-------------|
| 18 | `dashboard/server/utils/quality-classifier.ts` | Create | Sliding-window quality classifier. `classify(samples)` — returns QualityState based on packet loss, avg latency, jitter. `ClassifierState` — per-monitor state with window, consecutive failures/successes. |

**Quality conditions:**
| State | Conditions |
|-------|-----------|
| `warmingUp` | <30s or <5 samples |
| `low` | packetLoss <1%, avgLatency <50ms |
| `medium` | packetLoss <5%, avgLatency <100ms |
| `high` | packetLoss <10%, avgLatency <200ms |
| `veryHigh` | packetLoss <10%, avgLatency ≥200ms |
| `unstable` | packetLoss ≥10% or high jitter |
| `disconnected` | No samples in window |

#### 3.6 — Rate Limiter

| # | File | Action | Description |
|---|------|--------|-------------|
| 19 | `dashboard/server/utils/rate-limiter.ts` | Create | Per-IP rate limiter. `RateLimiter` class with sliding window. `check(ip, windowMs, maxRequests)` → boolean. |
| 20 | `dashboard/server/middleware/rate-limit.ts` | Create | Nitro middleware — applies rate limit to all `/api/**` routes. Returns 429 with `Retry-After` header on exceed. |

---

### Phase 4: API Routes

**Goal:** All REST endpoints functional with proper error handling.

#### 4.1 — Ingest Endpoint (F2, F3)

| # | File | Action | Description |
|---|------|--------|-------------|
| 21 | `dashboard/server/api/ping/ingest.post.ts` | Create | POST /api/ping/ingest — validates payload, calls ingestBatch, returns 201/207/200 with counts. |

#### 4.2 — Monitors List (F5)

| # | File | Action | Description |
|---|------|--------|-------------|
| 22 | `dashboard/server/api/monitors.get.ts` | Create | GET /api/monitors — queries all monitors with client info, ordered by last_seen_ms DESC. Returns MonitorListItem[]. |

#### 4.3 — Monitor History (F6)

| # | File | Action | Description |
|---|------|--------|-------------|
| 23 | `dashboard/server/api/monitors/[id].get.ts` | Create | GET /api/monitors/:id — fetches history with fromMs/toMs/maxPoints params. Aggregates into HistoryResponse format. Auto-scales bucket size. |

**Aggregation logic:**
- Default bucket: 60,000ms (1 minute)
- If bucket count > maxPoints, increase using: `[1000, 5000, 10000, 30000, 60000, 300000, 900000, 1800000, 3600000]`
- Return `bucketMs` in response for frontend to know granularity

#### 4.4 — Client Endpoints (F2, F11)

| # | File | Action | Description |
|---|------|--------|-------------|
| 24 | `dashboard/server/api/clients/[slug].get.ts` | Create | GET /api/clients/:slug — returns ClientRecord or 404 |
| 25 | `dashboard/server/api/clients/[slug]/name.put.ts` | Create | PUT /api/clients/:slug/name — validates name (1-100 chars), updates, broadcasts WS event |

---

### Phase 5: WebSocket Layer (F7)

**Goal:** Real-time ping broadcast with topic-based subscriptions.

#### 5.1 — WebSocket Route

| # | File | Action | Description |
|---|------|--------|-------------|
| 26 | `dashboard/server/ws/ping.ts` | Create | WS /ws/ping — handles subscribe/unsubscribe messages. Maintains Map<monitorId, Set<WebSocket>> for topic subscriptions. On new sample, broadcasts to all subscribers. Sends snapshot on subscribe. |

**WebSocket message handling:**
- `subscribe` → add to topic set, send `subscribed` ack, send `snapshot` with last 100 samples
- `unsubscribe` → remove from topic set, send `unsubscribed` ack
- `client_name_updated` → broadcast to all connections (sent from API routes via helper)

#### 5.2 — WebSocket Helper

| # | File | Action | Description |
|---|------|--------|-------------|
| 27 | `dashboard/server/utils/ws-broadcast.ts` | Create | `broadcastToMonitor(monitorId, message)` — sends to all subscribers of a monitor. `broadcastToAll(message)` — sends to all connections. Used by ingest engine and API routes. |

#### 5.3 — WebSocket Plugin

| # | File | Action | Description |
|---|------|--------|-------------|
| 28 | `dashboard/server/plugins/websocket.ts` | Create | Nitro plugin — configures WebSocket heartbeat interval, max clients, connection cleanup. |

---

### Phase 6: Frontend — CSS and Assets

**Goal:** Design system ported from desktop app, ready for components.

#### 6.1 — Global CSS

| # | File | Action | Description |
|---|------|--------|-------------|
| 29 | `dashboard/app/assets/css/global.css` | Create | Port from `src/styles.css` — all CSS custom properties, base styles, component class definitions. Dark theme only. |

**Key custom properties to port (15+):**
`--bg`, `--panel`, `--panel-raised`, `--panel-soft`, `--line`, `--line-strong`, `--text`, `--muted`, `--muted-strong`, `--accent`, `--accent-bright`, `--accent-soft`, `--blue`, `--warning`, `--warning-soft`, `--danger`, `--danger-soft`, `--radius`, `--shadow`

#### 6.2 — i18n Locale Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 30 | `dashboard/app/assets/i18n/en.json` | Create | Copy from `src/locales/en.json`, add dashboard-specific keys |
| 31 | `dashboard/app/assets/i18n/ko.json` | Create | Copy from `src/locales/ko.json` |
| 32 | `dashboard/app/assets/i18n/ja.json` | Create | Copy from `src/locales/ja.json` |
| 33 | `dashboard/app/assets/i18n/zh-CN.json` | Create | Copy from `src/locales/zh-CN.json` |
| 34 | `dashboard/app/assets/i18n/zh-TW.json` | Create | Copy from `src/locales/zh-TW.json` |

---

### Phase 7: Frontend — Composables

**Goal:** All state management composables functional.

#### 7.1 — Core Composables

| # | File | Action | Description |
|---|------|--------|-------------|
| 35 | `dashboard/app/composables/useMonitors.ts` | Create | Fetch monitors list, manage client groups, handle WS status updates. Exposes: `monitors` (reactive), `selectedMonitorId` (ref), `selectAll()` (method), `refresh()` (method). |
| 36 | `dashboard/app/composables/useMonitorHistory.ts` | Create | Fetch history with fromMs/toMs/maxPoints. Exposes: `history` (ref), `isLoading` (ref), `load()` (method). |
| 37 | `dashboard/app/composables/useWebSocket.ts` | Create | WS connection lifecycle, subscribe/unsubscribe per monitor, auto-reconnect with exponential backoff. Exposes: `connect()`, `disconnect()`, `subscribe(monitorId)`, `onMessage(callback)`. |
| 38 | `dashboard/app/composables/useChartSeries.ts` | Create | Transform HistoryPoint[] into uPlot-ready arrays. Handles multi-series alignment. |

#### 7.2 — Utility Composables

| # | File | Action | Description |
|---|------|--------|-------------|
| 39 | `dashboard/app/composables/useTimeWindow.ts` | Create | Manage selected time range. Exposes: `fromMs`, `toMs`, `followLive`, `setPreset()`, `setCustomRange()`. |
| 40 | `dashboard/app/composables/useDashboardPalette.ts` | Create | Assign colors to monitor series from 12-color palette. Stable by monitor ID. |
| 41 | `dashboard/app/composables/useI18n.ts` | Create | Locale resolution (localStorage → navigator.language → en), translation `t()`, formatting utilities (formatLatency, formatPercent, formatDuration, formatDateTime, formatBytes, formatError). |
| 42 | `dashboard/app/composables/useSidebarWidth.ts` | Create | Persistent sidebar width via CSS custom property + localStorage. Default 320px. |
| 43 | `dashboard/app/composables/useToast.ts` | Create | Global toast notification queue. Exposes: `show(message, kind)`, `toasts` (reactive list). |

---

### Phase 8: Frontend — Components

**Goal:** All UI components functional, mirroring desktop app design.

#### 8.1 — Layout Components

| # | File | Action | Description |
|---|------|--------|-------------|
| 44 | `dashboard/app/components/layout/AppShell.vue` | Create | Top-level layout: header + workspace (sidebar + dashboard panel). Provides MonitorsContext, WebSocketContext, TimeWindowContext, ToastContext. |
| 45 | `dashboard/app/components/layout/AppHeader.vue` | Create | Brand block + header actions (Live indicator, Pause/Resume, Settings button). |
| 46 | `dashboard/app/components/layout/DashboardPanel.vue` | Create | Right-side main content: heading, chart, metrics grid. |

#### 8.2 — Sidebar Components

| # | File | Action | Description |
|---|------|--------|-------------|
| 47 | `dashboard/app/components/sidebars/MonitorSidebar.vue` | Create | Full sidebar with heading, target list, empty state. Uses `<aside>` semantic element. |
| 48 | `dashboard/app/components/sidebars/ClientGroup.vue` | Create | Collapsible client group section. Shows client name, count badge, nested monitor rows. **Cloud-only** — not in desktop app. |
| 49 | `dashboard/app/components/sidebars/MonitorRow.vue` | Create | Single monitor row: status dot, name, host, latest latency, toggle. Matches desktop `.target-row`. |
| 50 | `dashboard/app/components/sidebars/AllMonitorsRow.vue` | Create | "All monitors" combined view entry. Matches desktop `.all-target-row`. |
| 51 | `dashboard/app/components/sidebars/SidebarResizer.vue` | Create | Draggable sidebar width resizer. Matches desktop `.sidebar-resizer`. |

#### 8.3 — Chart Components

| # | File | Action | Description |
|---|------|--------|-------------|
| 52 | `dashboard/app/components/charts/LatencyChart.vue` | Create | Vue 3 wrapper around uPlot. Handles onMounted/onUnmounted lifecycle, ResizeObserver, watch for data changes. |
| 53 | `dashboard/app/components/charts/ChartCard.vue` | Create | Container for chart + loading state + legend. Matches desktop `.chart-card`. |
| 54 | `dashboard/app/components/charts/ChartLegend.vue` | Create | Series legend with toggle buttons. Matches desktop `.chart-legend`. |
| 55 | `dashboard/app/components/charts/ChartTooltip.vue` | Create | Positioned tooltip overlay. Mirrors desktop `.chart-tooltip` behavior. |

#### 8.4 — Metric Components

| # | File | Action | Description |
|---|------|--------|-------------|
| 56 | `dashboard/app/components/metrics/SummaryGrid.vue` | Create | 5-column metric cards grid (Average, P95, Unstable, Disconnected, Packet Loss). Matches desktop `.summary-grid`. |
| 57 | `dashboard/app/components/metrics/MetricCard.vue` | Create | Single metric card: label, value, optional sub-value. Matches desktop `.metric-card`. |
| 58 | `dashboard/app/components/shared/StatePill.vue` | Create | Quality state badge with colored dot. Matches desktop `.state-pill`. |

#### 8.5 — Shared Components

| # | File | Action | Description |
|---|------|--------|-------------|
| 59 | `dashboard/app/components/shared/StatusDot.vue` | Create | Colored circular status indicator. Matches desktop `.status-dot`. |
| 60 | `dashboard/app/components/shared/TimeRangeSelector.vue` | Create | Range button group (Live, 5M, 10M, 30M, 1H, 6H, 12H, 24H, 7D, 30D, Custom). Matches desktop `.range-controls`. |
| 61 | `dashboard/app/components/shared/EmptyState.vue` | Create | Empty state with message. Matches desktop `.empty-targets`. |
| 62 | `dashboard/app/components/shared/ToggleButton.vue` | Create | On/off toggle switch. Matches desktop `.target-toggle`. |
| 63 | `dashboard/app/components/shared/ToastStack.vue` | Create | Toast notification stack. Matches desktop `.toast-stack`. |
| 64 | `dashboard/app/components/shared/IconButton.vue` | Create | Icon-only button. Matches desktop `.button.icon-button`. |
| 65 | `dashboard/app/components/shared/Button.vue` | Create | Generic button with variants (primary, ghost, danger-text). |

#### 8.6 — Modal Components

| # | File | Action | Description |
|---|------|--------|-------------|
| 66 | `dashboard/app/components/modals/ModalBase.vue` | Create | Reusable modal wrapper: backdrop, close button, header/footer. |
| 67 | `dashboard/app/components/modals/ClientNameDialog.vue` | Create | Edit client display name (F11). Calls PUT /api/clients/:slug/name. |
| 68 | `dashboard/app/components/modals/CustomRangeDialog.vue` | Create | Custom date range picker. Matches desktop `#range-dialog`. |

#### 8.7 — Page

| # | File | Action | Description |
|---|------|--------|-------------|
| 69 | `dashboard/app/pages/index.vue` | Modify | Replace placeholder with AppShell component |
| 70 | `dashboard/app.vue` | Modify | Update to use dark theme CSS, import global.css |

---

### Phase 9: Tests

**Goal:** Verify all layers work correctly. Write tests as you go, not all at the end.

#### 9.1 — Unit Tests

| # | File | Action | Description |
|---|------|--------|-------------|
| 71 | `dashboard/server/utils/__tests__/ping-validation.test.ts` | Create | Test all validation rules (7 rules), edge cases |
| 72 | `dashboard/server/utils/__tests__/client.test.ts` | Create | Test slug generation, upsert, lookup |
| 73 | `dashboard/server/utils/__tests__/quality-classifier.test.ts` | Create | Test all quality states, sliding window |
| 74 | `dashboard/server/utils/__tests__/cache.test.ts` | Create | Test LRU eviction, cleanup sweep |
| 75 | `dashboard/server/utils/__tests__/rate-limiter.test.ts` | Create | Test window sliding, max requests |

#### 9.2 — Integration Tests

| # | File | Action | Description |
|---|------|--------|-------------|
| 76 | `dashboard/__tests__/api/health.test.ts` | Create | Test health endpoint returns expected fields |
| 77 | `dashboard/__tests__/api/ingest.test.ts` | Create | Test batch ingest, dedup, validation errors |
| 78 | `dashboard/__tests__/api/monitors.test.ts` | Create | Test monitors list, history, client endpoints |

---

## File Inventory Summary

### Files to Create: 78

| Layer | Count | Files |
|-------|-------|-------|
| Schema | 6 | 5 migrations + index.sql |
| Server Utils | 8 | db.ts, ping-validation.ts, client.ts, ping-ingest.ts, cache.ts, quality-classifier.ts, rate-limiter.ts, ws-broadcast.ts |
| Server Plugins | 2 | database.ts, websocket.ts |
| Server Middleware | 1 | rate-limit.ts |
| API Routes | 5 | health.get.ts, ping/ingest.post.ts, monitors.get.ts, monitors/[id].get.ts, clients/[slug].get.ts, clients/[slug]/name.put.ts |
| WebSocket | 1 | ws/ping.ts |
| Shared Types | 1 | shared/types.ts |
| CSS/Assets | 6 | global.css + 5 locale files |
| Composables | 9 | useMonitors, useMonitorHistory, useWebSocket, useChartSeries, useTimeWindow, useDashboardPalette, useI18n, useSidebarWidth, useToast |
| Layout Components | 3 | AppShell, AppHeader, DashboardPanel |
| Sidebar Components | 5 | MonitorSidebar, ClientGroup, MonitorRow, AllMonitorsRow, SidebarResizer |
| Chart Components | 4 | LatencyChart, ChartCard, ChartLegend, ChartTooltip |
| Metric Components | 3 | SummaryGrid, MetricCard, StatePill |
| Shared Components | 7 | StatusDot, TimeRangeSelector, EmptyState, ToggleButton, ToastStack, IconButton, Button |
| Modal Components | 3 | ModalBase, ClientNameDialog, CustomRangeDialog |
| Tests | 8 | 5 unit + 3 integration |

### Files to Modify: 6

| File | Layer | Change |
|------|-------|--------|
| `dashboard/nuxt.config.ts` | Config | Add CSS import, uplot dependency config |
| `dashboard/package.json` | Config | Add `uplot` dependency |
| `dashboard/.gitignore` | Config | Add `.data/` directory |
| `dashboard/app.vue` | Frontend | Dark theme CSS, global import |
| `dashboard/app/pages/index.vue` | Frontend | Replace with AppShell |
| `dashboard/schema/index.sql` | Schema | Assemble from migrations |

---

## Dependency Graph

```
Phase 1 (Foundation)
  ├── 1.1 Schema migrations (parallel)
  ├── 1.2 Database plugin + utility
  ├── 1.3 Health endpoint (depends on 1.2)
  └── 1.4 Configuration updates (parallel)

Phase 2 (Shared Types) — depends on Phase 1
  └── 2.1 shared/types.ts

Phase 3 (Business Logic) — depends on Phase 2
  ├── 3.1 Validation (parallel)
  ├── 3.2 Client utilities (parallel)
  ├── 3.3 Ingest engine (depends on 3.1, 3.2)
  ├── 3.4 Cache (parallel)
  ├── 3.5 Quality classifier (parallel)
  └── 3.6 Rate limiter (parallel)

Phase 4 (API Routes) — depends on Phase 3
  ├── 4.1 Ingest (depends on 3.3)
  ├── 4.2 Monitors list (parallel)
  ├── 4.3 Monitor history (parallel)
  └── 4.4 Client endpoints (parallel)

Phase 5 (WebSocket) — depends on Phase 4
  ├── 5.1 WS route
  ├── 5.2 WS broadcast helper
  └── 5.3 WS plugin

Phase 6 (Frontend CSS/Assets) — independent, can run in parallel with Phase 4-5
  ├── 6.1 Global CSS
  └── 6.2 Locale files

Phase 7 (Composables) — depends on Phase 2 + Phase 6
  ├── 7.1 Core composables
  └── 7.2 Utility composables

Phase 8 (Components) — depends on Phase 7
  ├── 8.1 Layout (depends on 7.1)
  ├── 8.2 Sidebar (depends on 8.1)
  ├── 8.3 Chart (depends on 7.1)
  ├── 8.4 Metrics (depends on 7.1)
  ├── 8.5 Shared (parallel)
  ├── 8.6 Modals (parallel)
  └── 8.7 Page (depends on all)

Phase 9 (Tests) — runs alongside implementation, not after
  ├── 9.1 Unit tests (with Phase 3)
  └── 9.2 Integration tests (with Phase 4)
```

### Parallelizable Work

- **Phase 1:** Schema migrations (1.1) and configuration (1.4) can run in parallel
- **Phase 3:** Validation (3.1), client utils (3.2), cache (3.4), quality classifier (3.5), rate limiter (3.6) are independent
- **Phase 4:** All API routes can be written once Phase 3 is complete
- **Phase 6:** Frontend CSS/Assets is independent of backend — can start immediately
- **Phase 8:** Shared components (8.5) and modals (8.6) can be written in parallel

### Critical Path

```
1.1 Schema → 1.2 Database → 2.1 Types → 3.1 Validation → 3.2 Client → 3.3 Ingest → 4.1 Ingest API → 5.1 WebSocket → 7.1 Composables → 8.1 Layout → 8.3 Chart → 8.7 Page
```

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **better-sqlite3 native build fails** | High | Ensure `node-gyp` dependencies are available. Use `pnpm rebuild` after install. |
| **Nuxt 4 WebSocket API differs from Nuxt 3** | Medium | Nitro v2 WebSocket support is stable. Test early in Phase 5. |
| **uPlot Canvas lifecycle in SSR** | Medium | uPlot only runs client-side. Use `client-only` wrapper or `onMounted` guard. |
| **TypeScript strict mode conflicts** | Low | `nuxt.config.ts` already sets `strict: true`. Fix issues incrementally. |
| **Large package.json for uPlot** | Low | uPlot is ~40KB gzipped. Already in desktop deps. |
| **Migration ordering errors** | Medium | Use `IF NOT EXISTS` guards. Number migrations sequentially. |
| **Database file permissions** | Low | Create `.data/` directory in DB plugin with `fs.mkdirSync`. |

---

## Complexity: High

**Rationale:** This is a full-stack application with 78+ files across 10 layers. The backend (SQLite + WebSocket + real-time broadcast) and frontend (uPlot + 25 Vue components + 9 composables) are both substantial. The dependency chain is deep but well-structured.

## Plan saved to memory: ✅

## Next agent: Agent 06 (Audit & Present Plan)

---

## Gate Checklist

- [x] Planning skills invoked (sequential-thinking approach used)
- [x] Prior agent outputs reviewed (Agent 02 scope, Agent 03 code analysis, Agent 04 UI/UX plan)
- [x] Implementation sequence complete and ordered (9 phases, 78 files)
- [x] File inventory documented (78 create, 6 modify)
- [x] Dependencies mapped (dependency graph with parallelizable items)
- [x] Risks assessed (7 risks with mitigation)
- [x] Plan saved to memory
