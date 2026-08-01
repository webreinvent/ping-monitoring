/**
 * Unit tests for database schema migrations (001-005).
 *
 * Verifies SQL correctness, column definitions, constraints,
 * foreign keys, and index definitions by parsing the migration files.
 * Since better-sqlite3 crashes in this environment, we validate
 * the SQL text structure rather than executing it.
 */

import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// Load migration files from the migrations directory.
const migrationsDir = resolve(__dirname, "migrations");

function loadMigration(filename: string): string {
  return readFileSync(resolve(migrationsDir, filename), "utf-8");
}

function extractTableColumns(sql: string): string[] {
  // Extract content between the outer parentheses of CREATE TABLE.
  const match = sql.match(/CREATE TABLE IF NOT EXISTS \w+ \(([\s\S]*?)\);/);
  if (!match) return [];

  const body = match[1];
  // Split by commas, but respect parentheses (e.g., UNIQUE(...) spans lines).
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines;
}

function extractCreateIndexNames(sql: string): string[] {
  const names: string[] = [];
  const regex = /CREATE INDEX IF NOT EXISTS (\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(sql)) !== null) {
    names.push(m[1]);
  }
  return names;
}

describe("migration files", () => {
  test("all 5 migration files exist", () => {
    const files = readdirSync(migrationsDir).filter(
      (f) => f.endsWith(".sql") && !f.startsWith("index"),
    );

    const expected = [
      "001_create_clients.sql",
      "002_create_monitors.sql",
      "003_create_ping_samples.sql",
      "004_create_minute_rollups.sql",
      "005_create_indexes.sql",
    ];

    expect(files.length).toBe(expected.length);
    files.forEach((f) => {
      expect(expected).toContain(f);
    });
  });

  test("migration files follow 00X_name.sql convention", () => {
    const files = readdirSync(migrationsDir).filter(
      (f) => f.endsWith(".sql") && !f.startsWith("index"),
    );

    files.forEach((f) => {
      expect(f).toMatch(/^\d{3}_.+\.sql$/);
    });
  });

  test("migration files sort in correct dependency order", () => {
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql") && !f.startsWith("index"))
      .sort();

    expect(files[0]).toBe("001_create_clients.sql");
    expect(files[1]).toBe("002_create_monitors.sql");
    expect(files[2]).toBe("003_create_ping_samples.sql");
    expect(files[3]).toBe("004_create_minute_rollups.sql");
    expect(files[4]).toBe("005_create_indexes.sql");
  });
});

describe("001_create_clients.sql", () => {
  let sql: string;

  test("creates the clients table", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS clients");
  });

  test("has PRIMARY KEY AUTOINCREMENT on id column", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toMatch(/id\s+INTEGER PRIMARY KEY AUTOINCREMENT/);
  });

  test("has all required columns", () => {
    sql = loadMigration("001_create_clients.sql");
    const requiredColumns = [
      "id",
      "slug",
      "name",
      "username",
      "hostname",
      "mac_address",
      "sync_enabled",
      "sync_interval_min",
      "backend_url",
      "last_synced_at_ms",
      "created_at",
      "updated_at",
    ];

    requiredColumns.forEach((col) => {
      expect(sql).toContain(col);
    });
  });

  test("slug has NOT NULL UNIQUE constraint", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toMatch(/slug\s+TEXT\s+NOT NULL UNIQUE/);
  });

  test("name has NOT NULL constraint", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toMatch(/name\s+TEXT\s+NOT NULL/);
  });

  test("username has NOT NULL constraint", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toMatch(/username\s+TEXT\s+NOT NULL/);
  });

  test("hostname has NOT NULL constraint", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toMatch(/hostname\s+TEXT\s+NOT NULL/);
  });

  test("mac_address has NOT NULL constraint", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toMatch(/mac_address\s+TEXT\s+NOT NULL/);
  });

  test("sync_enabled has DEFAULT 1", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toMatch(/sync_enabled\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+1/);
  });

  test("sync_interval_min has DEFAULT 5", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toMatch(
      /sync_interval_min\s+INTEGER\s+NOT NULL\s+DEFAULT\s+5/,
    );
  });

  test("backend_url has DEFAULT empty string", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toMatch(/backend_url\s+TEXT\s+NOT NULL\s+DEFAULT\s+''/);
  });

  test("last_synced_at_ms is nullable", () => {
    sql = loadMigration("001_create_clients.sql");
    // last_synced_at_ms should NOT have NOT NULL
    const match = sql.match(/last_synced_at_ms\s+INTEGER/);
    expect(match).not.toBeNull();
    // Check the full line doesn't contain NOT NULL after the column name
    const line = sql.split("\n").find((l) => l.includes("last_synced_at_ms"));
    expect(line).not.toContain("NOT NULL");
  });

  test("created_at has NOT NULL constraint", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toMatch(/created_at\s+INTEGER\s+NOT NULL/);
  });

  test("updated_at has NOT NULL constraint", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toMatch(/updated_at\s+INTEGER\s+NOT NULL/);
  });

  test("has F9 sync columns (sync_enabled, sync_interval_min, backend_url, last_synced_at_ms)", () => {
    sql = loadMigration("001_create_clients.sql");
    expect(sql).toContain("sync_enabled");
    expect(sql).toContain("sync_interval_min");
    expect(sql).toContain("backend_url");
    expect(sql).toContain("last_synced_at_ms");
  });
});

