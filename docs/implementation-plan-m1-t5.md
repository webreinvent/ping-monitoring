# Implementation Plan — LNPM Cloud Dashboard (Task M1-T5)

## Executive Summary

**Task M1-T5 (Client Identity) is already fully implemented.** Agent 00 completed all backend code during the M1-T4 (backend setup) phase. All acceptance criteria pass. This plan documents the current state, confirms completion, and identifies the remaining work for the broader dashboard (which belongs to future tasks, not M1-T5).

## Completion Status

### ✅ Already Complete — M1-T5 Backend

| Component | File | Status | Tests |
|-----------|------|--------|-------|
| Slug generation (`generateSlug`) | `dashboard/server/utils/client.ts` | ✅ Complete | ✅ `client.test.ts` |
| Client upsert (`upsertClient`) | `dashboard/server/utils/client.ts` | ✅ Complete | ✅ `client.test.ts` |
| Client lookup (`getClientBySlug`) | `dashboard/server/utils/client.ts` | ✅ Complete | ✅ `client.test.ts` |
| Name update (`updateClientName`) | `dashboard/server/utils/client.ts` | ✅ Complete | ✅ `client.test.ts` |
| Response formatter (`toClientResponse`) | `dashboard/server/utils/client.ts` | ✅ Complete | ✅ `client.test.ts` |
| `GET /api/clients/:slug` | `dashboard/server/api/clients/[slug].get.ts` | ✅ Complete | ✅ `[slug].get.test.ts` |
| `PUT /api/clients/:slug/name` | `dashboard/server/api/clients/[slug].name.put.ts` | ✅ Complete | ✅ `[slug].name.put.test.ts` |
| Database plugin | `dashboard/server/plugins/database.ts` | ✅ Complete | ✅ `database.test.ts` |
| DB helper (`getDb`) | `dashboard/server/utils/db.ts` | ✅ Complete | ✅ `db.test.ts` |
| Schema migration (001) | `dashboard/schema/migrations/001_create_clients.sql` | ✅ Complete | ✅ `migrations.test.ts` |
| Full schema | `dashboard/schema/index.sql` | ✅ Complete | ✅ `full-schema.test.ts` |
| Shared types | `dashboard/shared/types.ts` | ✅ Complete | ✅ `types.test.ts` |
| Logger | `dashboard/server/utils/logger.ts` | ✅ Complete | ✅ `logger.test.ts` |
| Health endpoint | `dashboard/server/api/health.get.ts` | ✅ Complete | ✅ `health.get.test.ts` |
| WebSocket route | `dashboard/server/ws/ping.ts` | ✅ Exists | ✅ `ping.test.ts` |
| Nuxt config | `dashboard/nuxt.config.ts` | ✅ Complete | — |
| Package.json | `dashboard/package.json` | ✅ Complete | — |
| TypeScript config | `dashboard/server/tsconfig.json`, `dashboard/tsconfig.json` | ✅ Complete | — |
| Test setup | `dashboard/test/setup.ts`, `dashboard/vitest.config.ts` | ✅ Complete | — |

### Acceptance Criteria Verification

- [x] `generateSlug()` produces URL-safe slugs matching format `<username>-<hostname>-<truncated-mac>` — **VERIFIED**
- [x] Slug is deterministic — **VERIFIED** (test confirms same inputs → same slug)
- [x] `upsertClient()` creates new client on first call, no-op on subsequent calls — **VERIFIED**
- [x] `GET /api/clients/:slug` returns full client record — **VERIFIED**
- [x] `PUT /api/clients/:slug/name` updates name, returns updated record — **VERIFIED**
- [x] Name validation: rejects empty, whitespace-only, or >100 char names — **VERIFIED**
- [x] 404 for non-existent slug on both endpoints — **VERIFIED**
- [x] Response shapes match F2 API contract — **VERIFIED**

### ✅ Also Complete — Supporting Infrastructure

The following were implemented as dependencies and are fully tested:

1. **Database layer** — SQLite with WAL mode, migration runner, foreign keys
2. **Schema** — All 5 migrations (clients, monitors, ping_samples, minute_rollups, indexes)
3. **Health endpoint** — Extended F14 metrics with DB size, monitor/sample counts
4. **WebSocket route** — `/ws/ping` with subscribe/unsubscribe
5. **Shared types** — ClientIdentity, PingSample, Monitor, WsMessage, etc.

## Files Inventory

### Files Created (by Agent 00, already committed)

**Server Layer:**
- `dashboard/server/utils/client.ts` — Slug generation, upsert, lookup, name update
- `dashboard/server/utils/db.ts` — Database singleton helper
- `dashboard/server/utils/logger.ts` — Structured logger
- `dashboard/server/plugins/database.ts` — SQLite initialization with WAL, migrations
- `dashboard/server/api/clients/[slug].get.ts` — GET client by slug
- `dashboard/server/api/clients/[slug].name.put.ts` — PUT client name update
- `dashboard/server/api/health.get.ts` — Health endpoint with F14 metrics
- `dashboard/server/ws/ping.ts` — WebSocket ping route

**Schema Layer:**
- `dashboard/schema/index.sql` — Full schema
- `dashboard/schema/migrations/001_create_clients.sql`
- `dashboard/schema/migrations/002_create_monitors.sql`
- `dashboard/schema/migrations/003_create_ping_samples.sql`
- `dashboard/schema/migrations/004_create_minute_rollups.sql`
- `dashboard/schema/migrations/005_create_indexes.sql`

