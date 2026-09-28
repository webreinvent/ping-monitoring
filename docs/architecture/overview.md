# Architecture Overview — LNPM Cloud Dashboard

**Last Updated:** 2026-08-01
**Status:** Foundation (M1-T1 complete)

## Summary

The LNPM Cloud Dashboard extends the LNPM desktop application with a centralized Nuxt 4 + Nitro server. Desktop clients send ping data to the backend; the server stores it and broadcasts it in real time to a public web dashboard.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Nuxt 4 + Nitro v2 | Full-stack SSR, API routing, WebSocket |
| Runtime | node-server (persistent) | WebSocket connections, SQLite, in-memory cache |
| Database | better-sqlite3 | Persistent storage with WAL mode |
| Language | TypeScript 5.7 (strict) | Type safety across server and client |
| WebSocket | Nitro `defineWebSocketHandler` | Real-time broadcast |
| Testing | Vitest + Playwright | Unit and E2E tests |

## Project Structure

```
dashboard/
├── app/                      # Nuxt frontend (Vue components, pages, layouts)
│   ├── layouts/
│   │   └── default.vue       # Base layout wrapper
│   └── pages/
│       └── index.vue         # Dashboard home page
├── server/                   # Nitro server
│   ├── api/                  # API routes (file-based routing)
│   │   └── health.get.ts     # GET /api/health
│   ├── plugins/
│   │   └── database.ts       # SQLite init + migrations runner
│   ├── utils/
│   │   ├── db.ts             # Typed DB access helper
│   │   └── logger.ts         # Structured logger
│   └── ws/
│       └── ping.ts           # WebSocket handler
├── schema/                   # Database schema and migrations
│   ├── index.sql             # Full schema reference (placeholder)
│   └── migrations/           # Numbered migration files
│       └── 001_initial_setup.sql  # Migration tracking table
├── shared/                   # Types shared between server and client
│   └── types.ts              # Interfaces, type aliases
├── .env.example              # Environment variable template
├── app.vue                   # Root app shell
├── nuxt.config.ts            # Nuxt configuration
└── package.json              # Dependencies and scripts
```

## Key Architectural Decisions

### ADR-001: Nuxt 4 + Nitro v2

**Decision:** Use Nuxt 4 with Nitro v2 as the full-stack framework.

**Rationale:** Unified SSR/API/WebSocket framework with file-based routing. Replaces the desktop app's Tauri backend with a web-native approach. Single codebase for server and client.

**Config:** `nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  nitro: {
    preset: "node-server",       // Persistent runtime (not serverless)
    experimental: {
      websocket: true,           // Enable WebSocket support
    },
  },
  typescript: {
    strict: true,                // TypeScript strict mode
  },
  devServer: {
    port: 3000,                  // Dev server port
  },
  ssr: true,                     // SSR enabled for server routes
  routeRules: {
    "/api/**": { cors: true },   // CORS on API routes
  },
});
```

### Persistent `node-server` Runtime

**Decision:** Nitro preset is `node-server`, not serverless.

**Rationale:** Persistent WebSocket connections, SQLite database, and in-memory cache are incompatible with serverless cold starts.

### better-sqlite3 Over sqlite3

**Decision:** Synchronous `better-sqlite3` over async `sqlite3`.

**Rationale:** Synchronous API simplifies error handling in a single-process Node.js server. No connection pooling needed. WAL mode enables concurrent reads.

### Database via `globalThis`

**Decision:** Store the DB instance on `globalThis.__db` for cross-module access.

**Rationale:** Nitro has no built-in DI container. `globalThis` is the simplest way to share state across Nitro plugins and API routes. See [Database Documentation](../database/schema.md) for details.

### No Auto-import for Shared Types

**Decision:** Import shared types explicitly; do not use `imports.dirs`.

**Rationale:** Nuxt auto-imports only pick up functions and constants — not type interfaces.

## Data Flow

```
LNPM Client                    Nitro Server                   Web Dashboard
    │                               │                              │
    │  POST /api/ping/ingest        │                              │
    ├─────────────────────────────► │                              │
    │                               │  ── SQLite (store)           │
    │                               │  ── WebSocket (broadcast)    │
    │                               │                              │
    │                               │  WS /ws/ping                 │
    │                               ├─────────────────────────────►│
    │                               │      (real-time updates)     │
    │                               │                              │
```

## Next Steps

The next phase (M1-T2) will implement schema migrations for the core tables: `clients`, `monitors`, `ping_samples`, and `minute_rollups`. See the [implementation plan](../../memory/agent-05-implementation-plan.md) for the full sequence.
