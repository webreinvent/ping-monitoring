# LNPM Cloud Dashboard — Implementation Plan

> **Produced by:** Agent 05 (Create Implementation Plan)
> **Consumed by:** Agent 06 (Audit & Present Plan), Agent 07 (Execute Implementation)
> **Date:** 2026-08-02
> **Status:** Complete

---

## Current State

The cloud dashboard (`dashboard/`) currently has only the health check endpoint implemented. All other features need to be built from scratch.

| Component | Status | Notes |
|-----------|--------|-------|
| `server/api/health.get.ts` | ✅ Done | F1, F14 — returns full health metrics |
| `server/plugins/database.ts` | ✅ Done | SQLite init with WAL, migration runner |
| `server/utils/db.ts` | ✅ Done | Database connection helper |
| `server/utils/logger.ts` | ✅ Done | Structured logger |
| `server/ws/ping.ts` | ⚠️ Stub | Echo only, needs full WS protocol |
| `schema/` + migrations | ✅ Done | All 5 migrations, full schema |
| `shared/types.ts` | ⚠️ Partial | Needs update to match API design |
| `nuxt.config.ts` | ⚠️ Partial | Needs i18n, CSS config |
| `app/layouts/default.vue` | ⚠️ Placeholder | Bare layout shell |
| `app/pages/index.vue` | ⚠️ Placeholder | "Monitors will appear here" |
| `vitest.config.ts` | ✅ Done | Test framework configured |
| `playwright.config.ts` | ✅ Done | E2E framework configured |

---

## Phase 1: Foundation (Types, Config, Infrastructure)

### Step 1 — `dashboard/shared/types.ts` (MODIFY)

Full rewrite to match the API design contract (Section 15 of api-design.md):

- **Add:** `IngestPayload`, `PingSample` (server schema form), `IngestResponse`, `Rejection`, `MonitorListItem`, `ClientRecord`, `HistoryResponse`, `HistorySeries`, `HistoryPoint`, `QualityIntervalRecord`, `QualityState`, `QualityReason`, `RangeSummary`, `Target`
- **Add:** WebSocket message types (`WsInboundMessage`, `WsOutboundMessage`, `WsSubscribeMsg`, `WsSnapshotMsg`, `WsSampleMsg`, `WsClientNameUpdatedMsg`)
- **Retain:** `HealthResponse`, `HealthErrorResponse`, `ClientIdentity`
- **Remove:** old `PingSample` (RTT-based form), old `IngestRequest`, old `Monitor` (no longer matches API)

**Dependencies:** None

### Step 2 — `dashboard/test/fixtures.ts` (MODIFY)

Update factories to match new type shapes:

- **Add:** `createIngestPayload()`, `createMonitorListItem()`, `createClientRecord()`, `createHistoryResponse()`, `createRejection()`, `createWsSnapshotMsg()`
- **Fix:** `createHealthResponse` fixture has a `database` field that does not exist in `HealthResponse` (it should be `db_path`)

**Dependencies:** Step 1

### Step 3 — `dashboard/package.json` (MODIFY)

Add dependencies:

- `@nuxtjs/i18n` (latest)
- `uplot` (latest)
- `@types/uplot` (if available, or skip)

**Dependencies:** None (parallel with Step 1)

### Step 4 — `dashboard/nuxt.config.ts` (MODIFY)

- Add `@nuxtjs/i18n` module with 5-locale config (en, ko, ja, zh-CN, zh-TW)
- Add `css: ['~/assets/css/global.css']`
- Add `i18n.strategy: 'no_prefix'` with cookie detection
- Add `i18n.langDir: 'assets/locales/'`
- Keep existing nitro, typescript, devServer, ssr, routeRules config

**Dependencies:** Step 3

### Step 5 — `dashboard/app/assets/css/global.css` (CREATE)

- CSS custom properties from desktop `src/styles.css` (all tokens from ui-ux-plan.md Layer 1 + Layer 2)
- Global resets (box-sizing, html/body, font stack)
- uPlot-specific overrides
- `@keyframes radar-spin` animation
- Responsive breakpoints (980px, 640px)
- `prefers-reduced-motion` media query

**Dependencies:** None (parallel with Steps 6-10)

### Steps 6-10 — Locale Files (CREATE, all parallel)