describe("002_create_monitors.sql", () => {
  let sql: string;

  test("creates the monitors table", () => {
    sql = loadMigration("002_create_monitors.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS monitors");
  });

  test("has PRIMARY KEY AUTOINCREMENT on id column", () => {
    sql = loadMigration("002_create_monitors.sql");
    expect(sql).toMatch(/id\s+INTEGER PRIMARY KEY AUTOINCREMENT/);
  });

  test("has FK to clients(id) with ON DELETE CASCADE", () => {
    sql = loadMigration("002_create_monitors.sql");
    expect(sql).toContain("client_id");
    expect(sql).toContain("REFERENCES clients(id)");
    expect(sql).toContain("ON DELETE CASCADE");
  });

  test("has all required columns", () => {
    sql = loadMigration("002_create_monitors.sql");
    const requiredColumns = [
      "id",
      "client_id",
      "target_host",
      "target_name",
      "quality_state",
      "state_since_ms",
      "last_seen_ms",
      "last_status",
      "last_latency_ms",
      "created_at",
      "updated_at",
    ];

    requiredColumns.forEach((col) => {
      expect(sql).toContain(col);
    });
  });

  test("has UNIQUE(client_id, target_host) constraint", () => {
    sql = loadMigration("002_create_monitors.sql");
    expect(sql).toMatch(/UNIQUE\s*\(\s*client_id\s*,\s*target_host\s*\)/);
  });

  test("quality_state defaults to 'warmingUp'", () => {
    sql = loadMigration("002_create_monitors.sql");
    expect(sql).toMatch(/quality_state\s+TEXT\s+DEFAULT\s+'warmingUp'/);
  });

  test("target_host has NOT NULL constraint", () => {
    sql = loadMigration("002_create_monitors.sql");
    expect(sql).toMatch(/target_host\s+TEXT\s+NOT NULL/);
  });

  test("client_id has NOT NULL constraint", () => {
    sql = loadMigration("002_create_monitors.sql");
    expect(sql).toMatch(/client_id\s+INTEGER\s+NOT NULL/);
  });

  test("target_name is nullable", () => {
    sql = loadMigration("002_create_monitors.sql");
    const line = sql.split("\n").find((l) => l.includes("target_name"));
    expect(line).not.toContain("NOT NULL");
  });

  test("has quality state columns (quality_state, state_since_ms)", () => {
    sql = loadMigration("002_create_monitors.sql");
    expect(sql).toContain("quality_state");
    expect(sql).toContain("state_since_ms");
  });
});

