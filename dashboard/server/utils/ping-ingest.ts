import { getDb } from "./db";
import { getClientBySlug, upsertClient } from "./client";
import { info, error as logError } from "./logger";
import { classifyMonitorsBatch } from "./quality-classifier";
import type { Database } from "better-sqlite3";

import type {
  PingSampleIngest,
  IngestResponse,
  Rejection,
  AcceptedSample,
} from "./ping-types";
import { validateSample } from "./ping-validation";

/**
 * Maximum samples per batch (configurable via INGEST_MAX_SAMPLES).
 */
function getMaxSamples(): number {
  return Number(process.env.INGEST_MAX_SAMPLES ?? 1000);
}

/**
 * Ensure a monitor exists for the given client_id and target_host.
 * Auto-creates if it doesn't exist using INSERT OR IGNORE on the unique constraint.
 *
 * @param db - Database instance
 * @param clientId - The owning client's ID
 * @param targetHost - The target host being pinged
 * @returns The monitor ID (existing or newly created)
 */
function ensureMonitor(
  db: Database,
  clientId: number,
  targetHost: string,
): number {
  const now = Date.now();

  const upsertStmt = db.prepare(`
    INSERT INTO monitors (client_id, target_host, target_name, quality_state, created_at, updated_at)
    VALUES (?, ?, ?, 'warmingUp', ?, ?)
    ON CONFLICT(client_id, target_host) DO NOTHING
  `);

  upsertStmt.run(clientId, targetHost, targetHost, now, now);

  // Get the monitor ID — either existing or just created
  const row = db
    .prepare(
      "SELECT id FROM monitors WHERE client_id = ? AND target_host = ?",
    )
    .get(clientId, targetHost) as { id: number };

  return row.id;
}

/**
 * Ingest a batch of validated samples for a known client.
 *
 * Runs within a transaction:
 * 1. Ensure the client exists (upsert if first ingest)
 * 2. For each sample, ensure the monitor exists (auto-create)
 * 3. Bulk insert samples using INSERT OR IGNORE
 * 4. Update monitor latest state
 * 5. Update client last_synced_at_ms
 *
 * @param clientId - The client's database ID
 * @param samples - Array of validated samples to ingest
 * @returns An object with counts, affected monitor IDs, and accepted samples for broadcast
 */