- `dashboard/app/assets/locales/en.json`
- `dashboard/app/assets/locales/ko.json`
- `dashboard/app/assets/locales/ja.json`
- `dashboard/app/assets/locales/zh-CN.json`
- `dashboard/app/assets/locales/zh-TW.json`

Pattern: Copy desktop `src/locales/*.json` as baseline, add dashboard-specific keys (WebSocket states, cloud sync labels, etc.)

**Dependencies:** None

---

## Phase 2: Business Logic (Server Utils)

### Step 11 — `dashboard/server/utils/ping-types.ts` (CREATE)

Server-side ingest types:
- `IngestPayload` (request body), `PingSampleIn` (per-sample input)
- Constants: `MAX_BATCH_SIZE` (1000), `FUTURE_WINDOW_MS` (5 * 60 * 1000)
- Validation error codes enum: `INVALID_TIMESTAMP`, `FUTURE_TIMESTAMP`, `MISSING_LATENCY`, `INVALID_LATENCY`, `MISSING_RESOLVED_ADDRESS`, `INVALID_STATUS`, `MISSING_TARGET_HOST`, `UNKNOWN_CLIENT`, `EMPTY_SAMPLES`, `BATCH_TOO_LARGE`, `MISSING_CLIENT_SLUG`

**Dependencies:** Step 1

### Step 12 — `dashboard/server/utils/ping-validation.ts` (CREATE)

- `validateSample(sample: PingSampleIn, index: number, nowMs: number): Rejection[]` — 7 validation rules per sample
- `validateIngestPayload(payload: IngestPayload): Rejection[]` — batch-level validation

**Dependencies:** Step 11

### Step 13 — `dashboard/server/utils/client.ts` (CREATE)

- `generateSlug(username: string, hostname: string, mac: string): string` — format `<username>-<hostname>-<truncated-mac>`
- `upsertClient(db: Database, slug, username, hostname, mac, name?): number` — INSERT OR IGNORE, returns client_id
- `getClientBySlug(db: Database, slug: string): ClientRecord | null`
- `updateClientName(db: Database, slug: string, name: string): ClientRecord | null`

**Dependencies:** Step 11

### Step 14 — `dashboard/server/utils/ping-ingest.ts` (CREATE)

- `ingestBatch(db: Database, payload: IngestPayload): IngestResponse` — core ingest engine
  - Validate all samples first, collect rejections
  - Upsert client if new (via `client.ts`)
  - Auto-create monitors for new `targetHost` values within the same transaction
  - `INSERT OR IGNORE` into `ping_samples` using prepared statements
  - Track `db.changes` to count accepted vs duplicate
  - Return `IngestResponse` with accepted, duplicate, rejected, rejections
- `broadcastIngest(monitorId: number, sample: Record<string, any>)` — fire-and-forget WS broadcast

**Dependencies:** Steps 11, 12, 13

### Step 15 — `dashboard/server/utils/quality-classifier.ts` (CREATE)

- `classifyQuality(points: HistoryPoint[], windowMs: number): QualityIntervalRecord[]` — sliding window classifier (F12)
- States: `warmingUp`, `low`, `medium`, `high`, `veryHigh`, `unstable`, `disconnected`
- Thresholds from api-design.md Section 7

**Dependencies:** Step 1

### Step 16 — `dashboard/server/utils/cache.ts` (CREATE)

- `LRUCache<K, V>` class — in-memory LRU cache with configurable max size
- Methods: `get(key)`, `set(key, value)`, `delete(key)`, `clear()`, `size()`

**Dependencies:** None (parallel with Steps 14-15)

### Step 17 — `dashboard/server/utils/rate-limiter.ts` (CREATE)

- `RateLimiter` class — per-IP sliding window rate limiting (F13)
- `check(ip: string): { allowed: boolean; retryAfterMs: number | null }`
- Configurable: `windowMs` (default 60000), `maxRequests` (dev 1000, prod 100)

**Dependencies:** Step 16

### Step 18 — `dashboard/server/utils/dashboard-aggregation.ts` (CREATE)

- `buildHistoryResponse(db: Database, monitorId: number, fromMs: number, toMs: number, maxPoints: number): HistoryResponse` (F6)
  - Query raw `ping_samples` aggregated into time buckets
  - Down-sample by increasing bucket size when count exceeds `maxPoints`
  - Bucket sizes: `[1000, 5000, 10000, 30000, 60000, 300000, 900000, 1800000, 3600000]`
  - Compute `QualityIntervalRecord[]` via quality-classifier
  - Compute `RangeSummary`

