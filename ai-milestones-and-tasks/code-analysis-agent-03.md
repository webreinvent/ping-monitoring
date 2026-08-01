# Code Analysis — Agent 03

## Code Analysis

### Related Files

#### Desktop App (source of truth — read-only, do not modify)

| File | Purpose |
|------|---------|
| `src/types.ts` | Shared TypeScript types: `Target`, `PingSample`, `QualityMetrics`, `QualityState`, `QualityReason`, `QualityThresholds`, `LiveTargetStatus`, `DashboardSnapshot`, `HistoryResponse`, `HistorySeries`, `HistoryPoint`, `QualityIntervalRecord`, `RangeSummary`, `StateTransition`, `QualityTransitionEvent`, `AppSettings`, `UpdateInfo`, `UpdatePhase`, `UpdateProgressEvent`, `UserErrorPayload`, `StorageInfo` |
| `src/chart.ts` | uPlot chart: `LatencyChart` class, series rendering, quality state coloring, tooltip, bar/line mode, threshold zones, pan/zoom, `aggregateData()`, `alignSeries()`, `getBucketSize()`, `barColor()`, `formatXAxis()`, `formatYAxis()` |
| `src/api.ts` | Tauri IPC API: `api` object with typed methods for dashboard, targets, history, settings, storage, updates |
| `src/main.ts` | UI entry: vanilla DOM, template HTML, event delegation, `renderDashboard()`, `aggregateState()`, dialogs, sidebar resizer, toast notifications |
| `src/dashboard-selection.ts` | Multi-target aggregation: `averageLatestLatency()`, `aggregateRangeSummary()`, `weightedAverage()`, `minimum()`, `maximum()`, `percentage()` |
| `src/i18n.ts` | i18n: 5 locales (en, ko, ja, zh-CN, zh-TW), `t()`, `stateLabel()`, `reasonLabel()`, `formatLatency()`, `formatPercent()`, `formatDuration()`, `formatDateTime()`, `formatBytes()`, `formatError()`, `normalizeError()`, `resolveLanguage()` |
| `src/update-state.ts` | State machine: `reduceUpdateUiState()` for update UI, `UpdateUiState`/`UpdateUiEvent` discriminated union |

#### Dashboard — Currently Implemented (M1-T1)

| File | Purpose |
|------|---------|
| `dashboard/nuxt.config.ts` | Nuxt 4 config: `node-server` preset, WebSocket experimental, strict TS, SSR, CORS, port 3000 |
| `dashboard/package.json` | Dependencies: nuxt 4, vue 3.5, better-sqlite3, ws, vitest, playwright, vue-tsc |
| `dashboard/tsconfig.json` | Extends `.nuxt/tsconfig.json` |
| `dashboard/app.vue` | Minimal shell: `<NuxtLayout>` + `<NuxtPage>` |
| `dashboard/app/layouts/default.vue` | Default layout: `.dashboard-shell` flex column |
| `dashboard/app/pages/index.vue` | Index page: monitor placeholder with `data-testid` attributes |
| `dashboard/.env.example` | 13 env vars: PORT, DATABASE_PATH, LOG_LEVEL, WS config, ingest config, rate limiting, retention, cache |
| `dashboard/vitest.config.ts` | Vitest: node env, `**/*.test.ts`, v8 coverage, `~`/`@` aliases |
| `dashboard/playwright.config.ts` | E2E: chromium, `localhost:3000`, auto-start dev server, sequential workers |
| `dashboard/server/api/health.get.ts` | Health: status, timestamp, uptime, version, DB status |
| `dashboard/server/plugins/database.ts` | DB plugin: singleton, WAL mode, foreign keys, migration runner |
| `dashboard/server/utils/db.ts` | `getDb()` from `globalThis.__db` |
| `dashboard/server/utils/logger.ts` | Structured logger: `debug/info/warn/error` with `LOG_LEVEL` |
| `dashboard/server/ws/ping.ts` | WS stub: connect/echo/disconnect |
| `dashboard/shared/types.ts` | Shared types: `ClientIdentity`, `PingSample`, `Monitor`, `QualityClass`, `WsMessage`, `HealthResponse`, `IngestRequest/Response` |
| `dashboard/schema/index.sql` | Schema placeholder (empty) |

