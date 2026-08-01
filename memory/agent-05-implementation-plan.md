---
name: agent-05-implementation-plan
description: Complete implementation plan for LNPM Cloud Dashboard — 9 phases, current status tracked (M1-T1 complete, 8 phases remaining)
metadata:
  type: project
  hook: Agent 05 implementation plan — authoritative reference for remaining dashboard work
---

## LNPM Cloud Dashboard — Implementation Plan

**Status:** Phase 1 complete (M1-T1 done). Phases 2-9 remaining.

**Scope:** Full MVP (F1-F9) + Enhancement (F10-F14) within `dashboard/` subdirectory.

**Model:** Sequential-thinking approach used — layer-by-layer decomposition from foundation (schema) through business logic, API, WebSocket, frontend assets, composables, components, and tests.

---

### Current State (M1-T1 Complete)

Already implemented and verified by Agents 07-10:

| Component | File | Status |
|-----------|------|--------|
| Nuxt 4 config (node-server preset) | `dashboard/nuxt.config.ts` | ✅ Done |
| TypeScript strict mode | `dashboard/tsconfig.json` | ✅ Done |
| Package.json with deps | `dashboard/package.json` | ✅ Done |
| Environment variables | `dashboard/.env.example` | ✅ Done (all 14 vars) |
| Database plugin (WAL mode, migrations runner) | `dashboard/server/plugins/database.ts` | ✅ Done |
| DB helper utility | `dashboard/server/utils/db.ts` | ✅ Done |
| Structured logger | `dashboard/server/utils/logger.ts` | ✅ Done |
| Health endpoint | `dashboard/server/api/health.get.ts` | ✅ Done |
| WebSocket stub | `dashboard/server/ws/ping.ts` | ✅ Done |
| Schema placeholder | `dashboard/schema/index.sql` | ✅ Done |
| Migration tracking | `dashboard/schema/migrations/001_initial_setup.sql` | ✅ Done |
| Shared types | `dashboard/shared/types.ts` | ✅ Done (baseline) |
| Minimal app shell | `dashboard/app.vue` | ✅ Done |
| Placeholder page | `dashboard/app/pages/index.vue` | ✅ Done |
| Default layout | `dashboard/app/layouts/default.vue` | ✅ Done |
| Test infrastructure | `dashboard/vitest.config.ts`, `dashboard/test/` | ✅ Done |
| Unit tests (4 files, 31 tests) | `server/**/*.test.ts` | ✅ Done |
| Playwright E2E config | `dashboard/playwright.config.ts` | ✅ Done |
| E2E tests (4 files) | `tests/e2e/*.spec.ts` | ✅ Done |

**Verification results:**
- Typecheck: ✅ Pass (0 errors)
- Dev server: ✅ Starts on port 3000
- Health endpoint: ✅ Returns `{ status: "ok", database: "ok" }`
- Persistent runtime: ✅ node-server preset configured
- UAT: ✅ 38/38 criteria passed
- Code review: ✅ 4 issues found and fixed

---

## Remaining Implementation Sequence

### Phase 2: Schema Migrations

**Goal:** Database tables ready for data ingestion.

**Feature mapping:** F2 (client-identity), F3 (ping-ingest), F5 (monitors-list), F6 (monitor-history)

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `dashboard/schema/migrations/002_create_clients.sql` | Create | CREATE TABLE clients (id INTEGER PK, slug TEXT UNIQUE, name TEXT, username TEXT, hostname TEXT, mac_address TEXT, created_at, updated_at) + IF NOT EXISTS |
| 2 | `dashboard/schema/migrations/003_create_monitors.sql` | Create | CREATE TABLE monitors (id INTEGER PK, client_id INTEGER FK→clients, target_host TEXT, target_name TEXT, last_seen_ms, last_status, last_latency_ms, created_at, updated_at) + IF NOT EXISTS |
| 3 | `dashboard/schema/migrations/004_create_ping_samples.sql` | Create | CREATE TABLE ping_samples (id INTEGER PK, monitor_id INTEGER FK→monitors, timestamp_ms INTEGER, latency_ms REAL, status TEXT, resolved_address TEXT, error TEXT) + UNIQUE INDEX on (monitor_id, timestamp_ms, resolved_address) for dedup |
| 4 | `dashboard/schema/migrations/005_create_minute_rollups.sql` | Create | CREATE TABLE minute_rollups (id INTEGER PK, monitor_id INTEGER FK→monitors, minute_ms INTEGER, sample_count INTEGER, avg_latency_ms REAL, min_latency_ms REAL, max_latency_ms REAL, p95_latency_ms REAL, packet_loss_pct REAL) + UNIQUE on (monitor_id, minute_ms) |
| 5 | `dashboard/schema/migrations/006_create_indexes.sql` | Create | 8 performance indexes: idx_ping_samples_timestamp, idx_ping_samples_monitor, idx_monitors_client, idx_monitors_last_seen, idx_monitors_target, idx_rollups_monitor_minute, idx_rollups_monitor_time, idx_clients_slug |
| 6 | `dashboard/schema/index.sql` | Modify | Assemble full schema from all migrations for reference |

