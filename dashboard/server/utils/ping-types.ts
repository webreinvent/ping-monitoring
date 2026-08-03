/**
 * TypeScript types for the ping ingest endpoint (F3).
 * Defines the request payload, response shape, and validation result types.
 */

/**
 * A single ping sample in the ingest payload.
 * Matches the F3 API contract — raw fields only, no pre-computed metrics.
 */
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

/**
 * Full ingest request payload.
 * Client sends this to POST /api/ping/ingest.
 */
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

/**
 * Per-sample rejection detail included in the response.
 */
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

/**
 * Response returned to the client after processing the batch.
 */
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

/**
 * Result of validating a single sample.
 */
export interface ValidationResult {
  /** Whether the sample passed all validation rules */
  valid: boolean;

  /** List of rejection reasons (empty if valid) */
  rejections: { reason: string; code: string }[];
}
