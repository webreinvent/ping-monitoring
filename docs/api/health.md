# API: Health Check

**Endpoint:** `GET /api/health`
**File:** `server/api/health.get.ts`
**Features:** F1 (Backend setup), F14 (Health check with extended metrics)

## Purpose

Returns the server's current health status including database connectivity, uptime, version, and extended F14 metrics (database size, monitor count, sample count, and last ingest time). Used for:

- External monitoring services (Uptime Robot, Pingdom, Cloudflare Health Checks)
- Load balancer health checks
- Deployment verification
- Internal dashboards

## Request

- **Method:** GET
- **Path:** `/api/health`
- **Authentication:** None (publicly accessible)
- **Headers:** None required
- **Query parameters:** None
- **Request body:** None

## Response

### Success (200 OK)

```json
{
  "status": "ok",
  "timestamp": "2026-08-02T12:00:00.000Z",
  "uptime": 3600.42,
  "version": "0.1.0",
  "db_path": "/Users/pk/Projects/ping-monitoring/.data/lingering.db",
  "db_size_bytes": 524288,
  "monitor_count": 42,
  "sample_count": 158734,
  "last_ingest_time": "2026-08-02T11:59:58.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"ok"` | Server health status — always `"ok"` if the endpoint responds |
| `timestamp` | `string` | ISO 8601 timestamp of the check |
| `uptime` | `number` | Server process uptime in seconds (2 decimal places) |
| `version` | `string` | Package version from `package.json` (cached at module load) |
| `db_path` | `string` | Absolute path to the SQLite database file |
| `db_size_bytes` | `number` | Size of the main SQLite file in bytes (from `fs.statSync`) |
| `monitor_count` | `number` | Total monitors in the `monitors` table |
| `sample_count` | `number` | Total ping samples in the `ping_samples` table |
| `last_ingest_time` | `string \| null` | ISO 8601 timestamp of the most recent sample, or `null` if no samples exist |

### Success — No Data Ingested Yet (200 OK)

```json
{
  "status": "ok",
  "timestamp": "2026-08-02T12:00:00.000Z",
  "uptime": 10.5,
  "version": "0.1.0",
  "db_path": "/Users/pk/Projects/ping-monitoring/.data/lingering.db",
  "db_size_bytes": 8192,
  "monitor_count": 0,
  "sample_count": 0,
  "last_ingest_time": null
}
```

### Error (200 with error body)

```json
{
  "status": "error",
  "timestamp": "2026-08-02T12:00:00.000Z",
  "message": "Database connection failed"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"error"` | Indicates a failure |
| `timestamp` | `string` | ISO 8601 timestamp |
| `message` | `string` | Error message from the underlying exception |

**Note:** The endpoint returns HTTP 200 even on error to avoid confusing load balancers. Check the `status` field to determine health.

## Metric Sources

| Metric | Source |
|--------|--------|
| `status` | Always `"ok"` if the endpoint responds. A failure to respond (crash, DB corruption) is the failure scenario |
| `timestamp` | `new Date().toISOString()` at response time |
| `uptime` | `process.uptime()` rounded to 2 decimal places |
| `version` | Read from `package.json` `version` field, cached at module scope via IIFE |
| `db_path` | Resolved from `DATABASE_PATH` env var (default: `.data/lingering.db`) |
| `db_size_bytes` | `fs.statSync(fullDbPath).size` on the main SQLite file |
| `monitor_count` | `SELECT COUNT(*) as cnt FROM monitors` |
| `sample_count` | `SELECT COUNT(*) as cnt FROM ping_samples` |
| `last_ingest_time` | `SELECT MAX(timestamp_ms) as max_ts FROM ping_samples` converted to ISO 8601 |

## Database Connectivity Check

Before gathering extended metrics, the health check runs `SELECT 1` against the SQLite database. If this query fails, the database status is marked as `"error"` internally (logged via the structured logger) but the endpoint still attempts to gather metrics. If metric gathering also fails, the error response is returned.

## Performance

- All database queries are simple aggregates (COUNT, MAX) — no full table scans required.
- File system stat is synchronous (`fs.statSync`) but cheap — acceptable for infrequent health checks (every 1–5 minutes).
- Response time target: under 100ms.
- No caching needed — the endpoint is not a hot path.

## Example Usage

```bash
# Check health via curl
curl http://localhost:3000/api/health

# Check status for CI/CD pipeline
curl -s http://localhost:3000/api/health | jq '.status == "ok"'

# Verify database has data
curl -s http://localhost:3000/api/health | jq '.sample_count > 0'
```

## Related Types

The response conforms to `HealthResponse` and `HealthErrorResponse` in `shared/types.ts`:

```typescript
interface HealthResponse {
  status: "ok";
  timestamp: string;
  uptime: number;
  version: string;
  db_path: string;
  db_size_bytes: number;
  monitor_count: number;
  sample_count: number;
  last_ingest_time: string | null;
}

interface HealthErrorResponse {
  status: "error";
  timestamp: string;
  message: string;
}
```

## Related

- [Shared Types Documentation](../shared/types.md) — `HealthResponse`, `HealthErrorResponse`
- [Database Documentation](../database/schema.md) — `monitors` and `ping_samples` tables
- [DB Helper Documentation](../utils/db.md) — `getDb()` utility used by this endpoint
- [Feature F14 Specification](../../requirements/features/feature-00014-health-check.md) — Original requirements
