-- 003_create_ping_samples.sql
-- F1: Backend project setup
-- Creates the ping_samples table for raw individual ping probe results.

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
