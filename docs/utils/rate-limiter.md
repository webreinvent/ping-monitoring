# Rate Limiter Utility

**File:** `server/utils/rate-limiter.ts`

## Purpose

In-memory sliding window rate limiter with LRU eviction. Tracks request timestamps per client IP within a rolling time window, and rejects requests that exceed the configured limit. Designed to be used by Nitro middleware (F13 — Rate Limiting).

No external dependencies (no Redis). State is stored in a `Map` and evicted when it exceeds a configurable cap.

## API

### `getRateLimitConfig(isIngest)`

Returns the effective rate limit configuration for a given endpoint type.

```typescript
import { getRateLimitConfig } from "../utils/rate-limiter";

// For the ingest endpoint
const ingestConfig = getRateLimitConfig(true);
// { maxRequests: 100, windowMs: 60000 }

// For all other API endpoints
const apiConfig = getRateLimitConfig(false);
// { maxRequests: 60, windowMs: 60000 }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `isIngest` | `boolean` | `true` for `/api/ping/ingest`; `false` for all other API routes |

**Returns:** `RateLimitConfig`

### `checkRateLimit(ip, config)`

Check whether a request from the given IP is within the rate limit. Uses a sliding window to count requests in the last `windowMs` milliseconds.

```typescript
import { checkRateLimit, getRateLimitConfig, resetRateLimitState } from "../utils/rate-limiter";

const config = getRateLimitConfig(false);
const result = checkRateLimit("192.168.1.1", config);
// { allowed: true, retryAfter: 0 }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `ip` | `string` | Client IP address (used as the map key) |
| `config` | `RateLimitConfig` | Rate limit configuration from `getRateLimitConfig()` |

**Returns:** `RateLimitResult`

### `resetRateLimitState()`

Clear all rate limit state. Primarily used in tests to ensure isolation between test cases.

```typescript
import { resetRateLimitState } from "../utils/rate-limiter";

resetRateLimitState();
// Map is now empty
```

## Types

### `RateLimitConfig`

```typescript
interface RateLimitConfig {
  maxRequests: number;  // Maximum requests allowed per window
  windowMs: number;     // Window size in milliseconds
}
```

### `RateLimitResult`

```typescript
interface RateLimitResult {
  allowed: boolean;   // Whether the request is allowed
  retryAfter: number; // Seconds until limit resets (0 when allowed)
}
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit time window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | *(see below)* | Max requests per window per IP — overrides the per-tier default |

### Default Limits

| Endpoint | Default `maxRequests` | Window |
|----------|----------------------|--------|
| `/api/ping/ingest` | 100 | 60 seconds |
| All other API routes | 60 | 60 seconds |

If `RATE_LIMIT_MAX_REQUESTS` is set, it overrides the default for **both** tiers (not per-tier).

### LRU Eviction

The internal map caps at **10,000 entries**. When exceeded, entries whose `lastAccess` is older than **2 × 60 seconds** are evicted. This bounds memory growth regardless of traffic volume.

## Algorithm

1. On each request, the current timestamp is compared against `now - windowMs` to filter out old timestamps.
2. If the filtered timestamp count is ≥ `maxRequests`, the request is rejected with a `retryAfter` value calculated as the time until the oldest timestamp in the window expires.
3. If allowed, the timestamp is appended to the array.
4. LRU eviction triggers when the map size exceeds `MAX_ENTRIES` (10,000).

## Integration

- Used by the **rate-limit middleware** (`server/middleware/rate-limit.ts`) which auto-registers for all API routes.
- The middleware calls `getRateLimitConfig(isIngest)` to select the correct tier, then `checkRateLimit(ip, config)` to decide allow/deny.
- `resetRateLimitState()` is called in test setup files to ensure clean state between tests.

## Edge Cases

- **No IP available:** The middleware (not the utility) handles this — if `getRequestIP` returns `null`, the middleware skips rate limiting and logs a warning. The utility itself assumes a valid IP string.
- **Empty map on first request:** First request from any IP creates a new entry with a single timestamp and is always allowed.
- **retryAfter rounding:** `retryAfter` is always ≥ 1 second (rounded up with `Math.ceil`, clamped to minimum of 1) to avoid 0-second retry-after values.
- **Multi-process deployment:** State is in-memory only — each process has independent rate limit state. For distributed rate limiting, a shared store (e.g. Redis) would be needed. This is a known limitation documented in the code.
- **Env var parsing:** If `RATE_LIMIT_WINDOW_MS` or `RATE_LIMIT_MAX_REQUESTS` is set to a non-numeric string, `Number()` returns `NaN`. The code does not validate this — set only valid integer values.
- **Timestamp overflow:** The sliding window filter (`ts > windowStart`) ensures no unbounded growth of the timestamps array. Even if a single IP makes millions of requests over years, only timestamps within the current window are retained.
