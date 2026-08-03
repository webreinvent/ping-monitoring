# LNPM Cloud Dashboard — Implementation Plan (Memory Entry)

> Saved: 2026-08-02
> Source: Agent 05 (Create Implementation Plan)
> Full plan: `docs/implementation-plan.md`

## Summary

- **Total:** 61 steps across 6 phases, 51 file operations (43 create, 8 modify)
- **Estimated effort:** 56-82 hours
- **Complexity:** High
- **Key risks:** uPlot integration, Nitro WebSocket experimental, type drift between snake_case DB and camelCase API

## Phases

1. **Foundation** (Steps 1-10): Types, config, CSS, locales
2. **Business Logic** (Steps 11-18): Server utils (validation, ingest, quality classifier, cache, aggregation)
3. **API Routes** (Steps 19-25): 5 API endpoints, WebSocket, rate-limit middleware
4. **Composables** (Steps 26-33): 8 Vue 3 composables (monitors, history, WebSocket, chart, range, toast, settings, health)
5. **Components** (Steps 34-47): 12 Vue components + layout/page updates
6. **Tests** (Steps 48-61): Unit + API + E2E tests

## Critical Files

| File | Status |
|------|--------|
| `shared/types.ts` | MODIFY — full rewrite to match API design |
| `server/utils/ping-ingest.ts` | CREATE — core ingest engine |
| `server/api/ping/ingest.post.ts` | CREATE — batch ingest endpoint |
| `server/ws/ping.ts` | MODIFY — full WebSocket protocol |
| `server/utils/dashboard-aggregation.ts` | CREATE — HistoryResponse builder |
| `app/components/ChartCard.vue` | CREATE — uPlot chart component |
| `app/composables/useChart.ts` | CREATE — uPlot lifecycle |
| `app/pages/index.vue` | MODIFY — full dashboard page |

## Build Order Priority

1. Shared types (Step 1) — everything depends on this
2. Business logic utils (Steps 11-18) — deterministic, testable
3. API routes (Steps 19-23) — thin wrappers
4. WebSocket (Step 24) — highest risk, prototype early
5. Composables + Components (Steps 26-47) — frontend
6. Tests (Steps 48-61) — alongside implementation

## Dependencies

- Requires: M1-T1 (Nuxt project), M1-T2 (database plugin)
- Blocks: None (this is a planning artifact, not a code change)
