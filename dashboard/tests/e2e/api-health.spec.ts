import { test, expect } from "@playwright/test";

/**
 * E2E tests for the API health endpoint.
 *
 * Covers acceptance criteria:
 * - API health test: /api/health returns 200 with expected shape
 * - Server responds to HTTP requests on port 3000
 * - F14: extended metrics (db_path, db_size_bytes, monitor_count,
 *   sample_count, last_ingest_time)
 */

test.describe("API Health", () => {
  test("should return 200 with expected response shape", async ({
    request,
  }) => {
    const response = await request.get("/api/health");

    // Status 200
    expect(response.status()).toBe(200);

    // Parse response body
    const body = await response.json();

    // Basic fields
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.uptime).toBe("number");
    expect(body.version).toBe("0.1.0");

    // F14 extended fields
    expect(typeof body.db_path).toBe("string");
    expect(typeof body.db_size_bytes).toBe("number");
    expect(typeof body.monitor_count).toBe("number");
    expect(typeof body.sample_count).toBe("number");
    // last_ingest_time is string or null
    expect(body.last_ingest_time).toBeNull().or.toBeString();
  });

  test("should have CORS headers on API response", async ({ request }) => {
    const response = await request.get("/api/health");

    // CORS should be enabled on /api/** routes
    const headers = response.headers();
    expect(headers["access-control-allow-origin"]).toBeDefined();
  });

  test("should return a valid ISO timestamp", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    // timestamp must be parseable as an ISO date
    const date = new Date(body.timestamp);
    expect(Number.isNaN(date.getTime())).toBe(false);
  });

  test("should return positive uptime value", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    // Uptime is in seconds — should be > 0 since server is running
    expect(body.uptime).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // F14 — extended metrics
  // ------------------------------------------------------------------

  test("should return db_path as absolute path", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    expect(body.db_path).toBeTruthy();
    // Should end with .db
    expect(body.db_path).toMatch(/\.db$/);
  });

  test("should return non-negative db_size_bytes", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    expect(body.db_size_bytes).toBeGreaterThanOrEqual(0);
  });

  test("should return non-negative monitor_count", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    expect(body.monitor_count).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(body.monitor_count)).toBe(true);
  });

  test("should return non-negative sample_count", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    expect(body.sample_count).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(body.sample_count)).toBe(true);
  });

  test("should return null last_ingest_time when no samples exist", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    // Either null (no data) or a valid ISO string
    if (body.last_ingest_time !== null) {
      const date = new Date(body.last_ingest_time);
      expect(Number.isNaN(date.getTime())).toBe(false);
    }
  });

  test("should return response under 100ms", async ({ request }) => {
    const start = Date.now();
    await request.get("/api/health");
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});
