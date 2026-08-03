# Utility: Ping Ingest Types

**File:** `server/utils/ping-types.ts`
**Feature:** F3 (Ping data ingest)

## Purpose

Defines the TypeScript interfaces for the ping ingest endpoint's request payload, response shape, and validation results. These types are **server-only** — they define the contract between the API endpoint (`server/api/ping/ingest.post.ts`), the ingest engine (`server/utils/ping-ingest.ts`), and the validation layer (`server/utils/ping-validation.ts`).

## Types

### `PingSampleIngest`

A single ping sample in the ingest payload. Matches the F3 API contract — raw fields only, no pre-computed metrics.

```typescript
export interface PingSampleIngest {
  /** Target host or IP being pinged */
  targetHost: string;

  /** Unix epoch milliseconds of the ping event */
  timestampMs: number;

  /** Round-trip latency in ms; required when status is "success" */
  latencyMs: number | null;

  /** Ping result status */
  status: "success" | "timeout" | "error";

  /** Resolved IP address; required when status is "success" */
  resolvedAddress: string | null;

  /** Optional error message for timeout/error status */
  error?: string | null;
}
```

**Used by:** API endpoint, validation layer, ingest engine, database insert.

---

### `IngestPayload`

Full ingest request payload. Client sends this to `POST /api/ping/ingest`.

```typescript
export interface IngestPayload {
  /** Immutable client identifier */
  clientSlug: string;

  /** OS username — required on first ingest to register the client */
  username?: string;

  /** Hostname of the client machine — required on first ingest */
  hostname?: string;

  /** MAC address — required on first ingest */
  mac_address?: string;

  /** Array of ping samples (1–1000 items) */
  samples: PingSampleIngest[];
}
```

**Used by:** API endpoint body parsing.

---

### `Rejection`

Per-sample rejection detail included in the response.

```typescript
export interface Rejection {
  /** Index of the rejected sample in the original batch */
  index: number;

  /** Human-readable reason for rejection */
  reason: string;

  /** Machine-readable error code */
  code: string;

  /** The offending sample (partial shape for traceability) */
  sample: Partial<PingSampleIngest>;
}
```

**Used by:** Ingest response — included when `rejected > 0`.

---

### `IngestResponse`

Response returned to the client after processing the batch.

```typescript
export interface IngestResponse {
  /** Number of samples successfully inserted */
  accepted: number;

  /** Number of samples that were duplicates (INSERT OR IGNORE) */
  duplicate: number;

  /** Number of samples that failed validation */
  rejected: number;

  /** Detailed rejection info (only present when rejected > 0) */
  rejections?: Rejection[];
}
```

**Used by:** API response, `ingestPingBatch()` return value.

---

### `ValidationResult`

Result of validating a single sample.

```typescript
export interface ValidationResult {
  /** Whether the sample passed all validation rules */
  valid: boolean;

  /** List of rejection reasons (empty if valid) */
  rejections: { reason: string; code: string }[];
}
```

**Used by:** `validateSample()` in `server/utils/ping-validation.ts`.

## Edge Cases

- **`latencyMs` nullability:** For timeout/error status, `latencyMs` is `null`. The validation layer only requires it for `"success"` status.
- **`resolvedAddress` nullability:** Same as `latencyMs` — only required for `"success"`.
- **`error` optional:** The `error` field on `PingSampleIngest` is optional (`string | null`). It is used to store error messages for timeout/error status but is not validated.

## Related

- [Ping Ingest API](../api/ping-ingest.md) — Uses `IngestPayload` (request) and `IngestResponse` (response)
- [Ping Validation](../utils/ping-validation.md) — Returns `ValidationResult`
- [Ping Ingest Engine](../utils/ping-ingest.md) — Returns `IngestResponse | null`
- [Shared Types](../shared/types.md) — `PingSample` (distinct from `PingSampleIngest`)
