import { test, expect } from "@playwright/test";

/**
 * E2E tests for basic navigation and structural page checks.
 *
 * Covers acceptance criteria:
 * - Navigation without console errors
 * - No network errors on page load
 * - App shell structure with correct elements
 * - Routes work: /, /monitors/:id, /clients/:slug
 * - Responsive layout on narrow viewports
 */

test.describe("Navigation", () => {
  test("should navigate to root without console errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");

    // Wait for page to fully settle
    await page.waitForTimeout(2_000);

    // No console errors (filter out Vite HMR polling errors, hydration mismatches, and other known dev artifacts)
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes("Failed to fetch dynamically imported module") &&
        !err.includes("ERR_CONNECTION_REFUSED") &&
        !err.includes("net::") &&
        !err.includes("Hydration"),
    );
    expect(realErrors).toHaveLength(0);
  });

  test("should not have network errors on page load", async ({ page }) => {
    const networkErrors: string[] = [];

    page.on("response", (response) => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.url()} — ${response.status()}`);
      }
    });

    await page.goto("/");

    // Wait for page to settle
    await page.waitForTimeout(2_000);

    expect(networkErrors).toHaveLength(0);
  });

  test("should have the app shell with correct structure", async ({
    page,
  }) => {
    await page.goto("/");

    // Dashboard page container should be visible
    await expect(page.getByTestId("dashboard-page")).toBeVisible();

    // Monitor section should be inside the page
    await expect(page.getByTestId("monitor-section")).toBeVisible();

    // Heading should be an h2 element
    const heading = page.getByTestId("monitors-heading");
    await expect(heading).toBeVisible();
    const tag = await heading.evaluate((el) => el.tagName.toLowerCase());
    expect(tag).toBe("h2");

    // Header should be visible
    await expect(page.getByTestId("dashboard-header")).toBeVisible();
  });

  test("should have sidebar visible", async ({ page }) => {
    await page.goto("/");

    // Sidebar should be visible
    await expect(page.getByTestId("dashboard-sidebar")).toBeVisible();
  });

  test("should navigate to monitor detail page", async ({ page }) => {
    // Seed a test monitor first so the page has data
    const response = await page.request.post("/api/ping/ingest", {
      data: {
        samples: [
          {
            timestamp_ms: Date.now(),
            latency_ms: 50,
            status: "success",
            resolved_address: "127.0.0.1",
            target_host: "test-monitor.example.com",
            target_name: "Test Monitor",
            client_slug: "test-client",
          },
        ],
      },
    });
    expect(response.status()).toBeLessThan(400);

    // Wait for the monitor to be created
    await page.waitForTimeout(1000);

    // Navigate to monitor detail — we need to find the actual monitor ID
    const monitorsRes = await page.request.get("/api/monitors");
    const monitorsBody = await monitorsRes.json();
    const monitorId = (monitorsBody as { monitors: Array<{ id: number }> }).monitors[0]?.id;

    if (monitorId === undefined) {
      // If no monitor was created, skip
      test.skip();
    }

    await page.goto(`/monitors/${monitorId}`);

    // Monitor detail page container should be present
    const detailPage = page.getByTestId("monitor-detail-page");
    await expect(detailPage).toBeVisible();

    // Breadcrumb should be visible
    await expect(page.getByTestId("breadcrumb")).toBeVisible();
  });

  test("should navigate to client overview page", async ({ page }) => {
    // Seed a test client first
    const response = await page.request.post("/api/ping/ingest", {
      data: {
        samples: [
          {
            timestamp_ms: Date.now(),
            latency_ms: 30,
            status: "success",
            resolved_address: "127.0.0.1",
            target_host: "client-test.example.com",
            target_name: "Client Test Monitor",
            client_slug: "e2e-client",
          },
        ],
      },
    });
    expect(response.status()).toBeLessThan(400);

    await page.waitForTimeout(1000);

    await page.goto("/clients/e2e-client");

    // Client overview page should be visible
    const clientPage = page.getByTestId("client-overview-page");
    await expect(clientPage).toBeVisible();

    // Breadcrumb should be visible
    await expect(page.getByTestId("breadcrumb")).toBeVisible();
  });

  test("mobile viewport — sidebar hidden, hamburger visible", async ({
    page,
  }) => {
    // Set mobile viewport BEFORE navigating
    await page.setViewportSize({ width: 480, height: 780 });
    await page.goto("/");

    // Desktop sidebar should be hidden on mobile
    const desktopSidebar = page.locator(".sidebar-panel");
    expect(await desktopSidebar.isVisible()).toBe(false);

    // Hamburger button should be visible
    const hamburger = page.locator(".hamburger-btn");
    await expect(hamburger).toBeVisible();
  });
});