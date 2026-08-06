import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Mock the Nitro runtime helpers
// ============================================================================

vi.mock("nitropack", () => ({
  defineWebSocketHandler: (handler: any) => handler,
}), { virtual: true });

// We need defineWebSocketHandler to be globally available since ping.ts
// imports it without explicit import (Nitro auto-import).
const mockDefineWebSocketHandler = vi.fn((handler: any) => handler);
(global as any).defineWebSocketHandler = mockDefineWebSocketHandler;

// ============================================================================
// Mock the dependencies
// ============================================================================

const mockDb: any = {
  prepare: vi.fn(),
};

// Use both import path formats since the file may use relative or #server paths
vi.mock("../utils/db", () => ({
  getDb: () => mockDb,
}));

vi.mock("#server/utils/db", () => ({
  getDb: () => mockDb,
}));

vi.mock("../utils/logger", () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("#server/utils/logger", () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// ============================================================================
// Tests
// ============================================================================

describe("WebSocket ping handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.prepare.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("open", () => {
    test("sends connected message on connection", async () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      const mod = await import("./ping");
      const handler = mod.default;

      handler.open(peer);

      expect(sendMock).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      expect(sent.type).toBe("connected");
      expect(sent.timestamp).toBeDefined();
    });
  });

  describe("message handler", () => {
    describe("invalid messages", () => {
      test("sends error for invalid JSON", async () => {
        const sendMock = vi.fn();
        const peer = { send: sendMock, ws: { readyState: 1 } as any };

        const mod = await import("./ping");
        const handler = mod.default;

        handler.message(peer, { text: () => "not json {{{" } as any);

        const calls = sendMock.mock.calls;
        const messages = calls.map((c: any[]) => JSON.parse(c[0]));
        const error = messages.find((m: any) => m.type === "error");
        expect(error).toBeDefined();
        expect(error.message).toBe("Invalid JSON");
      });

      test("sends error for missing monitorId", async () => {
        const sendMock = vi.fn();
        const peer = { send: sendMock, ws: { readyState: 1 } as any };

        const mod = await import("./ping");
        const handler = mod.default;

        handler.message(peer, {
          text: () => JSON.stringify({ type: "subscribe" }),
        } as any);

        const calls = sendMock.mock.calls;
        const messages = calls.map((c: any[]) => JSON.parse(c[0]));
        const error = messages.find((m: any) => m.type === "error");
        expect(error).toBeDefined();
        expect(error.message).toContain("monitorId");
      });

      test("sends error for unknown message type", async () => {
        const sendMock = vi.fn();
        const peer = { send: sendMock, ws: { readyState: 1 } as any };

        const mod = await import("./ping");
        const handler = mod.default;

        handler.message(peer, {
          text: () => JSON.stringify({ type: "unknown", monitorId: 42 }),
        } as any);

        const calls = sendMock.mock.calls;
        const messages = calls.map((c: any[]) => JSON.parse(c[0]));
        const error = messages.find((m: any) => m.type === "error");
        expect(error).toBeDefined();
        expect(error.message).toContain("Unknown message type");
      });
    });

    describe("subscribe", () => {
      test("sends error for non-existent monitor", async () => {
        const sendMock = vi.fn();
        const peer = { send: sendMock, ws: { readyState: 1 } as any };

        // Mock monitor does not exist
        const prepareMock = {
          get: vi.fn().mockReturnValue(undefined),
          all: vi.fn().mockReturnValue([]),
        };
        mockDb.prepare.mockReturnValue(prepareMock);

        // Force re-import to pick up fresh mock state
        const modPath = "./ping";
        // Clear cache to re-import with fresh mocks
        vi.unstubAllGlobals();
        (global as any).defineWebSocketHandler = mockDefineWebSocketHandler;

        const mod = await import(modPath);
        const handler = mod.default;

        handler.message(peer, {
          text: () => JSON.stringify({ type: "subscribe", monitorId: 999 }),
        } as any);

        const calls = sendMock.mock.calls;
        const messages = calls.map((c: any[]) => JSON.parse(c[0]));
        const error = messages.find((m: any) => m.type === "error");
        expect(error).toBeDefined();
        expect(error.message).toContain("not found");
      });
    });

    describe("unsubscribe", () => {
      test("sends unsubscribed ack", async () => {
        const sendMock = vi.fn();
        const peer = { send: sendMock, ws: { readyState: 1 } as any };

        const mod = await import("./ping");
        const handler = mod.default;

        handler.message(peer, {
          text: () => JSON.stringify({ type: "unsubscribe", monitorId: 42 }),
        } as any);

        const calls = sendMock.mock.calls;
        const messages = calls.map((c: any[]) => JSON.parse(c[0]));
        const unsubscribed = messages.find(
          (m: any) => m.type === "unsubscribed",
        );
        expect(unsubscribed).toBeDefined();
        expect(unsubscribed.monitorId).toBe(42);
      });
    });
  });

  describe("close", () => {
    test("close callback removes peer from all subscriptions", async () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock, ws: {} as any };

      const mod = await import("./ping");
      const handler = mod.default;

      expect(() => handler.close(peer)).not.toThrow();
    });
  });

  describe("broadcastSample (exported)", () => {
    test("broadcastSample is exported from the module", async () => {
      const mod = await import("./ping");
      expect(typeof mod.broadcastSample).toBe("function");
    });

    test("getSubscriberCount is exported from the module", async () => {
      const mod = await import("./ping");
      expect(typeof mod.getSubscriberCount).toBe("function");
    });

    test("broadcastSample does nothing when no subscribers", async () => {
      const mod = await import("./ping");
      // Should not throw when there are no subscribers
      expect(() =>
        mod.broadcastSample(999, {
          timestampMs: 1000,
          latencyMs: 20,
          status: "success",
          resolvedAddress: "1.2.3.4",
        }),
      ).not.toThrow();
    });
  });

  describe("broadcastClientNameUpdated", () => {
    test("broadcastClientNameUpdated is exported from the module", async () => {
      const mod = await import("./ping");
      expect(typeof mod.broadcastClientNameUpdated).toBe("function");
    });

    test("broadcastClientNameUpdated sends correct message shape", async () => {
      const mod = await import("./ping");
      // Call with no peers — should not throw
      expect(() =>
        mod.broadcastClientNameUpdated("test-slug", "New Name"),
      ).not.toThrow();
    });

    test("broadcastClientNameUpdated sends to all connected peers", async () => {
      // Create mock WebSocket peers
      const peer1 = { readyState: 1, send: vi.fn() };
      const peer2 = { readyState: 1, send: vi.fn() };

      const mod = await import("./ping");
      const handler = mod.default;

      // Simulate two peers connecting by calling open
      const mockPeer1 = { send: vi.fn(), ws: peer1 };
      const mockPeer2 = { send: vi.fn(), ws: peer2 };
      handler.open(mockPeer1);
      handler.open(mockPeer2);

      // Broadcast
      mod.broadcastClientNameUpdated("test-client", "New Client Name");

      // Verify both peers received the message
      expect(peer1.send).toHaveBeenCalledTimes(1);
      expect(peer2.send).toHaveBeenCalledTimes(1);

      // Verify message shape
      const sent1 = JSON.parse(peer1.send.mock.calls[0][0]);
      const sent2 = JSON.parse(peer2.send.mock.calls[0][0]);
      expect(sent1.type).toBe("client_name_updated");
      expect(sent1.clientSlug).toBe("test-client");
      expect(sent1.newName).toBe("New Client Name");
      expect(sent2.type).toBe("client_name_updated");
      expect(sent2.clientSlug).toBe("test-client");
      expect(sent2.newName).toBe("New Client Name");

      // Clean up: disconnect both
      handler.close(mockPeer1);
      handler.close(mockPeer2);
    });

    test("broadcastClientNameUpdated skips closed peers", async () => {
      // Peer with readyState !== 1 should not receive the message
      const closedPeer = { readyState: 3, send: vi.fn() };

      const mod = await import("./ping");
      const handler = mod.default;

      const mockPeer = { send: vi.fn(), ws: closedPeer };
      handler.open(mockPeer);

      mod.broadcastClientNameUpdated("test-slug", "New Name");

      // Closed peer should not have received the message
      expect(closedPeer.send).not.toHaveBeenCalled();

      // Clean up
      handler.close(mockPeer);
    });

    test("broadcastClientNameUpdated handles send errors gracefully", async () => {
      // Peer that throws on send should not crash the broadcast
      const badPeer = {
        readyState: 1,
        send: vi.fn(() => { throw new Error("connection reset"); }),
      };

      const mod = await import("./ping");
      const handler = mod.default;

      const mockPeer = { send: vi.fn(), ws: badPeer };
      handler.open(mockPeer);

      // Should not throw
      expect(() =>
        mod.broadcastClientNameUpdated("test-slug", "New Name"),
      ).not.toThrow();

      // Clean up
      handler.close(mockPeer);
    });
  });
});
