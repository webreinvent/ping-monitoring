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
    ],
    environment: "node",
    setupFiles: ["./test/setup.ts"],
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
