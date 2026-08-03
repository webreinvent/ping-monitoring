# Utility: Ping Sample Validation

**File:** `server/utils/ping-validation.ts`
**Feature:** F3 (Ping data ingest)

## Purpose

Validates a single ping sample against 6 business rules before ingestion. Returns a `ValidationResult` with a `valid` flag and an array of rejection reasons. Validation is **accumulative** — all applicable rules are checked, so a single sample can have multiple rejection reasons (e.g., both `INVALID_TIMESTAMP` and `INVALID_STATUS`).

## API

### `validateSample(sample): ValidationResult`

```typescript
import { validateSample } from "~/server/utils/ping-validation";
import type { PingSampleIngest, ValidationResult } from "~/server/utils/ping-types";

const sample: PingSampleIngest = {
  targetHost: "8.8.8.8",
  timestampMs: 1725200400000,
  latencyMs: 12.5,
  status: "success",
  resolvedAddress: "8.8.8.8",
};

const result: ValidationResult = validateSample(sample);

// result = { valid: true, rejections: [] }
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sample` | `PingSampleIngest` | The ping sample to validate |

#### Returns

| Field | Type | Description |
|-------|------|-------------|
| `valid` | `boolean` | `true` if the sample passes all rules; `false` otherwise |
| `rejections` | `{ reason: string; code: string }[]` | Array of rejection objects. Empty if `valid` is `true`. |

## Validation Rules

Each rule is evaluated independently. A sample failing multiple rules produces multiple rejection entries.

### Rule 1: Target Host Required

| Check | Rejection Code | Condition |
|-------|---------------|-----------|
| `targetHost` present and non-empty | `MISSING_TARGET_HOST` | `!sample.targetHost` or `!String(sample.targetHost).trim()` |

### Rule 2: Valid Timestamp

| Check | Rejection Code | Condition |
|-------|---------------|-----------|
| `timestampMs` is a positive integer | `INVALID_TIMESTAMP` | Not a `number`, not `Number.isInteger()`, `<= 0`, or not `isFinite()` |

### Rule 3: Not in the Future

| Check | Rejection Code | Condition |
|-------|---------------|-----------|
| `timestampMs` within future window | `FUTURE_TIMESTAMP` | `timestampMs > Date.now() + futureWindow` |

**Default future window:** 5 minutes (300,000ms). Configurable via `INGEST_FUTURE_WINDOW_MS` environment variable.

### Rule 4: Valid Status

| Check | Rejection Code | Condition |
|-------|---------------|-----------|
| `status` is one of the valid values | `INVALID_STATUS` | Not `"success"`, `"timeout"`, or `"error"` |

### Rule 5: Latency (Conditional)

Only checked when `status === "success"`.

| Check | Rejection Code | Condition |
|-------|---------------|-----------|
| `latencyMs` is present | `MISSING_LATENCY` | `sample.latencyMs == null` or `typeof sample.latencyMs !== "number"` |
| `latencyMs` is positive and finite | `INVALID_LATENCY` | `sample.latencyMs <= 0` or `!isFinite(sample.latencyMs)` |

### Rule 6: Resolved Address (Conditional)

Only checked when `status === "success"`.

| Check | Rejection Code | Condition |
|-------|---------------|-----------|
| `resolvedAddress` is present and non-empty | `MISSING_RESOLVED_ADDRESS` | `!sample.resolvedAddress` or `!String(sample.resolvedAddress).trim()` |

## Rejection Codes

| Code | Rule | Description |
|------|------|-------------|
| `MISSING_TARGET_HOST` | 1 | Target host is empty or missing |
| `INVALID_TIMESTAMP` | 2 | Timestamp is not a positive integer |
| `FUTURE_TIMESTAMP` | 3 | Timestamp exceeds 5-minute future window |
| `INVALID_STATUS` | 4 | Status is not "success", "timeout", or "error" |
| `MISSING_LATENCY` | 5 | Latency required for "success" but missing |
| `INVALID_LATENCY` | 5 | Latency must be a positive finite number |
| `MISSING_RESOLVED_ADDRESS` | 6 | Resolved address required for "success" but missing |

## Usage Example

```typescript
// Valid sample — success with all required fields
const valid = validateSample({
  targetHost: "8.8.8.8",
  timestampMs: 1725200400000,
  latencyMs: 12.5,
  status: "success",
  resolvedAddress: "8.8.8.8",
});
// { valid: true, rejections: [] }

// Valid sample — timeout (latency/resolvedAddress not required)
const timeout = validateSample({
  targetHost: "8.8.8.8",
  timestampMs: 1725200400000,
  latencyMs: null,
  status: "timeout",
  resolvedAddress: null,
  error: "Request timed out",
});
// { valid: true, rejections: [] }

// Invalid sample — multiple failures
const invalid = validateSample({
  targetHost: "",
  timestampMs: -1,
  latencyMs: null,
  status: "unknown",
  resolvedAddress: null,
});
// {
//   valid: false,
//   rejections: [
//     { reason: "Missing required field: targetHost", code: "MISSING_TARGET_HOST" },
//     { reason: "timestampMs must be a positive integer", code: "INVALID_TIMESTAMP" },
//     { reason: "status must be one of: success, timeout, error", code: "INVALID_STATUS" },
//   ]
// }
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `INGEST_FUTURE_WINDOW_MS` | `300000` (5 minutes) | Maximum allowed future timestamp offset |

## Edge Cases

- **Very large timestamps:** `isValidPositiveInteger()` checks `isFinite()` to prevent `Infinity` or `NaN` from passing. JavaScript numbers can safely represent timestamps up to `2^53 - 1` (~285,000 AD), so epoch milliseconds are safe.
- **`latencyMs: 0`:** Treated as invalid (`<= 0`). A 0ms ping is not realistic and likely indicates a missing value.
- **`latencyMs: Infinity`:** Caught by `isFinite()` check → `INVALID_LATENCY`.
- **Whitespace-only `targetHost`:** Caught by `.trim()` check → `MISSING_TARGET_HOST`.
- **Whitespace-only `resolvedAddress`:** Caught by `.trim()` check → `MISSING_RESOLVED_ADDRESS`.
- **`status` with trailing whitespace:** Not valid — the `VALID_STATUSES` set uses exact string comparison.
- **`null` vs `undefined`:** Both are caught by `== null` check (covers `null`, `undefined`).

## Integration

- Called by `ingestPingBatch()` in `server/utils/ping-ingest.ts` for each sample in the batch
- Rejection details are mapped to the `Rejection` type and included in the API response
- Invalid samples are skipped during the database insert phase — only valid samples proceed

## Related

- [Ping Types](../utils/ping-types.md) — `PingSampleIngest`, `ValidationResult`
- [Ping Ingest Engine](../utils/ping-ingest.md) — Orchestrates validation + database insert
- [Ping Ingest API](../api/ping-ingest.md) — Endpoint that exposes validation to clients
- [Feature F3 Specification](../../requirements/features/feature-0003-ping-ingest.md) — Validation requirements
