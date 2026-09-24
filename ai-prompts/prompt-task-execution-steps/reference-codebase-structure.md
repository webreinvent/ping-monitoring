# LNPM Codebase Structure

## Root (Tauri Desktop Client)

```
ping-monitoring/
├── src/                    # Tauri frontend (plain TypeScript, no framework)
│   ├── main.ts             # Entire app UI — imperative DOM, innerHTML templates (~1500 lines)
│   ├── api.ts              # Tauri invoke bridge — all methods are invoke<ReturnType>("cmd", {args})
│   ├── types.ts            # Frontend types (Target, PingSample, AppSettings, SyncEvent, etc.)
│   ├── chart.ts            # uPlot wrapper (LatencyChart class)
│   ├── chart-tooltip.ts
│   ├── dashboard-selection.ts
│   ├── i18n.ts             # 5 languages: en, ko, ja, zh-CN, zh-TW
│   ├── sync-icon.ts
│   ├── update-state.ts
│   ├── styles.css          # Plain CSS for desktop UI
│   └── *.test.ts           # Colocated vitest tests
├── src-tauri/
│   ├── tauri.conf.json     # Tauri v2 config (CSP, updater, windows: main + popup)
│   ├── Cargo.toml          # lnpm v0.2.2-wri.1, edition 2024, rust-version 1.85
│   └── src/
│       ├── main.rs         # Thin bin → lnpm_lib::run
│       ├── lib.rs          # App builder, setup, generate_handler!, state
│       ├── domain.rs       # Core types + unix_time_ms()
│       ├── monitor.rs      # MonitorService — per-target tokio interval loop
│       ├── probe.rs        # SystemPingProbe — shells out to OS ping binary
│       ├── quality.rs      # QualityClassifier state machine
│       ├── storage.rs      # rusqlite DB (lnpm.sqlite3), schema v2 + ALTER TABLE
│       ├── sync.rs         # SyncService → dashboard (reqwest, batch, backoff)
│       ├── commands.rs     # All #[tauri::command] fns + CommandError mapping
│       ├── tray.rs         # Tray icon + notifications + TauriEventSink
│       ├── i18n.rs
│       ├── updater.rs      # Auto-update (tauri-plugin-updater)
│       └── *.rs tests      # #[cfg(test)] mod tests
├── package.json            # pnpm@11.9.0, vite, tsc, vitest, @tauri-apps/cli
├── pnpm-workspace.yaml     # packages: [dashboard]; allowBuilds: better-sqlite3, esbuild
├── AGENTS.md               # AI-context file — conventions, ADRs, per-milestone patterns
├── ai-milestones-and-tasks/
│   ├── project-dashboard.md
│   ├── milestone-01-backend-platform/
│   ├── milestone-02-dashboard-ui/
│   └── milestone-03-tauri-client-enhancement/
├── ai-prompts/
│   ├── prompt-task-execution.md          # This orchestrator
│   └── prompt-task-execution-steps/      # Step + reference files
├── ai-base-prompts/                      # Generator prompts (meta)
├── docs/                                 # Project documentation (see reference-key-files)
├── requirements/                         # Feature specs F1–F14
└── memory/                               # Project memory files (MEMORY.md index)
```

## Dashboard (Nuxt 4 + Nitro Cloud Dashboard)

