/**
 * In-memory sliding window rate limiter with LRU eviction.
 *
 * - Tracks request timestamps per IP within a rolling window
 * - Evicts stale entries on each check to bound memory usage
 * - No external dependencies (no Redis)
 *
 * Designed for Nitro middleware (F13 — Rate Limiting).
 */

interface RateLimitEntry {
  /** Timestamps of requests within the current window */
  timestamps: number[];
  /** Last access time — used for LRU eviction */
  lastAccess: number;
}

/** Configuration for a rate limit bucket */
export interface RateLimitConfig {
  /** Maximum number of requests allowed per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

/** Result of checking the rate limit */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Seconds until the limit resets (only meaningful when allowed === false) */
  retryAfter: number;
}

/**
 * Global rate limit state.
 * Keyed by client IP. Uses a Map for O(1) access.
 *
 * NOTE: This is in-memory only. In a multi-process deployment,
 * each process has independent state. For true distributed rate
 * limiting, a shared store (e.g. Redis) would be needed.
 */
const rateLimitMap = new Map<string, RateLimitEntry>();

/** Maximum number of IP entries to retain (LRU cap) */
const MAX_ENTRIES = 10_000;

/**
 * Get the current rate limit configuration.
 *
 * In dev, the limit is higher to avoid interfering with testing.
 * In prod, use the values from the spec (F13).
 *
 * @param isIngest — Whether the request is targeting the ingest endpoint
 * @returns The effective rate limit config
 */
export function getRateLimitConfig(isIngest: boolean): RateLimitConfig {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  const envMax = process.env.RATE_LIMIT_MAX_REQUESTS;

  // F13 spec: ingest = 100 req/min, other = 60 req/min
  // Env var overrides the default but is clamped to the tier minimum
  const defaultMax = isIngest ? 100 : 60;
  const maxRequests = envMax !== undefined ? Number(envMax) : defaultMax;

  return { maxRequests, windowMs };
}

/**
 * Check if a request from the given IP is within the rate limit.
 *
 * Uses a sliding window: counts requests within the last `windowMs`
 * milliseconds and rejects if the count exceeds `maxRequests`.
 *
 * @param ip — Client IP address
 * @param config — Rate limit configuration
 * @returns Whether the request is allowed and retry-after seconds
 */
export function checkRateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Evict stale entries (LRU cleanup) if map is getting large
  if (rateLimitMap.size > MAX_ENTRIES) {
    evictStaleEntries(now);
  }

  let entry = rateLimitMap.get(ip);

  if (!entry) {
    // First request from this IP — create entry
    entry = { timestamps: [now], lastAccess: now };
    rateLimitMap.set(ip, entry);
    return { allowed: true, retryAfter: 0 };
  }

  // Update last access time
  entry.lastAccess = now;

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    // Rate limit exceeded
    // retryAfter = seconds until the oldest timestamp in window expires
    const oldestInWindow = entry.timestamps[0]!;
    const retryAfterMs = (oldestInWindow + config.windowMs) - now;
    const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return { allowed: false, retryAfter };
  }

  // Allow and record
  entry.timestamps.push(now);
  return { allowed: true, retryAfter: 0 };
}

/**
 * Evict stale LRU entries when the map exceeds MAX_ENTRIES.
 * Removes entries whose lastAccess is outside the current window.
 *
 * @param now — Current timestamp
 */
function evictStaleEntries(now: number): void {
  // Evict entries whose lastAccess is older than 2x the standard window (60s)
  const evictionWindow = 2 * 60_000;
  const cutoff = now - evictionWindow;

  const staleIps: string[] = [];
  for (const [ip, entry] of rateLimitMap) {
    if (entry.lastAccess < cutoff) {
      staleIps.push(ip);
    }
  }
  for (const ip of staleIps) {
    rateLimitMap.delete(ip);
  }
}

/**
 * Reset all rate limit state.
 * Primarily useful for testing.
 */
export function resetRateLimitState(): void {
  rateLimitMap.clear();
}
