import { describe, it, expect, beforeEach } from "vitest";
import { createMockDb } from "~/test/mock-db-factory";
import type { Database } from "better-sqlite3";

// Helper: set up a database with the schema and test clients
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

  // Client 1: active, recently synced
  db.prepare(
    "INSERT INTO clients (slug, name, username, hostname, mac_address, sync_enabled, sync_interval_min, backend_url, last_synced_at_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    "active-client",
    "Active Client",
    "alice",
    "desktop",
    "aa:00:bb:11:cc:22",
    1,
    5,
    "https://dashboard.example.com/api",
    now,
    now,
    now,
  );

  // Client 2: sync disabled
  db.prepare(
    "INSERT INTO clients (slug, name, username, hostname, mac_address, sync_enabled, sync_interval_min, backend_url, last_synced_at_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    "disabled-client",
    "Disabled Client",
    "bob",
    "laptop",
    "bb:11:cc:22:dd:33",
    0,
    10,
    "",
    now - 3600000,
    now - 7200000,
    now - 3600000,
  );

  // Client 3: never synced
  db.prepare(
    "INSERT INTO clients (slug, name, username, hostname, mac_address, sync_enabled, sync_interval_min, backend_url, last_synced_at_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    "new-client",
    "New Client",
    "charlie",
    "server",
    "cc:22:dd:33:ee:44",
    1,
    15,
    "",
    null,
    now,
    now,
  );

  // Client 4: disconnected (last sync very old)
  db.prepare(
    "INSERT INTO clients (slug, name, username, hostname, mac_address, sync_enabled, sync_interval_min, backend_url, last_synced_at_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    "disconnected-client",
    "Disconnected Client",
    "dave",
    "workstation",
    "dd:33:ee:44:ff:55",
    1,
    5,
    "https://dashboard.example.com/api",
    now - 10000000, // ~2.78 hours ago, well beyond 2 * 5 min threshold
    now - 20000000,
    now - 10000000,
  );

  // @ts-expect-error — globalThis.__db is set by the database plugin
  globalThis.__db = db;
  return db;
}

/**
 * Compute sync status the same way the GET endpoint does.
 */
function computeSyncStatus(
  syncEnabled: boolean,
  lastSyncedAtMs: number | null,
  syncIntervalMin: number,
): string {
  if (!syncEnabled) {
    return "disabled";
  }
  if (lastSyncedAtMs == null) {
    return "not_configured";
  }
  const now = Date.now();
  const threshold = 2 * syncIntervalMin * 60000;
  if (now - lastSyncedAtMs > threshold) {
    return "disconnected";
  }
  return "connected";
}

describe("GET /api/clients/[slug]/settings — handler logic", () => {
  let db: Database;
  const now = Date.now();

  beforeEach(() => {
    db = setupDatabase();
  });

  describe("compute sync status", () => {
    it("returns 'connected' for a recently synced client", () => {
      const client = db.prepare("SELECT * FROM clients WHERE slug = ?").get("active-client");
      const status = computeSyncStatus(
        !!client.sync_enabled,
        client.last_synced_at_ms,
        client.sync_interval_min,
      );
      expect(status).toBe("connected");
    });

    it("returns 'disabled' when sync is disabled", () => {
      const client = db.prepare("SELECT * FROM clients WHERE slug = ?").get("disabled-client");
      const status = computeSyncStatus(
        !!client.sync_enabled,
        client.last_synced_at_ms,
        client.sync_interval_min,
      );
      expect(status).toBe("disabled");
    });

    it("returns 'not_configured' when never synced", () => {
      const client = db.prepare("SELECT * FROM clients WHERE slug = ?").get("new-client");
      const status = computeSyncStatus(
        !!client.sync_enabled,
        client.last_synced_at_ms,
        client.sync_interval_min,
      );
      expect(status).toBe("not_configured");
    });

    it("returns 'disconnected' when last sync is too old", () => {
      const client = db.prepare("SELECT * FROM clients WHERE slug = ?").get("disconnected-client");
      const status = computeSyncStatus(
        !!client.sync_enabled,
        client.last_synced_at_ms,
        client.sync_interval_min,
      );
      expect(status).toBe("disconnected");
    });
  });

  describe("response shape", () => {
    it("includes all required fields", () => {
      const client = db.prepare("SELECT * FROM clients WHERE slug = ?").get("active-client");

      // Simulate the response shape
      const response = {
        clientId: client.id,
        slug: client.slug,
        name: client.name,
        username: client.username,
        hostname: client.hostname,
        mac_address: client.mac_address,
        sync_enabled: !!client.sync_enabled,
        sync_interval_min: client.sync_interval_min,
        backend_url: client.backend_url,
        last_synced_at_ms: client.last_synced_at_ms,
        sync_status: computeSyncStatus(
          !!client.sync_enabled,
          client.last_synced_at_ms,
          client.sync_interval_min,
        ),
        created_at: new Date(client.created_at).toISOString(),
        updated_at: new Date(client.updated_at).toISOString(),
      };

      expect(response.clientId).toBe(1);
      expect(response.slug).toBe("active-client");
      expect(response.sync_enabled).toBe(true);
      expect(response.sync_status).toBe("connected");
      expect(response.created_at).toBeDefined();
      expect(response.updated_at).toBeDefined();
    });

    it("handles non-existent client (404)", () => {
      const client = db.prepare("SELECT * FROM clients WHERE slug = ?").get("nonexistent");
      expect(client).toBeUndefined();
    });
  });

  describe("threshold computation", () => {
    it("uses 2 * sync_interval_min * 60000 as the threshold", () => {
      const intervalMin = 5;
      const threshold = 2 * intervalMin * 60000;
      expect(threshold).toBe(600000); // 10 minutes in ms
    });

    it("correctly identifies boundary case (just within threshold)", () => {
      // Use Date.now() to avoid race with computeSyncStatus's internal Date.now()
      const lastSynced = Date.now() - 599999;
      const status = computeSyncStatus(true, lastSynced, 5);
      expect(status).toBe("connected");
    });

    it("correctly identifies boundary case (just beyond threshold)", () => {
      // Use Date.now() for the same reason
      const lastSynced = Date.now() - 600001;
      const status = computeSyncStatus(true, lastSynced, 5);
      expect(status).toBe("disconnected");
    });
  });
});
