# Client Identity API

**Endpoints:** `GET /api/clients/:slug`, `PUT /api/clients/:slug/name`, `PUT /api/clients/:slug/settings`
**Files:** `server/api/clients/[slug].get.ts`, `server/api/clients/[slug].name.put.ts`, `server/api/clients/[slug].settings.put.ts`
**Features:** F2 (Client registration & identity), F9 (Client sync settings), F11 (Dashboard client name editing)

## Purpose

The Client Identity API exposes three endpoints:
1. **Retrieve a client** by its unique slug — returns the full client record with formatted timestamps.
2. **Update a client's display name** — allows dashboard users to rename a client for human readability.
3. **Update a client's sync settings** — enables/disables sync, sets the sync interval and backend URL.

These endpoints serve the dashboard's client management UI and are the foundation for all client identification in the system. The slug is the primary identifier — deterministic, derived from `username`, `hostname`, and `mac_address`, and used across all data tables.

## GET /api/clients/:slug

Retrieve a client record by its unique slug.

### Request

- **Method:** GET
- **Path:** `/api/clients/:slug`
- **Authentication:** None (publicly accessible)
- **Path parameter:** `slug` — the unique client slug (required)
- **Query parameters:** None
- **Request body:** None

### Response

#### Success (200 OK)

```json
{
  "id": 1,
  "slug": "alice-desktop-00bb11cc22",
  "name": "Alice's Desktop",
  "username": "alice",
  "hostname": "desktop",
  "mac_address": "aa:00:bb:11:cc:22",
  "created_at": "2026-08-02T10:30:00.000Z",
  "updated_at": "2026-08-02T12:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Auto-increment primary key |
| `slug` | `string` | Deterministic unique identifier (URL-safe) |
| `name` | `string` | Human-readable display name (editable) |
| `username` | `string` | System username of the client |
| `hostname` | `string` | Hostname of the client machine |
| `mac_address` | `string` | MAC address of the network interface |
| `created_at` | `string` | ISO 8601 timestamp of client creation |
| `updated_at` | `string` | ISO 8601 timestamp of last update |

#### Not Found (404)

```json
{
  "statusCode": 404,
  "message": "Client not found"
}
```

Returned when no client exists with the given slug.

#### Bad Request (400)

```json
{
  "statusCode": 400,
  "message": "Missing slug parameter"
}
```

Returned when the `slug` path parameter is missing.

## PUT /api/clients/:slug/name

Update the display name of an existing client.

### Request

- **Method:** PUT
- **Path:** `/api/clients/:slug/name`
- **Authentication:** None (publicly accessible)
- **Path parameter:** `slug` — the unique client slug (required)
- **Request body:** JSON object with `name` field

```json
{
  "name": "Alice's Work Laptop"
}
```

### Response

#### Success (200 OK)

Returns the updated client record (same shape as GET response):

```json
{
  "id": 1,
  "slug": "alice-desktop-00bb11cc22",
  "name": "Alice's Work Laptop",
  "username": "alice",
  "hostname": "desktop",
  "mac_address": "aa:00:bb:11:cc:22",
  "created_at": "2026-08-02T10:30:00.000Z",
  "updated_at": "2026-08-02T14:30:00.000Z"
}
```

#### Not Found (404)

```json
{
  "statusCode": 404,
  "message": "Client not found"
}
```

Returned when no client exists with the given slug.

#### Bad Request (400)

```json
{
  "statusCode": 400,
  "message": "Name is required and must be between 1 and 100 characters"
}
```

Returned when any of the following conditions are met:
- `name` is missing from the request body
- `name` is not a string
- `name` is empty after trimming whitespace
- `name` exceeds 100 characters (after trimming)

## Name Validation Rules

| Rule | Error |
|------|-------|
| `name` must be a string | 400 — "Name is required and must be between 1 and 100 characters" |
| `name` must not be empty after trimming | 400 — "Name is required and must be between 1 and 100 characters" |
| `name` must not exceed 100 characters after trimming | 400 — "Name is required and must be between 1 and 100 characters" |

## Example Usage

```bash
# Get a client by slug
curl http://localhost:3000/api/clients/alice-desktop-00bb11cc22

# Update a client's display name
curl -X PUT http://localhost:3000/api/clients/alice-desktop-00bb11cc22/name \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Work Laptop"}'

# Verify update
curl http://localhost:3000/api/clients/alice-desktop-00bb11cc22 | jq '.name'
```

## Response Type

The response conforms to `ClientResponse` in `server/utils/client.ts`:

```typescript
interface ClientResponse {
  id: number;
  slug: string;
  name: string;
  username: string;
  hostname: string;
  mac_address: string;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
}
```

## Performance

- Both endpoints perform a single `SELECT` (and optionally `UPDATE`) query on the `clients` table.
- The `slug` column is `UNIQUE` with an implicit index, making lookups O(log N).
- Response time target: under 50ms.

## WebSocket Broadcast Integration (F11)

After a successful name update, the endpoint calls `broadcastClientNameUpdated(row.slug, row.name)` to notify all connected WebSocket clients. This means:

- **All open dashboard tabs** see the new name immediately without page refresh
- **The broadcast is non-blocking** — broadcast failure does not affect the API response
- **Message type:** `client_name_updated` with `{ clientSlug, newName }` payload
- **Frontend handler:** `SidebarContent.vue` calls `useWebSocket().onClientNameUpdated((slug, newName) => { ... })` to update sidebar client names reactively

See [WebSocket Broadcast API](../websocket/broadcast.md) for the `broadcastClientNameUpdated` function documentation and [WebSocket Protocol](../websocket/protocol.md) for the `client_name_updated` message format.

## Related

- [Client Utility Documentation](../utils/client.md) — `generateSlug()`, `upsertClient()`, `getClientBySlug()`, `updateClientName()`
- [Database Schema: clients table](../database/clients-table.md) — Table definition and constraints
- [Shared Types](../shared/types.md) — `ClientIdentity` type
- [Client Settings API](./clients-settings.md) — `PUT /api/clients/:slug/settings` endpoint
- [WebSocket Broadcast API](../websocket/broadcast.md) — `broadcastClientNameUpdated()` function
- [WebSocket Protocol](../websocket/protocol.md) — `client_name_updated` message type
- [Feature F2 Specification](../../requirements/features/feature-0002-client-identity.md) — Client registration & identity requirements
- [Feature F9 Specification](../../requirements/features/feature-0009-client-settings.md) — Client sync settings requirements
- [Feature F11 Specification](../../requirements/features/feature-00011-edit-client-name.md) — Dashboard client name editing requirements