---

### Phase 3: Shared Types (Expand)

**Goal:** All TypeScript interfaces defined, covering ingest, history, and WebSocket protocols.

| # | File | Action | Description |
|---|------|--------|-------------|
| 7 | `dashboard/shared/types.ts` | Modify | Add: IngestPayload, PingSampleIngest, IngestResponse, Rejection, MonitorListItem, ClientRecord, HistoryResponse, HistorySeries, HistoryPoint, QualityIntervalRecord, RangeSummary, Target, QualityState ('warmingUp'\|'low'\|'medium'\|'high'\|'veryHigh'\|'unstable'\|'disconnected'), QualityReason, SubscribeMessage, UnsubscribeMessage, SnapshotMessage, SampleMessage, SubscribedMessage, UnsubscribedMessage, ClientNameUpdatedMessage, ErrorMessage |

**Current types (already present):** ClientIdentity, PingSample, Monitor, QualityClass, WsMessageType, WsMessage, HealthResponse, HealthErrorResponse, IngestRequest, IngestResponse

---

### Phase 4: Business Logic Layer

**Goal:** All services, validators, and utilities functional.

| # | File | Action | Description |
|---|------|--------|-------------|
| 8 | `dashboard/server/utils/ping-validation.ts` | Create | `validateSample(sample, index): ValidationResult[]` — 7 validation rules (INVALID_TIMESTAMP, FUTURE_TIMESTAMP, MISSING_LATENCY, INVALID_LATENCY, MISSING_RESOLVED_ADDRESS, INVALID_STATUS, MISSING_TARGET_HOST) |
| 9 | `dashboard/server/utils/client.ts` | Create | `generateSlug(username, hostname, macAddress)`, `upsertClient(db, slug, ...)`, `getClientBySlug(db, slug)` |
| 10 | `dashboard/server/utils/ping-ingest.ts` | Create | `ingestBatch(db, payload): IngestResponse` — validates, upserts client, auto-creates monitors, INSERT OR IGNORE, computes rollups, transactional |
| 11 | `dashboard/server/utils/cache.ts` | Create | `LruCache<K,V>` class + `monitorCache` singleton (max 10k entries from LRU_CACHE_MAX env) |
| 12 | `dashboard/server/utils/quality-classifier.ts` | Create | `classify(samples): QualityState` — sliding-window classifier with 7 states (warmingUp, low, medium, high, veryHigh, unstable, disconnected) |
| 13 | `dashboard/server/utils/rate-limiter.ts` | Create | `RateLimiter` class — per-IP sliding window, configurable windowMs/maxRequests |
| 14 | `dashboard/server/middleware/rate-limit.ts` | Create | Nitro middleware — 429 + Retry-After header on exceed |

---

### Phase 5: API Routes

**Goal:** All REST endpoints functional with proper error handling.

| # | File | Action | Description |
|---|------|--------|-------------|
| 15 | `dashboard/server/api/ping/ingest.post.ts` | Create | POST /api/ping/ingest — validates payload, calls ingestBatch, returns 201/207/200. Client-level errors: 401 (unknown client), 400 (empty batch), 413 (oversized) |
| 16 | `dashboard/server/api/monitors.get.ts` | Create | GET /api/monitors — all monitors with client info, ordered by last_seen_ms DESC, returns MonitorListItem[] |
| 17 | `dashboard/server/api/monitors/[id].get.ts` | Create | GET /api/monitors/:id — history with fromMs/toMs/maxPoints params, auto-scales bucket, returns HistoryResponse |
| 18 | `dashboard/server/api/clients/[slug].get.ts` | Create | GET /api/clients/:slug — returns ClientRecord or 404 |
| 19 | `dashboard/server/api/clients/[slug]/name.put.ts` | Create | PUT /api/clients/:slug/name — validates name (1-100 chars), updates, broadcasts WS event |

