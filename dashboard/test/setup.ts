/**
 * Shared test setup.
 * Clears global state before each test so tests are isolated.
 * Also provides a mock for better-sqlite3 so tests that create in-memory
 * databases can run without the native module.
 */

import { beforeAll, beforeEach, afterEach, vi } from "vitest";
import MockDatabase from "~/test/mock-db-factory";

// Mock better-sqlite3 globally — tests that import Database will get the mock
vi.mock("better-sqlite3", () => ({
  default: MockDatabase,
}));

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
