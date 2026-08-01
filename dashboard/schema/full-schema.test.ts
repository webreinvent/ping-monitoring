/**
 * Full schema validation tests.
 *
 * Verifies the assembled schema (index.sql) matches all migrations
 * combined — ensuring the single-file schema stays in sync.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schemaDir = resolve(__dirname);
const migrationsDir = resolve(schemaDir, "migrations");

function loadFile(path: string): string {
  return readFileSync(resolve(schemaDir, path), "utf-8");
}

function loadMigration(filename: string): string {
  return readFileSync(resolve(migrationsDir, filename), "utf-8");
}

/**
 * Strip comments and normalize whitespace for comparison.
 */
function stripComments(sql: string): string {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("full schema (index.sql)", () => {
  test("index.sql exists", () => {
    const sql = loadFile("index.sql");
    expect(sql.length).toBeGreaterThan(100);
  });

  test("index.sql contains all 4 table definitions", () => {
    const sql = loadFile("index.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS clients");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS monitors");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ping_samples");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS minute_rollups");
  });

  test("index.sql contains all 9 index definitions", () => {
    const sql = loadFile("index.sql");
    const indexes = [
      "idx_clients_slug",
      "idx_clients_mac",
      "idx_clients_last_synced",
      "idx_monitors_client",
      "idx_monitors_last_seen",
      "idx_monitors_client_target",
      "idx_ping_monitor_time",
      "idx_ping_status",
      "idx_rollup_monitor_time",
    ];

    indexes.forEach((idx) => {
      expect(sql).toContain(idx);
    });
  });

  test("index.sql contains the clients table matching migration 001", () => {
    const indexSql = stripComments(loadFile("index.sql"));
    const migrationSql = stripComments(loadMigration("001_create_clients.sql"));

    // The clients table definition in index.sql should match migration 001
    expect(indexSql).toContain(migrationSql);
  });

  test("index.sql contains the monitors table matching migration 002", () => {
    const indexSql = stripComments(loadFile("index.sql"));
    const migrationSql = stripComments(loadMigration("002_create_monitors.sql"));

    expect(indexSql).toContain(migrationSql);
  });

  test("index.sql contains the ping_samples table matching migration 003", () => {
    const indexSql = stripComments(loadFile("index.sql"));
    const migrationSql = stripComments(
      loadMigration("003_create_ping_samples.sql"),
    );

    expect(indexSql).toContain(migrationSql);
  });

  test("index.sql contains the minute_rollups table matching migration 004", () => {
    const indexSql = stripComments(loadFile("index.sql"));
    const migrationSql = stripComments(
      loadMigration("004_create_minute_rollups.sql"),
    );

    expect(indexSql).toContain(migrationSql);
  });

  test("index.sql contains all index definitions matching migration 005", () => {
    const indexSql = stripComments(loadFile("index.sql"));
    const migrationSql = stripComments(loadMigration("005_create_indexes.sql"));

    expect(indexSql).toContain(migrationSql);
  });

  test("index.sql has tables in correct dependency order", () => {
    const sql = loadFile("index.sql");
    const clientsPos = sql.indexOf("CREATE TABLE IF NOT EXISTS clients");
    const monitorsPos = sql.indexOf("CREATE TABLE IF NOT EXISTS monitors");
    const pingSamplesPos = sql.indexOf(
      "CREATE TABLE IF NOT EXISTS ping_samples",
    );
    const rollupsPos = sql.indexOf(
      "CREATE TABLE IF NOT EXISTS minute_rollups",
    );
    const indexesPos = sql.indexOf("CREATE INDEX");

    expect(clientsPos).toBeLessThan(monitorsPos);
    expect(monitorsPos).toBeLessThan(pingSamplesPos);
    expect(pingSamplesPos).toBeLessThan(rollupsPos);
    expect(rollupsPos).toBeLessThan(indexesPos);
  });

  test("index.sql contains all foreign key constraints", () => {
    const sql = loadFile("index.sql");
    expect(sql).toContain("REFERENCES clients(id)");
    expect(sql).toContain("REFERENCES monitors(id)");
    expect(sql).toContain("ON DELETE CASCADE");
  });

  test("index.sql contains all unique constraints", () => {
    const sql = loadFile("index.sql");
    // clients.slug UNIQUE
    expect(sql).toMatch(/slug\s+TEXT\s+NOT NULL UNIQUE/);
    // monitors UNIQUE(client_id, target_host)
    expect(sql).toMatch(/UNIQUE\s*\(\s*client_id\s*,\s*target_host\s*\)/);
    // ping_samples UNIQUE(monitor_id, timestamp_ms, resolved_address)
    expect(sql).toMatch(
      /UNIQUE\s*\(\s*monitor_id\s*,\s*timestamp_ms\s*,\s*resolved_address\s*\)/,
    );
    // minute_rollups UNIQUE(monitor_id, timestamp_ms)
    expect(sql).toMatch(/UNIQUE\s*\(\s*monitor_id\s*,\s*timestamp_ms\s*\)/);
  });
});
