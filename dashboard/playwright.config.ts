import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for LNPM Cloud Dashboard.
 *
 * - Runs against the Nuxt dev server at http://localhost:3000
 * - Uses Chromium for deterministic rendering
 * - Headless by default (set HEADLESS=false for interactive debugging)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,

  /* Fail the build on the first error */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Run tests sequentially to avoid dev server instability */
  workers: 1,

  /* Shared settings for all the projects */
  use: {
    baseURL: "http://localhost:3000",
    headless: process.env.HEADLESS === "false" ? false : true,

    /* Collect trace when retrying a failed test */
    trace: "on-first-retry",

    /* Capture screenshots on failure */
    screenshot: "only-on-failure",

    /* Maximum time each action can take */
    actionTimeout: 5_000,

    /* Maximum time each test can take */
    timeout: 30_000,
  },

  /* Run tests in chromium only */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Run the dev server before all tests */
  webServer: {
    command: "NUXT_IGNORE_LOCK=1 pnpm dev",
    port: 3000,
    timeout: (() => {
      const raw = process.env.START_SERVER_TIMEOUT ?? "60";
      const seconds = Number(raw);
      return Number.isNaN(seconds) ? 60_000 : Math.floor(seconds * 1000);
    })(),
    reuseExistingServer: true,
  },
});
