// WebSocket ping broadcast stub
// F7: WebSocket broadcast will expand this with real-time logic.
// For now, it accepts connections and echoes ping updates.

export default defineWebSocketHandler({
  open(peer) {
    peer.send(
      JSON.stringify({
        type: "connected",
        timestamp: new Date().toISOString(),
      }),
    );
  },

  message(peer, message) {
    try {
      const data = JSON.parse(message.text) as Record<string, unknown>;
      // Echo back for now — F7 will implement topic subscriptions and broadcast
      peer.send(
        JSON.stringify({
          type: "echo",
          data,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch {
      peer.send(
        JSON.stringify({
          type: "error",
          message: "Invalid JSON",
          timestamp: new Date().toISOString(),
        }),
      );
    }
  },

  close(peer) {
    // F7: remove peer from subscription map
  },
});
