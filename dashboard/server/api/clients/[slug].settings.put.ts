import { getClientBySlug } from "../../utils/client";
import { getDb } from "../../utils/db";
import { broadcastSettingsUpdate } from "../../ws/ping";

/** Allowed sync interval values in minutes (per F9 spec) */
const ALLOWED_INTERVALS = [1, 5, 10, 15, 30, 60];

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

  // Validate sync_interval_min if provided
  if (body.sync_interval_min != null) {
    if (!ALLOWED_INTERVALS.includes(body.sync_interval_min)) {
      throw createError({
        statusCode: 400,
        message: `Invalid sync_interval_min. Must be one of: ${ALLOWED_INTERVALS.join(", ")}`,
      });
    }
  }

  // Validate backend_url if provided
  if (body.backend_url) {
    try {
      const url = new URL(body.backend_url);
      // Allow HTTPS for any host, or HTTP for localhost/127.0.0.1
      const isHttp = url.protocol === "http:";
      const isLocalhost =
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1" ||
        url.hostname === "[::1]";
      if (url.protocol !== "https:" && !(isHttp && isLocalhost)) {
        throw createError({
          statusCode: 400,
          message: "Invalid backend_url. Must be a valid HTTPS URL",
        });
      }
    } catch (err) {
      const error = err as { statusCode?: number };
      if (error.statusCode === 400) throw err;
      throw createError({
        statusCode: 400,
        message: "Invalid backend_url. Must be a valid HTTPS URL",
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
    body.backend_url ?? client.backend_url,
    now,
    slug,
  );

  const updatedSyncInterval = body.sync_interval_min ?? client.sync_interval_min;
  const updatedBackendUrl = body.backend_url ?? client.backend_url;

  // Broadcast settings update via WebSocket
  broadcastSettingsUpdate(slug, {
    sync_enabled: body.sync_enabled,
    sync_interval_min: updatedSyncInterval,
    backend_url: updatedBackendUrl,
  });

  return {
    clientId: client.id,
    slug: client.slug,
    sync_enabled: body.sync_enabled,
    sync_interval_min: updatedSyncInterval,
    backend_url: updatedBackendUrl,
    last_synced_at_ms: client.last_synced_at_ms,
    updated_at: new Date(now).toISOString(),
  };
});