**Dependencies:** Steps 1, 15

---

## Phase 3: API Routes

### Step 19 — `dashboard/server/api/monitors.get.ts` (CREATE)

`GET /api/monitors` (F5) — list all monitors with latest state. Single SQL query joining monitors + clients, ordered by lastSeenMs DESC, id ASC. Returns `{ monitors: MonitorListItem[] }`.

**Dependencies:** Steps 1, 13

### Step 20 — `dashboard/server/api/monitors/[id].get.ts` (CREATE)

`GET /api/monitors/:id?fromMs=&toMs=&maxPoints=` (F6) — monitor history. Validate monitor exists (404), validate query params (400). Delegate to `buildHistoryResponse()`.

**Dependencies:** Steps 1, 18

### Step 21 — `dashboard/server/api/clients/[slug].get.ts` (CREATE)

`GET /api/clients/:slug` (F2) — get client detail. Returns `ClientRecord` or 404.

**Dependencies:** Step 13

### Step 22 — `dashboard/server/api/clients/[slug].name.put.ts` (CREATE)

`PUT /api/clients/:slug/name` (F11) — update client display name. Validate name (1-100 chars). Broadcast `client_name_updated` WS message after update.

**Dependencies:** Steps 13, 1

### Step 23 — `dashboard/server/api/ping/ingest.post.ts` (CREATE)

`POST /api/ping/ingest` (F3) — batch ingest endpoint. Validate payload, check client exists (401). Call `ingestBatch()`. Return correct HTTP status: 201 (all new), 207 (mixed), 200 (all duplicate). Fire-and-forget WS broadcast after commit.

**Dependencies:** Steps 14, 11, 12

### Step 24 — `dashboard/server/ws/ping.ts` (MODIFY)

Expand stub to full WebSocket handler (F7):
- `Map<number, Set<Peer>>` subscription tracking
- Handle: `subscribe` (ack + send snapshot), `unsubscribe` (ack), `close` (cleanup)
- `broadcastSample(monitorId, data)` — push to subscribed peers
- Snapshot: fetch last 100 samples + monitor state from DB

**Dependencies:** Steps 23, 18

### Step 25 — `dashboard/server/middleware/rate-limit.ts` (CREATE)

Nitro middleware for per-IP rate limiting (F13). Returns 429 with `Retry-After` header when exceeded. Skips health endpoint.

**Dependencies:** Step 17

---

## Phase 4: Frontend Composables

### Step 26 — `dashboard/app/composables/useMonitors.ts` (CREATE)

`useState<MonitorListItem[]>('monitors')` — shared monitor list. `useState<string | null>('selectedMonitorId')`. `fetchMonitors()`. `selectMonitor(id)`.

**Dependencies:** Step 19

### Step 27 — `dashboard/app/composables/useHistory.ts` (CREATE)

`useState<HistoryResponse | null>('history')`. `fetchHistory(monitorId, range, maxPoints?)`. `pushSample(sample)` — merge real-time sample into history.

**Dependencies:** Step 20

### Step 28 — `dashboard/app/composables/useWebSocket.ts` (CREATE)

`connect()` / `disconnect()`. `subscribe(monitorId)` / `unsubscribe(monitorId)`. Exponential backoff reconnect: 1s → 2s → 4s → 8s → 16s → 30s (capped). Route incoming messages (snapshot, sample, client_name_updated). `useState<WsConnectionState>('wsState')`.

**Dependencies:** Step 24

### Step 29 — `dashboard/app/composables/useChart.ts` (CREATE)

uPlot lifecycle management. `render(history, container)`. `updateData(sample)`. `drangeCallback(fromMs, toMs)`. Series colors: `["#5eead4", "#60a5fa", "#c084fc", "#f472b6", "#facc15"]`.

**Dependencies:** Steps 20, 27

### Step 30 — `dashboard/app/composables/useRange.ts` (CREATE)

`useState('range')`. Range presets: 5M, 10M, 30M, 1H, 6H, 12H, 24H, 7D, 30D, Live. `getRangeMillis(key)`.

**Dependencies:** None (parallel with Steps 26-29)

### Step 31 — `dashboard/app/composables/useToast.ts` (CREATE)

