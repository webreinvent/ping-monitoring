import { deleteClientWithMonitors } from "../../utils/monitors";
import { info, error as logError } from "../../utils/logger";

/**
 * DELETE /api/clients/:slug
 *
 * Hard-deletes the client row identified by `slug` along with every
 * monitor that belongs to it. SQLite's `ON DELETE CASCADE` (declared in
 * `schema/migrations/003_create_ping_samples.sql` and
 * `schema/migrations/004_create_minute_rollups.sql`) removes every
 * dependent row in `ping_samples` and `minute_rollups` automatically.
 *
 * Responses:
 *  - 200 { ok: true, slug, deletedMonitors } on success
 *  - 400 if `slug` is missing
 *  - 404 if no client exists with the given slug
 */
export default defineEventHandler((event) => {
  const slug = getRouterParam(event, "slug");
  if (slug === undefined || slug === null || slug === "") {
    throw createError({
      statusCode: 400,
      message: "Missing slug parameter",
    });
  }

  try {
    const deletedMonitors = deleteClientWithMonitors(slug);
    if (deletedMonitors === null) {
      throw createError({
        statusCode: 404,
        message: `Client ${slug} not found`,
      });
    }

    info("Client deleted", { slug, deletedMonitors });
    return { ok: true, slug, deletedMonitors };
  } catch (err) {
    if (err && typeof err === "object" && "statusCode" in err) {
      throw err;
    }
    logError("Failed to delete client", {
      slug,
      error: err instanceof Error ? err.message : String(err),
    });
    throw createError({
      statusCode: 500,
      message: "Failed to delete client",
    });
  }
});
