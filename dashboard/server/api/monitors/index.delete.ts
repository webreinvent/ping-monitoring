import { deleteAllMonitors } from "../../utils/monitors";
import { info, error as logError } from "../../utils/logger";

/**
 * DELETE /api/monitors
 *
 * Hard-deletes every monitor in the database. Relies on SQLite's
 * `ON DELETE CASCADE` (declared in `schema/migrations/003_create_ping_samples.sql`
 * and `schema/migrations/004_create_minute_rollups.sql`) to remove every
 * dependent row in `ping_samples` and `minute_rollups` automatically. The
 * parent `clients` rows are intentionally left intact — clients are
 * entities in their own right and may receive further monitors later.
 *
 * Responses:
 *  - 200 { ok: true, deletedCount } on success (deletedCount may be 0)
 */
export default defineEventHandler(() => {
  try {
    const deletedCount = deleteAllMonitors();
    info("All monitors deleted", { deletedCount });
    return { ok: true, deletedCount };
  } catch (err) {
    logError("Failed to delete all monitors", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw createError({
      statusCode: 500,
      message: "Failed to delete all monitors",
    });
  }
});
