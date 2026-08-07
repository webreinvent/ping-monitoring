import { deleteMonitor } from "../../utils/monitors";
import { info, error as logError } from "../../utils/logger";

/**
 * DELETE /api/monitors/:id
 *
 * Hard-deletes a monitor and (via SQLite `ON DELETE CASCADE`) every
 * dependent row in `ping_samples` and `minute_rollups`. The parent
 * `clients` row is left intact even if this was the last monitor
 * for that client — clients are entities in their own right and
 * may receive further monitors later.
 *
 * Responses:
 *  - 200 { ok: true, id } on success
 *  - 400 if `id` is missing, non-numeric, or not a positive integer
 *  - 404 if no monitor exists with the given id
 */
export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, "id");
  if (raw === undefined || raw === null || raw === "") {
    throw createError({
      statusCode: 400,
      message: "Missing id parameter",
    });
  }

  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      message: "id must be a positive integer",
    });
  }

  try {
    const deleted = deleteMonitor(id);
    if (!deleted) {
      throw createError({
        statusCode: 404,
        message: `Monitor ${id} not found`,
      });
    }

    info("Monitor deleted", { id });
    return { ok: true, id };
  } catch (err) {
    if (err && typeof err === "object" && "statusCode" in err) {
      // Already a structured createError — rethrow verbatim so the
      // status code reaches the client.
      throw err;
    }
    logError("Failed to delete monitor", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    throw createError({
      statusCode: 500,
      message: "Failed to delete monitor",
    });
  }
});
