# Client Settings API

**Endpoints:**
- `GET /api/clients/:slug/settings` — Read current settings with computed sync status
- `PUT /api/clients/:slug/settings` — Update sync configuration

**Files:**
- `server/api/clients/[slug].settings.get.ts` — GET endpoint
- `server/api/clients/[slug].settings.put.ts` — PUT endpoint

**Feature:** F9 (Client sync settings)

## GET /api/clients/:slug/settings

Returns the full client settings object including identity fields, sync configuration, and a computed `sync_status`.

### Request

- **Method:** GET
- **Path:** `/api/clients/:slug/settings`
- **Path parameter:** `slug` — the unique client slug (required)

### Response (200 OK)

```json
{
  "clientId": 1,
  "slug": "alice-desktop-00bb11cc22",
  "name": "Alice's Desktop",
  "username": "alice",
  "hostname": "desktop",
  "mac_address": "aa:00:bb:11:cc:22",
  "sync_enabled": true,
  "sync_interval_min": 5,
  "backend_url": "https://dashboard.example.com/api",
  "last_synced_at_ms": 1712345678901,
  "sync_status": "connected",
  "created_at": "2025-01-15T10:30:00.000Z",
  "updated_at": "2025-06-01T14:22:00.000Z"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `clientId` | `number` | Database ID of the client |
| `slug` | `string` | Unique client identifier |
| `name` | `string` | Human-readable display name |
| `username` | `string` | System username |
| `hostname` | `string` | Hostname of the client machine |
| `mac_address` | `string` | MAC address of the network interface |
| `sync_enabled` | `boolean` | Whether cloud sync is enabled |
| `sync_interval_min` | `number` | Sync interval in minutes (one of: 1, 5, 10, 15, 30, 60) |
| `backend_url` | `string` | Backend API URL |
| `last_synced_at_ms` | `number \| null` | Epoch ms of last successful sync (null if never synced) |
| `sync_status` | `SyncStatus` | Computed status: `connected` \| `disconnected` \| `syncing` \| `disabled` \| `not_configured` |
| `created_at` | `string` | ISO 8601 creation timestamp |
| `updated_at` | `string` | ISO 8601 last update timestamp |

#### Sync Status Computation

The `sync_status` is computed server-side using `computeSyncStatus()`:

| Condition | Status |
|-----------|--------|
| `sync_enabled` is `false` | `"disabled"` |
| `last_synced_at_ms` is `null` | `"not_configured"` |
| `now - last_synced_at_ms > 2 * sync_interval_min * 60000` | `"disconnected"` |
| Otherwise | `"connected"` |

**Threshold:** The disconnect threshold is `2 * sync_interval_min * 60000` ms — the client is considered disconnected if no data has been received within 2× the configured interval. For a 5-minute interval, this means 10 minutes of silence.

### Error Responses

#### Not Found (404)
```json
{
  "statusCode": 404,
  "message": "Client not found"
}
```

#### Bad Request (400)
```json
{
  "statusCode": 400,
  "message": "Missing slug parameter"
}
```

### Example Usage

```bash
curl http://localhost:3000/api/clients/alice-desktop-00bb11cc22/settings
```

---

## PUT /api/clients/:slug/settings

Updates a client's sync configuration: whether sync is enabled, the sync interval, and the backend URL. After a successful update, broadcasts a `client_settings_updated` message to all connected WebSocket peers.

### Request

- **Method:** PUT
- **Path:** `/api/clients/:slug/settings`
- **Content-Type:** `application/json`
- **Path parameter:** `slug` — the unique client slug (required)

#### Request Body

```json
{
  "sync_enabled": true,
  "sync_interval_min": 5,
  "backend_url": "https://dashboard.example.com/api"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sync_enabled` | `boolean` | Yes | Whether sync is enabled |
| `sync_interval_min` | `number` | No | Sync interval in minutes (must be one of: 1, 5, 10, 15, 30, 60) |
| `backend_url` | `string` | No | Backend URL (must be valid HTTPS URL, or HTTP for localhost) |

#### Validation Rules

| Rule | Error |
|------|-------|
| `sync_enabled` is missing | 400 — "sync_enabled is required" |
| `sync_interval_min` not in allowed list | 400 — "Invalid sync_interval_min. Must be one of: 1, 5, 10, 15, 30, 60" |
| `backend_url` is not a valid URL | 400 — "Invalid backend_url. Must be a valid HTTPS URL" |
| `backend_url` is not HTTPS (non-localhost) | 400 — "Invalid backend_url. Must be a valid HTTPS URL" |
| `slug` is missing | 400 — "Missing slug parameter" |

**Note:** HTTP URLs are allowed for localhost hosts (`localhost`, `127.0.0.1`, `::1`, `[::1]`) — this is a development convenience.

### Response (200 OK)

```json
{
  "clientId": 1,
  "slug": "alice-desktop-00bb11cc22",
  "sync_enabled": true,
  "sync_interval_min": 5,
  "backend_url": "https://dashboard.example.com/api",
  "last_synced_at_ms": 1712345678901,
  "updated_at": "2025-06-01T14:22:00.000Z"
}
```

### WebSocket Broadcast

After a successful update, the endpoint calls `broadcastSettingsUpdate()` which sends a `client_settings_updated` message to ALL connected WebSocket peers:

```json
{
  "type": "client_settings_updated",
  "slug": "alice-desktop-00bb11cc22",
  "sync_enabled": true,
  "sync_interval_min": 5,
  "backend_url": "https://dashboard.example.com/api"
}
```

This enables real-time updates across all open browser tabs without requiring a page refresh.

### Error Responses

#### Not Found (404)
```json
{
  "statusCode": 404,
  "message": "Client not found"
}
```

#### Bad Request (400)
```json
{
  "statusCode": 400,
  "message": "sync_enabled is required"
}
```

### Database Update

The endpoint updates the `clients` table:

```sql
UPDATE clients SET
  sync_enabled = ?,
  sync_interval_min = ?,
  backend_url = ?,
  updated_at = ?
WHERE slug = ?
```

- `sync_enabled` is stored as integer (0/1)
- `sync_interval_min` falls back to the client's existing value if not provided
- `backend_url` falls back to the client's existing value if not provided
- `updated_at` is set to `Date.now()`

### Example Usage

```bash
# Enable sync with 5-minute interval
curl -X PUT http://localhost:3000/api/clients/alice-desktop-00bb11cc22/settings \
  -H "Content-Type: application/json" \
  -d '{"sync_enabled": true, "sync_interval_min": 5, "backend_url": "https://dashboard.example.com/api"}'

# Disable sync
curl -X PUT http://localhost:3000/api/clients/alice-desktop-00bb11cc22/settings \
  -H "Content-Type: application/json" \
  -d '{"sync_enabled": false}'
```

## Edge Cases

- **Only `sync_enabled` provided:** `sync_interval_min` and `backend_url` fall back to the client's existing values.
- **Sync disabled with interval/URL:** The interval and URL are stored but have no effect on the client.
- **Backend URL empty when sync enabled:** The server accepts the update (no server-side validation for this case); the frontend form validates this before submission.
- **localhost HTTP exception:** `http://localhost:3000/api` is valid; `http://example.com/api` is rejected.

## Related

- [Client Settings Page](../frontend/pages/clients-slug-settings.md) — Frontend page
- [SyncSettingsForm Component](../frontend/components/clients/SyncSettingsForm.md) — Frontend form
- [ClientIdentity Component](../frontend/components/clients/ClientIdentity.md) — Identity display
- [useClientSettings Composable](../frontend/composables/useClientSettings.md) — Settings management
- [Client Identity API](./clients.md) — `GET /api/clients/:slug` for basic client data
- [Feature F9 Specification](../../requirements/features/feature-0009-client-settings.md) — Original requirements
