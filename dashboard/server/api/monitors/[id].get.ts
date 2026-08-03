import { getDb } from "#server/utils/db";
import { info, error as logError } from "#server/utils/logger";
import type { HistoryResponse } from "#shared/types";
import type { ClientRow } from "#server/utils/history";
import {
  getMonitorHistoryPoints,
  computeQualityIntervals,
  computeRangeSummary,
  buildTarget,
  calculateBucketSize,
} from "#server/utils/history";

export default defineEventHandler((event) => {
  try {
    // 1. Parse path parameter
    const idParam = getRouterParam(event, "id");
    if (idParam === undefined) {
      throw createError({
        statusCode: 404,
        message: "monitor_not_found",
        data: { error: "monitor_not_found", code: "MONITOR_NOT_FOUND" },
      });
    }
    const monitorId = Number(idParam);
    if (!Number.isInteger(monitorId) || monitorId <= 0) {
      throw createError({
        statusCode: 404,
        message: "monitor_not_found",
        data: { error: "monitor_not_found", code: "MONITOR_NOT_FOUND" },
      });
    }

    // 2. Parse query parameters
    const query = getQuery(event) as Record<string, unknown>;
    const nowMs = Date.now();

    let fromMs: number;
    let toMs: number;
    let maxPoints: number;

    if (query.fromMs !== undefined && query.fromMs !== null && query.fromMs !== "") {
      fromMs = Number(query.fromMs);
    } else {
      fromMs = nowMs - 3_600_000; // Default: 1 hour ago
    }

    if (query.toMs !== undefined && query.toMs !== null && query.toMs !== "") {
      toMs = Number(query.toMs);
    } else {
      toMs = nowMs;
    }

    if (query.maxPoints !== undefined && query.maxPoints !== null && query.maxPoints !== "") {
      const parsed = Number(query.maxPoints);
      if (Number.isFinite(parsed) && parsed >= 1) {
        maxPoints = Math.min(parsed, 5000);
      } else {
        maxPoints = 2000;
      }
    } else {
      maxPoints = 2000;
    }

    // 3. Validate query parameters
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      throw createError({
        statusCode: 400,
        message: "fromMs and toMs must be valid numbers",
        data: { error: "invalid_query_params", code: "INVALID_QUERY_PARAMS", message: "fromMs and toMs must be valid numbers" },
      });
    }

    if (fromMs >= toMs) {
      throw createError({
        statusCode: 400,
        message: "fromMs must be less than toMs",
        data: { error: "invalid_query_params", code: "INVALID_QUERY_PARAMS", message: "fromMs must be less than toMs" },
      });
    }

    // 4. Verify monitor exists
    const db = getDb();
    const monitor = db
      .prepare("SELECT * FROM monitors WHERE id = ?")
      .get(monitorId);

    if (!monitor) {
      throw createError({
        statusCode: 404,
        message: "monitor_not_found",
        data: { error: "monitor_not_found", code: "MONITOR_NOT_FOUND" },
      });
    }

    // 5. Calculate bucket size
    const bucketMs = calculateBucketSize(fromMs, toMs, maxPoints);

    // 6. Fetch aggregated points
    const points = getMonitorHistoryPoints(monitorId, fromMs, toMs, bucketMs);

    // 7. Compute quality intervals
    const intervals = computeQualityIntervals(points, bucketMs);

    // 8. Compute range summary (reuse intervals to avoid recomputation)
    const summary = computeRangeSummary(points, intervals);

    // 9. Build target
    const client = db
      .prepare("SELECT * FROM clients WHERE id = ?")
      .get((monitor as any).client_id) as ClientRow | null;

    const target = buildTarget(
      monitor as any,
      client,
    );

    // 10. Assemble response
    const response: HistoryResponse = {
      fromMs,
      toMs,
      bucketMs,
      series: [{ target, points, intervals, summary }],
    };

    info("Monitor history requested", {
      monitorId,
      fromMs,
      toMs,
      bucketMs,
      pointCount: points.length,
    });

    return response;
  } catch (err) {
    // Re-throw Nitro errors (createError) as-is
    if (
      err instanceof Error &&
      "statusCode" in err &&
      typeof (err as any).statusCode === "number"
    ) {
      throw err;
    }

    logError("Failed to fetch monitor history", {
      error: err instanceof Error ? err.message : String(err),
    });

    throw createError({
      statusCode: 500,
      message: "Internal server error",
      data: { error: "internal_server_error", code: "DATABASE_ERROR" },
    });
  }
});
