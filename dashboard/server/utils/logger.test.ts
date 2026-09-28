import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { debug, info, warn, error } from "./logger";

// Helper to reset env vars
function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    // @ts-expect-error — delete for test isolation
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("logger", () => {
  beforeEach(() => {
    setEnv("LOG_LEVEL", undefined);
    setEnv("NODE_ENV", undefined);
  });

  afterEach(() => {
    // Restore after each test in case afterEach in setup.ts doesn't catch it
    vi.restoreAllMocks();
  });

  describe("default log level", () => {
    test('defaults to "debug" in development', () => {
      setEnv("NODE_ENV", "development");

      vi.spyOn(console, "debug");
      vi.spyOn(console, "info");
      vi.spyOn(console, "warn");
      vi.spyOn(console, "error");

      debug("test");
      info("test");
      warn("test");
      error("test");

      expect(console.debug).toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test('defaults to "info" in production', () => {
      setEnv("NODE_ENV", "production");

      vi.spyOn(console, "debug");
      vi.spyOn(console, "info");

      debug("should-not-log");
      info("should-log");

      // debug should be silenced in production (default level=info)
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
    });

    test("defaults to debug when no NODE_ENV is set", () => {
      setEnv("NODE_ENV", undefined);

      vi.spyOn(console, "debug");

      debug("test");

      expect(console.debug).toHaveBeenCalled();
    });
  });

  describe("LOG_LEVEL env var override", () => {
    test("respects LOG_LEVEL=warn (silences debug and info)", () => {
      setEnv("LOG_LEVEL", "warn");

      vi.spyOn(console, "debug");
      vi.spyOn(console, "info");
      vi.spyOn(console, "warn");

      debug("no");
      info("no");
      warn("yes");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });

    test("respects LOG_LEVEL=error (only errors pass)", () => {
      setEnv("LOG_LEVEL", "error");

      vi.spyOn(console, "debug");
      vi.spyOn(console, "info");
      vi.spyOn(console, "warn");
      vi.spyOn(console, "error");

      debug("no");
      info("no");
      warn("no");
      error("yes");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test("respects LOG_LEVEL=debug (all messages pass)", () => {
      setEnv("LOG_LEVEL", "debug");

      vi.spyOn(console, "debug");
      vi.spyOn(console, "info");
      vi.spyOn(console, "warn");
      vi.spyOn(console, "error");

      debug("yes");
      info("yes");
      warn("yes");
      error("yes");

      expect(console.debug).toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test("LOG_LEVEL takes precedence over NODE_ENV", () => {
      setEnv("NODE_ENV", "production");
      setEnv("LOG_LEVEL", "debug");

      vi.spyOn(console, "debug");

      debug("should-log");

      expect(console.debug).toHaveBeenCalled();
    });
  });

  describe("output format", () => {
    test("includes ISO timestamp, uppercase level, and message", () => {
      setEnv("LOG_LEVEL", "info");

      vi.spyOn(console, "info");

      info("hello world");

      expect(console.info).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T.*\] INFO hello world/),
      );
    });

    test("includes meta JSON when provided", () => {
      setEnv("LOG_LEVEL", "info");

      vi.spyOn(console, "info");

      info("with meta", { key: "value", count: 42 });

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining(`{"key":"value","count":42}`),
      );
    });

    test("does not include meta when not provided", () => {
      setEnv("LOG_LEVEL", "error");

      vi.spyOn(console, "error");

      error("no meta");

      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T.*\] ERROR no meta$/),
      );
    });

    test("meta with nested objects is serialized correctly", () => {
      setEnv("LOG_LEVEL", "info");

      vi.spyOn(console, "info");

      info("nested", { outer: { inner: "value" } });

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining(`{"outer":{"inner":"value"}}`),
      );
    });
  });

  describe("console method dispatch", () => {
    test("debug() uses console.debug", () => {
      setEnv("LOG_LEVEL", "debug");
      vi.spyOn(console, "debug");

      debug("msg");

      expect(console.debug).toHaveBeenCalled();
    });

    test("info() uses console.info", () => {
      setEnv("LOG_LEVEL", "info");
      vi.spyOn(console, "info");

      info("msg");

      expect(console.info).toHaveBeenCalled();
    });

    test("warn() uses console.warn", () => {
      setEnv("LOG_LEVEL", "warn");
      vi.spyOn(console, "warn");

      warn("msg");

      expect(console.warn).toHaveBeenCalled();
    });

    test("error() uses console.error", () => {
      setEnv("LOG_LEVEL", "error");
      vi.spyOn(console, "error");

      error("msg");

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("level ordering", () => {
    test("debug (0) < info (1) < warn (2) < error (3)", () => {
      // When LOG_LEVEL=info, warn and error should also pass
      setEnv("LOG_LEVEL", "info");

      vi.spyOn(console, "warn");
      vi.spyOn(console, "error");

      warn("higher");
      error("highest");

      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test("when LOG_LEVEL=warn, error also passes", () => {
      setEnv("LOG_LEVEL", "warn");

      vi.spyOn(console, "error");

      error("should-pass");

      expect(console.error).toHaveBeenCalled();
    });
  });
});
