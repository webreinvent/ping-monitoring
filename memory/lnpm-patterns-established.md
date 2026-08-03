---
name: lnpm-patterns-established
description: Patterns established during M1 and M2 — Nuxt 4 + Nitro foundation, uPlot charts, WebSocket, Vue composables
metadata:
  type: project
  agent: "12"
  date: 2026-08-03
---

# LNPM Cloud Dashboard — Patterns Established

## Nuxt 4 + Nitro Patterns

### Database Plugin Pattern
- **File**: `server/plugins/database.ts`
- **Pattern**: Nitro plugin initializes SQLite (better-sqlite3) with WAL mode, foreign keys, and runs migrations at startup. Stores instance on `globalThis.__db` for cross-module access.
- **Key**: Singleton via closure-scoped `getDatabase()` — only one DB connection per process.
- **Related**: [[lnpm-decisions-made]]

### Migration Runner Pattern
- **Location**: `server/plugins/database.ts` → `runMigrations()`
- **Pattern**: Reads `schema/migrations/*.sql` files, sorts alphabetically, skips already-applied migrations using a tracking table. Each migration is tracked by filename in a `migrations` table (created IF NOT EXISTS before running).
- **Error handling**: try/catch per migration with console.error + rethrow.

### Database Helper Pattern
- **File**: `server/utils/db.ts`
- **Pattern**: `getDb()` reads from `globalThis.__db`, throws if uninitialized. Simple typed accessor — no pooling, no async.
- **Related**: [[lnpm-lessons-learned]]

### Structured Logger Pattern
- **File**: `server/utils/logger.ts`
- **Pattern**: LOG_LEVEL-aware logger with 4 levels (debug/info/warn/error). Respects `LOG_LEVEL` env var, falls back to `NODE_ENV` (production→info, development→debug). ISO 8601 timestamps, optional JSON meta.
- **Export**: Named exports (`debug`, `info`, `warn`, `error`) — no default export.

### Health Endpoint Pattern
- **File**: `server/api/health.get.ts`
- **Pattern**: `defineEventHandler` with try/catch, returns structured JSON. Caches `package.json` version at module scope (IIFE). Checks DB connectivity inline.
- **Response shape**: `{ status, timestamp, uptime, version, database }`

### WebSocket Handler Pattern
- **File**: `server/ws/ping.ts`
- **Pattern**: `defineWebSocketHandler` with `open`, `message`, `close` lifecycle. Messages are JSON-serialized strings. Uses `message.text` (crossws passes a Message object, not raw string).
- **Subscription map**: `Map<number, Set<WebSocketType>>` keyed by monitor_id. Snapshot on subscribe (last 100 samples). Broadcast from ingest endpoint.

### Shared Types Pattern
- **File**: `shared/types.ts`
- **Pattern**: Plain TypeScript interfaces, no runtime validation. Used by both server and client. No auto-import config needed (Nuxt auto-imports functions/constants, not types — types are imported explicitly).

## Vue Component Patterns

### App Shell Pattern
- **File**: `app.vue`
- **Pattern**: Minimal root — `<NuxtLayout>` wrapping `<NuxtPage>`. No theme CSS yet (deferred to Phase 9).

### Layout Pattern
- **File**: `app/layouts/default.vue`
- **Pattern**: Flex column, `min-height: 100vh`, scoped CSS with `.dashboard-shell` class.

### Page Pattern
- **File**: `app/pages/index.vue`
- **Pattern**: Semantic `<section>` elements, `data-testid` attributes for E2E testing, `useHead` for page title, scoped CSS.

### Sidebar Pattern (M2-T1)
- **File**: `app/components/DashboardSidebar.vue`
- **Pattern**: Fixed-width sidebar (260px) with collapse on narrow viewports. Uses `useResponsiveSidebar()` composable for breakpoint detection.
- **Components**: `SidebarContent` (scrollable list), `ClientGroup` (expandable client section), `MonitorRow` (individual monitor status).

