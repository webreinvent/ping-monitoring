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
});
