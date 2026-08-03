# LNPM Cloud Dashboard — Implementation Plan (Memory Entry)

> Updated: 2026-08-03
> Source: Agent 05 (Create Implementation Plan) — Agent 00 executed
> Full plan: `docs/implementation-plan.md`

## Executive Summary

**M1-T5 (Client Identity) is 100% complete.** Agent 00 implemented all backend code during the M1-T4 (backend setup) phase. All acceptance criteria verified and passing.

**Remaining: Full dashboard frontend** — This is a substantial M2+ effort (51 file operations, 61 steps) requiring 18 Vue components, 7 composables, uPlot chart integration, WebSocket real-time updates, and i18n support.

## M1-T5 Completion Status

### ✅ All Complete — Backend

| Component | File | Tests |
|-----------|------|-------|
| Slug generation | `server/utils/client.ts` | ✅ `client.test.ts` |
| Client upsert | `server/utils/client.ts` | ✅ `client.test.ts` |
| Client lookup | `server/utils/client.ts` | ✅ `client.test.ts` |
| Name update | `server/utils/client.ts` | ✅ `client.test.ts` |
| `GET /api/clients/:slug` | `server/api/clients/[slug].get.ts` | ✅ `[slug].get.test.ts` |
| `PUT /api/clients/:slug/name` | `server/api/clients/[slug].name.put.ts` | ✅ `[slug].name.put.test.ts` |
| Database plugin | `server/plugins/database.ts` | ✅ `database.test.ts` |
| Schema migrations (5) | `schema/migrations/001-005_*.sql` | ✅ `migrations.test.ts` |
| Shared types | `shared/types.ts` | ✅ `types.test.ts` |
| Health endpoint | `server/api/health.get.ts` | ✅ `health.get.test.ts` |
| WebSocket | `server/ws/ping.ts` | ✅ `ping.test.ts` |

### Acceptance Criteria: All Pass

- [x] `generateSlug()` → URL-safe, deterministic `<username>-<hostname>-<truncated-mac>`
- [x] `upsertClient()` → idempotent (INSERT OR IGNORE)
- [x] `GET /api/clients/:slug` → full client record, 404 on missing
- [x] `PUT /api/clients/:slug/name` → validates 1-100 chars, 404 on missing
- [x] Response shapes match F2 API contract

## Remaining Dashboard Implementation (M2+)

### Phases (from Agent 04 UI/UX Plan)

1. **Foundation** (Steps 1-10): Design tokens CSS, update nuxt.config (CSS + i18n), install uPlot + @nuxtjs/i18n, locale JSON files (5 locales)
2. **Business Logic** (Steps 11-18): Server utils — ping validation, ping ingest, quality classifier, cache, dashboard aggregation (HistoryResponse builder)
3. **API Routes** (Steps 19-25): `GET /api/monitors`, `GET /api/monitors/:id`, `POST /api/ping/ingest`, WebSocket broadcast, rate-limit middleware
4. **Composables** (Steps 26-33): `useMonitors`, `useWebSocket`, `useChart`, `useQualityState`, `useRange`, `useMetrics`, `useToast`, `useSettings`
5. **Components** (Steps 34-47): 18 Vue SFC components — AppHeader, BrandLogo, Sidebar, TargetRow, EmptyTargets, DashboardPanel, DashboardHeading, StatePill, RangeControls, ChartCard, ChartLegend, ChartTooltip, SummaryGrid, MetricCard, TargetDialog, SettingsDialog, RangeDialog, ToastStack
6. **Tests** (Steps 48-61): Unit tests for composables, component tests, API integration tests, E2E tests

### Critical Files to Create

| File | Purpose |
|------|---------|
| `app/assets/css/design-tokens.css` | CSS custom properties mirroring desktop app |
| `app/composables/useChart.ts` | uPlot lifecycle management |
| `app/components/ChartCard.vue` | uPlot chart component |
| `app/components/Sidebar.vue` | Monitor list with client grouping |
| `app/pages/index.vue` | Full dashboard page (replace placeholder) |
| `server/utils/ping-ingest.ts` | Core ingest engine |
| `server/api/ping/ingest.post.ts` | Batch ingest endpoint |
| `server/api/monitors.get.ts` | Monitor list endpoint |
| `server/api/monitors/[id].get.ts` | Monitor history endpoint |

### File Counts

- **Create:** 43 new files (18 components, 7 composables, 8 server routes/utils, 5 locales, 1 CSS, 4 tests)
- **Modify:** 8 files (index.vue, default.vue, nuxt.config.ts, package.json, shared/types.ts, ws/ping.ts, 2 API routes)

## Dependencies

```
M1-T1 (Nuxt project) ✅
M1-T3 (Database Schema) ✅
M1-T4 (Backend Setup) ✅
    └── M1-T5 (Client Identity) ✅ — COMPLETE
            └── M1-T6 (blocks on M1-T5) — NOT STARTED
```

## Risks

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| better-sqlite3@13 requires Node 22+ | Tests crash on Node 20 | Mock DB in tests; 242 existing tests pass | ✅ Mitigated |
| WebSocket `client_name_updated` broadcast | F11 real-time updates | Add to PUT endpoint | ⏳ Future |
| uPlot + Vue 3 integration | Chart rendering bugs | Prototype early, use lifecycle hooks | ⏳ Future |
| Nitro WebSocket experimental | WS stability | Test thoroughly in dev | ⏳ Future |
| Type drift (snake_case DB → camelCase API) | Runtime errors | Strict TypeScript, test coverage | ⏳ Ongoing |

## Complexity: High (M2+ frontend)
## Estimated Effort: 56-82 hours (full dashboard)
## Next Agent: Agent 06 (Audit & Present Plan)