#### Test Files

| File | Tests |
|------|-------|
| `dashboard/server/api/health.get.test.ts` | Health endpoint response shape, DB status OK/error |
| `dashboard/server/utils/db.test.ts` | `getDb()` throws when not initialized, returns mock when set |
| `dashboard/server/utils/logger.test.ts` | Log levels, env override, output format, meta JSON |
| `dashboard/server/ws/ping.test.ts` | WS open/message/close, echo, invalid JSON handling |

### Reusable code:

1. **`src/types.ts` → `dashboard/shared/types.ts`** — The desktop types are the canonical source. The dashboard's `shared/types.ts` has already been created with dashboard-specific types (`ClientIdentity`, `Monitor`, etc.). The desktop `Target`, `HistoryResponse`, `HistoryPoint`, `QualityIntervalRecord`, `RangeSummary` types should be mirrored in the dashboard's shared types for the history API (F6). **Note:** There is a type divergence — the desktop `PingSample` uses `targetId`/`timestampMs`/`latencyMs`, while the dashboard `PingSample` uses `clientName`/`timestamp`/`rtt`/`target`. These are different shapes for different layers.

2. **uPlot chart patterns (`src/chart.ts`)** — The `LatencyChart` class is the reference implementation. Key patterns to reuse in the dashboard:
   - Color palette: `["#5eead4", "#60a5fa", "#c084fc", "#f472b6", "#facc15"]`
   - Bar color thresholds: `[50, "#4ade80"], [100, "#facc15"], [200, "#fb923c"], [Infinity, "#f87171"]`
   - Threshold zone lines: red (200ms), orange (150ms), yellow (100ms), green (50ms)
   - Quality state → color mapping for status dots
   - Data aggregation with `getBucketSize()` and `aggregateData()`
   - Series alignment with gap detection (`alignSeries()`)
   - Tooltip positioning logic (`calculateTooltipPosition`)

3. **`src/dashboard-selection.ts`** — Aggregation functions for multi-monitor summary: `aggregateRangeSummary()` (weighted average latency, min/max, p95, stability percentages). Can be adapted for the dashboard's `/api/monitors` response.

4. **`src/i18n.ts`** — Formatting functions are portable: `formatLatency()`, `formatPercent()`, `formatDuration()`, `formatDateTime()`, `formatBytes()`, `formatError()`, `normalizeError()`. The i18n pattern (catalog-based with parameter interpolation) should be adapted for the Vue dashboard using Nuxt's built-in i18n module or a simplified port.

5. **`src/update-state.ts`** — State machine pattern (`reduceUpdateUiState`) — reusable pattern for any state-driven UI in the dashboard.

6. **`dashboard/server/plugins/database.ts`** — Database singleton pattern with WAL mode, migration runner. Already implemented and working.

7. **`dashboard/server/utils/logger.ts`** — Structured logger with level filtering — already implemented and used by the health endpoint.

8. **`dashboard/test/fixtures.ts`** — Factory pattern for test data (`createPingSample`, `createMonitor`, etc.) — reusable for all new tests.

### Patterns to follow:

**Coding style:**
- Strict TypeScript (`strict: true`, `noUnusedLocals`, `noUnusedParameters`)
- No `any` types — use `unknown` and narrow with type guards
- Explicit return types on all functions
- `readonly` modifiers where appropriate
- Type-safe discriminated unions (e.g., `UpdateUiEvent` with `type` field)

**Naming conventions:**
- camelCase for functions, variables, methods
- PascalCase for types, interfaces, classes, enums
- kebab-case for file names (e.g., `health.get.ts`, `ping-ingest.post.ts`)
- File suffixes: `.get.ts`, `.post.ts`, `.put.ts` for API routes
- Test files: `*.test.ts` (Vitest), `*.spec.ts` (Playwright)

**Import patterns:**
- Relative imports with `./` prefix for local files
- Grouped: Node.js builtins → external packages → project modules → types
- Path aliases: `~` and `@` both resolve to dashboard root (configured in vitest.config.ts)

