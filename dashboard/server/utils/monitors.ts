import { getDb } from "./db";
import { mapQualityState, mapSampleStatus } from "./quality-states";
import type { MonitorListItem } from "#shared/types";

/**
 * Fetch all monitors with their latest state, joined with client info.
 *
 * Single SQL query using a CTE with ROW_NUMBER() to get the latest
 * ping sample per monitor, then LEFT JOIN to monitors and clients.
 *
 * Returns empty array when no monitors exist.
 * Monitors with no samples have null latest state fields.
 *
 * Sort: lastSeenMs DESC, monitors.id ASC
 */
export function getAllMonitorsWithLatestState(): MonitorListItem[] {
  const db = getDb();

  const rows = db
    .prepare(`
    WITH latest_samples AS (
      SELECT
        monitor_id,
        status,
        latency_ms,
        timestamp_ms,
        ROW_NUMBER() OVER (
          PARTITION BY monitor_id
          ORDER BY timestamp_ms DESC
        ) AS rn
      FROM ping_samples
    )
    SELECT
      m.id,
      c.slug AS client_slug,
      c.name AS client_name,
      m.target_host,
      m.target_name,
      ls.status AS last_status,
      ls.latency_ms AS last_latency_ms,
      ls.timestamp_ms AS last_seen_ms,
      m.quality_state,
      m.quality_state_updated_at,
      m.created_at
    FROM monitors m
    INNER JOIN clients c ON m.client_id = c.id
    LEFT JOIN latest_samples ls ON m.id = ls.monitor_id AND ls.rn = 1
    ORDER BY
      COALESCE(ls.timestamp_ms, 0) DESC,
      m.id ASC
  `)
    .all() as Array<{
      id: number;
      client_slug: string;
      client_name: string;
      target_host: string;
      target_name: string | null;
      last_status: string | null;
      last_latency_ms: number | null;
      last_seen_ms: number | null;
      quality_state: string;
      quality_state_updated_at: number | null;
      created_at: number;
    }>;

  return rows.map((row) => ({
    id: row.id,
    clientSlug: row.client_slug,
    clientName: row.client_name,
    targetHost: row.target_host,
    targetName: row.target_name ?? row.target_host,
    status: mapSampleStatus(row.last_status),
    latencyMs: row.last_latency_ms,
    qualityState: mapQualityState(row.quality_state),
    lastSeenMs: row.last_seen_ms,
    qualityStateUpdatedAtMs: row.quality_state_updated_at ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

/**
 * Delete a monitor by ID. Relies on SQLite's `ON DELETE CASCADE` (declared
 * in `schema/migrations/003_create_ping_samples.sql` and
 * `schema/migrations/004_create_minute_rollups.sql`) to remove every related
 * row in `ping_samples` and `minute_rollups` automatically. The parent
 * `clients` row is intentionally left intact even if this monitor was the
 * last one for that client — callers wanting client-level cleanup must do
 * it explicitly.
 *
 * Returns true if a row was deleted, false if no monitor with the given id
 * existed (caller should translate to a 404).
 */
export function deleteMonitor(id: number): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM monitors WHERE id = ?")
    .run(id) as { changes: number };
  return result.changes > 0;
}

/**
 * Hard-delete every monitor in the database. Relies on SQLite's
 * `ON DELETE CASCADE` to also remove every dependent row in
 * `ping_samples` and `minute_rollups`. The `clients` rows are intentionally
 * left intact — clients are entities in their own right and may receive
 * further monitors later.
 *
 * Returns the number of monitor rows that were deleted. Returns 0 when no
 * monitors exist (not an error condition).
 */
export function deleteAllMonitors(): number {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM monitors")
    .run() as { changes: number };
  return result.changes;
}

/**
 * Hard-delete a client and all of its monitors (and, via SQLite
 * `ON DELETE CASCADE`, every dependent row in `ping_samples` and
 * `minute_rollups`). Returns the number of monitor rows that were deleted
 * alongside the client. Returns null when no client row matched the slug
 * (caller should translate to a 404).
 */
export function deleteClientWithMonitors(slug: string): number | null {
  const db = getDb();
  // Look up the client first so we can return a 404 if the slug is unknown.
  const clientRow = db
    .prepare("SELECT id FROM clients WHERE slug = ?")
    .get(slug) as { id: number } | undefined;
  if (!clientRow) return null;

  // Delete the monitors explicitly so we can return their count. SQLite's
  // ON DELETE CASCADE handles ping_samples and minute_rollups.
  const monitorResult = db
    .prepare("DELETE FROM monitors WHERE client_id = ?")
    .run(clientRow.id) as { changes: number };

  // Now drop the client row itself. Other code paths may have created rows
  // that depend on the client; rely on cascade for those (or fall back to
  // an explicit error if cascade is not configured for some dependent table).
  db.prepare("DELETE FROM clients WHERE id = ?").run(clientRow.id);

  return monitorResult.changes;
}

