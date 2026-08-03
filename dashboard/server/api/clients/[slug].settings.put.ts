import { getClientBySlug } from "../../utils/client";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Missing slug parameter" });
  }

  const body = await readBody(event);

  // Validate required fields
  if (body.sync_enabled === undefined) {
    throw createError({ statusCode: 400, message: "sync_enabled is required" });
  }

  // Validate sync_interval_min if sync is enabled
  if (body.sync_enabled && body.sync_interval_min != null) {
    const allowedIntervals = [1, 2, 5, 10, 15, 30, 60];
    if (!allowedIntervals.includes(body.sync_interval_min)) {
      throw createError({
        statusCode: 400,
        message: `sync_interval_min must be one of: ${allowedIntervals.join(", ")}`,
      });
    }
  }

  // Validate backend_url if provided and sync is enabled
  if (body.sync_enabled && body.backend_url) {
    try {
      const url = new URL(body.backend_url);
      if (url.protocol !== "https:") {
        throw createError({
          statusCode: 400,
          message: "backend_url must use HTTPS",
        });
      }
    } catch (err) {
      const error = err as { statusCode?: number };
      if (error.statusCode === 400) throw err;
      throw createError({
        statusCode: 400,
        message: "backend_url must be a valid URL",
      });
    }
  }

  // Check client exists
  const client = getClientBySlug(slug);
  if (!client) {
    throw createError({ statusCode: 404, message: "Client not found" });
  }

  // Update settings
  const db = getDb();
  const now = Date.now();

  db.prepare(
    `UPDATE clients SET
      sync_enabled = ?,
      sync_interval_min = ?,
      backend_url = ?,
      updated_at = ?
    WHERE slug = ?`,
  ).run(
    body.sync_enabled ? 1 : 0,
    body.sync_interval_min ?? client.sync_interval_min,
    body.backend_url ?? "",
    now,
    slug,
  );

  return {
    success: true,
    sync_enabled: body.sync_enabled,
    sync_interval_min: body.sync_interval_min ?? client.sync_interval_min,
    backend_url: body.backend_url ?? "",
  };
});
