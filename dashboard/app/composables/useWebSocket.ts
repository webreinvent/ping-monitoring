import { onScopeDispose } from "vue";
import type { WsPingSample, QualityState } from "#shared/types";

/** Connection states for the WebSocket connection */
export type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

/** Outbound WebSocket message types */
type OutboundMessage =
  | { type: "subscribe"; monitorId: number }
  | { type: "unsubscribe"; monitorId: number };

/** Inbound WebSocket message types (from server) */
interface WsSampleMessage {
  type: "sample";
  monitorId: number;
  qualityState: QualityState;
  data: WsPingSample;
}

interface WsSubscribedMessage {
  type: "subscribed";
  monitorId: number;
}

interface WsSnapshotMessage {
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
    samples: WsPingSample[];
  };
}

interface WsClientNameUpdated {
  type: "client_name_updated";
  clientSlug: string;
  newName: string;
}

interface WsErrorMessage {
  type: "error";
  message: string;
}

type InboundMessage =
  | WsSampleMessage
  | WsSubscribedMessage
  | WsSnapshotMessage
  | WsClientNameUpdated
  | WsErrorMessage
  | { type: "connected"; timestamp: string }
  | { type: "unsubscribed"; monitorId: number };

/**
 * Composable for managing WebSocket connections to the live ping feed.
 *
 * - Connects to /ws/ping automatically on mount
 * - Supports subscribing/unsubscribing to individual monitors
 * - Auto-reconnects with exponential backoff on disconnect
 * - Exposes reactive connection state
 * - Handles client_name_updated messages
 */
export function useWebSocket() {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;

  // Reactive connection state
  const connectionState = ref<ConnectionState>("disconnected");

  // Set of monitor IDs currently subscribed
  const subscribedMonitors = ref<Set<number>>(new Set());

  /** Callback for when a new sample arrives */
  const sampleCallback = ref<((monitorId: number, sample: WsPingSample, qualityState: QualityState) => void) | null>(null);

  /** Callback for when a snapshot is received */
  const snapshotCallback = ref<((monitorId: number, samples: WsPingSample[], monitorInfo: { id: number; targetHost: string; targetName: string; status: "up" | "down" | null; latencyMs: number | null; qualityState: QualityState; lastSeenMs: number | null }) => void) | null>(null);

  /** Callback for when client name is updated */
  const clientNameUpdatedCallback = ref<((clientSlug: string, newName: string) => void) | null>(null);

  /**
   * Register a callback for incoming sample messages.
   */
  function onSample(
    fn: (monitorId: number, sample: WsPingSample, qualityState: QualityState) => void,
  ): void {
    sampleCallback.value = fn;
  }

  /**
   * Register a callback for snapshot messages.
   */
  function onSnapshot(
    fn: (monitorId: number, samples: WsPingSample[], monitorInfo: { id: number; targetHost: string; targetName: string; status: "up" | "down" | null; latencyMs: number | null; qualityState: QualityState; lastSeenMs: number | null }) => void,
  ): void {
    snapshotCallback.value = fn;
  }

  /**
   * Register a callback for client_name_updated messages.
   */
  function onClientNameUpdated(
    fn: (clientSlug: string, newName: string) => void,
  ): void {
    clientNameUpdatedCallback.value = fn;
  }

  /**
   * Send a JSON message to the WebSocket.
   */
  function send(message: OutboundMessage): void {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Subscribe to a monitor's live feed.
   */
  function subscribe(monitorId: number): void {
    subscribedMonitors.value = new Set(subscribedMonitors.value).add(monitorId);
    send({ type: "subscribe", monitorId });
  }

  /**
   * Unsubscribe from a monitor's live feed.
   */
  function unsubscribe(monitorId: number): void {
    const newSet = new Set(subscribedMonitors.value);
    newSet.delete(monitorId);
    subscribedMonitors.value = newSet;
    send({ type: "unsubscribe", monitorId });
  }

  /**
   * Get the WebSocket URL based on the current origin.
   */
  function getWsUrl(): string {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws/ping`;
  }

  /**
   * Connect to the WebSocket server.
   */
  function connect(): void {
    if (socket) {
      try {
        socket.close();
      } catch {
        // Ignore close errors
      }
    }

    connectionState.value = "connecting";

    try {
      socket = new WebSocket(getWsUrl());

      socket.onopen = () => {
        connectionState.value = "connected";
        reconnectAttempts = 0;

        // Re-subscribe to all previously subscribed monitors
        for (const monitorId of subscribedMonitors.value) {
          send({ type: "subscribe", monitorId });
        }
      };

      socket.onmessage = (event: MessageEvent) => {
        let message: InboundMessage;
        try {
          message = JSON.parse(event.data) as InboundMessage;
        } catch {
          return;
        }

        handleIncomingMessage(message);
      };

      socket.onclose = () => {
        if (connectionState.value === "connected") {
          // Unexpected close — start reconnection
          connectionState.value = "disconnected";
          scheduleReconnect();
        }
        socket = null;
      };

      socket.onerror = () => {
        // Error — let onclose handle reconnection
      };
    } catch {
      connectionState.value = "disconnected";
      scheduleReconnect();
    }
  }

  /**
   * Handle incoming messages from the server.
   */
  function handleIncomingMessage(message: InboundMessage): void {
    switch (message.type) {
      case "sample": {
        sampleCallback.value?.(message.monitorId, message.data, message.qualityState);
        break;
      }
      case "snapshot": {
        snapshotCallback.value?.(
          message.monitorId,
          message.data.samples,
          message.data.monitor,
        );
        break;
      }
      case "client_name_updated": {
        clientNameUpdatedCallback.value?.(message.clientSlug, message.newName);
        break;
      }
      // subscribed, unsubscribed, connected, error — handled silently
      default:
        break;
    }
  }

  /**
   * Schedule a reconnection with exponential backoff and jitter.
   */
  function scheduleReconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
    const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    // Add jitter: +/- 10%
    const jitter = baseDelay * 0.1 * (Math.random() * 2 - 1);
    const delay = baseDelay + jitter;

    reconnectAttempts++;
    connectionState.value = "reconnecting";

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  /**
   * Disconnect and clean up.
   */
  function disconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      try {
        socket.close();
      } catch {
        // Ignore
      }
      socket = null;
    }
    connectionState.value = "disconnected";
    subscribedMonitors.value = new Set();
    sampleCallback.value = null;
    snapshotCallback.value = null;
    clientNameUpdatedCallback.value = null;
  }

  // Auto-connect on mount (client-side only)
  let handleVisibilityChange: (() => void) | null = null;
  if (typeof window !== "undefined") {
    connect();

    // Reconnect on visibility change (user switches tab)
    handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && connectionState.value === "disconnected") {
        connect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  // Cleanup on unmount
  onScopeDispose(() => {
    if (typeof window !== "undefined" && handleVisibilityChange) {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    disconnect();
  });

  return {
    connectionState,
    subscribe,
    unsubscribe,
    onSample,
    onSnapshot,
    onClientNameUpdated,
    disconnect,
  };
}
