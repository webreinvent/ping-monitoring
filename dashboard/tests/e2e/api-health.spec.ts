import { test, expect } from "@playwright/test";

/**
 * E2E tests for the API health endpoint.
 *
 * Covers acceptance criteria:
 * - API health test: /api/health returns 200 with expected shape
 * - Server responds to HTTP requests on port 3000
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

    // Expected fields
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.uptime).toBe("number");
    expect(body.version).toBe("0.1.0");
    expect(body.database).toBe("ok");
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
});
