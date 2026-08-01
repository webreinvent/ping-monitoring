/**
 * Shared test setup.
 * Clears global state before each test so tests are isolated.
 */

import { beforeAll, beforeEach, afterEach, afterAll } from "vitest";

// Silently capture console output during tests to keep output clean.
// Tests can still spy on console methods when they need to assert output.
const originalConsole = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

beforeAll(() => {
  // Suppress console output by default
  console.debug = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
});

beforeEach(() => {
  // Clear the global database reference before each test
  // @ts-expect-error — globalThis.__db is set by the database plugin
  delete globalThis.__db;
});

afterEach(() => {
  // Restore console methods after each test in case they were spied
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});
