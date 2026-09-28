# Logger Utility

**File:** `server/utils/logger.ts`

## Purpose

Structured logger that respects the `LOG_LEVEL` environment variable. Provides level-gated logging with ISO 8601 timestamps and optional structured metadata.

## API

```typescript
import { debug, info, warn, error } from "../utils/logger";

// Simple message
info("Server started");

// With structured metadata
info("Health check requested", { dbStatus: "ok" });

// Debug only (not logged in production)
debug("Query executed", { sql: "SELECT 1", duration: 2 });

// Warnings
warn("Slow query detected", { duration: 5000 });

// Errors
error("Database connection failed", { code: "SQLITE_BUSY" });
```

### Function Signature

```typescript
function debug(message: string, meta?: Record<string, unknown>): void;
function info(message: string, meta?: Record<string, unknown>): void;
function warn(message: string, meta?: Record<string, unknown>): void;
function error(message: string, meta?: Record<string, unknown>): void;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | `string` | Log message text |
| `meta` | `Record<string, unknown>` (optional) | Structured metadata, serialized as JSON |

## Log Levels

| Level | Description | Default in Dev | Default in Prod |
|-------|-------------|---------------|-----------------|
| `debug` | Verbose diagnostics | Enabled | Disabled |
| `info` | General information | Enabled | Enabled |
| `warn` | Warnings | Enabled | Enabled |
| `error` | Errors | Enabled | Enabled |

### Level Hierarchy

Messages are logged only if their level is at or above the configured minimum:

```
debug (0) < info (1) < warn (2) < error (3)
```

If `LOG_LEVEL=warn`, only `warn` and `error` messages are logged.

## Output Format

```
[2026-08-01T12:00:00.000Z] INFO Health check started
[2026-08-01T12:00:00.000Z] INFO Health check completed {"dbStatus":"ok","duration":5}
```

Format: `[timestamp] LEVEL message {meta-json}`

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Minimum log level |
| `NODE_ENV` | `development` | Determines default log level |

### Setting Log Level

```bash
# .env
LOG_LEVEL=debug     # All messages
LOG_LEVEL=info      # Info and above (production default)
LOG_LEVEL=warn      # Warnings and errors only
LOG_LEVEL=error     # Errors only
```

## Integration

- Used by the health endpoint (`server/api/health.get.ts`) to log health check requests.
- Used by the database plugin (`server/plugins/database.ts`) to log migration errors.
- Available to all server-side code via explicit import.

## Edge Cases

- **Missing LOG_LEVEL:** Falls back to `debug` in development, `info` in production (based on `NODE_ENV`).
- **Invalid LOG_LEVEL:** Treated as `undefined` — falls back to the default. Use only `debug`, `info`, `warn`, or `error`.
- **Circular JSON in meta:** `JSON.stringify` throws on circular references. Ensure `meta` objects are plain data.
- **Performance:** Messages below the current level are short-circuited before formatting — no string allocation or timestamp generation.