function ingestSamples(
  clientId: number,
  samples: PingSampleIngest[],
): {
  accepted: number;
  duplicate: number;
  monitorIds: Set<number>;
  acceptedSamples: AcceptedSample[];
} {
  const db = getDb();
  const now = Date.now();

  // Use db.transaction for atomicity — if anything fails, the whole batch rolls back
  const transaction = db.transaction(() => {
    // Phase 1: Resolve all monitor IDs, auto-creating as needed
    const sampleMonitorMap: { sample: PingSampleIngest; monitorId: number }[] =
      [];

    for (const sample of samples) {
      const monitorId = ensureMonitor(db, clientId, sample.targetHost);
      sampleMonitorMap.push({ sample, monitorId });
    }

    // Phase 2: Insert samples using INSERT OR IGNORE
    // We track how many rows were actually inserted vs. ignored
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO ping_samples
        (monitor_id, timestamp_ms, latency_ms, status, resolved_address, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let accepted = 0;
    let duplicate = 0;
    const affectedMonitorIds = new Set<number>();
    const acceptedSamples: AcceptedSample[] = [];

    // better-sqlite3: stmt.run() returns an object with a `changes` property
    // indicating how many rows were actually modified.
    // INSERT OR IGNORE returns changes=0 when the row was ignored (duplicate).
    for (const { sample, monitorId } of sampleMonitorMap) {
      const result = insertStmt.run(
        monitorId,
        sample.timestampMs,
        sample.latencyMs ?? null,
        sample.status,
        sample.resolvedAddress ?? null,
        sample.error ?? null,
        now,
      );

      if ((result as { changes: number }).changes > 0) {
        accepted++;
        acceptedSamples.push({
          monitorId,
          timestampMs: sample.timestampMs,
          latencyMs: sample.latencyMs ?? null,
          status: sample.status as "success" | "timeout" | "error",
          resolvedAddress: sample.resolvedAddress ?? null,
        });
      } else {
        duplicate++;
      }
      affectedMonitorIds.add(monitorId);
    }

    // Phase 3: Update monitor latest state for affected monitors
    // We use the most recent sample per monitor to update last_seen_ms, last_status, last_latency_ms
    const updateMonitorStmt = db.prepare(`
      UPDATE monitors SET
        last_seen_ms = :ts,
        last_status = :status,
        last_latency_ms = :latency,
        updated_at = :now
      WHERE id = :monitorId
    `);

    for (const monitorId of affectedMonitorIds) {
      // Find the most recent sample for this monitor in the batch
      const latestSample = sampleMonitorMap
        .filter((s) => s.monitorId === monitorId)
        .sort((a, b) => b.sample.timestampMs - a.sample.timestampMs)[0];

      if (latestSample) {
        updateMonitorStmt.run({
          monitorId,
          ts: latestSample.sample.timestampMs,
          status: latestSample.sample.status,
          latency:
            latestSample.sample.status === "success"
              ? latestSample.sample.latencyMs
              : null,
          now,
        });
      }
    }

    // Phase 4: Update client last_synced_at_ms
    db.prepare(
      "UPDATE clients SET last_synced_at_ms = ?, updated_at = ? WHERE id = ?",
    ).run(now, now, clientId);

    return { accepted, duplicate, monitorIds: affectedMonitorIds, acceptedSamples };
  });

  return transaction();
}

/**
 * Main entry point for the ping ingest pipeline.
 *
 * Orchestrates:
 * 1. Client lookup (returns null if client not found — caller handles 401)
 * 2. Sample validation (per-sample, collects rejections)
 * 3. Batch insert with dedup
 *
 * @param clientSlug - The client's slug identifier
 * @param samples - The raw samples from the request body
 * @param clientIdentity - Optional identity fields for first-time registration
 * @returns IngestResponse with accepted/duplicate/rejected counts, or null if client not found
 */
export function ingestPingBatch(
  clientSlug: string,
  samples: PingSampleIngest[],
  clientIdentity?: {
    username?: string;
    hostname?: string;
    mac_address?: string;
  },
): IngestResponse | null {
  const maxSamples = getMaxSamples();

  // Validate batch size
  if (samples.length === 0) {
    throw new Error("EMPTY_SAMPLES");
  }

  if (samples.length > maxSamples) {
    throw new Error("BATCH_TOO_LARGE");
  }

  // Phase 1: Resolve client — lookup or upsert
  let client = getClientBySlug(clientSlug);

  if (!client && clientIdentity?.username && clientIdentity.hostname && clientIdentity.mac_address) {
    // First ingest from this client — register it
    client = upsertClient(
      clientIdentity.username,
      clientIdentity.hostname,
      clientIdentity.mac_address,
    );
  }

  if (!client) {
    return null; // Client not found and no registration data — caller returns 401
  }

  // Phase 2: Validate all samples
  const validSamples: PingSampleIngest[] = [];
  const rejections: Rejection[] = [];

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] as PingSampleIngest;
    const result = validateSample(sample);
    if (result.valid) {
      validSamples.push(sample);
    } else {
      for (const rejection of result.rejections) {
        rejections.push({
          index: i,
          reason: rejection.reason,
          code: rejection.code,
          sample,
        });
      }
    }
  }

  const rejectedCount = new Set(rejections.map((r) => r.index)).size;

  // Phase 3: Ingest valid samples within a transaction
  let accepted = 0;
  let duplicate = 0;
  const acceptedSamples: AcceptedSample[] = [];

  if (validSamples.length > 0) {
    try {
      const result = ingestSamples(client.id, validSamples);
      accepted = result.accepted;
      duplicate = result.duplicate;
      acceptedSamples.push(...result.acceptedSamples);

      // Phase 4: Post-ingest classification (after transaction commits)
      if (result.monitorIds.size > 0) {
        try {
          const monitorIds = Array.from(result.monitorIds);
          classifyMonitorsBatch(monitorIds);
        } catch (classificationErr) {
          // Classification failure should NOT fail the ingest
          logError("Post-ingest classification failed", {
            error:
              classificationErr instanceof Error
                ? classificationErr.message
                : String(classificationErr),
            monitorCount: result.monitorIds.size,
          });
        }
      }

      info(
        `Ingested batch for client ${clientSlug}`,
        {
          accepted,
          duplicate,
          rejected: rejectedCount,
          total: samples.length,
          monitorCount: result.monitorIds.size,
        },
      );
    } catch (err) {
      logError(
        `Database error during ingest for client ${clientSlug}`,
        {
          error: err instanceof Error ? err.message : String(err),
          sampleCount: validSamples.length,
        },
      );
      throw err; // Re-throw so the transaction rollback takes effect
    }
  }

  return {
    accepted,
    duplicate,
    rejected: rejectedCount,
    rejections: rejections.length > 0 ? rejections : undefined,
    acceptedSamples: acceptedSamples.length > 0 ? acceptedSamples : undefined,
  };
}