---

### Phase 6: WebSocket Layer (Expand)

**Goal:** Real-time ping broadcast with topic subscriptions.

| # | File | Action | Description |
|---|------|--------|-------------|
| 20 | `dashboard/server/ws/ping.ts` | Modify | Full WS handler: subscribe/unsubscribe, Map\<monitorId, Set\<peer\>\> for topic subscriptions, snapshot on subscribe (last 100 samples), broadcast on new sample |
| 21 | `dashboard/server/utils/ws-broadcast.ts` | Create | `broadcastToMonitor(monitorId, message)`, `broadcastToAll(message)` — used by ingest engine and API routes |
| 22 | `dashboard/server/plugins/websocket.ts` | Create | WS config: heartbeat (WS_HEARTBEAT_INTERVAL_MS), max clients (WS_MAX_CLIENTS), connection cleanup |

---

### Phase 7: Frontend — CSS and Assets

**Goal:** Design system ported from desktop app, ready for components.

**Note:** This phase is independent of Phases 4-6 and can run in parallel.

| # | File | Action | Description |
|---|------|--------|-------------|
| 23 | `dashboard/app/assets/css/global.css` | Create | Port from `src/styles.css` — 15+ CSS custom properties, base styles, all component class definitions from desktop app |
| 24 | `dashboard/app/assets/css/uplot.css` | Create | uPlot-specific overrides (tooltip, threshold lines, band rendering) |
| 25 | `dashboard/app/assets/i18n/en.json` | Create | English locale + dashboard-specific keys |
| 26 | `dashboard/app/assets/i18n/ko.json` | Create | Korean locale |
| 27 | `dashboard/app/assets/i18n/ja.json` | Create | Japanese locale |
| 28 | `dashboard/app/assets/i18n/zh-CN.json` | Create | Simplified Chinese locale |
| 29 | `dashboard/app/assets/i18n/zh-TW.json` | Create | Traditional Chinese locale |

---

### Phase 8: Frontend — Composables

**Goal:** All state management composables functional.

| # | File | Action | Description |
|---|------|--------|-------------|
| 30 | `dashboard/app/composables/useMonitors.ts` | Create | Fetch monitors via GET /api/monitors, manage client groups, handle WS status updates. Exposes: `monitors` (reactive), `selectedMonitorId` (ref), `selectAll()`, `refresh()` |
| 31 | `dashboard/app/composables/useMonitorHistory.ts` | Create | Fetch history with fromMs/toMs/maxPoints. Exposes: `history` (ref), `isLoading` (ref), `load()` |
| 32 | `dashboard/app/composables/useWebSocket.ts` | Create | WS lifecycle, subscribe/unsubscribe per monitor, auto-reconnect (1s→2s→4s→8s→16s→30s backoff). Exposes: `connect()`, `disconnect()`, `subscribe(monitorId)`, `onMessage(cb)` |
| 33 | `dashboard/app/composables/useChartSeries.ts` | Create | Transform HistoryPoint[] → uPlot arrays. Handles multi-series alignment. |
| 34 | `dashboard/app/composables/useTimeWindow.ts` | Create | Time range management (Live, 5M, 10M, 30M, 1H, 6H, 12H, 24H, 7D, 30D, Custom). Exposes: `fromMs`, `toMs`, `followLive`, `setPreset()`, `setCustomRange()` |
| 35 | `dashboard/app/composables/useDashboardPalette.ts` | Create | 12-color palette, stable assignment by monitor ID |
| 36 | `dashboard/app/composables/useI18n.ts` | Create | Locale resolution (localStorage → navigator.language → en), t(), formatting utilities |
| 37 | `dashboard/app/composables/useSidebarWidth.ts` | Create | Persistent sidebar width (default 320px) via CSS custom property + localStorage |
| 38 | `dashboard/app/composables/useToast.ts` | Create | Global toast notification queue. Exposes: `show(message, kind)`, `toasts` (reactive) |

