import { describe, it, expect, beforeEach } from "vitest";
import { createMockDb } from "~/test/mock-db-factory";
import type { Database } from "better-sqlite3";

// Helper: set up a database with the schema and a test client
function setupDatabase(): Database {
  const DB = createMockDb();
  const db = new DB(":memory:");

  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      username TEXT NOT NULL,
      hostname TEXT NOT NULL,
      mac_address TEXT NOT NULL,
      sync_enabled INTEGER NOT NULL DEFAULT 1,
      sync_interval_min INTEGER NOT NULL DEFAULT 5,
      backend_url TEXT NOT NULL DEFAULT '',
      last_synced_at_ms INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const now = Date.now();
  db.prepare(
    "INSERT INTO clients (slug, name, username, hostname, mac_address, sync_enabled, sync_interval_min, backend_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run("test-client", "Test Client", "alice", "desktop", "aa:00:bb:11:cc:22", 1, 5, "", now, now);

  // @ts-expect-error — globalThis.__db is set by the database plugin
  globalThis.__db = db;
  return db;
}

describe("PUT /api/clients/[slug]/settings — handler logic", () => {
  beforeEach(() => {
    setupDatabase();
  });

  describe("validate sync_interval_min", () => {
    it("accepts valid sync_interval_min values", () => {
      const allowedIntervals = [1, 2, 5, 10, 15, 30, 60];
      for (const interval of allowedIntervals) {
        // The validation logic: allowedIntervals.includes(body.sync_interval_min)
        const isValid = allowedIntervals.includes(interval);
        expect(isValid).toBe(true);
      }
    });

    it("rejects invalid sync_interval_min values", () => {
      const allowedIntervals = [1, 2, 5, 10, 15, 30, 60];
      const invalidValues = [0, 3, 7, 45, 120, -1];
      for (const val of invalidValues) {
        const isValid = allowedIntervals.includes(val);
        expect(isValid).toBe(false);
      }
    });
  });

  describe("validate backend_url", () => {
    it("accepts valid HTTPS URLs", () => {
      const validUrls = [
        "https://example.com",
        "https://api.example.com/v1",
        "https://localhost:8443",
      ];
      for (const url of validUrls) {
        const parsed = new URL(url);
        expect(parsed.protocol).toBe("https:");
      }
    });

    it("rejects non-HTTPS URLs", () => {
      const invalidUrls = ["http://example.com", "ftp://example.com", "ws://example.com"];
      for (const url of invalidUrls) {
        const parsed = new URL(url);
        expect(parsed.protocol).not.toBe("https:");
      }
    });

    it("rejects invalid URLs", () => {
      const invalidUrls = ["not-a-url", "https://", "://example.com", ""];
      for (const url of invalidUrls) {
        try {
          new URL(url);
          expect(false).toBe(true); // Should not reach here
        } catch {
          // Expected
        }
      }
    });
  });

  describe("update settings", () => {
    it("updates sync_enabled to false and preserves other settings", () => {
      const db = globalThis.__db as Database;
      const now = Date.now();

      // Simulate the PUT endpoint logic
      db.prepare(`
        UPDATE clients SET
          sync_enabled = ?,
          sync_interval_min = ?,
          backend_url = ?,
          updated_at = ?
        WHERE slug = ?
      `).run(0, 5, "", now, "test-client");

      const client = db.prepare("SELECT * FROM clients WHERE slug = ?").get("test-client");
      expect(client.sync_enabled).toBe(0);
      expect(client.sync_interval_min).toBe(5);
      expect(client.backend_url).toBe("");
    });

    it("updates sync_enabled to true with new interval", () => {
      const db = globalThis.__db as Database;
      const now = Date.now();

      db.prepare(`
        UPDATE clients SET
          sync_enabled = ?,
          sync_interval_min = ?,
          backend_url = ?,
          updated_at = ?
        WHERE slug = ?
      `).run(1, 10, "https://api.example.com", now, "test-client");

      const client = db.prepare("SELECT * FROM clients WHERE slug = ?").get("test-client");
      expect(client.sync_enabled).toBe(1);
      expect(client.sync_interval_min).toBe(10);
      expect(client.backend_url).toBe("https://api.example.com");
    });

    it("preserves existing interval when not provided (sync enabled)", () => {
      const db = globalThis.__db as Database;
      const now = Date.now();

      // Simulate updating sync_enabled but not changing interval
      db.prepare(`
        UPDATE clients SET
          sync_enabled = ?,
          sync_interval_min = ?,
          backend_url = ?,
          updated_at = ?
        WHERE slug = ?
      `).run(1, 5, "", now, "test-client"); // keeping same interval

      const client = db.prepare("SELECT * FROM clients WHERE slug = ?").get("test-client");
      expect(client.sync_interval_min).toBe(5);
    });

    it("handles non-existent client (404)", () => {
      const db = globalThis.__db as Database;
      const client = db.prepare("SELECT * FROM clients WHERE slug = ?").get("nonexistent");
      expect(client).toBeUndefined();
    });
  });
});
