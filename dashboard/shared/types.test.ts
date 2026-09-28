import { describe, test, expect } from "vitest";

describe("shared types", () => {
  describe("PingSample", () => {
    test("requires timestamp, clientName, rtt, and target", () => {
      const sample = {
        timestamp: "2025-01-01T00:00:00.000Z",
        clientName: "test",
        rtt: 42,
        target: "8.8.8.8",
      };

      expect(sample.timestamp).toBeDefined();
      expect(sample.clientName).toBeDefined();
      expect(sample.rtt).toBeDefined();
      expect(sample.target).toBeDefined();
    });

    test("allows optional packetLoss and jitter", () => {
      const sample = {
        timestamp: "2025-01-01T00:00:00.000Z",
        clientName: "test",
        rtt: 42,
        target: "8.8.8.8",
      };

      // These should not exist
      expect("packetLoss" in sample).toBe(false);
      expect("jitter" in sample).toBe(false);
    });

    test("rtt is a number", () => {
      const sample = {
        timestamp: "2025-01-01T00:00:00.000Z",
        clientName: "test",
        rtt: 42,
        target: "8.8.8.8",
      };

      expect(typeof sample.rtt).toBe("number");
    });
  });

  describe("ClientIdentity", () => {
    test("requires all fields: slug, name, ip, os, hostname", () => {
      const client = {
        slug: "test-client",
        name: "Test",
        ip: "192.168.1.1",
        os: "Linux",
        hostname: "test-host",
      };

      expect(client.slug).toBe("test-client");
      expect(client.name).toBe("Test");
      expect(client.ip).toBe("192.168.1.1");
      expect(client.os).toBe("Linux");
      expect(client.hostname).toBe("test-host");
    });
  });

  describe("Monitor", () => {
    test("status is one of 'up', 'down', or 'degraded'", () => {
      const validStatuses = ["up", "down", "degraded"] as const;

      validStatuses.forEach((status) => {
        const monitor = {
          id: 1,
          clientSlug: "test",
          name: "Test",
          target: "8.8.8.8",
          lastPingAt: "2025-01-01T00:00:00.000Z",
          status,
          avgRtt: 42,
          avgPacketLoss: 0,
        };

        expect(monitor.status).toBe(status);
      });
    });
  });

  describe("QualityClass", () => {
    test("quality classes are good, fair, poor, critical", () => {
      const classes = ["good", "fair", "poor", "critical"] as const;

      expect(classes).toContain("good");
      expect(classes).toContain("fair");
      expect(classes).toContain("poor");
      expect(classes).toContain("critical");
    });
  });

  describe("WsMessageType", () => {
    test("valid message types are ping_update, monitor_status, client_online, client_offline", () => {
      const types = [
        "ping_update",
        "monitor_status",
        "client_online",
        "client_offline",
      ] as const;

      expect(types).toContain("ping_update");
      expect(types).toContain("monitor_status");
      expect(types).toContain("client_online");
      expect(types).toContain("client_offline");
    });
  });

  describe("WsMessage", () => {
    test("requires type, data, and timestamp", () => {
      const msg = {
        type: "ping_update" as const,
        data: { rtt: 42 },
        timestamp: "2025-01-01T00:00:00.000Z",
      };

      expect(msg.type).toBe("ping_update");
      expect(msg.data).toBeDefined();
      expect(msg.timestamp).toBeDefined();
    });

    test("data is a Record<string, unknown>", () => {
      const msg = {
        type: "ping_update" as const,
        data: { rtt: 42, name: "test" },
        timestamp: "2025-01-01T00:00:00.000Z",
      };

      expect(typeof msg.data).toBe("object");
    });
  });

  describe("HealthResponse", () => {
    test("requires status 'ok', timestamp, uptime, version, and F14 fields", () => {
      const resp = {
        status: "ok" as const,
        timestamp: "2025-01-01T00:00:00.000Z",
        uptime: 100,
        version: "0.1.0",
        db_path: "/tmp/lingering.db",
        db_size_bytes: 8192,
        monitor_count: 0,
        sample_count: 0,
        last_ingest_time: null,
      };

      expect(resp.status).toBe("ok");
      expect(resp.uptime).toBe(100);
      expect(resp.version).toBe("0.1.0");
      expect(typeof resp.db_path).toBe("string");
      expect(typeof resp.db_size_bytes).toBe("number");
      expect(typeof resp.monitor_count).toBe("number");
      expect(typeof resp.sample_count).toBe("number");
      expect(resp.last_ingest_time).toBeNull();
    });

    test("last_ingest_time is string when samples exist", () => {
      const resp = {
        status: "ok" as const,
        timestamp: "2025-01-01T00:00:00.000Z",
        uptime: 100,
        version: "0.1.0",
        db_path: "/tmp/lingering.db",
        db_size_bytes: 8192,
        monitor_count: 5,
        sample_count: 100,
        last_ingest_time: "2025-01-01T00:00:00.000Z",
      };

      expect(resp.last_ingest_time).toBe("2025-01-01T00:00:00.000Z");
    });
  });

});
