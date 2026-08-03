/**
 * Rate limiting middleware for all API endpoints (F13).
 *
 * - Applies per-IP sliding window rate limiting
 * - Ingest endpoint: 100 requests/minute
 * - All other API routes: 60 requests/minute
 * - Returns 429 with Retry-After header when limit exceeded
 *
 * Nitro middleware in `server/middleware/` runs automatically
 * before every server route handler.
 */

import { defineEventHandler, getRequestIP, setHeader, setResponseStatus } from "h3";
import { checkRateLimit, getRateLimitConfig } from "../utils/rate-limiter";
import { warn } from "../utils/logger";

export default defineEventHandler((event) => {
  // Only apply to /api/ routes — skip static assets, WebSocket, etc.
  const url = event.path;
  if (!url.startsWith("/api/")) {
    return;
  }

  // Determine the client IP using h3's built-in IP resolution
  const ip = getRequestIP(event, { xForwardedFor: true });
  if (!ip) {
    warn("Rate limiter could not determine client IP", { path: url });
    // Cannot rate-limit without an IP — allow the request through
    return;
  }

  // Determine if this is the ingest endpoint
  const isIngest = url.startsWith("/api/ping/ingest");

  // Get the appropriate rate limit config
  const config = getRateLimitConfig(isIngest);

  // Check rate limit
  const result = checkRateLimit(ip, config);

  if (!result.allowed) {
    // Log the rate limit event
    warn("Rate limit exceeded", {
      ip,
      path: url,
      retryAfter: result.retryAfter,
      limit: config.maxRequests,
      windowMs: config.windowMs,
    });

    // Send 429 response with correct shape per F13
    setResponseStatus(event, 429);
    setHeader(event, "Content-Type", "application/json");
    setHeader(event, "Retry-After", String(result.retryAfter));

    return {
      error: "rate_limit_exceeded",
      retryAfter: result.retryAfter,
    };
  }

  // Request is allowed — continue to the route handler
  return;
});
