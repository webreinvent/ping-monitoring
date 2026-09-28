# Clients Table

**Migration:** `schema/migrations/001_create_clients.sql`
**Features:** F2 (Client registration & identity), F11 (Dashboard client name editing)

## Purpose

The `clients` table stores the identity of each LNPM desktop client installation. Each client is uniquely identified by a deterministic `slug` derived from its `username`, `hostname`, and `mac_address`. This table is the foundation for all client identification in the system — the slug is referenced across other tables (monitors, ping samples, etc.).

## Schema

```sql
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
```

## Column Reference

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Auto-increment primary key |
| `slug` | `TEXT` | `NOT NULL UNIQUE` | Deterministic unique identifier (URL-safe) |
| `name` | `TEXT` | `NOT NULL` | Human-readable display name (editable via API) |
| `username` | `TEXT` | `NOT NULL` | System username of the client machine |
| `hostname` | `TEXT` | `NOT NULL` | Hostname of the client machine |
| `mac_address` | `TEXT` | `NOT NULL` | MAC address of the network interface |
| `sync_enabled` | `BOOLEAN` | `NOT NULL DEFAULT 1` | Whether sync is enabled for this client |
| `sync_interval_min` | `INTEGER` | `NOT NULL DEFAULT 5` | Sync interval in minutes |
| `backend_url` | `TEXT` | `NOT NULL DEFAULT ''` | Backend URL for this client |
| `last_synced_at_ms` | `INTEGER` | nullable | Epoch milliseconds of the last sync |
| `created_at` | `INTEGER` | `NOT NULL` | Epoch milliseconds of record creation |
| `updated_at` | `INTEGER` | `NOT NULL` | Epoch milliseconds of last update |

## Indexes

| Index | Column(s) | Purpose |
|-------|-----------|---------|
| Implicit UNIQUE | `slug` | Enforced by `UNIQUE` constraint; enables fast O(log N) lookups |

## Slug Format

The `slug` column follows the format: `<username>-<hostname>-<truncated-mac>`

Where `truncated-mac` is the last 10 hex characters of the MAC address with non-hex characters removed.

### Examples

| username | hostname | mac_address | slug |
|----------|----------|-------------|------|
| `alice` | `desktop` | `aa:00:bb:11:cc:22` | `alice-desktop-00bb11cc22` |
| `bob` | `laptop-pro` | `00:11:22:33:44:55` | `bob-laptop-pro-22334455` |
| `charlie` | `machine_v2` | `AB:CD:EF:01:23:45` | `charlie-machine-v2-012345` |

## Default Name

On first registration, the `name` column is set to `username@hostname` (e.g., `alice@desktop`). Users can edit this via the `PUT /api/clients/:slug/name` endpoint.

## Upsert Behavior

Client records are upserted (not inserted blindly) using `ON CONFLICT(slug) DO UPDATE`:

```sql
INSERT INTO clients (slug, name, username, hostname, mac_address, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(slug) DO UPDATE SET
  username = excluded.username,
  hostname = excluded.hostname,
  mac_address = excluded.mac_address,
  updated_at = excluded.updated_at
```

- **New client:** Full `INSERT` with all fields.
- **Existing client (same slug):** Updates `username`, `hostname`, `mac_address`, `updated_at`. Does **NOT** overwrite `name` (preserving user-edited names), `id`, `created_at`, or sync-related fields.

## Timestamps

- `created_at` and `updated_at` are stored as **epoch milliseconds** (e.g., `1751479800000`).
- The API layer converts these to **ISO 8601 strings** in responses (e.g., `"2026-08-02T10:30:00.000Z"`).
- The utility function `toClientResponse()` handles this conversion.

## Related

- [Client Utility Documentation](../utils/client.md) — `generateSlug()`, `upsertClient()`, `getClientBySlug()`, `updateClientName()`
- [Client API Documentation](../api/clients.md) — REST endpoints
- [Database Schema Overview](./schema.md) — Full database schema
- [Database Migrations](./migrations.md) — Migration system and conventions
- [Feature F2 Specification](../../requirements/features/feature-0002-client-identity.md) — Client registration & identity requirements
