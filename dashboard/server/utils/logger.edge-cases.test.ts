import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { debug, info, warn, error } from "./logger";

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    // @ts-expect-error — delete for test isolation
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("logger - edge cases", () => {
  beforeEach(() => {
    setEnv("LOG_LEVEL", undefined);
    setEnv("NODE_ENV", undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("empty meta object does not break output", () => {
    setEnv("LOG_LEVEL", "info");
    vi.spyOn(console, "info");

    info("with empty meta", {});

    expect(console.info).toHaveBeenCalled();
  });

  test("meta with null values is serialized", () => {
    setEnv("LOG_LEVEL", "info");
    vi.spyOn(console, "info");

    info("null meta", { key: null });

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining(`{"key":null}`),
    );
  });

  test("meta with array values is serialized", () => {
    setEnv("LOG_LEVEL", "info");
    vi.spyOn(console, "info");

    info("array meta", { items: [1, 2, 3] });

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining(`{"items":[1,2,3]}`),
    );
  });

  test("empty string message is logged", () => {
    setEnv("LOG_LEVEL", "debug");
    vi.spyOn(console, "debug");

    debug("");

    expect(console.debug).toHaveBeenCalled();
  });

  test("message with special characters is logged", () => {
    setEnv("LOG_LEVEL", "info");
    vi.spyOn(console, "info");

    info("message with\ttabs\nand\nnewlines");

    expect(console.info).toHaveBeenCalled();
  });

  test("very long message is logged without truncation", () => {
    setEnv("LOG_LEVEL", "info");
    vi.spyOn(console, "info");

    const longMsg = "a".repeat(10000);
    info(longMsg);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining(longMsg),
    );
  });

  test("debug is silenced when LOG_LEVEL=info", () => {
    setEnv("LOG_LEVEL", "info");
    vi.spyOn(console, "debug");

    debug("should not appear");

    expect(console.debug).not.toHaveBeenCalled();
  });

  test("debug is silenced when LOG_LEVEL=warn", () => {
    setEnv("LOG_LEVEL", "warn");
    vi.spyOn(console, "debug");

    debug("should not appear");

    expect(console.debug).not.toHaveBeenCalled();
  });

  test("debug is silenced when LOG_LEVEL=error", () => {
    setEnv("LOG_LEVEL", "error");
    vi.spyOn(console, "debug");

    debug("should not appear");

    expect(console.debug).not.toHaveBeenCalled();
  });

  test("info is silenced when LOG_LEVEL=warn", () => {
    setEnv("LOG_LEVEL", "warn");
    vi.spyOn(console, "info");

    info("should not appear");

    expect(console.info).not.toHaveBeenCalled();
  });

  test("info is silenced when LOG_LEVEL=error", () => {
    setEnv("LOG_LEVEL", "error");
    vi.spyOn(console, "info");

    info("should not appear");

    expect(console.info).not.toHaveBeenCalled();
  });

  test("warn is silenced when LOG_LEVEL=error", () => {
    setEnv("LOG_LEVEL", "error");
    vi.spyOn(console, "warn");

    warn("should not appear");

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("error always passes regardless of level", () => {
    // error should pass even at debug level
    setEnv("LOG_LEVEL", "debug");
    vi.spyOn(console, "error");
    error("always");
    expect(console.error).toHaveBeenCalled();

    // Reset and test at warn level
    setEnv("LOG_LEVEL", "warn");
    vi.spyOn(console, "error");
    error("always");
    expect(console.error).toHaveBeenCalled();
  });

  test("unknown NODE_ENV values default to debug level", () => {
    setEnv("NODE_ENV", "test");
    vi.spyOn(console, "debug");

    debug("should-log");

    expect(console.debug).toHaveBeenCalled();
  });

  test("LOG_LEVEL=info with NODE_ENV=production is consistent", () => {
    setEnv("LOG_LEVEL", "info");
    setEnv("NODE_ENV", "production");

    vi.spyOn(console, "debug");
    vi.spyOn(console, "info");

    debug("no");
    info("yes");

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalled();
  });
});