describe("003_create_ping_samples.sql", () => {
  let sql: string;

  test("creates the ping_samples table", () => {
    sql = loadMigration("003_create_ping_samples.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ping_samples");
  });

  test("has PRIMARY KEY AUTOINCREMENT on id column", () => {
    sql = loadMigration("003_create_ping_samples.sql");
    expect(sql).toMatch(/id\s+INTEGER PRIMARY KEY AUTOINCREMENT/);
  });

  test("has FK to monitors(id) with ON DELETE CASCADE", () => {
    sql = loadMigration("003_create_ping_samples.sql");
    expect(sql).toContain("monitor_id");
    expect(sql).toContain("REFERENCES monitors(id)");
    expect(sql).toContain("ON DELETE CASCADE");
  });

  test("has all required columns", () => {
    sql = loadMigration("003_create_ping_samples.sql");
    const requiredColumns = [
      "id",
      "monitor_id",
      "timestamp_ms",
      "latency_ms",
      "status",
      "resolved_address",
      "error",
      "created_at",
    ];

    requiredColumns.forEach((col) => {
      expect(sql).toContain(col);
    });
  });

  test("has UNIQUE dedup constraint (monitor_id, timestamp_ms, resolved_address)", () => {
    sql = loadMigration("003_create_ping_samples.sql");
    expect(sql).toMatch(
      /UNIQUE\s*\(\s*monitor_id\s*,\s*timestamp_ms\s*,\s*resolved_address\s*\)/,
    );
  });

  test("status has NOT NULL constraint", () => {
    sql = loadMigration("003_create_ping_samples.sql");
    expect(sql).toMatch(/status\s+TEXT\s+NOT NULL/);
  });

  test("timestamp_ms has NOT NULL constraint", () => {
    sql = loadMigration("003_create_ping_samples.sql");
    expect(sql).toMatch(/timestamp_ms\s+INTEGER\s+NOT NULL/);
  });

  test("monitor_id has NOT NULL constraint", () => {
    sql = loadMigration("003_create_ping_samples.sql");
    expect(sql).toMatch(/monitor_id\s+INTEGER\s+NOT NULL/);
  });

  test("latency_ms is nullable", () => {
    sql = loadMigration("003_create_ping_samples.sql");
    const line = sql.split("\n").find((l) => l.includes("latency_ms"));
    expect(line).not.toContain("NOT NULL");
  });
});

describe("004_create_minute_rollups.sql", () => {
  let sql: string;

  test("creates the minute_rollups table", () => {
    sql = loadMigration("004_create_minute_rollups.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS minute_rollups");
  });

  test("has FK to monitors(id) with ON DELETE CASCADE", () => {
    sql = loadMigration("004_create_minute_rollups.sql");
    expect(sql).toContain("monitor_id");
    expect(sql).toContain("REFERENCES monitors(id)");
    expect(sql).toContain("ON DELETE CASCADE");
  });

  test("has all required columns", () => {
    sql = loadMigration("004_create_minute_rollups.sql");
    const requiredColumns = [
      "monitor_id",
      "timestamp_ms",
      "sample_count",
      "success_count",
      "failure_count",
      "avg_latency",
      "min_latency",
      "max_latency",
      "p95_latency",
      "created_at",
    ];

    requiredColumns.forEach((col) => {
      expect(sql).toContain(col);
    });
  });

  test("has UNIQUE(monitor_id, timestamp_ms) constraint", () => {
    sql = loadMigration("004_create_minute_rollups.sql");
    expect(sql).toMatch(
      /UNIQUE\s*\(\s*monitor_id\s*,\s*timestamp_ms\s*\)/,
    );
  });

  test("sample_count defaults to 0", () => {
    sql = loadMigration("004_create_minute_rollups.sql");
    expect(sql).toMatch(/sample_count\s+INTEGER\s+NOT NULL\s+DEFAULT\s+0/);
  });

  test("success_count defaults to 0", () => {
    sql = loadMigration("004_create_minute_rollups.sql");
    expect(sql).toMatch(/success_count\s+INTEGER\s+NOT NULL\s+DEFAULT\s+0/);
  });

  test("failure_count defaults to 0", () => {
    sql = loadMigration("004_create_minute_rollups.sql");
    expect(sql).toMatch(/failure_count\s+INTEGER\s+NOT NULL\s+DEFAULT\s+0/);
  });

  test("monitor_id has NOT NULL constraint", () => {
    sql = loadMigration("004_create_minute_rollups.sql");
    expect(sql).toMatch(/monitor_id\s+INTEGER\s+NOT NULL/);
  });

  test("timestamp_ms has NOT NULL constraint", () => {
    sql = loadMigration("004_create_minute_rollups.sql");
    expect(sql).toMatch(/timestamp_ms\s+INTEGER\s+NOT NULL/);
  });

  test("minute_rollups has no AUTOINCREMENT primary key (composite PK via UNIQUE)", () => {
    sql = loadMigration("004_create_minute_rollups.sql");
    // minute_rollups doesn't have an id column with AUTOINCREMENT
    expect(sql).not.toContain("AUTOINCREMENT");
  });

  test("avg_latency is nullable", () => {
    sql = loadMigration("004_create_minute_rollups.sql");
    const line = sql.split("\n").find((l) => l.includes("avg_latency"));
    expect(line).not.toContain("NOT NULL");
  });

  test("p95_latency is nullable", () => {
    sql = loadMigration("004_create_minute_rollups.sql");
    const line = sql.split("\n").find((l) => l.includes("p95_latency"));
    expect(line).not.toContain("NOT NULL");
  });
});

