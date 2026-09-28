---
id: F9
name: Client Settings UI
phase: MVP
priority: High
effort: Medium
dependencies: [F2, F4, F8]
---

# F9: Client Settings UI

## Description

A settings view within the web dashboard (F8) that displays and manages LNPM client configuration. The UI shows the current client identity (username, hostname, MAC address), the backend connection URL, sync interval, and a toggle to enable or disable cloud sync. A cloud sync status indicator provides real-time feedback on whether the client is actively syncing data to the cloud backend.

This feature allows the dashboard user to view, edit, and control the sync behavior of each registered client (F2) without needing to modify the desktop client directly. The sync toggle and interval settings are persisted on the backend and communicated to the client sync service (F4) via the WebSocket broadcast (F7).

## Acceptance Criteria

### Given a registered client exists in the system
- When the dashboard user navigates to the client settings view
- Then the UI displays the client slug, display name, username, hostname, MAC address, backend URL, and current sync interval
- And the sync status indicator reflects the current sync state (connected, disconnected, or syncing)

### Given the user toggles the sync enable switch to off
- When the toggle is confirmed
- Then the backend marks the client's `sync_enabled` as `false`
- And the cloud sync status indicator changes to "Disabled"
- And the WebSocket broadcast notifies the client to stop syncing

### Given the user toggles the sync enable switch to on
- When the toggle is confirmed
- Then the backend marks the client's `sync_enabled` as `true`
- And the cloud sync status indicator changes to "Connected" (once the client acknowledges)
- And the WebSocket broadcast notifies the client to resume syncing

### Given the user changes the sync interval
- When a valid interval value (e.g., 1, 5, 10, 15, 30 minutes) is entered and saved
- Then the backend updates the client's `sync_interval_min` setting
- And the WebSocket broadcast sends the new interval to the client
- When an invalid value is entered
- Then the form displays a validation error and does not save

### Given the user views the backend URL setting
- When the settings page loads
- Then the current backend URL (e.g., `https://dashboard.example.com/api`) is displayed
- And the URL field is editable with validation to ensure it is a valid HTTPS URL

### Given the user views the client identity fields
- When the settings page loads
- Then username, hostname, and MAC address are displayed as read-only fields
- And the display name is editable (F11 handles the name editing separately)

### Given the cloud sync status indicator
- When the client is actively sending data, **then** the indicator shows "Connected" (green)
- When the client has not sent data in the last 2 * sync_interval_min, **then** the indicator shows "Disconnected" (red)
- When a batch is currently in transit, **then** the indicator shows "Syncing..." (yellow)
- When sync is disabled by the user, **then** the indicator shows "Disabled" (gray)

### Given the settings page loads for a new client
- When no sync has ever occurred
- Then the sync status indicator shows "Not configured" (gray)
- And the sync toggle defaults to the `sync_enabled` value in the database (default: `true`)

## Implementation Notes

### Frontend components (this repo — Nuxt 4 + Vue 3)

- **`pages/clients/[slug]/settings.vue`** — Settings page routed under the client detail section. Displays identity info, connection settings, sync controls, and status indicator.
- **`components/settings/ClientIdentity.vue`** — Read-only display of username, hostname, MAC address, and slug.
- **`components/settings/SyncSettings.vue`** — Editable sync toggle, sync interval selector, and backend URL input.
- **`components/settings/SyncStatusIndicator.vue`** — Status badge with color-coded states: connected (green), syncing (yellow), disconnected (red), disabled/not configured (gray).
- **`composables/useClientSettings.ts`** — Composable for fetching and updating client settings via the API. Handles form validation, optimistic updates, and rollback on error.

### Backend endpoints (this repo — Nuxt 4 + Nitro)

- **`GET /api/clients/:slug/settings`** — Returns the full client settings object including sync configuration.
- **`PUT /api/clients/:slug/settings`** — Updates sync-related settings (`sync_enabled`, `sync_interval_min`, `backend_url`). Validates inputs and broadcasts changes via WebSocket.

### WebSocket integration

- When settings are updated via `PUT /api/clients/:slug/settings`, the server sends a `client_settings_updated` message over the WebSocket to the connected desktop client.
- Message format: `{ type: "client_settings_updated", slug: "...", sync_enabled: true, sync_interval_min: 5, backend_url: "..." }`.
- The client sync service (F4, running on the desktop client) listens for this message and adjusts its behavior accordingly.

### Sync status computation