`useState<Toast[]>('toasts')`. `addToast(message, kind, timeout?)`. `removeToast(id)`.

**Dependencies:** None (parallel with Steps 26-30)

### Step 32 — `dashboard/app/composables/useSettings.ts` (CREATE)

`useState<Settings>('settings')`. Language resolution (auto, en, ko, ja, zh-CN, zh-TW). Retention days, notifications toggle.

**Dependencies:** None (parallel with Steps 26-31)

### Step 33 — `dashboard/app/composables/useHealth.ts` (CREATE)

`useState<HealthResponse | null>('health')`. `fetchHealth()`. `pollHealth(intervalMs?)`.

**Dependencies:** Step 19

---

## Phase 5: Frontend Components

### Step 34 — `dashboard/app/components/StatePill.vue` (CREATE)

Props: `state: QualityState`. Status dot with color + glow, text label. `role="status"`, `aria-label`.

**Dependencies:** None (simplest component)

### Step 35 — `dashboard/app/components/MetricCard.vue` (CREATE)

Props: `label`, `value`, `subValue?`, `variant?`. 5-column grid layout, glow pseudo-element, responsive variants.

**Dependencies:** None (parallel with Step 34)

### Step 36 — `dashboard/app/components/RangeSelector.vue` (CREATE)

Props: `activeRange`, `showLive`. Emit: `select(range)`. Button group with active/inactive states.

**Dependencies:** Step 30

### Step 37 — `dashboard/app/components/EmptyState.vue` (CREATE)

Props: `variant` (no-monitors, no-data, error). Radar animation for no-monitors variant.

**Dependencies:** None (parallel with Steps 34-36)

### Step 38 — `dashboard/app/components/ToastNotification.vue` (CREATE)

Props: `message`, `kind`, `timeout`. Bottom-right stack, fade-in/out animations. `aria-live="polite"`.

**Dependencies:** Step 31

### Step 39 — `dashboard/app/components/MonitorRow.vue` (CREATE)

Props: `monitor: MonitorListItem`, `selected: boolean`. Emits: `select`, `toggle`, `edit`. Status dot, name, host, latency, toggle switch, edit icon. `role="option"`, `aria-selected`, keyboard navigation.

**Dependencies:** Step 34

### Step 40 — `dashboard/app/components/ChartCard.vue` (CREATE)

Props: `history: HistoryResponse | null`, `selectedTargetId`. Emits: `range-changed`, `legend-select`. uPlot canvas host, loading overlay, legend bar. `aria-label` on chart container.

**Dependencies:** Steps 29, 27

### Step 41 — `dashboard/app/components/MonitorSidebar.vue` (CREATE)

Props: `monitors`, `selectedId`. Emits: `select`, `toggle`, `edit`, `add`. "All Monitors" row + monitor list grouped by client. `role="listbox"`.

**Dependencies:** Steps 34, 39

### Step 42 — `dashboard/app/components/DashboardPanel.vue` (CREATE)

Props: `selectedMonitor`, `qualityState`, `range`. Emits: `update:range`. Heading + ChartCard + MetricCards. Slot: `heading-actions`.

**Dependencies:** Steps 35, 36, 40, 41

### Step 43 — `dashboard/app/components/TargetDialog.vue` (CREATE)

Props: `modelValue`, `target?`. Emits: `update:modelValue`, `save`, `delete`. `<dialog>` element, form fields, validation, footer actions. Focus trapping, `role="dialog"`, `aria-modal="true"`.

**Dependencies:** Steps 34, 35

### Step 44 — `dashboard/app/components/SettingsDialog.vue` (CREATE)

Props: `modelValue`. Emits: `update:modelValue`, `save`. Sections: Monitoring, Appearance, Data. Language selector, retention settings.

**Dependencies:** Steps 32, 34

### Step 45 — `dashboard/app/components/AppLayout.vue` (CREATE)

Header bar (brand + actions: Live, Pause, Settings). Workspace grid: sidebar (320px) + divider (1px) + panel (flex: 1). Draggable sidebar resizer. `role="banner"`, `role="navigation"`, `role="main"`.

**Dependencies:** Steps 38, 41, 42, 44

### Step 46 — `dashboard/app/layouts/default.vue` (MODIFY)

Replace placeholder with `<AppLayout>` wrapper.

**Dependencies:** Step 45

