import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    include: ["**/*.test.ts"],
    exclude: [
      "node_modules",
      ".nuxt",
      ".data",
      ".output",
      "coverage",
      "tests/e2e",
    ],
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    // Use forks pool to isolate test workers.
    pool: "forks",
    // Vitest 4 moved poolOptions to top-level; this is kept for Vitest 3.x compat.
    maxConcurrency: 2,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
    },
  },
  resolve: {
    alias: {
      "~": resolve(import.meta.dirname, "."),
      "@": resolve(import.meta.dirname, "."),
    },
  },
});
