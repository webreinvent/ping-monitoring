---
id: F1
name: Backend project setup
phase: MVP
priority: Critical
effort: Medium
dependencies: []
---

# F1: Backend project setup

## Description
Establish the foundational backend project using Nuxt with Nitro in a persistent (non-serverless) runtime, SQLite via better-sqlite3 with WAL mode, WebSocket support, and a health endpoint. This is the base layer every other feature depends on — no API route, data model, or real-time feature can exist without it.

## Acceptance Criteria

### Given/When/Then

- **Given** the project is initialized, **when** `npm run dev` is executed, **then** the Nitro server starts on the configured port with a persistent Node.js runtime (not serverless).
- **Given** the server is running, **when** a GET request is made to `/api/health`, **then** it returns a 200 OK with JSON containing `status: "ok"`, `timestamp`, and `uptime` in seconds.
- **Given** the project is configured, **when** the SQLite database is first accessed, **then** it creates the database file at the configured path with WAL mode enabled.
- **Given** the server is running, **when** a WebSocket connection is attempted, **then** the server accepts the connection without errors (full broadcast logic deferred to F7).
- **Given** the project structure exists, **when** a new developer clones the repo and runs `npm install && npm run dev`, **then** the server starts without errors and the health endpoint responds.

## Implementation Notes

### Project structure
```
src/
  server/
    api/
      health.get.ts              # Health check endpoint
    plugins/
      database.ts                # SQLite initialization with WAL mode
      websocket.ts               # WebSocket server setup
    utils/
      db.ts                      # Database connection helper, schema migration runner
    ws/
      (reserved for F7)          # WebSocket route handlers
  schema/
    index.sql                    # Initial schema (empty tables created by F1, columns added by dependent features)
  app.vue                        # Minimal app shell
nuxt.config.ts                   # Nitro config: persistent runtime, SQLite, WebSocket
```

### Key configuration
- **Nitro preset**: `node-server` (persistent runtime, not serverless)
- **SQLite**: `better-sqlite3` with `PRAGMA journal_mode = WAL` for concurrent read/write
- **WebSocket**: Nitro native WebSocket support via `server/ws/` routes
- **Database path**: Configurable via environment variable `DATABASE_PATH` (default: `.data/lingering.db`)

### Database setup
- Initialize connection on server start in a Nitro plugin (`server/plugins/database.ts`)
- Enable WAL mode immediately after opening
- Create a migration runner that executes `schema/index.sql` on first run
- Export a typed database helper (`server/utils/db.ts`) for use by all API routes

### Health endpoint
- Route: `GET /api/health`
- Returns: `{ status: "ok", timestamp: <ISO 8601>, uptime: <seconds>, version: "<package.json version>" }`
- No authentication required

### Environment variables
- `DATABASE_PATH` — SQLite file location (default: `.data/lingering.db`)
- `PORT` — Server port (default: 3000)
- `NODE_ENV` — Environment mode

## Data Model Changes

No permanent tables created by F1 alone. The schema file (`schema/index.sql`) is initialized as empty with a header comment. Dependent features (F2, F3, etc.) will add their own migration files and DDL statements.

## API Contract

### GET /api/health

**Request:**
```
GET /api/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-07-31T12:00:00.000Z",
  "uptime": 3600,
  "version": "0.0.0"
}
```

**No authentication required. No request body.**
