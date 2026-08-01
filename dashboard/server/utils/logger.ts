/**
 * Structured logger that respects LOG_LEVEL.
 * Supports levels: debug, info, warn, error.
 * Default level is "info" in production, "debug" in development.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getLevel(): LogLevel {
  return (
    (process.env.LOG_LEVEL as LogLevel) ||
    (process.env.NODE_ENV === "production" ? "info" : "debug")
  );
}

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[getLevel()];
}

function format(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] ${level.toUpperCase()} ${message}${metaStr}`;
}

export function debug(message: string, meta?: Record<string, unknown>): void {
  if (shouldLog("debug")) {
    console.debug(format("debug", message, meta));
  }
}

export function info(message: string, meta?: Record<string, unknown>): void {
  if (shouldLog("info")) {
    console.info(format("info", message, meta));
  }
}

export function warn(message: string, meta?: Record<string, unknown>): void {
  if (shouldLog("warn")) {
    console.warn(format("warn", message, meta));
  }
}

export function error(message: string, meta?: Record<string, unknown>): void {
  if (shouldLog("error")) {
    console.error(format("error", message, meta));
  }
}
