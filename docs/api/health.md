# API: Health Check

**Endpoint:** `GET /api/health`
**File:** `server/api/health.get.ts`

## Purpose

Returns the server's current health status including database connectivity, uptime, and version. Used for monitoring, load balancer health checks, and deployment verification.

## Request

- **Method:** GET
- **Path:** `/api/health`
- **Authentication:** None
- **Headers:** None required

## Response

### Success (200 OK)

```json
{
  "status": "ok",
  "timestamp": "2026-08-01T12:00:00.000Z",
  "uptime": 3600.5,
  "version": "0.0.1",
  "database": "ok"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"ok"` | Server health status |
| `timestamp` | `string` | ISO 8601 timestamp of the check |
| `uptime` | `number` | Server process uptime in seconds |
| `version` | `string` | Package version from `package.json` |
| `database` | `"ok" \| "error"` | Database connectivity status |

### Error (200 with error body)

```json
{
  "status": "error",
  "timestamp": "2026-08-01T12:00:00.000Z",
  "message": "Error description"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"error"` | Indicates a failure |
| `timestamp` | `string` | ISO 8601 timestamp |
| `message` | `string` | Error message |

**Note:** The endpoint returns HTTP 200 even on error to avoid confusing load balancers. Check the `status` field to determine health.

## Database Check

The health check runs `SELECT 1` against the SQLite database. If this query fails, `database` is set to `"error"` but `status` remains `"ok"` — the server is running but the database is unreachable.

## Implementation Notes

- The package version is cached at module scope (IIFE) since `package.json` does not change at runtime.
- Health check requests are logged via the structured logger: `info("Health check requested", { dbStatus })`.
- Uses the typed DB helper (`getDb()`) from `server/utils/db.ts`.

## Example Usage

```bash
# Check health via curl
curl http://localhost:3000/api/health

# Check with jq for CI/CD
curl -s http://localhost:3000/api/health | jq '.status == "ok"'
```

## Related Types

The response conforms to `HealthResponse` and `HealthErrorResponse` in `shared/types.ts`:

```typescript
interface HealthResponse {
  status: "ok";
  timestamp: string;
  uptime: number;
  version: string;
  database: "ok" | "error";
}

interface HealthErrorResponse {
  status: "error";
  timestamp: string;
  message: string;
}
```
