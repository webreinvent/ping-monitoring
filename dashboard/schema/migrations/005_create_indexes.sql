-- 005_create_indexes.sql
-- F1: Backend project setup
-- Creates all indexes for query performance.

CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_mac ON clients(mac_address);
CREATE INDEX IF NOT EXISTS idx_monitors_client ON monitors(client_id);
CREATE INDEX IF NOT EXISTS idx_monitors_last_seen ON monitors(last_seen_ms);
CREATE INDEX IF NOT EXISTS idx_monitors_client_target ON monitors(client_id, target_host);
CREATE INDEX IF NOT EXISTS idx_ping_monitor_time ON ping_samples(monitor_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_ping_status ON ping_samples(status);
CREATE INDEX IF NOT EXISTS idx_rollup_monitor_time ON minute_rollups(monitor_id, timestamp_ms);
