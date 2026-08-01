# AGENTS.md — LNPM Cloud Dashboard

AI context file for the LNPM Cloud Dashboard project. Contains conventions, patterns, and architectural decisions to guide AI-assisted development.

---

## Project Overview

**Project:** LNPM Cloud Dashboard
**Framework:** Nuxt 4 + Nitro v2 (persistent `node-server` runtime)
**Database:** SQLite via `better-sqlite3` with WAL mode
**Language:** TypeScript (strict mode)
**Package Manager:** pnpm (v10.4.1)

The dashboard lives in `./dashboard/` at the project root. The existing LNPM desktop app code (in `./src/` and `./src-tauri/`) is untouched.

---

## Directory Structure

```
dashboard/
├── app/                     # Vue 3 frontend
│   ├── app.vue             # Root shell (<NuxtLayout> + <NuxtPage>)
│   ├── layouts/            # Layout components (default.vue)
│   └── pages/              # File-based routes (index.vue)
├── server/                 # Nitro backend
│   ├── api/                # File-based API routes (health.get.ts, etc.)
│   ├── plugins/            # Nitro plugins (database.ts)
│   ├── utils/              # Server utilities (db.ts, logger.ts)
│   └── ws/                 # WebSocket handlers (ping.ts)
├── shared/                 # TypeScript types shared between server and client
│   └── types.ts            # Interfaces: PingSample, Monitor, WsMessage, etc.
├── schema/                 # SQLite migrations
│   ├── index.sql           # Schema placeholder
│   └── migrations/         # Numbered migration files (001_initial_setup.sql)
├── test/                   # Test setup and fixtures
│   ├── setup.ts            # Vitest setup (console silence, DB cleanup)
│   └── fixtures.ts         # Factory functions for test data
├── nuxt.config.ts          # Nuxt configuration
├── vitest.config.ts        # Vitest configuration
├── playwright.config.ts    # Playwright E2E configuration
└── .env.example            # Environment variable template
```

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Backend** | Nuxt 4 + Nitro v2 (`node-server` preset) | Single codebase for API + UI, native WebSocket, file-based routing, persistent process |
| **Storage** | SQLite (`better-sqlite3`) with WAL mode | Single-file, zero ops, concurrent reads/writes via WAL |
| **Caching** | In-memory LRU cache | Hot monitor state in process memory; recoverable from SQLite |
| **Real-time** | WebSocket (`defineWebSocketHandler`) | Built-in via `server/ws/` routes, per-monitor topic subscriptions |
| **Charts** | uPlot | Canvas-based, fast, small bundle; already used in LNPM desktop |
| **Frontend** | Nuxt 4 + Vue 3 Composition API | Same framework as backend, mirrors desktop app design |
| **Testing** | Vitest (unit/integration), Playwright (E2E) | Vitest for server logic; Playwright for browser tests |
| **Language** | TypeScript (strict mode, ^5.7.0) | End-to-end type safety from ingest payload to chart data |

## Coding Conventions

### API Routes
- **File-based routing**: `server/api/health.get.ts` → `GET /api/health`
- Use `defineEventHandler` with async/await
- Return structured JSON (never raw strings)
- Always wrap in try/catch; return `{ status: "error", message }` on failure
- Cache module-level constants (e.g., `package.json` version) using IIFE — don't re-read files on every request

### Database
- **Singleton pattern**: `server/plugins/database.ts` initializes one `better-sqlite3` connection per process
- DB instance stored on `globalThis.__db` (access via `getDb()` from `server/utils/db.ts`)
- Always enable WAL mode (`PRAGMA journal_mode = WAL`) and foreign keys (`PRAGMA foreign_keys = ON`)
- **Migrations**: Numbered files in `schema/migrations/` (e.g., `001_initial_setup.sql`). The tracking table is created by the plugin (not a migration file). Each migration is tracked by filename — the plugin skips already-applied ones.
- Wrap every migration in try/catch with `console.error` + rethrow

### WebSocket
- Use `defineWebSocketHandler` with `open`, `message`, `close` lifecycle
- Messages are JSON-serialized strings; access via `message.text` (crossws passes a `Message` object)
- Store in `server/ws/` directory
- Enable via `nitro.experimental.websocket: true` in `nuxt.config.ts`

