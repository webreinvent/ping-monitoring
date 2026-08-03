# Environment Configuration

**File:** `dashboard/.env.example`

## Overview

The `.env.example` file contains all environment variables required by the LNPM Cloud Dashboard. Copy to `.env` and adjust values for your environment:

```bash
cp dashboard/.env.example dashboard/.env
```

## Variables

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `PORT` | `3000` | HTTP server port |
| `DATABASE_PATH` | `.data/lingering.db` | SQLite database path (relative to project root) |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Logging verbosity (`debug`, `info`, `warn`, `error`) |

### WebSocket

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_HEARTBEAT_INTERVAL_MS` | `30000` | WebSocket ping/pong heartbeat interval (milliseconds) |
| `WS_MAX_CLIENTS` | `1000` | Maximum concurrent WebSocket connections |

### Ingest

| Variable | Default | Description |
|----------|---------|-------------|
| `INGEST_MAX_SAMPLES` | `1000` | Maximum samples per batch POST request |
| `INGEST_FUTURE_WINDOW_MS` | `300000` | Max future timestamp offset (ms) — rejects samples >5 min in the future |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit time window (milliseconds) |
| `RATE_LIMIT_MAX_REQUESTS` | `1000` (dev) / `100` (prod) | Max requests per window per IP |

### Data Retention

| Variable | Default | Description |
|----------|---------|-------------|
| `RETENTION_ENABLED` | `true` | Enable/disable retention cleanup entirely |
| `RETENTION_SAMPLE_DAYS` | `30` | How long to keep raw ping samples (days) |
| `RETENTION_ROLLUP_DAYS` | `90` | How long to keep minute rollups (days) |
| `RETENTION_INTERVAL_MIN` | `60` | How often the cleanup runs (minutes) |
| `RETENTION_VACUUM_THRESHOLD` | `10000` | Minimum rows deleted before triggering a VACUUM |

### Cache

| Variable | Default | Description |
|----------|---------|-------------|
| `LRU_CACHE_MAX` | `10000` | Maximum entries in the in-memory LRU cache |

## Environment-Specific Defaults

| Variable | Development | Production |
|----------|------------|------------|
| `LOG_LEVEL` | `debug` | `info` |
| `RATE_LIMIT_MAX_REQUESTS` | `1000` | `100` |

## Notes

- **Never commit `.env`** — it should be in `.gitignore`.
- The `.env.example` file is a template only and is not loaded by the application.
- Variables are read at server startup — changes require a restart.
- `DATABASE_PATH` is resolved relative to `process.cwd()` (the directory where `pnpm run dev` is executed).

## Related

- [Database Documentation](../database/schema.md) — `DATABASE_PATH` usage
- [Logger Documentation](../utils/logger.md) — `LOG_LEVEL` usage
- [WebSocket Protocol](../websocket/protocol.md) — `WS_HEARTBEAT_INTERVAL_MS`, `WS_MAX_CLIENTS`
- [Retention Cleanup](../utils/retention.md) — `RETENTION_*` variables usage