---

### Phase 9: Frontend — Components

**Goal:** All UI components functional, mirroring desktop app design.

#### 9.1 — Layout (3 components)

| # | File | Action | Description |
|---|------|--------|-------------|
| 39 | `dashboard/app/components/layout/AppShell.vue` | Create | Header + workspace grid (sidebar \| resizer \| main). Provides MonitorsContext, WebSocketContext, TimeWindowContext, ToastContext |
| 40 | `dashboard/app/components/layout/AppHeader.vue` | Create | Brand block + Live/Pause/Settings actions |
| 41 | `dashboard/app/components/layout/DashboardPanel.vue` | Create | Main content: heading, chart, metrics grid |

#### 9.2 — Sidebar (5 components)

| # | File | Action | Description |
|---|------|--------|-------------|
| 42 | `dashboard/app/components/sidebar/MonitorSidebar.vue` | Create | Full sidebar with client groups, heading, empty state. Uses \`<aside>\` semantic element |
| 43 | `dashboard/app/components/sidebar/ClientGroup.vue` | Create | Collapsible client group section with count badge |
| 44 | `dashboard/app/components/sidebar/MonitorRow.vue` | Create | Single monitor: status dot, name, host, latest latency, toggle |
| 45 | `dashboard/app/components/sidebar/AllMonitorsRow.vue` | Create | "All monitors" combined view entry |
| 46 | `dashboard/app/components/sidebar/SidebarResizer.vue` | Create | Draggable width resizer |

#### 9.3 — Chart (4 components)

| # | File | Action | Description |
|---|------|--------|-------------|
| 47 | `dashboard/app/components/chart/LatencyChart.vue` | Create | uPlot wrapper with onMounted/onUnmounted lifecycle, ResizeObserver, watch for data changes. Client-only rendering |
| 48 | `dashboard/app/components/chart/ChartCard.vue` | Create | Chart container + loading state + legend |
| 49 | `dashboard/app/components/chart/ChartLegend.vue` | Create | Series legend with toggle buttons |
| 50 | `dashboard/app/components/chart/ChartTooltip.vue` | Create | Positioned tooltip overlay |

#### 9.4 — Metrics (3 components)

| # | File | Action | Description |
|---|------|--------|-------------|
| 51 | `dashboard/app/components/metrics/SummaryGrid.vue` | Create | 5-column metric cards (Average, P95, Unstable, Disconnected, Packet Loss) |
| 52 | `dashboard/app/components/metrics/MetricCard.vue` | Create | Single metric card: label, value, sub-value |
| 53 | `dashboard/app/components/metrics/StatePill.vue` | Create | Quality state badge with colored dot |

#### 9.5 — Shared (7 components)

| # | File | Action | Description |
|---|------|--------|-------------|
| 54 | `dashboard/app/components/shared/StatusDot.vue` | Create | Colored status indicator (green/yellow/red/gray) |
| 55 | `dashboard/app/components/shared/TimeRangeSelector.vue` | Create | Range button group (11 presets) |
| 56 | `dashboard/app/components/shared/EmptyState.vue` | Create | Empty state message |
| 57 | `dashboard/app/components/shared/ToggleButton.vue` | Create | On/off toggle switch |
| 58 | `dashboard/app/components/shared/ToastStack.vue` | Create | Toast notification stack |
| 59 | `dashboard/app/components/shared/IconButton.vue` | Create | Icon-only button (Lucide icons) |
| 60 | `dashboard/app/components/shared/Button.vue` | Create | Generic button (primary/ghost/danger) |

#### 9.6 — Modals (3 components)

| # | File | Action | Description |
|---|------|--------|-------------|
| 61 | `dashboard/app/components/modal/ModalBase.vue` | Create | Reusable modal wrapper: backdrop, close button, header/footer |
| 62 | `dashboard/app/components/modal/ClientNameDialog.vue` | Create | Edit client name (F11), calls PUT /api/clients/:slug/name |
| 63 | `dashboard/app/components/modal/CustomRangeDialog.vue` | Create | Custom date range picker |

#### 9.7 — Pages & App (2 modifications)

| # | File | Action | Description |
|---|------|--------|-------------|
| 64 | `dashboard/app/pages/index.vue` | Modify | Replace placeholder with AppShell |
| 65 | `dashboard/app.vue` | Modify | Dark theme CSS, import global.css, uplot CSS |

---

### Phase 10: Tests

**Goal:** Verify all layers. Write as you go, not all at the end.

#### Unit Tests (5 files)

| # | File | Action | Description |
|---|------|--------|-------------|
| 66 | `dashboard/server/utils/__tests__/ping-validation.test.ts` | Create | 7 rules + edge cases |
| 67 | `dashboard/server/utils/__tests__/client.test.ts` | Create | Slug generation, upsert, lookup |
| 68 | `dashboard/server/utils/__tests__/quality-classifier.test.ts` | Create | 7 quality states, sliding window |
| 69 | `dashboard/server/utils/__tests__/cache.test.ts` | Create | LRU eviction, cleanup |
| 70 | `dashboard/server/utils/__tests__/rate-limiter.test.ts` | Create | Window sliding, max requests |

#### Integration Tests (3 files)

| # | File | Action | Description |
|---|------|--------|-------------|
| 71 | `dashboard/tests/api/health.test.ts` | Create | Health endpoint response shapes |
| 72 | `dashboard/tests/api/ingest.test.ts` | Create | Batch ingest, dedup, validation |
| 73 | `dashboard/tests/api/monitors.test.ts` | Create | Monitors list, history, clients |

---

### Configuration Updates

| # | File | Action | Description |
|---|------|--------|-------------|
| 74 | `dashboard/nuxt.config.ts` | Modify | Add CSS imports (global.css, uplot.css), ensure shared types auto-import |
| 75 | `dashboard/package.json` | Modify | Add `uplot` dependency, `@iconify/vue` for Lucide icons |
| 76 | `dashboard/.gitignore` | Modify | Add `.data/` directory |

---

## File Inventory Summary

### Files to Create: 73

| Layer | Count | Files |
|-------|-------|-------|
| Schema | 5 | 5 migration files |
| Server Utils | 6 | ping-validation, client, ping-ingest, cache, quality-classifier, ws-broadcast |
| Server Middleware | 1 | rate-limit |
| API Routes | 5 | ingest, monitors list, monitor history, client get, client name put |
| WebSocket Plugin | 1 | websocket plugin |
| CSS/Assets | 7 | global.css, uplot.css + 5 locale files |
| Composables | 9 | useMonitors, useMonitorHistory, useWebSocket, useChartSeries, useTimeWindow, useDashboardPalette, useI18n, useSidebarWidth, useToast |
| Layout | 3 | AppShell, AppHeader, DashboardPanel |
| Sidebar | 5 | MonitorSidebar, ClientGroup, MonitorRow, AllMonitorsRow, SidebarResizer |
| Chart | 4 | LatencyChart, ChartCard, ChartLegend, ChartTooltip |
| Metrics | 3 | SummaryGrid, MetricCard, StatePill |
| Shared | 7 | StatusDot, TimeRangeSelector, EmptyState, ToggleButton, ToastStack, IconButton, Button |
| Modal | 3 | ModalBase, ClientNameDialog, CustomRangeDialog |
| Tests | 8 | 5 unit + 3 integration |

### Files to Modify: 8

| File | Layer | Change |
|------|-------|--------|
| `dashboard/shared/types.ts` | Shared | Expand with missing types |
| `dashboard/schema/index.sql` | Schema | Update with full schema from migrations |
| `dashboard/server/ws/ping.ts` | WebSocket | Expand stub to full handler |
| `dashboard/app.vue` | Frontend | Dark theme CSS, global import |
| `dashboard/app/pages/index.vue` | Frontend | Replace with AppShell |
| `dashboard/nuxt.config.ts` | Config | Add CSS imports, uplot config |
| `dashboard/package.json` | Config | Add uplot, @iconify/vue dependencies |
| `dashboard/.gitignore` | Config | Add .data/ directory |

---

## Dependency Graph

```
Phase 1 (Foundation) — COMPLETE ✅
  ├── database.ts, db.ts, logger.ts, health.get.ts — all done
  ├── nuxt.config.ts, package.json, .env.example — all done
  └── ws/ping.ts (stub), shared/types.ts (baseline) — done

