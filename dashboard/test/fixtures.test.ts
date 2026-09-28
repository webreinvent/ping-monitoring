import { describe, test, expect } from "vitest";
import {
  createPingSample,
  createPingSamples,
  createClientIdentity,
  createMonitor,
  createIngestPayload,
  createIngestResponse,
  createHealthResponse,
  createHealthErrorResponse,
} from "./fixtures";

describe("test fixtures", () => {
  describe("createPingSample", () => {
    test("creates a valid PingSample with defaults", () => {
      const sample = createPingSample();

      expect(sample.timestamp).toBe("2025-01-01T00:00:00.000Z");
      expect(sample.clientName).toBe("test-client");
      expect(sample.rtt).toBe(42);
      expect(sample.target).toBe("8.8.8.8");
      expect(sample.packetLoss).toBe(0);
      expect(sample.jitter).toBe(2);
    });

    test("allows overrides", () => {
      const sample = createPingSample({ rtt: 100, target: "1.1.1.1" });

      expect(sample.rtt).toBe(100);
      expect(sample.target).toBe("1.1.1.1");
      expect(sample.clientName).toBe("test-client"); // default preserved
    });

    test("allows optional fields to be overridden", () => {
      const sample = createPingSample({
        packetLoss: 50,
        jitter: 10,
      });

      expect(sample.packetLoss).toBe(50);
      expect(sample.jitter).toBe(10);
    });

    test("allows optional fields to be set to undefined (overwrites defaults)", () => {
      // Note: spreading { packetLoss: undefined } overwrites the base defaults
      // because the spread happens after the defaults are set. This is the
      // expected behavior — the caller controls the final shape.
      const sample = createPingSample({
        packetLoss: undefined,
        jitter: undefined,
      });

      expect(sample.packetLoss).toBe(undefined);
      expect(sample.jitter).toBe(undefined);
    });
  });

  describe("createPingSamples", () => {
    test("creates the requested number of samples", () => {
      const samples = createPingSamples(5);

      expect(samples).toHaveLength(5);
    });

    test("each sample has a unique timestamp", () => {
      const samples = createPingSamples(3);

      const timestamps = samples.map((s) => s.timestamp);
      const uniqueTimestamps = new Set(timestamps);

      expect(uniqueTimestamps.size).toBe(3);
    });

    test("creates zero samples when count is 0", () => {
      const samples = createPingSamples(0);

      expect(samples).toHaveLength(0);
    });

    test("applies overrides to all samples", () => {
      const samples = createPingSamples(3, { target: "1.1.1.1" });

      samples.forEach((s) => {
        expect(s.target).toBe("1.1.1.1");
      });
    });

    test("samples have sequential timestamps", () => {
      const samples = createPingSamples(3);

      expect(samples[0].timestamp).toBe("2025-01-01T00:00:00.000Z");
      expect(samples[1].timestamp).toBe("2025-01-01T00:01:00.000Z");
      expect(samples[2].timestamp).toBe("2025-01-01T00:02:00.000Z");
    });
  });

  describe("createClientIdentity", () => {
    test("creates a valid ClientIdentity with defaults", () => {
      const client = createClientIdentity();

      expect(client.slug).toBe("test-client");
      expect(client.name).toBe("Test Client");
      expect(client.ip).toBe("192.168.1.1");
      expect(client.os).toBe("Linux");
      expect(client.hostname).toBe("test-host");
    });

    test("allows overrides", () => {
      const client = createClientIdentity({
        slug: "custom",
        ip: "10.0.0.1",
      });

      expect(client.slug).toBe("custom");
      expect(client.ip).toBe("10.0.0.1");
      expect(client.name).toBe("Test Client"); // default preserved
    });
  });

  describe("createMonitor", () => {
    test("creates a valid Monitor with defaults", () => {
      const monitor = createMonitor();

      expect(monitor.id).toBe(1);
      expect(monitor.clientSlug).toBe("test-client");
      expect(monitor.name).toBe("Test Monitor");
      expect(monitor.target).toBe("8.8.8.8");
      expect(monitor.status).toBe("up");
      expect(monitor.avgRtt).toBe(42);
      expect(monitor.avgPacketLoss).toBe(0);
    });

    test("allows status overrides", () => {
      const monitor = createMonitor({ status: "down" });

      expect(monitor.status).toBe("down");
    });

    test("allows degraded status", () => {
      const monitor = createMonitor({ status: "degraded" });

      expect(monitor.status).toBe("degraded");
    });
  });

  describe("createIngestPayload", () => {
    test("creates a valid IngestPayload with defaults", () => {
      const payload = createIngestPayload();

      expect(payload.clientSlug).toBe("test-client");
      expect(payload.samples).toHaveLength(0);
    });

    test("allows samples override", () => {
      const payload = createIngestPayload({
        samples: [
          {
            targetHost: "1.1.1.1",
            timestampMs: Date.now(),
            latencyMs: 10,
            status: "success",
            resolvedAddress: "1.1.1.1",
          },
          {
            targetHost: "2.2.2.2",
            timestampMs: Date.now(),
            latencyMs: 20,
            status: "success",
            resolvedAddress: "2.2.2.2",
          },
        ],
      });

      expect(payload.samples).toHaveLength(2);
    });

    test("allows empty samples array", () => {
      const payload = createIngestPayload({ samples: [] });

      expect(payload.samples).toHaveLength(0);
    });
  });

  describe("createIngestResponse", () => {
    test("creates a valid IngestResponse with defaults", () => {
      const resp = createIngestResponse();

      expect(resp.accepted).toBe(1);
      expect(resp.duplicate).toBe(0);
      expect(resp.rejected).toBe(0);
    });

    test("allows overrides", () => {
      const resp = createIngestResponse({
        accepted: 5,
        duplicate: 2,
        rejected: 1,
      });

      expect(resp.accepted).toBe(5);
      expect(resp.duplicate).toBe(2);
      expect(resp.rejected).toBe(1);
    });
  });

  describe("createHealthResponse", () => {
    test("creates a valid HealthResponse with defaults", () => {
      const resp = createHealthResponse();

      expect(resp.status).toBe("ok");
      expect(resp.timestamp).toBe("2025-01-01T00:00:00.000Z");
      expect(resp.uptime).toBe(100);
      expect(resp.version).toBe("0.1.0");
      expect(resp.db_path).toBe("/tmp/test.db");
      expect(resp.db_size_bytes).toBe(8192);
      expect(resp.monitor_count).toBe(0);
      expect(resp.sample_count).toBe(0);
      expect(resp.last_ingest_time).toBeNull();
    });

    test("allows overrides for all fields", () => {
      const resp = createHealthResponse({
        db_size_bytes: 102400,
        monitor_count: 5,
        sample_count: 500,
        last_ingest_time: "2025-01-01T00:00:00.000Z",
      });

      expect(resp.db_size_bytes).toBe(102400);
      expect(resp.monitor_count).toBe(5);
      expect(resp.sample_count).toBe(500);
      expect(resp.last_ingest_time).toBe("2025-01-01T00:00:00.000Z");
    });
  });

  describe("createHealthErrorResponse", () => {
    test("creates a valid HealthErrorResponse with defaults", () => {
      const resp = createHealthErrorResponse();

      expect(resp.status).toBe("error");
      expect(resp.timestamp).toBe("2025-01-01T00:00:00.000Z");
      expect(resp.message).toBe("Something went wrong");
    });

    test("allows custom message", () => {
      const resp = createHealthErrorResponse({
        message: "Database connection failed",
      });

      expect(resp.message).toBe("Database connection failed");
    });
  });
});
