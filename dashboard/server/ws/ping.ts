import { getDb } from "../utils/db";
import { info, warn } from "../utils/logger";
import { mapQualityState, mapSampleStatus } from "../utils/quality-states";
import type { WebSocket as WebSocketType } from "ws";
import type { QualityState } from "#shared/types";

// ============================================================================
// Constants
// ============================================================================

/** Default number of recent samples to send in a snapshot on subscribe */
const SNAPSHOT_SIZE = 100;

// ============================================================================
// Message Types (matches F7 spec)
// ============================================================================

/** Client → Server */
interface SubscribeMessage {
  type: "subscribe";
  monitorId: number;
}

interface UnsubscribeMessage {
  type: "unsubscribe";
  monitorId: number;
}

type InboundMessage = SubscribeMessage | UnsubscribeMessage;

/** Server → Client */
interface SubscribedMessage {
  type: "subscribed";
  monitorId: number;
}

interface UnsubscribedMessage {
  type: "unsubscribed";
  monitorId: number;
}

interface SnapshotMessage {
  type: "snapshot";
  monitorId: number;
  data: {
    monitor: {
      id: number;
      targetHost: string;
      targetName: string;
      status: "up" | "down" | null;
      latencyMs: number | null;
      qualityState: QualityState;
      lastSeenMs: number | null;
    };
    samples: {
      timestampMs: number;
      latencyMs: number | null;
      status: "success" | "timeout" | "error";
      resolvedAddress: string | null;
    }[];
  };
}

interface SampleMessage {
  type: "sample";
  monitorId: number;
  qualityState: QualityState;
  data: {
    timestampMs: number;
    latencyMs: number | null;
    status: "success" | "timeout" | "error";
    resolvedAddress: string | null;
  };
}

interface ErrorMessage {
  type: "error";
  message: string;
}

interface ClientNameUpdatedMessage {
  type: "client_name_updated";
  clientSlug: string;
  newName: string;
}

type OutboundMessage =
  | SubscribedMessage
  | UnsubscribedMessage
  | SnapshotMessage
  | SampleMessage
  | ErrorMessage
  | ClientNameUpdatedMessage;

// ============================================================================
// Subscription Map
// ============================================================================

/**
 * Map of monitorId → Set of WebSocket peers subscribed to that monitor.
 *
 * Each peer is the raw WebSocket (ws) object extracted from the Nitro peer.
 * We store the raw WebSocket to support broadcasting from outside the handler.
 */
const subscriptions = new Map<number, Set<WebSocketType>>();

/**
 * Global collection of ALL connected WebSocket peers.
 * Used for non-monitor-scoped broadcasts (e.g., client_name_updated).
 */
const allPeers = new Set<WebSocketType>();

/**
 * Get or create the subscriber set for a monitor.
 */
function getSubscribers(monitorId: number): Set<WebSocketType> {
  if (!subscriptions.has(monitorId)) {
    subscriptions.set(monitorId, new Set());
  }
  return subscriptions.get(monitorId)!;
}

/**
 * Remove an empty subscriber set for a monitor (cleanup).
 */
function cleanupEmptyMonitor(monitorId: number): void {
  const subSet = subscriptions.get(monitorId);
  if (subSet !== undefined && subSet.size === 0) {
    subscriptions.delete(monitorId);
  }
}

// ============================================================================
// Helper: send JSON to a peer (Nitro Peer<AdapterInternal>)
// ============================================================================

function sendJSON(peer: any, message: OutboundMessage): void {
  try {
    peer.send(JSON.stringify(message));
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    warn(`Failed to send ${message.type} to peer: ${errMessage}`);
  }
}

// ============================================================================
// Helper: fetch the latest N samples for a monitor (snapshot)
// ============================================================================

interface RawSampleRow {
  timestamp_ms: number;
  latency_ms: number | null;
  status: string;
  resolved_address: string | null;
}

interface RawMonitorRow {
  id: number;
  target_host: string;
  target_name: string | null;
  last_status: string | null;
  last_latency_ms: number | null;
  quality_state: string;
  last_seen_ms: number | null;
}

/**
 * Fetch the latest N samples for a monitor, ordered newest first (will be reversed).
 */
function getSnapshotSamples(monitorId: number, limit: number): RawSampleRow[] {
  const db = getDb();
  return db
    .prepare(`
      SELECT timestamp_ms, latency_ms, status, resolved_address
      FROM ping_samples
      WHERE monitor_id = ?
      ORDER BY timestamp_ms DESC
      LIMIT ?
    `)
    .all(monitorId, limit) as RawSampleRow[];
}