Phase 2 (Schema) — depends on Phase 1
  └── 5 migrations (parallel)

Phase 3 (Types) — depends on Phase 2
  └── shared/types.ts expansion

Phase 4 (Business Logic) — depends on Phase 3
  ├── ping-validation (parallel)
  ├── client utils (parallel)
  ├── ping-ingest (depends on validation + client)
  ├── cache (parallel)
  ├── quality-classifier (parallel)
  └── rate-limiter + middleware (parallel)

Phase 5 (API Routes) — depends on Phase 4
  ├── ingest API (depends on ingest engine)
  ├── monitors list (parallel)
  ├── monitor history (parallel)
  └── client endpoints (parallel)

Phase 6 (WebSocket) — depends on Phase 5
  ├── ws/ping.ts expansion
  ├── ws-broadcast helper
  └── websocket plugin

Phase 7 (CSS/Assets) — independent, can run in parallel with Phase 4-6
  ├── global.css, uplot.css
  └── 5 locale files

Phase 8 (Composables) — depends on Phase 3 (types) + Phase 7 (CSS)
  ├── Core: useMonitors, useMonitorHistory, useWebSocket, useChartSeries
  └── Utility: useTimeWindow, useDashboardPalette, useI18n, useSidebarWidth, useToast

Phase 9 (Components) — depends on Phase 8
  ├── Layout (9.1) → Sidebar (9.2) → Chart (9.3)
  ├── Metrics (9.4) — parallel with 9.3
  ├── Shared (9.5) — parallel
  ├── Modal (9.6) — parallel
  └── Pages (9.7) — depends on all

