# Client Utility

**File:** `server/utils/client.ts`
**Features:** F2 (Client registration & identity), F11 (Dashboard client name editing)

## Purpose

Server-side utility module for client identity management. Provides functions to:

1. **Generate deterministic slugs** from identity fields (`username`, `hostname`, `mac_address`)
2. **Upsert client records** into the `clients` table (create on first call, update on subsequent)
3. **Retrieve clients by slug**
4. **Update client display names**
5. **Convert database rows to API response shapes** (epoch-ms → ISO 8601)

This module is the single source of truth for client identity operations. All API endpoints and the ping ingest pipeline use these functions.

## API

### `generateSlug(username, hostname, macAddress)`

Generate a deterministic, URL-safe client slug from identity fields.

#### Signature

```typescript
function generateSlug(
  username: string,
  hostname: string,
  macAddress: string,
): string;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | `string` | System username of the client (non-empty) |
| `hostname` | `string` | Hostname of the client machine (non-empty) |
| `macAddress` | `string` | MAC address of the network interface (non-empty) |

#### Returns

| Type | Description |
|------|-------------|
| `string` | URL-safe, deterministic slug |

#### Format

`<username>-<hostname>-<truncated-mac>` where truncated-mac is the last 10 hex characters of the MAC address.

#### Steps

1. Strip non-hex characters from the MAC and take the last 10 hex chars
2. Build `username-hostname-truncatedMac`
3. Replace non-alphanumeric characters with hyphens
4. Collapse consecutive hyphens into one
5. Trim leading and trailing hyphens

#### Example

```typescript
import { generateSlug } from "~/server/utils/client";

generateSlug("alice", "desktop", "aa:00:bb:11:cc:22");
// → "alice-desktop-00bb11cc22"

generateSlug("bob", "laptop-pro", "00:11:22:33:44:55");
// → "bob-laptop-pro-22334455"

generateSlug("charlie", "machine_v2", "AB:CD:EF:01:23:45");
// → "charlie-machine-v2-012345"
```

#### Edge Cases

| Input | Result | Notes |
|-------|--------|-------|
| Empty/whitespace inputs | Throws `Error` | All three inputs must be non-empty strings |
| MAC with colons/dashes | Normalized | Non-hex chars stripped before truncation |
| Hostname with dots | Hyphens | `desktop.local` → `desktop-local` |
| Hostname with hyphens | Preserved | `laptop-pro` stays as-is |
| Consecutive special chars | Collapsed | `user--name` → `user-name` |
| Leading/trailing special chars | Trimmed | `-username-` → `username` |

### `toClientResponse(row)`

Convert a raw database `ClientRow` to the API response shape.

#### Signature

```typescript
function toClientResponse(row: ClientRow): ClientResponse;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `row` | `ClientRow` | Raw row from the `clients` table (with epoch-ms timestamps) |

#### Returns

| Type | Description |
|------|-------------|
| `ClientResponse` | API response shape with ISO 8601 timestamps |

#### Example

```typescript
import { toClientResponse } from "~/server/utils/client";

const row = {
  id: 1,
  slug: "alice-desktop-00bb11cc22",
  name: "Alice's Desktop",
  username: "alice",
  hostname: "desktop",
  mac_address: "aa:00:bb:11:cc:22",
  sync_enabled: 1,
  sync_interval_min: 5,
  backend_url: "",
  last_synced_at_ms: null,
  created_at: 1751479800000,
  updated_at: 1751486400000,
};

toClientResponse(row);
// → {
//     id: 1,
//     slug: "alice-desktop-00bb11cc22",
//     name: "Alice's Desktop",
//     username: "alice",
//     hostname: "desktop",
//     mac_address: "aa:00:bb:11:cc:22",
//     created_at: "2026-08-02T10:30:00.000Z",
//     updated_at: "2026-08-02T12:00:00.000Z"
//   }
```

### `upsertClient(username, hostname, macAddress)`

Upsert a client record. Creates on first call, updates on subsequent calls with the same slug.

#### Signature