**UI patterns (desktop → dashboard mapping):**
- Desktop uses vanilla DOM + template literals → Dashboard uses Vue 3 `<script setup>` + `<template>`
- Desktop uses `renderDashboard()` for state-driven re-render → Dashboard uses Vue reactivity
- Desktop uses event delegation on `root` → Dashboard uses Vue event handlers (`@click`)
- Desktop uses `byId()` for element lookup → Dashboard uses template refs / reactivity

**Error handling:**
- `try/catch` with `showToast(formatError(error), "error")`
- `normalizeError()` converts any error to `UserErrorPayload` (code + detail)
- Error codes map to i18n keys via `errorKeys` lookup table
- Format: `formatError(error)` returns localized summary, optionally with raw detail appended

**Test patterns:**
- Vitest with `describe`/`it` blocks, `expect().toBe()`, `expect().toEqual()`
- Test files co-located with source: `src/chart.ts` → `src/chart-tooltip.test.ts`
- Factory fixtures in `test/fixtures.ts` for consistent test data
- Console silenced during tests (setup.ts)
- E2E tests use Playwright with `chromium` project, sequential workers

### Error handling pattern:

```
try {
  await someOperation();
} catch (error) {
  showToast(formatError(error), "error");
}
```

`formatError()` normalizes via `normalizeError()` → `UserErrorPayload { code, detail }` → looks up `errorKeys[code]` → interpolates i18n template → returns localized string with optional raw detail appended.

### Code to avoid modifying:

- **`src/`** — Entire desktop app directory. Do not modify. This is the Tauri desktop application.
- **`src-tauri/`** — Rust backend for the desktop app. Do not modify.
- **`requirements/`** — Requirements documentation. Read-only reference.
- **`docs/`** — Design specs. Read-only reference.
- **`dashboard/server/plugins/database.ts`** — Database plugin is the foundation. Only add to it, don't change the singleton pattern.
- **`dashboard/shared/types.ts`** — Shared types are consumed by both server and client. Changes must be coordinated.
- **`dashboard/schema/migrations/`** — Once applied, migration files should not be modified. Add new migrations instead.

### Architectural decisions:

- **ADR-001 (Nuxt 4 + Nitro)** — Confirmed: `nuxt.config.ts` uses `node-server` preset, WebSocket experimental enabled. The project is correctly configured for persistent runtime.
- **ADR-002 (SQLite WAL)** — Confirmed: `server/plugins/database.ts` enables WAL mode and foreign keys. Migrations run on startup.
- **ADR-003 (In-memory LRU)** — Not yet implemented. Planned as `server/utils/cache.ts`.
- **ADR-004 (Client Identity)** — Schema defined in data models. Slug generation logic to be implemented in `server/utils/client.ts`.
- **ADR-005 (Batched Ingest)** — Ingest endpoint not yet implemented. Planned as `server/api/ping/ingest.post.ts`.
- **ADR-006 (Nitro WebSocket)** — Stub exists at `server/ws/ping.ts`. Echo-only. Full topic-based subscriptions planned for F7.
- **ADR-007 (uPlot Charts)** — Desktop chart code is the reference. Will be adapted for Vue in dashboard components.
- **ADR-008 (Single-Node Deploy)** — Confirmed: no containerization, one process, one SQLite file.
- **ADR-009 (Raw Samples, Backend Computed)** — Confirmed: `ping_samples` stores raw data only. `minute_rollups` pre-aggregates. Quality classifier computes state from raw samples.

**Type divergence noted:** The desktop `src/types.ts` and dashboard `dashboard/shared/types.ts` have different type shapes for overlapping concepts (e.g., `PingSample`, `QualityState`). This is expected because the desktop types describe the local probe data model while dashboard types describe the cloud ingest/API model. When building the history API (F6), the dashboard must transform its cloud data model into the desktop's `HistoryResponse` format so the same uPlot chart code can render it.

### Next agent: Agent 04 (Plan UI/UX Design)

### Gate

- [x] Related code identified and read
- [x] Patterns documented
- [x] Reusable code identified
- [x] Conventions noted