### Step 47 — `dashboard/app/pages/index.vue` (MODIFY)

Replace placeholder with full dashboard: MonitorSidebar + DashboardPanel. Wire up composables (useMonitors, useHistory, useWebSocket, useRange, useToast). WebSocket auto-connect on mount.

**Dependencies:** Steps 26-33, 41-45

---

## Phase 6: Tests

### Step 48 — `dashboard/server/utils/ping-validation.test.ts` (CREATE)

Test all 7 validation rules individually. Edge cases (boundary timestamps, null values, empty strings). Batch-level checks.

**Dependencies:** Step 12

### Step 49 — `dashboard/server/utils/client.test.ts` (CREATE)

Slug generation (various inputs, truncation). upsertClient (new, existing, retry safety). getClientBySlug (found, not found). updateClientName (valid, invalid, not found).

**Dependencies:** Step 13

### Step 50 — `dashboard/server/utils/ping-ingest.test.ts` (CREATE)

ingestBatch: all-new (201), mixed (207), all-duplicates (200). Monitor auto-creation. Client auto-registration. Transaction rollback on error. Batch size limits.

**Dependencies:** Step 14

### Step 51 — `dashboard/server/utils/quality-classifier.test.ts` (CREATE)

Each state transition (warmingUp → low → medium → high → veryHigh → unstable). Disconnected state (no samples). Boundary conditions (exactly at thresholds).

**Dependencies:** Step 15

### Step 52 — `dashboard/server/utils/dashboard-aggregation.test.ts` (CREATE)

buildHistoryResponse with known data. Down-sampling (bucket size increase). Empty data range. maxPoints enforcement. QualityIntervalRecord computation. RangeSummary computation.

**Dependencies:** Step 18

### Step 53 — `dashboard/server/api/ping/ingest.post.test.ts` (CREATE)

All HTTP status codes (200, 201, 207, 400, 401, 413). Error response shapes. Batch processing.

**Dependencies:** Step 23

### Step 54 — `dashboard/server/api/monitors.get.test.ts` (CREATE)

Empty monitor list. Monitors with latest state. Ordering (lastSeenMs DESC, id ASC).

**Dependencies:** Step 19

### Step 55 — `dashboard/server/api/monitors/[id].get.test.ts` (CREATE)

Valid monitor history. 404 for unknown monitor. Query param validation. Default time window.

**Dependencies:** Step 20

### Step 56 — `dashboard/server/api/clients/[slug].get.test.ts` (CREATE)

Client found / not found.

**Dependencies:** Step 21

### Step 57 — `dashboard/server/api/clients/[slug].name.put.test.ts` (CREATE)

Valid name update. Invalid name (too short, too long, empty). Client not found.

**Dependencies:** Step 22

### Step 58 — `dashboard/server/utils/rate-limiter.test.ts` (CREATE)

Allow within limit. Reject over limit. retry-after calculation. Window expiry.

**Dependencies:** Step 17

### Step 59 — `dashboard/server/utils/cache.test.ts` (CREATE)

get/set/delete/clear. LRU eviction on max size.

**Dependencies:** Step 16

### Step 60 — `dashboard/server/ws/ping.test.ts` (MODIFY)

Replace echo tests with full protocol tests. Subscribe/unsubscribe flow. Snapshot delivery. Sample broadcast. Cleanup on close.

**Dependencies:** Step 24

### Step 61 — `dashboard/tests/e2e/dashboard.spec.ts` (CREATE, update)

Playwright E2E: load dashboard, verify sidebar renders. Monitor selection (click → chart loads). Range selector (click → data updates). WebSocket reconnect (simulate disconnect).

**Dependencies:** Steps 24, 26-33, 41-47

---

## File Inventory

### Files to Create (43)

