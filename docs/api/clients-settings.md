# Client Settings API

**Endpoint:** `PUT /api/clients/:slug/settings`
**File:** `server/api/clients/[slug].settings.put.ts`
**Feature:** F9 (Client sync settings)

## Purpose

Updates a client's sync configuration: whether sync is enabled, the sync interval, and the backend URL. The client's LNPM desktop app reads these settings to determine how to send data to the dashboard backend.

## Request

- **Method:** PUT
- **Path:** `/api/clients/:slug/settings`
- **Authentication:** None (publicly accessible)
- **Content-Type:** `application/json`
- **Path parameter:** `slug` — the unique client slug (required)

### Request Body

```json
{
  "sync_enabled": true,
  "sync_interval_min": 5,
  "backend_url": "https://dashboard.example.com"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sync_enabled` | `boolean` | Yes | Whether sync is enabled |
| `sync_interval_min` | `number` | Conditional | Sync interval in minutes (required if sync enabled, must be one of: 1, 2, 5, 10, 15, 30, 60) |
| `backend_url` | `string` | Conditional | Backend URL (required if sync enabled, must be valid HTTPS URL) |

### Validation Rules

| Rule | Error |
|------|-------|
| `sync_enabled` is missing | 400 — "sync_enabled is required" |
| `sync_interval_min` not in allowed list (when sync enabled) | 400 — "sync_interval_min must be one of: 1, 2, 5, 10, 15, 30, 60" |
| `backend_url` is not a valid URL (when sync enabled) | 400 — "backend_url must be a valid URL" |
| `backend_url` is not HTTPS (when sync enabled) | 400 — "backend_url must use HTTPS" |
| `slug` is missing | 400 — "Missing slug parameter" |

## Response

### Success (200 OK)

```json
{
  "success": true,
  "sync_enabled": true,
  "sync_interval_min": 5,
  "backend_url": "https://dashboard.example.com"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `true` on success |
| `sync_enabled` | `boolean` | Updated sync enabled value |
| `sync_interval_min` | `number` | Updated sync interval (falls back to existing value if not provided) |
| `backend_url` | `string` | Updated backend URL (falls back to empty string if not provided) |

### Not Found (404)

```json
{
  "statusCode": 404,
  "message": "Client not found"
}
```

### Bad Request (400)

```json
{
  "statusCode": 400,
  "message": "sync_enabled is required"
}
```

## Database Update

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
- `backend_url` falls back to empty string if not provided
- `updated_at` is set to `Date.now()`

## Example Usage

```bash
# Enable sync with 5-minute interval
curl -X PUT http://localhost:3000/api/clients/alice-desktop-00bb11cc22/settings \
  -H "Content-Type: application/json" \
  -d '{"sync_enabled": true, "sync_interval_min": 5, "backend_url": "https://dashboard.example.com"}'

# Disable sync
curl -X PUT http://localhost:3000/api/clients/alice-desktop-00bb11cc22/settings \
  -H "Content-Type: application/json" \
  -d '{"sync_enabled": false}'
```

## Edge Cases

- **Only `sync_enabled` provided:** `sync_interval_min` falls back to the client's existing value; `backend_url` falls back to empty string.
- **Sync disabled with interval/URL:** The interval and URL fields are not validated when sync is disabled — the values are stored but have no effect.
- **Backend URL empty when sync enabled:** Rejected by validation (both frontend and backend).

## Related

- [SyncSettingsForm Component](../frontend/components/clients/SyncSettingsForm.md) — Frontend form
- [Client Settings Page](../frontend/pages/clients-slug-settings.md) — Settings page
- [Client Identity API](./clients.md) — `GET /api/clients/:slug` for reading current settings
- [Client Utility](../utils/client.md) — `getClientBySlug()` helper
- [Feature F9 Specification](../../requirements/features/feature-0009-client-settings.md) — Original requirements
