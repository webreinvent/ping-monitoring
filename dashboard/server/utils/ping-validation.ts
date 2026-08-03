import type { PingSampleIngest, ValidationResult } from "./ping-types";

const VALID_STATUSES = new Set(["success", "timeout", "error"]);

/**
 * Maximum allowed future timestamp window (5 minutes by default).
 * Configurable via INGEST_FUTURE_WINDOW_MS environment variable.
 */
function getFutureWindowMs(): number {
  return Number(process.env.INGEST_FUTURE_WINDOW_MS ?? 300_000);
}

/**
 * Validate a single ping sample against business rules.
 *
 * Rules:
 * 1. targetHost is required and non-empty
 * 2. timestampMs is a positive integer
 * 3. timestampMs must not exceed 5 minutes into the future
 * 4. status must be one of "success", "timeout", "error"
 * 5. latencyMs is required and positive when status is "success"
 * 6. resolvedAddress is required when status is "success"
 *
 * @param sample - The ping sample to validate
 * @returns ValidationResult with valid flag and any rejections
 */
export function validateSample(
  sample: PingSampleIngest,
): ValidationResult {
  const rejections: { reason: string; code: string }[] = [];
  const now = Date.now();
  const futureWindow = getFutureWindowMs();

  // Rule 1: targetHost is required and non-empty
  if (!sample.targetHost || !String(sample.targetHost).trim()) {
    rejections.push({
      reason: "Missing required field: targetHost",
      code: "MISSING_TARGET_HOST",
    });
  }

  // Rule 2: timestampMs must be a positive integer
  if (!isValidPositiveInteger(sample.timestampMs)) {
    rejections.push({
      reason: "timestampMs must be a positive integer",
      code: "INVALID_TIMESTAMP",
    });
  } else if (sample.timestampMs > now + futureWindow) {
    // Rule 3: timestamp must not exceed 5-minute future window
    rejections.push({
      reason: "Timestamp exceeds 5-minute future window",
      code: "FUTURE_TIMESTAMP",
    });
  }

  // Rule 4: status must be one of the valid values
  if (typeof sample.status !== "string" || !VALID_STATUSES.has(sample.status)) {
    rejections.push({
      reason: "status must be one of: success, timeout, error",
      code: "INVALID_STATUS",
    });
  }

  // Rules 5-6: Conditional on status being "success"
  if (sample.status === "success") {
    // Rule 5: latencyMs is required and must be a positive number
    if (sample.latencyMs == null || typeof sample.latencyMs !== "number") {
      rejections.push({
        reason: "Missing required field: latencyMs (required for success status)",
        code: "MISSING_LATENCY",
      });
    } else if (sample.latencyMs <= 0 || !isFinite(sample.latencyMs)) {
      rejections.push({
        reason: "latencyMs must be a positive number",
        code: "INVALID_LATENCY",
      });
    }

    // Rule 6: resolvedAddress is required
    if (!sample.resolvedAddress || !String(sample.resolvedAddress).trim()) {
      rejections.push({
        reason: "Missing required field: resolvedAddress (required for success status)",
        code: "MISSING_RESOLVED_ADDRESS",
      });
    }
  }

  return {
    valid: rejections.length === 0,
    rejections,
  };
}

/**
 * Check if a value is a valid positive integer (safe for large timestamps).
 * TypeScript types say `number`, but the runtime value could be anything.
 */
function isValidPositiveInteger(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    isFinite(value)
  );
}