### uPlot Chart Pattern (M2-T3)
- **File**: `app/components/charts/LatencyChart.vue`
- **Pattern**: uPlot chart wrapped in Vue component with reactive props. Uses `useChartSeries()` composable for data transforms, `useMonitorHistory()` for data fetching.
- **Key**: `onMounted` creates chart, `onUnmounted` destroys it. `watch` on data props triggers `uPlot.setData()`. Quality bands rendered via `Qual` plugin.

### All-Monitors Chart Pattern (M2-T3)
- **File**: `app/components/charts/AllMonitorsChart.vue`
- **Pattern**: Multi-series uPlot chart showing all monitors on a single chart. Uses `useDashboardPalette()` composable for color cycling. Toggle checkbox per monitor for visibility control.

### Chart Composable Pattern (M2-T3)
- **File**: `app/composables/useChartSeries.ts`
- **Pattern**: Pure function composable for transforming `HistoryPoint[]` into uPlot-compatible `[[timestamps], [values], ...]` arrays.
- **Composables**: `useTimeWindow()` for time range management, `useDashboardPalette()` for color palette generation, `useMonitorHistory()` for API fetching.

### Quality Bands Pattern (M2-T3)
- **File**: `app/utils/quality-bands.ts`
- **Pattern**: Generates `Qual` plugin path data from `QualityIntervalRecord[]`. Maps quality state → color via `QUALITY_COLORS` constants. Produces SVG path strings for uPlot's background bands.

### Time Range Selector Pattern (M2-T3)
- **File**: `app/components/shared/TimeRangeSelector.vue`
- **Pattern**: Button-group component with preset time ranges (1h, 6h, 24h, 7d, 30d). Emits `select` event with `{ fromMs, toMs }` payload. Uses `useTimeWindow()` composable for computation.

## Test Patterns

### Vitest Configuration
- **File**: `vitest.config.ts`
- **Pattern**: Node environment, global test functions, alias resolution (`~` and `@` → project root), V8 coverage provider.
- **Excludes**: `node_modules`, `.nuxt`, `.data`, `.output`, `coverage`.

### Test Setup Pattern
- **File**: `test/setup.ts`
- **Pattern**: Silences console output by default, clears `globalThis.__db` before each test, restores console methods after each test (for spy compatibility).

### Fixtures Pattern
- **File**: `test/fixtures.ts`
- **Pattern**: Factory functions with `Partial<T>` overrides — `createPingSample()`, `createMonitor()`, `createClientIdentity()`, etc. Spread defaults, then overrides.

### Mock DB Pattern
- **File**: `test/mock-db-factory.ts`
- **Pattern**: Creates a minimal Database stub dispatching on SQL string matching. `prepare(sql)` returns mock statement objects with `all()`, `get()`, `run()` methods. Transaction mock: `transaction: vi.fn((fn) => () => fn())`.
- **Key**: Avoids better-sqlite3 segfault in Vitest forked workers entirely.

### Frontend Utility Test Pattern (M2-T7)
- **Files**: `app/utils/quality-bands.test.ts`, `app/composables/useChartSeries.test.ts`, `app/composables/useDashboardPalette.test.ts`
- **Pattern**: Test frontend utility functions and composables with pure function assertions. No DOM required. Use fixtures from `test/fixtures.ts` for consistent test data.

## Environment Configuration

### .env.example Pattern
- **File**: `.env.example`
- **Pattern**: 14 environment variables with section headers, inline comments, and sensible defaults. Categories: environment mode, HTTP server, SQLite, WebSocket, ingest, rate limiting, data retention, cache.

## Ping Ingest Patterns (M1-T6)

### Type-First Module Pattern
- **File**: `server/utils/ping-types.ts`
- **Pattern**: Dedicated type file for a feature domain. Co-located with implementation (`server/utils/`). Defines `PingSampleIngest`, `IngestPayload`, `IngestResponse`, `Rejection`, and `ValidationResult` interfaces.

### Validation Rule Pattern
- **File**: `server/utils/ping-validation.ts`
- **Pattern**: Single `validateSample()` function returns `ValidationResult { valid, rejections[] }`. Multiple rejections can accumulate on a single sample.

