---
name: lnpm-patterns-established
description: Patterns established during M1-T1 — Nuxt 4 + Nitro foundation patterns
metadata:
  type: project
  agent: "12"
  date: 2026-08-01
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
- **Stub behavior**: Echoes messages back with `type: "echo"` wrapper.

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

## Environment Configuration

### .env.example Pattern
- **File**: `.env.example`
- **Pattern**: 14 environment variables with section headers, inline comments, and sensible defaults. Categories: environment mode, HTTP server, SQLite, WebSocket, ingest, rate limiting, data retention, cache.