| Category | Count | Files |
|----------|-------|-------|
| Server utils | 8 | `ping-types.ts`, `ping-validation.ts`, `client.ts`, `ping-ingest.ts`, `quality-classifier.ts`, `cache.ts`, `rate-limiter.ts`, `dashboard-aggregation.ts` |
| API routes | 5 | `monitors.get.ts`, `monitors/[id].get.ts`, `clients/[slug].get.ts`, `clients/[slug].name.put.ts`, `ping/ingest.post.ts` |
| Middleware | 1 | `rate-limit.ts` |
| Composables | 8 | `useMonitors.ts`, `useHistory.ts`, `useWebSocket.ts`, `useChart.ts`, `useRange.ts`, `useToast.ts`, `useSettings.ts`, `useHealth.ts` |
| Components | 12 | `StatePill.vue`, `MetricCard.vue`, `RangeSelector.vue`, `EmptyState.vue`, `ToastNotification.vue`, `MonitorRow.vue`, `ChartCard.vue`, `MonitorSidebar.vue`, `DashboardPanel.vue`, `TargetDialog.vue`, `SettingsDialog.vue`, `AppLayout.vue` |
| Locales | 5 | `en.json`, `ko.json`, `ja.json`, `zh-CN.json`, `zh-TW.json` |
| CSS | 1 | `global.css` |
| Tests | 14 | 8 business logic + 5 API + 1 WS |

### Files to Modify (8)

| File | Change |
|------|--------|
| `shared/types.ts` | Full rewrite to match API design |
| `test/fixtures.ts` | Update factories for new types |
| `package.json` | Add i18n, uPlot deps |
| `nuxt.config.ts` | Add i18n module, CSS |
| `server/ws/ping.ts` | Expand stub to full protocol |
| `app/layouts/default.vue` | Use AppLayout |
| `app/pages/index.vue` | Full dashboard page |
| `server/ws/ping.test.ts` | Full protocol tests |

**Total: Create 43 | Modify 8 = 51 file operations**

---

## Dependency Graph

```
Phase 1 (Foundation)
  Step 1 (types) ──→ Step 2 (fixtures)
  Step 3 (pkg) ──→ Step 4 (nuxt config)
  Steps 5-10 (CSS, locales) ──→ independent

Phase 2 (Business Logic)
  Step 1 ──→ Step 11 (ping-types)
  Step 11 ──→ Steps 12 (validation), 13 (client)
  Steps 11,12,13 ──→ Step 14 (ingest)
  Step 1 ──→ Step 15 (quality-classifier)
  Step 16 (cache) ──→ Step 17 (rate-limiter)
  Steps 1,15 ──→ Step 18 (aggregation)

Phase 3 (API Routes)
  Steps 1,13 ──→ Step 19 (monitors.get)
  Steps 1,18 ──→ Step 20 (monitors/[id].get)
  Step 13 ──→ Step 21 (clients/[slug].get)
  Steps 13,1 ──→ Step 22 (clients/[slug].name.put)
  Steps 14,11,12 ──→ Step 23 (ping/ingest.post)
  Steps 23,18 ──→ Step 24 (ws/ping)
  Step 17 ──→ Step 25 (rate-limit middleware)

Phase 4 (Composables)
  Step 19 ──→ Steps 26 (useMonitors), 33 (useHealth)
  Step 20 ──→ Step 27 (useHistory)
  Step 24 ──→ Step 28 (useWebSocket)
  Steps 20,27 ──→ Step 29 (useChart)
  Steps 30,31,32 ──→ independent

Phase 5 (Components)
  Steps 34,35 ──→ independent (simplest)
  Step 30 ──→ Step 36 (RangeSelector)
  Step 31 ──→ Step 38 (ToastNotification)
  Step 34 ──→ Steps 39 (MonitorRow), 43 (TargetDialog)
  Steps 29,27 ──→ Step 40 (ChartCard)
  Steps 34,39 ──→ Step 41 (MonitorSidebar)
  Steps 35,36,40,41 ──→ Step 42 (DashboardPanel)
  Steps 32,34 ──→ Step 44 (SettingsDialog)
  Steps 38,41,42,44 ──→ Step 45 (AppLayout)
  Step 45 ──→ Step 46 (default.vue)
  All above ──→ Step 47 (index.vue)

Phase 6 (Tests) ──→ After corresponding implementation steps
```

---

## Parallelizable Work

### Phase 1 (all parallel within phase)
- Steps 1, 3, 5-10 are independent
- Step 2 depends on Step 1
- Step 4 depends on Step 3

### Phase 2 (partial parallelization)
- After Step 1: Steps 11, 15, 16 can proceed in parallel
- After Step 11: Steps 12, 13 in parallel
- After Steps 12, 13: Steps 14, 17 in parallel
- After Steps 15, 18: Step 18 in parallel with 14-17

### Phase 3 (API routes)
- Steps 19-23 can be built in parallel once their utils are ready
- Steps 24-25 independent of each other

