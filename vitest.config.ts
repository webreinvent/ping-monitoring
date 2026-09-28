import { defineConfig } from "vitest/config";

// Root-level suite: Tauri desktop app tests (src/**).
// The dashboard is a separate pnpm workspace package with its own
// vitest.config.ts (aliases, setup file, node env) — scoping the root
// suite to src/** keeps the two suites from being merged, which would
// fail on the dashboard's `~` / `#shared` imports.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: true,
  },
});
