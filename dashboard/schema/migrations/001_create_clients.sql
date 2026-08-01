-- 001_create_clients.sql
-- F1: Backend project setup
-- Creates the clients table for LNPM desktop client installations.

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
