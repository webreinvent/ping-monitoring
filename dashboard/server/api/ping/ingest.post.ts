import { ingestPingBatch } from "../../utils/ping-ingest";
import { error as logError } from "../../utils/logger";
import type {
  IngestPayload,
  PingSampleIngest,
  IngestResponse,
} from "../../utils/ping-types";
import type { H3Event } from "h3";

/**
 * POST /api/ping/ingest
 *
 * Batch ingest endpoint for raw ping samples from LNPM clients.
 *
 * - Validates the request shape and client identity
 * - Validates each sample against business rules
 * - Deduplicates using INSERT OR IGNORE on unique index
 * - Auto-creates monitors for new target hosts
 * - Returns counts of accepted/duplicate/rejected samples
 *
 * Response status codes:
 * - 201: All samples accepted, no duplicates
 * - 200: All samples are duplicates (none accepted)
 * - 207: Mixed results (some accepted, some duplicate/rejected)
 * - 400: Empty batch or missing clientSlug
 * - 401: Unknown client slug (no registration data provided)
 * - 413: Batch exceeds maximum size
 * - 500: Database error
 */
export default defineEventHandler(async (event) => {
  try {
    // Parse request body
    const body = await readBody(event);

    // Validate top-level fields
    if (!body || typeof body.clientSlug !== "string" || !body.clientSlug.trim()) {
      return createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        data: {
          error: "clientSlug is required",
          code: "MISSING_CLIENT_SLUG",
        },
      });
    }

    const clientSlug = body.clientSlug.trim();
    const samples = body.samples;

    // Validate samples array exists and is non-empty
    if (!Array.isArray(samples) || samples.length === 0) {
      return createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        data: {
          error: "Samples array is required and must contain at least 1 item",
          code: "EMPTY_SAMPLES",
        },
      });
    }

    // Check batch size limit
    const maxSamples =
      Number(process.env.INGEST_MAX_SAMPLES ?? 1000);
    if (samples.length > maxSamples) {
      return createError({
        statusCode: 413,
        statusMessage: "Payload Too Large",
        data: {
          error: `Batch exceeds maximum of ${maxSamples} samples`,
          code: "BATCH_TOO_LARGE",
        },
      });
    }

    // Cast to expected type — individual sample validation happens in the ingest engine
    const payload: IngestPayload = {
      clientSlug,
      username: body.username,
      hostname: body.hostname,
      mac_address: body.mac_address,
      samples: samples as PingSampleIngest[],
    };

    // Run the ingest pipeline
    const result = ingestPingBatch(
      payload.clientSlug,
      payload.samples,
      {
        username: payload.username,
        hostname: payload.hostname,
        mac_address: payload.mac_address,
      },
    );

    // Handle unknown client
    if (result === null) {
      return createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
        data: {
          error: "Unknown client slug",
          code: "UNKNOWN_CLIENT",
        },
      });
    }

    // Determine HTTP status code based on result composition
    const { accepted, duplicate, rejected } = result;

    let statusCode: number;
    if (accepted === 0 && duplicate === 0) {
      // All rejected — still return 200 with rejection details
      statusCode = 200;
    } else if (accepted === 0 && duplicate > 0) {
      // All duplicates, nothing new
      statusCode = 200;
    } else if (accepted > 0 && duplicate === 0 && rejected === 0) {
      // All accepted, no issues
      statusCode = 201;
    } else {
      // Mixed: some accepted, some duplicate/rejected
      statusCode = 207;
    }

    const response: IngestResponse = {
      accepted,
      duplicate,
      rejected,
      rejections: result.rejections,
    };

    return sendResponse(event, statusCode, response);
  } catch (err) {
    // Database or unexpected error
    const message = err instanceof Error ? err.message : String(err);
    logError("Unhandled error during ping ingest", {
      error: message,
    });

    return createError({
      statusCode: 500,
      statusMessage: "Internal Server Error",
      data: {
        error: "Database error during ingest",
        code: "DATABASE_ERROR",
      },
    });
  }
});

/**
 * Send a response with the correct status code.
 * Uses Nitro's `setResponseStatus` helper.
 */
function sendResponse(
  event: H3Event,
  statusCode: number,
  body: IngestResponse,
): IngestResponse {
  setResponseStatus(event, statusCode);
  return body;
}
