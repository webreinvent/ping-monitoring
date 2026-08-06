import { getClientBySlug } from "../../utils/client";
import type { ClientSettings, SyncStatus } from "#shared/types";

/**
 * Compute sync status from last_synced_at_ms and sync_interval_min.
 * Per F9 spec:
 * - disabled: sync_enabled is false
 * - not_configured: no sync has ever occurred (last_synced_at_ms is null)
 * - disconnected: no data received in last 2 * sync_interval_min * 60000 ms
 * - connected: data received within threshold
 */
function computeSyncStatus(
  syncEnabled: boolean,
  lastSyncedAtMs: number | null,
  syncIntervalMin: number,
): SyncStatus {
  if (!syncEnabled) {
    return "disabled";
  }
  if (lastSyncedAtMs == null) {
    return "not_configured";
  }
  const now = Date.now();
  const threshold = 2 * syncIntervalMin * 60000;
  if (now - lastSyncedAtMs > threshold) {
    return "disconnected";
  }
  return "connected";
}

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Missing slug parameter" });
  }

  const row = getClientBySlug(slug);
  if (!row) {
    throw createError({ statusCode: 404, message: "Client not found" });
  }

  const settings: ClientSettings = {
    clientId: row.id,
    slug: row.slug,
    name: row.name,
    username: row.username,
    hostname: row.hostname,
    mac_address: row.mac_address,
    sync_enabled: !!row.sync_enabled,
    sync_interval_min: row.sync_interval_min,
    backend_url: row.backend_url,
    last_synced_at_ms: row.last_synced_at_ms,
    sync_status: computeSyncStatus(
      !!row.sync_enabled,
      row.last_synced_at_ms,
      row.sync_interval_min,
    ),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };

  return settings;
});
