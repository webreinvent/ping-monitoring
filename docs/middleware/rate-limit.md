# Rate Limit Middleware

**File:** `server/middleware/rate-limit.ts`

## Purpose

Nitro middleware that applies per-IP sliding window rate limiting to all API endpoints. Runs automatically before every route handler. Returns HTTP 429 with a `Retry-After` header when the rate limit is exceeded.

## Auto-Registration

Nitro automatically loads all files in `server/middleware/` as middleware that runs **before** every server route handler. No explicit registration is needed.

```
server/
  middleware/
    rate-limit.ts   # Automatically loaded — no import/registration needed
```

## Behavior

### Path Filtering

Only `/api/` routes are rate-limited. Static assets, WebSocket connections, and non-API paths are skipped:

```
/api/ping/ingest     → rate-limited (100 req/min)
/api/monitors        → rate-limited (60 req/min)
/ws/ping             → skipped (WebSocket)
/                   → skipped (static / SPA)
```

### IP Resolution

Uses `getRequestIP(event, { xForwardedFor: true })` from `h3` to properly resolve the client IP behind reverse proxies (e.g., Nginx, Cloudflare):

```typescript
const ip = getRequestIP(event, { xForwardedFor: true });
```

If the IP cannot be determined, a warning is logged and the request is allowed through.

### Endpoint Tier Selection

The middleware detects whether the request targets the ingest endpoint and applies the appropriate limit:

```typescript
const isIngest = url.startsWith("/api/ping/ingest");
const config = getRateLimitConfig(isIngest);
```

| Endpoint Pattern | Limit | Window |
|-----------------|-------|--------|
| `/api/ping/ingest` | 100 requests | 60 seconds |
| All other `/api/` routes | 60 requests | 60 seconds |

## 429 Response

When a client exceeds the rate limit, the middleware returns:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 5

{
  "error": "rate_limit_exceeded",
  "retryAfter": 5
}
```

### Response Shape (F13 Spec)

| Field | Type | Description |
|-------|------|-------------|
| `error` | `string` | Always `"rate_limit_exceeded"` |
| `retryAfter` | `number` | Seconds until the limit resets (≥ 1) |

### Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `Retry-After` | Number of seconds until the limit resets |

## Logging

When a request is rate-limited, a structured warning is logged via the logger utility:

```
[2026-08-03T12:00:00.000Z] WARN Rate limit exceeded {"ip":"192.168.1.1","path":"/api/ping/ingest","retryAfter":5,"limit":100,"windowMs":60000}
```

## Configuration

Environment variables are read by the underlying `rate-limiter.ts` utility:

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Time window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | *(per tier)* | Overrides default max requests for all tiers |

## Edge Cases

- **No client IP:** If `getRequestIP` returns `null` (e.g., malformed request, missing headers), the request is allowed through with a warning log. No 429 is returned.
- **WebSocket connections:** The `/ws/ping` WebSocket endpoint is not rate-limited (path does not start with `/api/`).
- **Concurrent requests:** The sliding window is accurate to the millisecond. Two requests at the exact same millisecond are counted as separate requests.
- **Distributed deployment:** Rate limit state is per-process (in-memory Map). A single IP sending requests to two different server instances will have two independent rate limit counters. For distributed deployments, replace with a shared rate limiter (e.g., Redis).

## Related

- [Rate Limiter Utility](../utils/rate-limiter.md) — The core algorithm and API
- [Environment Configuration](../configuration/env.md) — Rate limiting environment variables
- [F13 Feature Spec](../../requirements/features/feature-00013-rate-limiting.md) — Original requirements