### Ingest Engine Pattern (3-Phase Pipeline)
- **File**: `server/utils/ping-ingest.ts`
- **Pattern**: `ingestPingBatch()` orchestrates: (1) client lookup/auto-register, (2) validation, (3) transactional ingest. Returns `IngestResponse` with accepted/duplicate/rejected counts.

### Transactional Ingest Pattern
- **File**: `server/utils/ping-ingest.ts` → `ingestSamples()`
- **Pattern**: `db.transaction()` wraps 4 phases: resolve monitor IDs, bulk insert samples, update monitor latest state, update client last_synced_at_ms. Dedup via INSERT OR IGNORE.

### Route Handler Status Code Logic
- **File**: `server/api/ping/ingest.post.ts`
- **Pattern**: 201 (all accepted), 200 (all dupes or all rejected), 207 (mixed). `sendResponse()` helper with `setResponseStatus()`.

## Quality Classifier Patterns (M1-T10)

### Quality State Constants Pattern
- **File**: `server/utils/quality-states.ts`
- **Pattern**: Dedicated constants module with named exports. `mapQualityState()` for safe string-to-typed conversion. `QUALITY_COLORS` record for UI color mapping.

### Classification Engine Pattern (First-Match-Wins)
- **File**: `server/utils/quality-classifier.ts`
- **Pattern**: `classifyMonitor()` uses single aggregate query + ordered decision chain: disconnected → warmingUp → unstable → veryHigh → high → medium → low.

### Batch Classification with Change Detection
- **File**: `server/utils/quality-classifier.ts` → `classifyMonitorsBatch()`
- **Pattern**: Returns `Map<monitorId, QualityState>` of only changed monitors. Per-monitor try/catch for fault isolation.

### Background Sweep Plugin Pattern
- **File**: `server/plugins/quality-sweep.ts`
- **Pattern**: `defineNitroPlugin` with `setInterval`. Queries monitors with recent samples only. Env var validated with `Number.isFinite()`.

## CTE + ROW_NUMBER Pattern (M1-T7)
- **Pattern**: `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ... DESC)` to fetch latest row per entity, then LEFT JOIN. Single query, no N+1. NULL-safe with COALESCE for sort ordering.

## History Aggregation Pattern (M1-T8)
- **Pattern**: SQL GROUP BY on timestamp-truncated buckets. Application-side quality classification and down-sampling via bucket size adjustment.

## WebSocket Live Broadcast Pattern (M1-T9 / M2-T5)
- **Subscription map**: `Map<number, Set<WebSocketType>>` keyed by monitor_id
- **Message protocol**: JSON with `type` discriminator (subscribe, unsubscribe, subscribed, unsubscribed, snapshot, sample, error)
- **Snapshot on subscribe**: Last 100 samples, oldest-first order
- **Broadcast from ingest**: `broadcastSample()` exported from `server/ws/ping.ts`, called by ingest endpoint
- **Frontend composable**: `useWebSocket()` with auto-reconnect, connection state reactivity

## Rate Limiting Pattern (M1-T12)
- **Pattern**: In-memory sliding window rate limiter using `Map<string, RateLimitEntry>` with LRU eviction. Different limits for ingest (100/min) vs other endpoints (60/min). Nitro middleware auto-applied to `/api/*` paths.

## Client Page Patterns (M2-T6)
- **Client overview**: `app/pages/clients/[slug]/index.vue` — displays client identity, monitors list, sync status
- **Client settings**: `app/pages/clients/[slug]/settings.vue` — sync configuration form with PUT endpoint
- **Components**: `ClientInfo`, `ClientMonitors`, `SyncStatusIndicator`, `SyncSettingsForm` — all composable, reusable

## Inline Name Editing Pattern (M2-T7)
- **File**: `app/components/sidebars/ClientGroup.vue`
- **Pattern**: Click-to-edit inline name field with blur/enter to save, escape to cancel. Optimistic update with rollback on error. `PUT /api/clients/[slug]/name` endpoint.
