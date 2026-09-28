---
id: F2
name: Client Registration & Identity
phase: MVP
priority: Critical
effort: Small
dependencies: [F1]
---

# F2: Client Registration & Identity

## Description
Register a new client on its first data ingest by auto-generating a unique slug from the combination of username, hostname, and MAC address. Assign a default display name derived from `username@hostname`. Store the client record in the `clients` table. Subsequent ingests from the same client are matched by slug, avoiding duplicate registrations.

## Acceptance Criteria

- **Given** a client sends its first ingest request with `username`, `hostname`, and `mac_address`, **when** the request is processed, **then** a new client record is created with an auto-generated slug and a default name of `username@hostname`.
- **Given** a client record already exists with the same slug, **when** the client sends another ingest request, **then** no new record is created and the existing client is used.
- **Given** a client record exists, **when** the client sends ingest data, **then** the `updated_at` timestamp is refreshed.
- **Given** a client record exists, **when** the dashboard user edits the client name, **then** the `name` field is updated while the `slug` remains immutable.
- **Given** a slug is generated from `username`, `hostname`, and `mac_address`, **then** it follows the format `<username>-<hostname>-<truncated-mac>` (e.g., `alice-desktop-aa00bb11cc22`) and is URL-safe.
- **Given** malformed or missing client identity data, **when** the ingest request is processed, **then** the request is rejected with a 400 Bad Request.

## Implementation Notes

- **Slug generation**: Concatenate `username`, `hostname`, and the last 10 hex characters of `mac_address`, separated by hyphens. Replace any non-alphanumeric characters with hyphens, collapse consecutive hyphens, and trim edge hyphens. Example: `alice-desktop-aa00bb11cc22`.
- **Default name**: Format as `username@hostname`.
- **Registration trigger**: Occurs automatically during the first successful ingest (F3), not via a separate endpoint. Use `INSERT OR IGNORE` with a unique constraint on `slug`.
- **Slug immutability**: The `slug` column has a `UNIQUE NOT NULL` constraint. No API endpoint allows changing it.
- **Name editing**: Handled by a separate endpoint (F11) — `PUT /api/monitors/:id/edit-name` — which updates only the `name` column.
- **Files to create/modify**:
  - `server/utils/client.ts` — slug generation, name default, client upsert logic
  - `server/database/schema.sql` — `clients` table definition (see Data Model Changes)
  - `server/database/seed.sql` — optional seed data for testing
  - `server/routes/api/clients/[slug].ts` — GET client by slug, used by other endpoints

## Data Model Changes

```sql
CREATE TABLE IF NOT EXISTS clients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  username    TEXT    NOT NULL,
  hostname    TEXT    NOT NULL,
  mac_address TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);
```

## API Contract

### POST /api/ping/ingest (client registration triggered here — see F3)

Client identity is embedded in the ingest payload. The server extracts it to register or match the client before processing samples.

### GET /api/clients/:slug

Retrieve a single client by slug.

**Response (200 OK):**
```json
{
  "id": 1,
  "slug": "alice-desktop-aa00bb11cc22",
  "name": "alice@desktop",
  "username": "alice",
  "hostname": "desktop",
  "mac_address": "aa:00:bb:11:cc:22",
  "created_at": "2026-07-31T10:00:00Z",
  "updated_at": "2026-07-31T10:00:00Z"
}
```

### PUT /api/clients/:slug/name

Update the display name of a client. Slug is immutable.

**Request:**
```json
{
  "name": "Alice's Workstation"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "slug": "alice-desktop-aa00bb11cc22",
  "name": "Alice's Workstation",
  "username": "alice",
  "hostname": "desktop",
  "mac_address": "aa:00:bb:11:cc:22",
  "created_at": "2026-07-31T10:00:00Z",
  "updated_at": "2026-07-31T12:30:00Z"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Name is required and must be a non-empty string"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Client not found"
}
```
