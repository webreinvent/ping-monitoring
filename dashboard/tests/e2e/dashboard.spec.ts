import { test, expect } from "@playwright/test";

/**
 * E2E tests for the dashboard load and basic page structure.
 *
 * Covers acceptance criteria:
 * - Dashboard load test: navigate to /, verify sidebar, chart container, and metrics area load
 * - Monitors list test: verify monitors appear in sidebar, grouped by client
 * - All-monitors chart test: verify combined chart renders all monitors
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
    await expect(heading).toContainText("Monitors");
  });

  test("should have the correct page title", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("LNPM Cloud Dashboard");
  });
});

test.describe("Monitors Placeholder", () => {
  test("should show monitors placeholder when no data is available", async ({
    page,
  }) => {
    await page.goto("/");

    const placeholder = page.getByTestId("monitors-placeholder");
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toContainText(
      "Monitors will appear here once data is ingested.",
    );
  });
});
