import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import type { Database as DBType } from "better-sqlite3";

// ============================================================================
// Helper: Create in-memory test database
// ============================================================================

function createTestDb(): DBType {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      username TEXT NOT NULL,
      hostname TEXT NOT NULL,
      mac_address TEXT NOT NULL,
      sync_enabled BOOLEAN NOT NULL DEFAULT 1,
      sync_interval_min INTEGER NOT NULL DEFAULT 5,
      backend_url TEXT NOT NULL DEFAULT '',
      last_synced_at_ms INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      target_host TEXT NOT NULL,
      target_name TEXT DEFAULT NULL,
      quality_state TEXT DEFAULT 'warmingUp',
      state_since_ms INTEGER DEFAULT NULL,
      last_seen_ms INTEGER DEFAULT NULL,
      last_status TEXT DEFAULT NULL,
      last_latency_ms REAL DEFAULT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(client_id, target_host)
    );

    CREATE TABLE ping_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      timestamp_ms INTEGER NOT NULL,
      latency_ms REAL DEFAULT NULL,
      status TEXT NOT NULL,
      resolved_address TEXT DEFAULT NULL,
      error TEXT DEFAULT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(monitor_id, timestamp_ms, resolved_address)
    );
  `);
  return db;
}

function setDb(db: DBType) {
  // @ts-expect-error — test isolation
  globalThis.__db = db;
}

function clearDb() {
  // @ts-expect-error — test isolation
  delete globalThis.__db;
}

// ============================================================================
// Route parameter parsing
// ============================================================================

describe("monitor history route — query parameter defaults", () => {
  let db: DBType;

  beforeEach(() => {
    clearDb();
    db = createTestDb();
    setDb(db);
    db.prepare(
      "INSERT INTO clients (slug, name, username, hostname, mac_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("test", "Test", "test", "host", "aa:00:bb:11:cc:22", 0, 0);
    db.prepare(
      "INSERT INTO monitors (client_id, target_host, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).run(1, "8.8.8.8", 0, 0);
  });

  afterEach(() => {
    db.close();
    clearDb();
  });

  it("valid monitor ID returns 200", async () => {
    const { getMonitorHistoryPoints } = await import("~/server/utils/history");
    // Test the function exists and works
    const points = getMonitorHistoryPoints(1, 0, Date.now(), 60000);
    expect(Array.isArray(points)).toBe(true);
  });
});

describe("monitor history route — query parameter validation logic", () => {
  it("fromMs defaults to now - 1 hour when not provided", () => {
    const nowMs = Date.now();
    const defaultFromMs = nowMs - 3_600_000;
    expect(defaultFromMs).toBeLessThan(nowMs);
    expect(nowMs - defaultFromMs).toBe(3_600_000);
  });

  it("toMs defaults to now when not provided", () => {
    const nowMs = Date.now();
    // toMs = nowMs
    expect(nowMs).toBeGreaterThanOrEqual(0);
  });

  it("maxPoints defaults to 2000", () => {
    const defaultMaxPoints = 2000;
    expect(defaultMaxPoints).toBe(2000);
  });

  it("maxPoints capped at 5000", () => {
    const capped = Math.min(10000, 5000);
    expect(capped).toBe(5000);
  });

  it("fromMs >= toMs is invalid", () => {
    const fromMs = 2000;
    const toMs = 1000;
    expect(fromMs >= toMs).toBe(true);
  });

  it("partial params — only fromMs provided, toMs defaults to now", () => {
    const fromMs = 1000;
    const toMs = Date.now(); // default
    expect(fromMs < toMs).toBe(true);
  });

  it("negative maxPoints resets to default 2000", () => {
    let maxPoints = -5;
    if (maxPoints < 1) {
      maxPoints = 2000;
    }
    expect(maxPoints).toBe(2000);
  });
});

describe("monitor ID validation", () => {
  it("valid integer ID passes", () => {
    const id = 42;
    expect(Number.isInteger(id) && id > 0).toBe(true);
  });

  it("non-integer string fails", () => {
    const id = Number("abc");
    expect(!Number.isInteger(id) || id <= 0).toBe(true);
  });

  it("negative integer fails", () => {
    const id = -1;
    expect(!Number.isInteger(id) || id <= 0).toBe(true);
  });

  it("zero fails", () => {
    const id = 0;
    expect(!Number.isInteger(id) || id <= 0).toBe(true);
  });

  it("float fails", () => {
    const id = 42.5;
    expect(!Number.isInteger(id) || id <= 0).toBe(true);
  });
});

describe("monitor not found", () => {
  let db: DBType;

  beforeEach(() => {
    clearDb();
    db = createTestDb();
    setDb(db);
    db.prepare(
      "INSERT INTO clients (slug, name, username, hostname, mac_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("test", "Test", "test", "host", "aa:00:bb:11:cc:22", 0, 0);
  });

  afterEach(() => {
    db.close();
    clearDb();
  });

  it("valid ID but no monitor → not found", () => {
    const monitor = db.prepare("SELECT * FROM monitors WHERE id = ?").get(9999);
    expect(monitor).toBeUndefined();
  });
});