### Shared Types
- `shared/types.ts` holds plain TypeScript interfaces used by both server and client
- Import types explicitly — Nuxt auto-import does NOT work for type-only exports
- Do not use `imports.dirs` for shared types (it only picks up functions and constants)

### Logger
- Use the structured logger from `server/utils/logger.ts`
- Named exports: `debug`, `info`, `warn`, `error` (no default export)
- Respects `LOG_LEVEL` env var; falls back to `NODE_ENV` (production→info, development→debug)
- ISO 8601 timestamps, optional JSON meta argument

### Vue Components
- Use `<script setup lang="ts">` (Composition API)
- Use `useHead()` for page titles
- Use `data-testid` attributes for E2E test hooks
- Scoped CSS with semantic HTML elements (`<section>`, `<h2>`, etc.)

### Testing
- **Vitest** (unit/integration): Node environment, global test functions, V8 coverage
  - Test setup (`test/setup.ts`) silences `console.*` by default and clears `globalThis.__db` before each test
  - Fixtures (`test/fixtures.ts`) use factory functions with `Partial<T>` overrides
- **Playwright** (E2E): Browser tests targeting `data-testid` attributes
- Use `nuxt typecheck` (not `nuxi typecheck`) in Nuxt 4

### Environment Variables
- Template in `dashboard/.env.example` — 14 variables across 8 categories
- Always validate env vars before using as numbers (`parseInt` silently produces `NaN`)
- Key variables: `DATABASE_PATH`, `LOG_LEVEL`, `PORT`, `WS_HEARTBEAT_INTERVAL_MS`, `INGEST_MAX_SAMPLES`

## Nuxt 4 / Nitro Specifics

- `compatibilityVersion` is NOT needed in Nuxt 4 (removed from config)
- `nuxt typecheck` is the correct typecheck command (not `nuxi typecheck`)
- `nitro.preset: "node-server"` configures persistent runtime (not serverless)
- WebSocket support requires `nitro.experimental.websocket: true`
- CORS is configured via `routeRules` in `nuxt.config.ts`
- `ssr: true` is required for server routes to work

## ADRs (Architectural Decision Records)

| ADR | Decision | Summary |
|-----|----------|---------|
| ADR-001 | Nuxt 4 + Nitro for Backend | Single full-stack framework, file-based routing, native WebSocket |
| ADR-002 | SQLite with WAL Mode | Single-file storage, concurrent reads/writes, zero ops |
| ADR-003 | In-memory LRU Cache | No Redis; hot data in process memory; recoverable from SQLite |
| ADR-004 | Client Identity via Username + Hostname + MAC | Human-readable slug, device-bound identity, immutable identifier |
| ADR-005 | Batched Ingest with Dedup | 10 samples or 5s buffer, `INSERT OR IGNORE` for safe retries |
| ADR-006 | Nitro Native WebSocket | No Socket.io; topic-based subscriptions via Map |
| ADR-007 | uPlot Charts | Canvas-based, fast rendering, already used in desktop |
| ADR-008 | Single-Node Deployment | One process, one SQLite file, PM2 or systemd |
| ADR-009 | Raw Samples with Backend Computed Metrics | Backend owns quality computation, `minute_rollups` for efficient queries |

## Quick Reference

### Commands
```bash
pnpm run dev          # Start dev server on port 3000
pnpm run build        # Build for production
pnpm run preview      # Preview production build
pnpm run test         # Run Vitest unit tests
pnpm run test:watch   # Vitest with file watcher
pnpm run test:e2e     # Run Playwright E2E tests
pnpm run typecheck    # TypeScript type checking
```

### Key Files
- `dashboard/nuxt.config.ts` — Nuxt configuration
- `dashboard/server/plugins/database.ts` — SQLite init + migration runner
- `dashboard/server/utils/db.ts` — Typed DB accessor (`getDb()`)
- `dashboard/server/utils/logger.ts` — Structured logger
- `dashboard/shared/types.ts` — Shared TypeScript interfaces
- `dashboard/schema/migrations/` — Numbered SQL migration files

---

*Last updated: 2026-08-01 (Agent 14 — Update Project Context)*
