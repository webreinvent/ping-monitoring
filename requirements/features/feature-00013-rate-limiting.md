---
id: F13
name: Rate Limiting
phase: Enhancement
priority: Medium
effort: Small
dependencies: [F1]
---

# F13: Rate Limiting

## Description
Per-IP rate limiting middleware to protect API endpoints from excessive requests. The ingest endpoint allows a higher rate (100 requests/minute) to accommodate client sync bursts, while all other endpoints are limited to 60 requests/minute. Exceeding the limit returns HTTP 429 Too Many Requests.

## Acceptance Criteria
- Given a client IP has sent 100 requests to the ingest endpoint within 60 seconds, when the 101st request arrives, then the server returns 429 Too Many Requests
- Given a client IP has sent 60 requests to any non-ingest endpoint within 60 seconds, when the 61st request arrives, then the server returns 429 Too Many Requests
- Given a client IP has been rate-limited, when the 60-second window resets, then subsequent requests are accepted normally
- Given a 429 response, the response includes a Retry-After header indicating seconds until the limit resets
- Given multiple distinct client IPs, each IP is rate-limited independently without affecting others

## Implementation Notes
- Use a Nitro middleware (e.g., `middleware/rateLimit.ts`) that runs before route handlers
- Store rate limit state in an in-memory LRU map keyed by client IP — no Redis dependency
- Use a sliding window counter: track request timestamps per IP, count requests within the rolling 60-second window
- Evict stale entries (older than 60 seconds) on each request to bound memory usage
- Ingest endpoint (`/api/ping/ingest`) uses limit 100/min; all other API routes use limit 60/min
- Extract client IP from `req.ip` (Nitro/Node) or `req.socket.remoteAddress`
- Return 429 with JSON body: `{"error": "rate_limit_exceeded", "retryAfter": <seconds>}`

## Data Model Changes
None. Rate limit state is ephemeral, stored in an in-memory Map.

## API Contract

**429 Response (any endpoint when limit exceeded):**
```
Status: 429 Too Many Requests
Headers: Retry-After: <seconds>
Content-Type: application/json

{
  "error": "rate_limit_exceeded",
  "retryAfter": <seconds>
}
```

**Rate limit configuration:**
| Endpoint Pattern | Limit | Window |
|-----------------|-------|--------|
| POST /api/ping/ingest | 100 requests | 60 seconds |
| All other API routes | 60 requests | 60 seconds |
