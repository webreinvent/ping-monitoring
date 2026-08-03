import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkRateLimit,
  getRateLimitConfig,
  resetRateLimitState,
} from "./rate-limiter";

// Helper to set env vars
function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    // @ts-expect-error — delete for test isolation
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("rate-limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRateLimitState();
    setEnv("RATE_LIMIT_WINDOW_MS", undefined);
    setEnv("RATE_LIMIT_MAX_REQUESTS", undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimitState();
    vi.unstubAllEnvs();
  });

  describe("getRateLimitConfig", () => {
    it("returns ingest config with higher limit by default", () => {
      const config = getRateLimitConfig(true);
      expect(config.maxRequests).toBeGreaterThanOrEqual(100);
      expect(config.windowMs).toBe(60_000);
    });

    it("returns non-ingest config with lower limit by default", () => {
      const config = getRateLimitConfig(false);
      expect(config.maxRequests).toBeGreaterThanOrEqual(60);
      expect(config.windowMs).toBe(60_000);
    });

    it("respects RATE_LIMIT_WINDOW_MS env var", () => {
      setEnv("RATE_LIMIT_WINDOW_MS", "30000");
      const config = getRateLimitConfig(true);
      expect(config.windowMs).toBe(30_000);
    });

    it("respects RATE_LIMIT_MAX_REQUESTS env var (higher than default)", () => {
      setEnv("RATE_LIMIT_MAX_REQUESTS", "200");
      const config = getRateLimitConfig(true);
      expect(config.maxRequests).toBe(200);
    });

    it("respects RATE_LIMIT_MAX_REQUESTS env var (lower than default)", () => {
      setEnv("RATE_LIMIT_MAX_REQUESTS", "50");
      const config = getRateLimitConfig(true);
      expect(config.maxRequests).toBe(50);
    });

    it("ingest defaults to 100 when no env var is set", () => {
      setEnv("RATE_LIMIT_MAX_REQUESTS", undefined);
      const config = getRateLimitConfig(true);
      expect(config.maxRequests).toBe(100);
    });

    it("non-ingest defaults to 60 when no env var is set", () => {
      setEnv("RATE_LIMIT_MAX_REQUESTS", undefined);
      const config = getRateLimitConfig(false);
      expect(config.maxRequests).toBe(60);
    });
  });

  describe("checkRateLimit", () => {
    it("allows first request from a new IP", () => {
      const result = checkRateLimit("192.168.1.1", {
        maxRequests: 5,
        windowMs: 60_000,
      });

      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBe(0);
    });

    it("allows requests within the limit", () => {
      const config = { maxRequests: 3, windowMs: 60_000 };
      const ip = "192.168.1.1";

      for (let i = 0; i < 3; i++) {
        const result = checkRateLimit(ip, config);
        expect(result.allowed).toBe(true);
      }
    });

    it("rejects requests exceeding the limit", () => {
      const config = { maxRequests: 2, windowMs: 60_000 };
      const ip = "192.168.1.1";

      checkRateLimit(ip, config); // 1
      checkRateLimit(ip, config); // 2
      const result = checkRateLimit(ip, config); // 3 — should be rejected

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("allows requests again after the window expires", () => {
      const config = { maxRequests: 2, windowMs: 5_000 };
      const ip = "192.168.1.1";

      checkRateLimit(ip, config); // 1
      checkRateLimit(ip, config); // 2

      // Advance time past the window
      vi.advanceTimersByTime(6_000);

      const result = checkRateLimit(ip, config); // 3 — should be allowed
      expect(result.allowed).toBe(true);
    });

    it("tracks each IP independently", () => {
      const config = { maxRequests: 1, windowMs: 60_000 };

      const result1 = checkRateLimit("10.0.0.1", config); // 1st for IP A
      const result2 = checkRateLimit("10.0.0.2", config); // 1st for IP B

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);

      // Now IP A should be rejected, but IP B should still be allowed
      const result3 = checkRateLimit("10.0.0.1", config); // 2nd for IP A
      const result4 = checkRateLimit("10.0.0.2", config); // 2nd for IP B

      expect(result3.allowed).toBe(false);
      expect(result4.allowed).toBe(false); // Both at 1-limit, both rejected on 2nd
    });

    it("calculates correct retry-after value", () => {
      const config = { maxRequests: 1, windowMs: 10_000 };
      const ip = "192.168.1.1";

      checkRateLimit(ip, config); // 1st — allowed
      vi.advanceTimersByTime(3_000);

      const result = checkRateLimit(ip, config); // 2nd — rejected

      expect(result.allowed).toBe(false);
      // Should be about 7 seconds (10s window - 3s elapsed)
      expect(result.retryAfter).toBeGreaterThanOrEqual(6);
      expect(result.retryAfter).toBeLessThanOrEqual(8);
    });

    it("retry-after is at least 1 second", () => {
      const config = { maxRequests: 1, windowMs: 500 };
      const ip = "192.168.1.1";

      checkRateLimit(ip, config); // 1st
      vi.advanceTimersByTime(490);

      const result = checkRateLimit(ip, config); // 2nd — rejected

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThanOrEqual(1);
    });

    it("sliding window only counts requests within the window", () => {
      const config = { maxRequests: 2, windowMs: 5_000 };
      const ip = "192.168.1.1";

      checkRateLimit(ip, config); // t=0
      vi.advanceTimersByTime(3_000);
      checkRateLimit(ip, config); // t=3000

      // Both within window — next should be rejected
      const rejected = checkRateLimit(ip, config);
      expect(rejected.allowed).toBe(false);

      // Advance past the first request
      vi.advanceTimersByTime(3_000); // t=6000 — first request now outside window

      const allowed = checkRateLimit(ip, config); // Should be allowed
      expect(allowed.allowed).toBe(true);
    });

    it("handles high volume of unique IPs without memory issues", () => {
      resetRateLimitState();
      const config = { maxRequests: 10, windowMs: 60_000 };

      // Simulate 100 unique IPs
      for (let i = 0; i < 100; i++) {
        const ip = `10.0.0.${i}`;
        const result = checkRateLimit(ip, config);
        expect(result.allowed).toBe(true);
      }

      // Now exhaust one IP
      const targetIp = "10.0.0.0";
      for (let i = 0; i < 9; i++) {
        checkRateLimit(targetIp, config);
      }
      const result = checkRateLimit(targetIp, config); // 11th — should be rejected
      expect(result.allowed).toBe(false);
    });
  });

  describe("resetRateLimitState", () => {
    it("clears all tracked IPs", () => {
      const config = { maxRequests: 5, windowMs: 60_000 };
      checkRateLimit("10.0.0.1", config);
      checkRateLimit("10.0.0.2", config);

      resetRateLimitState();

      // Both IPs should be treated as new
      const result1 = checkRateLimit("10.0.0.1", config);
      const result2 = checkRateLimit("10.0.0.2", config);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });
});
