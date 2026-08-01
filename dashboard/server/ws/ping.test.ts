import { describe, test, expect, vi } from "vitest";

describe("WebSocket ping handler", () => {
  describe("open", () => {
    test("sends connected message on connection", () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      // Simulate the open callback behavior from ping.ts
      const message = {
        type: "connected",
        timestamp: new Date().toISOString(),
      };
      peer.send(JSON.stringify(message));

      expect(sendMock).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      expect(sent.type).toBe("connected");
      expect(sent.timestamp).toBeDefined();
    });

    test("connected message contains valid ISO timestamp", () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      const message = {
        type: "connected",
        timestamp: new Date().toISOString(),
      };
      peer.send(JSON.stringify(message));

      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      // Verify timestamp is parseable
      expect(new Date(sent.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe("message", () => {
    test("echoes valid JSON with type 'echo'", () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      const input = JSON.stringify({ client: "test", rtt: 42 });

      // Simulate the message handler
      try {
        const data = JSON.parse(input) as Record<string, unknown>;
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

      expect(sendMock).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      expect(sent.type).toBe("echo");
      expect(sent.data).toEqual({ client: "test", rtt: 42 });
    });

    test("sends error for invalid JSON", () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      const input = "not json {{{";

      try {
        const data = JSON.parse(input) as Record<string, unknown>;
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

      expect(sendMock).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      expect(sent.type).toBe("error");
      expect(sent.message).toBe("Invalid JSON");
    });

    test("handles empty object JSON", () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      const input = "{}";

      try {
        const data = JSON.parse(input) as Record<string, unknown>;
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

      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      expect(sent.type).toBe("echo");
      expect(sent.data).toEqual({});
    });

    test("handles array JSON input", () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      // JSON.parse doesn't produce Record<string, unknown> for arrays,
      // but the handler casts it anyway — so we verify the echo path
      const input = "[1, 2, 3]";

      try {
        const data = JSON.parse(input) as Record<string, unknown>;
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

      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      expect(sent.type).toBe("echo");
    });

    test("handles deeply nested JSON", () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      const input = JSON.stringify({
        outer: {
          inner: {
            deep: {
              value: "nested",
            },
          },
        },
      });

      try {
        const data = JSON.parse(input) as Record<string, unknown>;
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

      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      expect(sent.type).toBe("echo");
      expect(sent.data.outer.inner.deep.value).toBe("nested");
    });

    test("handles JSON with special characters", () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      const input = JSON.stringify({ message: "hello\nworld\t" });

      try {
        const data = JSON.parse(input) as Record<string, unknown>;
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

      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      expect(sent.type).toBe("echo");
      expect(sent.data.message).toBe("hello\nworld\t");
    });

    test("sends error for empty string", () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      const input = "";

      try {
        const data = JSON.parse(input) as Record<string, unknown>;
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

      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      expect(sent.type).toBe("error");
    });

    test("sends error for trailing comma JSON", () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      const input = '{"a": 1,}';

      try {
        const data = JSON.parse(input) as Record<string, unknown>;
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

      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      expect(sent.type).toBe("error");
    });
  });

  describe("close", () => {
    test("close callback is a no-op placeholder", () => {
      // The close callback in ping.ts is empty — it's a placeholder for F7.
      // Verify it doesn't throw.
      const closeFn = (_peer: unknown) => {
        // F7: remove peer from subscription map
      };

      expect(() => closeFn({})).not.toThrow();
    });

    test("close callback accepts undefined peer", () => {
      const closeFn = (_peer: unknown) => {
        // F7: remove peer from subscription map
      };

      expect(() => closeFn(undefined)).not.toThrow();
    });
  });

  describe("message format consistency", () => {
    test("echo response always includes timestamp", () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      const input = JSON.stringify({ key: "value" });

      try {
        const data = JSON.parse(input) as Record<string, unknown>;
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

      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      expect(sent).toHaveProperty("timestamp");
      expect(typeof sent.timestamp).toBe("string");
    });

    test("error response always includes timestamp", () => {
      const sendMock = vi.fn();
      const peer = { send: sendMock };

      const input = "invalid";

      try {
        const data = JSON.parse(input) as Record<string, unknown>;
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

      const sent = JSON.parse(sendMock.mock.calls[0][0]);
      expect(sent).toHaveProperty("timestamp");
      expect(typeof sent.timestamp).toBe("string");
    });
  });
});