- The backend tracks the last successful ingest timestamp per client (stored as `last_synced_at_ms` in the `clients` table, updated during F3 ingest).
- Sync status is computed on the frontend by comparing `last_synced_at_ms` against `now - 2 * sync_interval_min * 60000`.
- "Syncing..." state is shown briefly after a settings change is saved, until the next ingest confirms reconnection.

### Validation rules

- **Backend URL**: Must be a valid HTTPS URL (or HTTP for localhost). Pattern: `^(https|http)://[^\s/$.?#].[^\s]*$`.
- **Sync interval**: Must be one of the allowed values `[1, 5, 10, 15, 30, 60]` minutes. Default: 5.
- **Sync toggle**: Boolean. Cannot be disabled if the client is the only active client (to prevent accidental data loss).
- **Identity fields** (username, hostname, MAC): Read-only in this view. Changes to these require re-registration (out of scope for F9).

### Files to create/modify

- `server/routes/api/clients/[slug]/settings.get.ts` — GET client settings
- `server/routes/api/clients/[slug]/settings.put.ts` — PUT client settings
- `server/utils/clientSettings.ts` — Settings validation, update logic, WebSocket broadcast helper
- `server/database/schema.sql` — Add `sync_enabled`, `sync_interval_min`, `backend_url`, `last_synced_at_ms` columns to `clients` table
- `app/pages/clients/[slug]/settings.vue` — Settings page
- `app/components/settings/ClientIdentity.vue` — Identity display component
- `app/components/settings/SyncSettings.vue` — Sync controls component
- `app/components/settings/SyncStatusIndicator.vue` — Status indicator component
- `app/composables/useClientSettings.ts` — Settings composable

## Data Model Changes

```sql
ALTER TABLE clients ADD COLUMN sync_enabled          BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE clients ADD COLUMN sync_interval_min     INTEGER NOT NULL DEFAULT 5;
ALTER TABLE clients ADD COLUMN backend_url           TEXT    NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN last_synced_at_ms     INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_clients_last_synced ON clients(last_synced_at_ms);
```

- **`sync_enabled`**: Boolean. Controls whether the client sync service should actively POST to the backend. Default: `true` (enabled).
- **`sync_interval_min`**: Integer. Periodic sync sweep interval in minutes. Default: `5`. Allowed values: `[1, 5, 10, 15, 30, 60]`.
- **`backend_url`**: Text. The base URL of the backend API. Default: empty string (client uses its configured value). Stored for display and for the dashboard to communicate back to the client.
- **`last_synced_at_ms`**: Integer (nullable). Milliseconds since epoch of the last successful ingest. Updated by the ingest endpoint (F3) on each successful batch. Used by the sync status indicator.

## API Contract

### GET /api/clients/:slug/settings

Retrieve the full settings object for a client.

**Response (200 OK):**
```json
{
  "clientId": 1,
  "slug": "alice-desktop-aa00bb11cc22",
  "name": "alice@desktop",
  "username": "alice",
  "hostname": "desktop",
  "mac_address": "aa:00:bb:11:cc:22",
  "sync_enabled": true,
  "sync_interval_min": 5,
  "backend_url": "https://dashboard.example.com/api",
  "last_synced_at_ms": 1700000000000,
  "sync_status": "connected",
  "created_at": "2026-07-31T10:00:00Z",
  "updated_at": "2026-07-31T10:00:00Z"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Client not found"
}
```

### PUT /api/clients/:slug/settings

Update sync-related settings. Only `sync_enabled`, `sync_interval_min`, and `backend_url` are mutable through this endpoint.

**Request:**
```json
{
  "sync_enabled": true,
  "sync_interval_min": 10,
  "backend_url": "https://dashboard.example.com/api"
}
```

**Response (200 OK):**
```json
{
  "clientId": 1,
  "slug": "alice-desktop-aa00bb11cc22",
  "sync_enabled": true,
  "sync_interval_min": 10,
  "backend_url": "https://dashboard.example.com/api",
  "last_synced_at_ms": 1700000000000,
  "updated_at": "2026-07-31T14:30:00Z"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Invalid sync_interval_min. Must be one of: 1, 5, 10, 15, 30, 60"
}
```

**Response (400 Bad Request — invalid URL):**
```json
{
  "error": "Invalid backend_url. Must be a valid HTTPS URL"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Client not found"
}
```

### WebSocket: client_settings_updated

Broadcast to the connected desktop client when settings change.

**Message:**
```json
{
  "type": "client_settings_updated",
  "slug": "alice-desktop-aa00bb11cc22",
  "sync_enabled": true,
  "sync_interval_min": 10,
  "backend_url": "https://dashboard.example.com/api"
}
```