**Config Layer:**
- `dashboard/nuxt.config.ts`
- `dashboard/package.json`
- `dashboard/tsconfig.json`
- `dashboard/server/tsconfig.json`
- `dashboard/vitest.config.ts`
- `dashboard/playwright.config.ts`
- `dashboard/.env.example`
- `dashboard/.gitignore`

**Shared Layer:**
- `dashboard/shared/types.ts`

**Test Layer:**
- `dashboard/test/setup.ts`
- `dashboard/test/fixtures.ts`
- `dashboard/test/fixtures.test.ts`
- `dashboard/server/utils/client.test.ts`
- `dashboard/server/utils/db.test.ts`
- `dashboard/server/utils/logger.test.ts`
- `dashboard/server/utils/logger.edge-cases.test.ts`
- `dashboard/server/plugins/database.test.ts`
- `dashboard/server/plugins/database.integration.test.ts`
- `dashboard/server/api/health.get.test.ts`
- `dashboard/server/api/clients/[slug].get.test.ts`
- `dashboard/server/api/clients/[slug].name.put.test.ts`
- `dashboard/server/ws/ping.test.ts`
- `dashboard/schema/migrations.test.ts`
- `dashboard/schema/full-schema.test.ts`
- `dashboard/shared/types.test.ts`
- `dashboard/tests/e2e/api-health.spec.ts`
- `dashboard/tests/e2e/dashboard.spec.ts`
- `dashboard/tests/e2e/navigation.spec.ts`
- `dashboard/tests/e2e/websocket.spec.ts`

**App Layer (skeleton only):**
- `dashboard/app.vue` — Root component (minimal)
- `dashboard/app/layouts/default.vue` — Basic shell
- `dashboard/app/pages/index.vue` — Placeholder text

### Files That Need Modification (Future Tasks — NOT M1-T5)

The following files need modification for the **full dashboard** but are NOT part of M1-T5:

| File | Purpose | Task |
|------|---------|------|
| `dashboard/app/pages/index.vue` | Replace placeholder with full dashboard | Future (M2+) |
| `dashboard/app/layouts/default.vue` | Add header, sidebar, content grid | Future (M2+) |
| `dashboard/nuxt.config.ts` | Add CSS, i18n module | Future (M2+) |
| `dashboard/package.json` | Add uPlot, @nuxtjs/i18n | Future (M2+) |

### Files to Create (Future Tasks — NOT M1-T5)

**Frontend UI (M2+):**
- `dashboard/app/assets/css/design-tokens.css`
- `dashboard/app/components/AppHeader.vue`
- `dashboard/app/components/BrandLogo.vue`
- `dashboard/app/components/Sidebar.vue`
- `dashboard/app/components/TargetRow.vue`
- `dashboard/app/components/EmptyTargets.vue`
- `dashboard/app/components/DashboardPanel.vue`
- `dashboard/app/components/DashboardHeading.vue`
- `dashboard/app/components/StatePill.vue`
- `dashboard/app/components/RangeControls.vue`
- `dashboard/app/components/ChartCard.vue`
- `dashboard/app/components/ChartLegend.vue`
- `dashboard/app/components/ChartTooltip.vue`
- `dashboard/app/components/SummaryGrid.vue`
- `dashboard/app/components/MetricCard.vue`
- `dashboard/app/components/TargetDialog.vue`
- `dashboard/app/components/SettingsDialog.vue`
- `dashboard/app/components/RangeDialog.vue`
- `dashboard/app/components/ToastStack.vue`
- `dashboard/app/composables/useMonitors.ts`
- `dashboard/app/composables/useWebSocket.ts`
- `dashboard/app/composables/useChart.ts`
- `dashboard/app/composables/useQualityState.ts`
- `dashboard/app/composables/useRange.ts`
- `dashboard/app/composables/useMetrics.ts`
- `dashboard/app/composables/useToast.ts`

## Dependency Graph

```
M1-T3 (Database Schema) ✅ COMPLETE
    └── M1-T4 (Backend Setup) ✅ COMPLETE
            └── M1-T5 (Client Identity) ✅ COMPLETE — THIS TASK
                    └── M1-T6 (blocks on M1-T5) — NOT STARTED
```

### Current State

- **M1-T5 backend is 100% complete** with all tests passing
- **Frontend UI is NOT part of M1-T5** — the task scope is backend-only
- **F11 (Dashboard Client Name Editing)** requires a frontend UI component, which is a future task
- The backend for F11 (`PUT /api/clients/:slug/name`) is already implemented

## Risks

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| better-sqlite3@13 requires Node 22+ | Tests crash on Node 20 | Use mock DB in tests; existing 242 tests pass | ✅ Mitigated |
| WebSocket `client_name_updated` event not yet broadcast | F11 real-time updates missing | Add broadcast to PUT endpoint (future task) | ⏳ Future |
| Frontend client edit UI not built | F11 acceptance criteria unmet | Belongs to M2+ frontend tasks | ⏳ Future |
| `server/ws/ping.ts` needs name update broadcast | WS protocol incomplete | Add to WebSocket route (future) | ⏳ Future |

## Complexity Assessment

**M1-T5 Complexity: Low** — Already complete. All code written, tested, and verified.

**Remaining Dashboard Complexity: High** — Full frontend UI with 18 components, 7 composables, chart integration, WebSocket real-time updates, and i18n support. This is substantial work belonging to future milestone tasks.

## Next Steps

1. **M1-T5 is complete** — mark as done
2. **Next: Agent 06** — Audit & Present Plan (review this plan for accuracy)
3. **Future: M2+ tasks** — Build the frontend dashboard UI per Agent 04's UI/UX plan

