-- 002_create_monitors.sql
-- F1: Backend project setup
-- Creates the monitors table for ping targets per client.

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