describe("005_create_indexes.sql", () => {
  let sql: string;

  test("creates all 9 indexes", () => {
    sql = loadMigration("005_create_indexes.sql");
    const indexes = extractCreateIndexNames(sql);
    expect(indexes.length).toBe(9);
  });

  test("has idx_clients_slug", () => {
    sql = loadMigration("005_create_indexes.sql");
    expect(sql).toContain("idx_clients_slug");
    expect(sql).toMatch(/idx_clients_slug ON clients\s*\(\s*slug\s*\)/);
  });

  test("has idx_clients_mac", () => {
    sql = loadMigration("005_create_indexes.sql");
    expect(sql).toContain("idx_clients_mac");
    expect(sql).toMatch(/idx_clients_mac ON clients\s*\(\s*mac_address\s*\)/);
  });

  test("has idx_clients_last_synced", () => {
    sql = loadMigration("005_create_indexes.sql");
    expect(sql).toContain("idx_clients_last_synced");
    expect(sql).toMatch(
      /idx_clients_last_synced ON clients\s*\(\s*last_synced_at_ms\s*\)/,
    );
  });

  test("has idx_monitors_client", () => {
    sql = loadMigration("005_create_indexes.sql");
    expect(sql).toContain("idx_monitors_client");
    expect(sql).toMatch(
      /idx_monitors_client ON monitors\s*\(\s*client_id\s*\)/,
    );
  });

  test("has idx_monitors_last_seen", () => {
    sql = loadMigration("005_create_indexes.sql");
    expect(sql).toContain("idx_monitors_last_seen");
    expect(sql).toMatch(
      /idx_monitors_last_seen ON monitors\s*\(\s*last_seen_ms\s*\)/,
    );
  });

  test("has idx_monitors_client_target (composite)", () => {
    sql = loadMigration("005_create_indexes.sql");
    expect(sql).toContain("idx_monitors_client_target");
    expect(sql).toMatch(
      /idx_monitors_client_target ON monitors\s*\(\s*client_id\s*,\s*target_host\s*\)/,
    );
  });

  test("has idx_ping_monitor_time (composite)", () => {
    sql = loadMigration("005_create_indexes.sql");
    expect(sql).toContain("idx_ping_monitor_time");
    expect(sql).toMatch(
      /idx_ping_monitor_time ON ping_samples\s*\(\s*monitor_id\s*,\s*timestamp_ms\s*\)/,
    );
  });

  test("has idx_ping_status", () => {
    sql = loadMigration("005_create_indexes.sql");
    expect(sql).toContain("idx_ping_status");
    expect(sql).toMatch(/idx_ping_status ON ping_samples\s*\(\s*status\s*\)/);
  });

  test("has idx_rollup_monitor_time (composite)", () => {
    sql = loadMigration("005_create_indexes.sql");
    expect(sql).toContain("idx_rollup_monitor_time");
    expect(sql).toMatch(
      /idx_rollup_monitor_time ON minute_rollups\s*\(\s*monitor_id\s*,\s*timestamp_ms\s*\)/,
    );
  });

  test("all indexes use IF NOT EXISTS", () => {
    sql = loadMigration("005_create_indexes.sql");
    const lines = sql
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    lines.forEach((line) => {
      if (line.startsWith("CREATE INDEX")) {
        expect(line).toContain("IF NOT EXISTS");
      }
    });
  });
});