### Phase 4 (composables)
- All Steps 26-33 independent of each other (once API routes exist)

### Phase 5 (components)
- Steps 34-36, 37, 38: independent, simplest first
- Steps 39-42: depend on simpler components
- Steps 43-44: independent of chart components
- Steps 45-47: depend on all components

### Phase 6 (tests)
- Steps 48-52: parallel (unit tests for utils)
- Steps 53-58: parallel (API/middleware tests)
- Steps 59-61: sequential (E2E depends on frontend)

---

## Risks and Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| **uPlot Vue 3 integration** | Medium | uPlot requires direct DOM refs; use `ref<HTMLDivElement>` + `nextTick()` pattern. Test in isolation first (Step 29). |
| **Nitro WebSocket limitations** | Medium | Nitro v2 WebSocket support is experimental; `crossws` may have edge cases. Test connect/subscribe/broadcast cycle early (Step 24). |
| **better-sqlite3 sync blocking** | Low | Single-threaded SQLite blocks the event loop during large ingests. Use `db.transaction()` for atomicity; batch size limited to 1000. |
| **SSR + WebSocket mismatch** | Medium | WebSocket only works client-side. Use `process.client` checks in composables; `useState` for SSR-safe shared state. |
| **i18n module compatibility** | Low | `@nuxtjs/i18n` may have Nuxt 4 compatibility issues. Pin to latest stable version; test SSR locale detection early. |
| **Type drift between shared/types.ts and actual DB schema** | High | DB uses `timestamp_ms`, `latency_ms` (snake_case) while ingest payload uses `timestampMs`, `latencyMs` (camelCase). Ping-ingest must translate. Document clearly in ping-types.ts. |
| **Timezone handling** | Medium | `timestamp_ms` is epoch milliseconds (timezone-independent), but ISO strings in responses must be UTC. Explicit `.toISOString()` everywhere. |
| **Quality classifier threshold edge cases** | Low | At-exact-threshold values (e.g., exactly 10% loss) need deterministic behavior. Define inclusive/exclusive boundaries explicitly in code. |

---

## Complexity Assessment

| Layer | Effort | Confidence |
|-------|--------|------------|
| Shared types (Step 1) | 1 hour | High — straightforward type definitions |
| Business logic (Steps 11-18) | 8-12 hours | High — well-specified, deterministic logic |
| API routes (Steps 19-23) | 6-8 hours | High — thin wrappers around business logic |
| WebSocket (Step 24) | 4-6 hours | Medium — Nitro WS experimental, subscription tracking |
| Middleware (Step 25) | 1-2 hours | High — simple per-IP counter |
| Composables (Steps 26-33) | 8-10 hours | Medium — uPlot integration is the unknown |
| Components (Steps 34-47) | 16-24 hours | Medium — uPlot chart is the most complex component; rest are standard UI |
| Tests (Steps 48-61) | 12-16 hours | Medium — DB integration tests need careful mocking |
| **Total** | **56-82 hours** | |

**Highest-risk items:** uPlot integration (Step 29/40), Nitro WebSocket (Step 24), dashboard-aggregation down-sampling (Step 18). These three items should be prototyped first before building dependent code.

---

## Recommended Build Order (Single Developer)

1. **Steps 1-10** (foundation, ~1 day)
2. **Steps 11-18** (business logic, ~2 days)
3. **Steps 19-23** (API routes, ~1 day)
4. **Step 24** (WebSocket prototype, ~half day)
5. **Steps 26-33** (composables, ~2 days)
6. **Steps 34-47** (components, ~3 days)
7. **Steps 48-61** (tests, ~2-3 days)
8. **Step 25** (middleware, ~half day — low risk, can be slotted anywhere)

---

## Plan Summary

```
Implementation Plan

Sequence: 61 steps across 6 phases
  Phase 1: Foundation (10 steps)
  Phase 2: Business Logic (8 steps)
  Phase 3: API Routes (7 steps)
  Phase 4: Composables (8 steps)
  Phase 5: Components (14 steps)
  Phase 6: Tests (14 steps)

Files: Create 43 | Modify 8
Dependencies: See dependency graph above
Risks: 8 identified risks with mitigation strategies (see Risks table)
Complexity: High (56-82 hours total)
Plan saved to memory: ✅
Next agent: Agent 06 (Audit & Present Plan)
```
