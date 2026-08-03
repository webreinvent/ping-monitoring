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

