-- LNPM Cloud Dashboard — Full Schema
-- F1: Backend project setup
-- Assembled from migrations 001-005 in schema/migrations/
-- Source: requirements/data-models/data-models.md

-- Migration 001: clients
CREATE TABLE IF NOT EXISTS clients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  username    TEXT    NOT NULL,
  hostname    TEXT    NOT NULL,
  mac_address TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Migration 002: monitors
CREATE TABLE IF NOT EXISTS monitors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  target_host     TEXT    NOT NULL,
  target_name     TEXT    DEFAULT NULL,
  quality_state   TEXT    DEFAULT 'warmingUp',
  state_since_ms  INTEGER DEFAULT NULL,
  last_seen_ms    INTEGER DEFAULT NULL,
  last_status     TEXT    DEFAULT NULL,
  last_latency_ms REAL    DEFAULT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE(client_id, target_host)
);

-- Migration 003: ping_samples
CREATE TABLE IF NOT EXISTS ping_samples (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id       INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  timestamp_ms     INTEGER NOT NULL,
  latency_ms       REAL    DEFAULT NULL,
  status           TEXT    NOT NULL,
  resolved_address TEXT    DEFAULT NULL,
  error            TEXT    DEFAULT NULL,
  created_at       INTEGER NOT NULL,
  UNIQUE(monitor_id, timestamp_ms, resolved_address)
);

-- Migration 004: minute_rollups
CREATE TABLE IF NOT EXISTS minute_rollups (
  monitor_id     INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  timestamp_ms   INTEGER NOT NULL,
  sample_count   INTEGER NOT NULL DEFAULT 0,
  success_count  INTEGER NOT NULL DEFAULT 0,
  failure_count  INTEGER NOT NULL DEFAULT 0,
  avg_latency    REAL    DEFAULT NULL,
  min_latency    REAL    DEFAULT NULL,
  max_latency    REAL    DEFAULT NULL,
  p95_latency    REAL    DEFAULT NULL,
  created_at     INTEGER NOT NULL,
  UNIQUE(monitor_id, timestamp_ms)
);

-- Migration 005: indexes
CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_mac ON clients(mac_address);
CREATE INDEX IF NOT EXISTS idx_monitors_client ON monitors(client_id);
CREATE INDEX IF NOT EXISTS idx_monitors_last_seen ON monitors(last_seen_ms);
CREATE INDEX IF NOT EXISTS idx_monitors_client_target ON monitors(client_id, target_host);
CREATE INDEX IF NOT EXISTS idx_ping_monitor_time ON ping_samples(monitor_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_ping_status ON ping_samples(status);
CREATE INDEX IF NOT EXISTS idx_rollup_monitor_time ON minute_rollups(monitor_id, timestamp_ms);
