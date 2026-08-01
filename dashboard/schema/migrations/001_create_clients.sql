-- 001_create_clients.sql
-- F1: Backend project setup, F9: Client settings
-- Creates the clients table for LNPM desktop client installations.

CREATE TABLE IF NOT EXISTS clients (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  slug              TEXT    NOT NULL UNIQUE,
  name              TEXT    NOT NULL,
  username          TEXT    NOT NULL,
  hostname          TEXT    NOT NULL,
  mac_address       TEXT    NOT NULL,
  sync_enabled      BOOLEAN NOT NULL DEFAULT 1,
  sync_interval_min INTEGER NOT NULL DEFAULT 5,
  backend_url       TEXT    NOT NULL DEFAULT '',
  last_synced_at_ms INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