```typescript
function upsertClient(
  username: string,
  hostname: string,
  macAddress: string,
): ClientRow;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | `string` | System username (trimmed before use) |
| `hostname` | `string` | Hostname (trimmed before use) |
| `macAddress` | `string` | MAC address (trimmed before use) |

#### Returns

| Type | Description |
|------|-------------|
| `ClientRow` | The upserted client row (with epoch-ms timestamps) |

#### Behavior

1. Generates slug from the three inputs
2. Sets default name to `username@hostname`
3. Executes `INSERT OR IGNORE ... ON CONFLICT(slug) DO UPDATE` to upsert
4. Returns the current row via `getClientBySlug()`

#### Example

```typescript
import { upsertClient } from "~/server/utils/client";

// First call — creates new record
const client = upsertClient("alice", "desktop", "aa:00:bb:11:cc:22");
// client.name === "alice@desktop"

// Second call with same inputs — updates existing record, no duplicate
const client2 = upsertClient("alice", "desktop", "aa:00:bb:11:cc:22");
// client2.id === client.id (same record)
```

### `getClientBySlug(slug)`

Retrieve a client record by its unique slug.

#### Signature

```typescript
function getClientBySlug(slug: string): ClientRow | null;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | The unique client slug |

#### Returns

| Type | Description |
|------|-------------|
| `ClientRow \| null` | The client row, or `null` if not found |

#### Example

```typescript
import { getClientBySlug } from "~/server/utils/client";

const client = getClientBySlug("alice-desktop-00bb11cc22");
if (client) {
  console.log(client.name); // "Alice's Desktop"
}
```

### `updateClientName(slug, name)`

Update the display name of an existing client.

#### Signature

```typescript
function updateClientName(slug: string, name: string): ClientRow | null;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | The unique client slug |
| `name` | `string` | The new display name |

#### Returns

| Type | Description |
|------|-------------|
| `ClientRow \| null` | The updated client row, or `null` if the slug was not found |

#### Example

```typescript
import { updateClientName } from "~/server/utils/client";

const updated = updateClientName("alice-desktop-00bb11cc22", "Alice Work Laptop");
if (updated) {
  console.log(updated.name); // "Alice Work Laptop"
}
```

## Types

### `ClientRow` (internal)

Raw database row shape. Not exported; used internally for type safety.

```typescript
interface ClientRow {
  id: number;
  slug: string;
  name: string;
  username: string;
  hostname: string;
  mac_address: string;
  sync_enabled: number;        // 0 or 1
  sync_interval_min: number;
  backend_url: string;
  last_synced_at_ms: number | null;
  created_at: number;          // epoch milliseconds
  updated_at: number;          // epoch milliseconds
}
```

### `ClientResponse` (exported)

API response shape with ISO 8601 timestamps.

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

## Implementation Details

- **Slug generation** is deterministic: the same inputs always produce the same slug. This ensures consistency across restarts and enables idempotent upserts.
- **Upsert uses `ON CONFLICT(slug) DO UPDATE`**: The `slug` column is `UNIQUE` in the database, so the conflict handler fires when a duplicate slug is inserted. The update only refreshes `username`, `hostname`, `mac_address`, and `updated_at` — it does NOT overwrite `name` (preserving user-edited names) or `id`.
- **All functions use `getDb()`** from `server/utils/db.ts` — no direct database imports.
- **Timestamps** are stored as epoch milliseconds (`Date.now()`) in the database and converted to ISO 8601 strings only at the API boundary via `toClientResponse()`.

## Edge Cases

- **Empty inputs to `generateSlug()`**: Throws an `Error` with descriptive message. All three inputs must be non-empty trimmed strings.
- **MAC address format variations**: Colon-separated (`aa:bb:cc:dd:ee:ff`), dash-separated, or contiguous hex — all handled by stripping non-hex characters.
- **Upsert idempotency**: Calling `upsertClient()` multiple times with the same inputs does NOT create duplicates and does NOT overwrite the user-edited `name` field.
- **`updateClientName()` on unknown slug**: Returns `null` (not an error). The API layer converts this to a 404.

## Testing Notes

- `server/utils/client.test.ts` — Unit tests for `generateSlug()`, `toClientResponse()`, and idempotency of `upsertClient()`
- `server/utils/client.integration.test.ts` — Integration tests with real SQLite database
- `server/utils/client.edge-cases.test.ts` — Edge case coverage (empty inputs, special characters, format variations)

## Related

- [Client API Documentation](../api/clients.md) — API endpoints using these utilities
- [DB Helper Documentation](./db.md) — `getDb()` function used by this module
- [Database Schema: clients table](../database/clients-table.md) — Table definition and constraints
- [Shared Types](../shared/types.md) — `ClientIdentity` type