```
dashboard/
├── nuxt.config.ts              # Nuxt 4, node-server, experimental.websocket, port 3000
├── playwright.config.ts        # E2E — testDir ./tests/e2e, chromium, workers 1
├── vitest.config.ts            # Unit/integration — pool forks, setupFiles, aliases ~/@
├── package.json                # pnpm@10.4.1, nuxt ^4.1, better-sqlite3 ^11.10, ws ^8.18
├── .env.example                # 19 env vars (DATABASE_PATH, LOG_LEVEL, PORT, INGEST_MAX_SAMPLES, …)
├── app/
│   ├── app.vue                 # <NuxtLayout><NuxtPage/></NuxtLayout>
│   ├── pages/
│   │   ├── index.vue           # All Monitors overview + AllMonitorsChart
│   │   ├── monitors/[id].vue   # Monitor detail view
│   │   └── clients/[slug]/
│   │       ├── index.vue       # Client overview
│   │       └── settings.vue    # Client settings
│   ├── components/
│   │   ├── charts/             # AllMonitorsChart, LatencyChart, MonitorHeader, MonitorSummary
│   │   ├── clients/            # ClientIdentity, ClientInfo, ClientMonitors, SyncSettingsForm, SyncStatusIndicator
│   │   ├── layout/             # DashboardHeader
│   │   ├── shared/             # EmptyState, StatusDot, TimeRangeSelector, NavigationBreadcrumb, SidebarContent
│   │   ├── sidebars/           # ClientGroup, MonitorRow
│   │   └── DashboardSidebar.vue
│   ├── composables/
│   │   ├── useWebSocket.ts
│   │   ├── useLiveChart.ts     # WS samples → Float64Array (cap 2000) → rAF → uPlot
│   │   ├── useMonitors.ts
│   │   ├── useMonitorHistory.ts
│   │   ├── useClientSettings.ts
│   │   ├── useTimeWindow.ts
│   │   ├── useChartSeries.ts
│   │   ├── useDashboardPalette.ts
│   │   └── useResponsiveSidebar.ts
│   ├── utils/
│   │   ├── format.ts
│   │   ├── live-aggregation.ts
│   │   └── quality-bands.ts
│   ├── layouts/
│   └── assets/css/
│       ├── dashboard.css       # Design tokens, global styles
│       └── charts.css
├── server/
│   ├── api/
│   │   ├── health.get.ts
│   │   ├── monitors.get.ts
│   │   ├── monitors/
│   │   │   ├── [id].get.ts
│   │   │   ├── [id].delete.ts
│   │   │   └── index.delete.ts
│   │   ├── clients/
│   │   │   ├── [slug].get.ts
│   │   │   ├── [slug].delete.ts
│   │   │   ├── [slug].name.put.ts
│   │   │   ├── [slug].settings.get.ts
│   │   │   └── [slug].settings.put.ts
│   │   └── ping/
│   │       └── ingest.post.ts
│   ├── routes/ws/
│   │   └── ping.ts             # defineWebSocketHandler, broadcastSample, allPeers
│   ├── plugins/
│   │   ├── database.ts         # better-sqlite3 singleton (globalThis.__db), WAL, migrations
│   │   ├── quality-sweep.ts    # 60s interval re-classify
│   │   └── retention.ts        # Periodic data cleanup
│   ├── middleware/
│   │   └── rate-limit.ts       # Per-IP sliding window (ingest 100/min, others 60/min)
│   └── utils/
│       ├── db.ts               # getDb() — never import plugin directly
│       ├── client.ts
│       ├── monitors.ts
│       ├── history.ts
│       ├── ping-ingest.ts      # Ingest engine: ensureMonitor, bulk INSERT OR IGNORE
│       ├── ping-validation.ts  # validateSample, VALID_STATUSES
│       ├── ping-types.ts       # Wire contract types
│       ├── quality-classifier.ts
│       ├── quality-states.ts   # mapQualityState, classifyMonitorsBatch
│       ├── rate-limiter.ts
│       ├── retention.ts
│       └── logger.ts
├── shared/
│   └── types.ts                # Client-server type contract (import explicitly, NOT auto-imported)
├── schema/
│   ├── index.sql               # Assembled from migrations
│   └── migrations/
│       ├── 001_*.sql           # Initial schema
│       ├── 002_*.sql
│       ├── 003_*.sql
│       ├── 004_*.sql
│       ├── 005_*.sql           # Indexes
│       └── 006_quality_state_updated_at.sql
├── test/
│   ├── setup.ts                # Vitest setup — mocks better-sqlite3
│   ├── fixtures.ts
│   └── mock-db-factory.ts
└── tests/
    └── e2e/
        ├── api-health.spec.ts
        ├── dashboard.spec.ts
        ├── navigation.spec.ts
        └── websocket.spec.ts
```

## Data Flow (End-to-End)

```
Desktop client (Tauri)
  per-target tokio interval → SystemPingProbe (shell ping) → QualityClassifier
  → in-memory LiveTargetStatus + lnpm.sqlite3 (rusqlite)
  → Tauri events → vanilla-TS UI re-render

Cloud sync
  Rust SyncService batches unsynced samples
  → POST {dashboardIngestUrl}/api/ping/ingest (reqwest, retry ×3)

Dashboard (Nitro)
  ingest handler → ingestPingBatch (upsert client, auto-create monitors,
  bulk INSERT OR IGNORE into ping_samples, update monitor state, classify quality)
  → SQLite (WAL) → broadcastSample to /ws/ping subscribers

Dashboard UI (Nuxt 4 / Vue 3)
  useWebSocket → useLiveChart (Float64Array, rAF) → uPlot
  REST: /api/monitors, /api/clients/[slug]
  quality-sweep + retention plugins run periodically
```

Two independent SQLite DBs:
- Client: `lnpm.sqlite3` (rusqlite, target-centric, `cloud_synced_at_ms` from schema v2)
- Dashboard: `.data/lingering.db` (better-sqlite3, client→monitor→samples + minute_rollups)

Data moves one way: client → dashboard.