/**
 * Fetch monitor state for the snapshot.
 */
function getMonitorState(monitorId: number): RawMonitorRow | undefined {
  const db = getDb();
  return db
    .prepare(`
      SELECT id, target_host, target_name, last_status, last_latency_ms,
             quality_state, last_seen_ms
      FROM monitors
      WHERE id = ?
    `)
    .get(monitorId) as RawMonitorRow | undefined;
}

/**
 * Map a sample status string to the monitor status for display.
 * Delegated to shared utility: mapSampleStatus (quality-states.ts).
 * @see mapSampleStatus
 */

// ============================================================================
// Broadcast: send samples to all subscribers of a monitor
// ============================================================================

/**
 * Broadcast a new sample to all subscribers of a monitor.
 * Called from the ingest endpoint after a successful insert.
 *
 * This function is exported so the ingest endpoint can call it.
 * F12: Includes quality state in the broadcast message.
 *
 * @param monitorId - The monitor ID to broadcast to
 * @param sample - The sample data to broadcast
 * @param qualityState - The current quality state of the monitor (F12)
 */
export function broadcastSample(
  monitorId: number,
  sample: {
    timestampMs: number;
    latencyMs: number | null;
    status: "success" | "timeout" | "error";
    resolvedAddress: string | null;
  },
  qualityState?: QualityState,
): void {
  const subSet = subscriptions.get(monitorId);
  if (!subSet || subSet.size === 0) {
    return;
  }

  const message: SampleMessage = {
    type: "sample",
    monitorId,
    qualityState: qualityState ?? "warmingUp",
    data: sample,
  };
  const payload = JSON.stringify(message);

  // Iterate a copy — the set may change during iteration
  for (const ws of [...subSet]) {
    try {
      if (ws.readyState === 1) {
        // 1 = OPEN
        ws.send(payload);
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      warn(`Broadcast failed for monitor ${monitorId}: ${errMessage}`);
    }
  }
}

/**
 * Get the current count of subscribers for a monitor (for logging/debugging).
 */
export function getSubscriberCount(monitorId: number): number {
  return subscriptions.get(monitorId)?.size ?? 0;
}

/**
 * Broadcast a client name update to ALL connected WebSocket clients.
 * Called from the PUT /api/clients/:slug/name endpoint after a successful update.
 *
 * Unlike broadcastSample (which targets monitor subscribers), this reaches
 * every connected peer so all dashboards see the rename immediately.
 *
 * @param clientSlug - The slug of the renamed client
 * @param newName - The new display name
 */
export function broadcastClientNameUpdated(clientSlug: string, newName: string): void {
  const message: ClientNameUpdatedMessage = {
    type: "client_name_updated",
    clientSlug,
    newName,
  };
  const payload = JSON.stringify(message);

  // Iterate a copy — the set may change during iteration
  for (const ws of [...allPeers]) {
    try {
      if (ws.readyState === 1) {
        // 1 = OPEN
        ws.send(payload);
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      warn(`Broadcast client_name_updated failed: ${errMessage}`);
    }
  }
}

/**
 * Broadcast a client_settings_updated message to all connected WebSocket peers.
 * Called from the PUT /api/clients/[slug]/settings endpoint when settings change.
 *
 * @param slug - The client slug
 * @param settings - The updated settings payload
 */
export function broadcastSettingsUpdate(
  slug: string,
  settings: {
    sync_enabled: boolean;
    sync_interval_min: number;
    backend_url: string;
  },
): void {
  const message = {
    type: "client_settings_updated",
    slug,
    sync_enabled: settings.sync_enabled,
    sync_interval_min: settings.sync_interval_min,
    backend_url: settings.backend_url,
  };
  const payload = JSON.stringify(message);

  // Broadcast to all connected WebSocket peers
  for (const monitorId of subscriptions.keys()) {
    const subSet = subscriptions.get(monitorId);
    if (!subSet || subSet.size === 0) {
      continue;
    }
    for (const ws of [...subSet]) {
      try {
        if (ws.readyState === 1) {
          // 1 = OPEN
          ws.send(payload);
        }
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        warn(`Settings broadcast failed: ${errMessage}`);
      }
    }
  }
}

// ============================================================================
// WebSocket Handler
// ============================================================================

export default defineWebSocketHandler({
  open(peer) {
    // Track this peer in the global set for non-monitor-scoped broadcasts
    const ws: WebSocketType = (peer as any).ws;
    allPeers.add(ws);

    // Send connected acknowledgment (matches existing behavior, retained for backward compat)
    peer.send(
      JSON.stringify({
        type: "connected",
        timestamp: new Date().toISOString(),
      }),
    );

    info("WebSocket client connected to /ws/ping");
  },

  message(peer, message) {
    // Parse and validate JSON
    let parsed: InboundMessage;
    try {
      parsed = JSON.parse(message.text()) as InboundMessage;
    } catch {
      sendJSON(peer, {
        type: "error",
        message: "Invalid JSON",
      });
      return;
    }

    // Validate required fields
    if (!parsed.type || typeof parsed.monitorId !== "number") {
      sendJSON(peer, {
        type: "error",
        message: "Message must include 'type' and 'monitorId' (number)",
      });
      return;
    }

    // Get the underlying WebSocket from the peer
    const ws: WebSocketType = (peer as any).ws;

    switch (parsed.type) {
      case "subscribe": {
        handleSubscribe(peer, ws, parsed.monitorId);
        break;
      }
      case "unsubscribe": {
        handleUnsubscribe(peer, ws, parsed.monitorId);
        break;
      }
      default: {
        const unknownType = (parsed as any).type;
        sendJSON(peer, {
          type: "error",
          message: `Unknown message type: ${unknownType}. Expected 'subscribe' or 'unsubscribe'.`,
        });
        break;
      }
    }
  },

  close(peer) {
    // Remove this peer's WebSocket from all subscription sets
    const ws: WebSocketType = (peer as any).ws;

    // Remove from global peer set
    allPeers.delete(ws);

    // Iterate over a copy of keys — the map may change during iteration
    const monitorIds = [...subscriptions.keys()];
    for (const monitorId of monitorIds) {
      const subSet = subscriptions.get(monitorId);
      if (subSet) {
        subSet.delete(ws);
        if (subSet.size === 0) {
          subscriptions.delete(monitorId);
        }
      }
    }

    info("WebSocket client disconnected from /ws/ping");
  },
});

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Handle subscribe message:
 * 1. Add peer to the monitor's subscriber set
 * 2. Send 'subscribed' acknowledgment
 * 3. Send 'snapshot' with the latest N samples
 */
function handleSubscribe(
  peer: any,
  ws: WebSocketType,
  monitorId: number,
): void {
  // Verify monitor exists
  const db = getDb();
  const monitorExists = db
    .prepare("SELECT id FROM monitors WHERE id = ?")
    .get(monitorId);

  if (!monitorExists) {
    sendJSON(peer, {
      type: "error",
      message: `Monitor ${monitorId} not found`,
    });
    return;
  }

  // Add to subscription map
  getSubscribers(monitorId).add(ws);

  // Send acknowledgment
  sendJSON(peer, {
    type: "subscribed",
    monitorId,
  });

  info(`Client subscribed to monitor ${monitorId}`);

  // Fetch and send snapshot
  const monitorState = getMonitorState(monitorId);
  const rawSamples = getSnapshotSamples(monitorId, SNAPSHOT_SIZE);

  // Reverse to oldest-first order
  rawSamples.reverse();

  const snapshot: SnapshotMessage = {
    type: "snapshot",
    monitorId,
    data: {
      monitor: {
        id: monitorState?.id ?? monitorId,
        targetHost: monitorState?.target_host ?? "",
        targetName: monitorState?.target_name ?? monitorState?.target_host ?? "",
        status: monitorState ? mapSampleStatus(monitorState.last_status) : null,
        latencyMs: monitorState?.last_latency_ms ?? null,
        qualityState: monitorState ? mapQualityState(monitorState.quality_state) : "warmingUp",
        lastSeenMs: monitorState?.last_seen_ms ?? null,
      },
      samples: rawSamples.map((s) => ({
        timestampMs: s.timestamp_ms,
        latencyMs: s.latency_ms,
        status: s.status as "success" | "timeout" | "error",
        resolvedAddress: s.resolved_address,
      })),
    },
  };

  sendJSON(peer, snapshot);
}

/**
 * Handle unsubscribe message:
 * 1. Remove peer from the monitor's subscriber set
 * 2. Send 'unsubscribed' acknowledgment
 * 3. Clean up empty sets
 */
function handleUnsubscribe(
  peer: any,
  ws: WebSocketType,
  monitorId: number,
): void {
  const subSet = subscriptions.get(monitorId);

  if (!subSet) {
    // Not subscribed — still send acknowledgment
    sendJSON(peer, {
      type: "unsubscribed",
      monitorId,
    });
    return;
  }

  subSet.delete(ws);
  cleanupEmptyMonitor(monitorId);

  sendJSON(peer, {
    type: "unsubscribed",
    monitorId,
  });

  info(`Client unsubscribed from monitor ${monitorId}`);
}