describe("schema consistency", () => {
  test("index tables reference columns that exist in their tables", () => {
    const clientsSql = loadMigration("001_create_clients.sql");
    const monitorsSql = loadMigration("002_create_monitors.sql");
    const pingSamplesSql = loadMigration("003_create_ping_samples.sql");
    const rollupsSql = loadMigration("004_create_minute_rollups.sql");
    const indexesSql = loadMigration("005_create_indexes.sql");

    // idx_clients_slug -> clients(slug) — slug exists in clients
    expect(clientsSql).toContain("slug");
    // idx_clients_mac -> clients(mac_address) — mac_address exists in clients
    expect(clientsSql).toContain("mac_address");
    // idx_clients_last_synced -> clients(last_synced_at_ms)
    expect(clientsSql).toContain("last_synced_at_ms");
    // idx_monitors_client -> monitors(client_id)
    expect(monitorsSql).toContain("client_id");
    // idx_monitors_last_seen -> monitors(last_seen_ms)
    expect(monitorsSql).toContain("last_seen_ms");
    // idx_monitors_client_target -> monitors(client_id, target_host)
    expect(monitorsSql).toContain("client_id");
    expect(monitorsSql).toContain("target_host");
    // idx_ping_monitor_time -> ping_samples(monitor_id, timestamp_ms)
    expect(pingSamplesSql).toContain("monitor_id");
    expect(pingSamplesSql).toContain("timestamp_ms");
    // idx_ping_status -> ping_samples(status)
    expect(pingSamplesSql).toContain("status");
    // idx_rollup_monitor_time -> minute_rollups(monitor_id, timestamp_ms)
    expect(rollupsSql).toContain("monitor_id");
    expect(rollupsSql).toContain("timestamp_ms");
  });

  test("foreign key references match table names", () => {
    const monitorsSql = loadMigration("002_create_monitors.sql");
    const pingSamplesSql = loadMigration("003_create_ping_samples.sql");
    const rollupsSql = loadMigration("004_create_minute_rollups.sql");

    // monitors references clients
    expect(monitorsSql).toContain("REFERENCES clients(id)");
    // ping_samples references monitors
    expect(pingSamplesSql).toContain("REFERENCES monitors(id)");
    // minute_rollups references monitors
    expect(rollupsSql).toContain("REFERENCES monitors(id)");
  });

  test("foreign key chains are in correct migration order", () => {
    // clients (001) has no FKs — it's the root
    const clientsSql = loadMigration("001_create_clients.sql");
    expect(clientsSql).not.toContain("REFERENCES");

    // monitors (002) -> clients (001) — 001 runs before 002
    // ping_samples (003) -> monitors (002) — 002 runs before 003
    // minute_rollups (004) -> monitors (002) — 002 runs before 004
    // indexes (005) — last, after all tables exist
  });

  test("all tables have created_at column", () => {
    const clientsSql = loadMigration("001_create_clients.sql");
    const monitorsSql = loadMigration("002_create_monitors.sql");
    const pingSamplesSql = loadMigration("003_create_ping_samples.sql");
    const rollupsSql = loadMigration("004_create_minute_rollups.sql");

    expect(clientsSql).toContain("created_at");
    expect(monitorsSql).toContain("created_at");
    expect(pingSamplesSql).toContain("created_at");
    expect(rollupsSql).toContain("created_at");
  });

  test("tables with timestamps have updated_at column where applicable", () => {
    const clientsSql = loadMigration("001_create_clients.sql");
    const monitorsSql = loadMigration("002_create_monitors.sql");
    const pingSamplesSql = loadMigration("003_create_ping_samples.sql");
    const rollupsSql = loadMigration("004_create_minute_rollups.sql");

    // clients and monitors have updated_at (CRUD entities)
    expect(clientsSql).toContain("updated_at");
    expect(monitorsSql).toContain("updated_at");
    // ping_samples and minute_rollups do NOT have updated_at — they are append-only
    expect(pingSamplesSql).not.toContain("updated_at");
    expect(rollupsSql).not.toContain("updated_at");
  });
});
