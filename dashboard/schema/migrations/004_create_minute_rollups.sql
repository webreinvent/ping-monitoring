-- 004_create_minute_rollups.sql
-- F1: Backend project setup
-- Creates the minute_rollups table for pre-aggregated 1-minute buckets.

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
