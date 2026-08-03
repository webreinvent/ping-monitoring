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

    // No console errors (filter out Vite HMR polling errors that are normal during dev)
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes("Failed to fetch dynamically imported module") &&
        !err.includes("ERR_CONNECTION_REFUSED") &&
        !err.includes("net::"),
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
    await page.goto("/monitors/1");

    // Monitor detail page should load
    await expect(page.getByTestId("monitor-detail-page")).toBeVisible();

    // Breadcrumb should be visible
    await expect(page.getByTestId("breadcrumb")).toBeVisible();
  });

  test("should navigate to client overview page", async ({ page }) => {
    await page.goto("/clients/test-client");

    // Client overview page should load
    await expect(page.getByTestId("client-overview-page")).toBeVisible();

    // Breadcrumb should be visible
    await expect(page.getByTestId("breadcrumb")).toBeVisible();
  });

  test("mobile viewport — sidebar hidden, hamburger visible", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");

    // Desktop sidebar should be hidden on mobile
    const desktopSidebar = page
      .locator(".sidebar-panel")
      .first();
    expect(await desktopSidebar.isVisible()).toBe(false);

    // Hamburger button should be visible
    const hamburger = page.locator(".hamburger-btn");
    await expect(hamburger).toBeVisible();
  });
});