Phase 10 (Tests) — alongside implementation
  ├── Unit tests with Phase 4
  └── Integration tests with Phase 5

Configuration Updates — alongside Phase 7
```

### Critical Path

```
Phase 1 (done) → Phase 2 (Schema) → Phase 3 (Types) → Phase 4 (Business Logic)
  → Phase 5 (API) → Phase 6 (WebSocket) → Phase 8 (Composables) → Phase 9 (Components)
```

### Parallelizable Work

- **Phase 2:** All 5 migrations can be created in parallel
- **Phase 4:** Validation, client utils, cache, classifier, rate limiter are independent (only ingest depends on validation + client)
- **Phase 5:** All API routes once Phase 4 is done
- **Phase 7:** CSS/Assets is fully independent of backend — can start alongside Phase 4
- **Phase 9:** Shared components (9.5) and modals (9.6) can be written in parallel

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **better-sqlite3 native build fails** | High | `pnpm rebuild` after install; ensure node-gyp deps available |
| **Nuxt 4 WebSocket API differences** | Medium | Test early in Phase 6; stub already works (verified) |
| **uPlot Canvas lifecycle in SSR** | Medium | `onMounted` guard, client-only rendering with `<ClientOnly>` |
| **TypeScript strict mode conflicts** | Low | Typecheck already passes; fix incrementally |
| **Migration ordering errors** | Medium | IF NOT EXISTS guards, sequential numbering |
| **Database file permissions** | Low | mkdirSync in DB plugin (already implemented) |
| **WebSocket reconnection race conditions** | Medium | Exponential backoff with jitter, tested in Phase 6 |

---

## Complexity: High

**Rationale:** 73 new files + 8 modifications across 10 phases. Backend (SQLite ingest + WebSocket broadcast) and frontend (uPlot + 25 Vue components + 9 composables) are both substantial. The dependency chain is deep but well-structured with clear parallelization points.

**Plan saved to memory:** ✅
**Next agent:** Agent 06 (Audit & Present Plan)

---

## Gate Checklist

- [x] Planning skills invoked (sequential-thinking approach used)
- [x] Prior agent outputs reviewed (Agents 02-04 scope, analysis, UI plan)
- [x] Current state assessed (M1-T1 complete — Agents 07-10)
- [x] Implementation sequence complete and ordered (10 phases, 73 create + 8 modify)
- [x] File inventory documented
- [x] Dependencies mapped (critical path + parallelizable items)
- [x] Risks assessed (7 risks with mitigation)
- [x] Plan saved to memory
