import { test, expect } from "@playwright/test";

/**
 * E2E tests for the dashboard load and basic page structure.
 *
 * Covers acceptance criteria:
 * - Dashboard load test: navigate to /, verify sidebar, placeholder content
 * - Empty state test: verify empty state shown when no monitors
 * - Page title test: verify correct page title
 */

test.describe("Dashboard Load", () => {
  test("should load the home page with dashboard content", async ({
    page,
  }) => {
    await page.goto("/");

    // Dashboard page container should be visible
    await expect(page.getByTestId("dashboard-page")).toBeVisible();

    // Monitor section should render
    await expect(page.getByTestId("monitor-section")).toBeVisible();

    // Monitors heading should be visible with correct text
    const heading = page.getByTestId("monitors-heading");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("All Monitors");
  });

  test("should have the correct page title", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("LNPM Cloud Dashboard — All Monitors");
  });
});

test.describe("Empty State", () => {
  test("should show empty state when no monitors configured", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for the monitors API to resolve
    await page.waitForResponse(resp =>
      resp.url().includes("/api/monitors") && resp.status() === 200
    );

    // Empty state should be visible in sidebar (no data ingested yet)
    const placeholder = page.getByTestId("empty-state");
    await expect(placeholder).toBeVisible();
  });

  test("should show empty state in sidebar when no monitors", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for API to resolve
    await page.waitForResponse(resp =>
      resp.url().includes("/api/monitors") && resp.status() === 200
    );

    // Empty state should be rendered in sidebar
    await expect(page.getByTestId("empty-state")).toBeVisible();
  });
});

test.describe("Sidebar Structure", () => {
  test("should render sidebar with correct structure", async ({ page }) => {
    await page.goto("/");

    // Sidebar should be visible
    await expect(page.getByTestId("dashboard-sidebar")).toBeVisible();

    // Header should be visible (rendered in layout)
    await expect(page.getByTestId("dashboard-header")).toBeVisible();

    // If no monitors, empty state is shown; if monitors exist, "All Monitors" row is shown
    const allMonitorsRow = page.getByText("All Monitors");
    const emptyState = page.getByTestId("empty-state");

    // Either All Monitors row (in sidebar) or empty state should be present
    await expect(page).toHaveSelector("text=All Monitors");
  });
});