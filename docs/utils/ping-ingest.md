# Utility: Ping Ingest Engine

**File:** `server/utils/ping-ingest.ts`
**Features:** F3 (Ping data ingest), F4 (Client auto-registration)

## Purpose

Core ingest pipeline that orchestrates client resolution, sample validation, and batch database insertion. Handles the full lifecycle of a ping batch: looking up or registering the client, validating samples, auto-creating monitors, inserting with dedup, and updating monitor/latest state.

Designed for **internal use only** — not exposed as an API endpoint directly. The API layer (`server/api/ping/ingest.post.ts`) wraps this function with HTTP error handling and status code mapping.

## API

### `ingestPingBatch(clientSlug, samples, clientIdentity): IngestResponse | null`

```typescript
import { ingestPingBatch } from "~/server/utils/ping-ingest";
import type { PingSampleIngest, IngestResponse } from "~/server/utils/ping-types";

const samples: PingSampleIngest[] = [
  {
    targetHost: "8.8.8.8",
    timestampMs: 1725200400000,
    latencyMs: 12.5,
    status: "success",
    resolvedAddress: "8.8.8.8",
  },
];

const result = ingestPingBatch(
  "alice-desktop-00bb11cc22",
  samples,
  { username: "alice", hostname: "desktop", mac_address: "aa:00:bb:11:cc:22" }
);

// result = { accepted: 1, duplicate: 0, rejected: 0 }
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `clientSlug` | `string` | Immutable client identifier |
| `samples` | `PingSampleIngest[]` | Array of ping samples to ingest |
| `clientIdentity` | `object` (optional) | Optional identity fields for first-time registration |

#### `clientIdentity` Shape

| Field | Type | Description |
|-------|------|-------------|
| `username` | `string` (optional) | OS username |
| `hostname` | `string` (optional) | Client machine hostname |
| `mac_address` | `string` (optional) | MAC address |

**Note:** All three fields must be present for auto-registration to trigger. Missing any one of them means the client is looked up but not auto-registered.

#### Returns

| Value | Description |
|-------|-------------|
| `IngestResponse` | On success — contains `accepted`, `duplicate`, `rejected` counts and optional `rejections` array |
| `null` | Client not found and no registration data provided (caller should return HTTP 401) |

#### Throws

| Error | Condition |
|-------|-----------|
| `Error("EMPTY_SAMPLES")` | `samples` array is empty |
| `Error("BATCH_TOO_LARGE")` | `samples` exceeds `INGEST_MAX_SAMPLES` |
| `DatabaseError` | Database operation fails (transaction rolls back automatically) |

## Pipeline

The ingest engine runs through 3 phases:

```
Phase 1: Client Resolution
  ├─ Lookup client by slug via getClientBySlug()
  ├─ If not found AND identity fields provided → upsertClient()
  └─ If still not found → return null (401)

Phase 2: Sample Validation
  ├─ Iterate all samples
  ├─ Call validateSample() on each
  ├─ Collect valid samples in one array
  └─ Collect rejections (with index) in another

Phase 3: Batch Insert (transaction)
  ├─ Auto-create monitors for new target hosts (INSERT OR IGNORE)
  ├─ Insert valid samples (INSERT OR IGNORE on unique index)
  ├─ Update monitor latest state (last_seen_ms, last_status, last_latency_ms)
  └─ Update client last_synced_at_ms
```

### Phase 1: Client Resolution

```typescript
// Lookup existing client
let client = getClientBySlug(clientSlug);

// Auto-register if identity data is present
if (!client && clientIdentity?.username && clientIdentity.hostname && clientIdentity.mac_address) {
  client = upsertClient(
    clientIdentity.username,
    clientIdentity.hostname,
    clientIdentity.mac_address
  );
}

// Still not found → return null (caller handles 401)
if (!client) return null;
```

### Phase 2: Sample Validation

```typescript
const validSamples: PingSampleIngest[] = [];
const rejections: Rejection[] = [];

for (let i = 0; i < samples.length; i++) {
  const result = validateSample(samples[i]);
  if (result.valid) {
    validSamples.push(samples[i]);
  } else {
    for (const rejection of result.rejections) {
      rejections.push({
        index: i,
        reason: rejection.reason,
        code: rejection.code,
        sample: samples[i],
      });
    }
  }
}

// Count unique rejected samples (a sample with 2 failures counts as 1 rejected)
const rejectedCount = new Set(rejections.map((r) => r.index)).size;
```

### Phase 3: Batch Insert (Transactional)

The `ingestSamples()` internal function runs within a single `db.transaction()` block:

```
┌─────────────────────────────────────────────┐
│  db.transaction(() => {                      │
│                                               │
│    Phase 3a: Ensure Monitors                 │
│    └─ For each sample: ensureMonitor()       │
│       └─ INSERT OR IGNORE on monitors table  │
│       └─ Returns existing or new monitor ID  │
│                                               │
│    Phase 3b: Insert Samples                  │
│    └─ INSERT OR IGNORE into ping_samples     │
│    └─ Track changes > 0 = accepted           │
│    └─ Track changes = 0 = duplicate          │
│                                               │
│    Phase 3c: Update Monitor Latest State     │
│    └─ Most recent sample per monitor         │
│    └─ Set last_seen_ms, last_status,         │
│       last_latency_ms, updated_at            │
│                                               │
│    Phase 3d: Update Client                   │
│    └─ Set last_synced_at_ms, updated_at      │
│                                               │
│  })                                           │
└─────────────────────────────────────────────┘
```

## Internal Functions

### `ensureMonitor(db, clientId, targetHost): number`

Ensures a monitor exists for the given `(client_id, target_host)` pair. Auto-creates if it doesn't exist using `INSERT OR IGNORE` on the `UNIQUE(client_id, target_host)` constraint.

```typescript
// Internal — not exported
function ensureMonitor(
  db: Database,
  clientId: number,
  targetHost: string
): number
```

**Returns:** The monitor `id` (existing or newly created).

**Initial values for new monitors:**
- `target_name`: Same as `targetHost`
- `quality_state`: `'warmingUp'` (placeholder for F12 quality classifier)
- `created_at`, `updated_at`: Current timestamp

### `ingestSamples(clientId, samples): { accepted, duplicate, monitorIds }`

Internal function that handles the database transaction. Not exported — called by `ingestPingBatch` only.

```typescript
// Internal — not exported
function ingestSamples(
  clientId: number,
  samples: PingSampleIngest[]
): { accepted: number; duplicate: number; monitorIds: Set<number> }
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `INGEST_MAX_SAMPLES` | `1000` | Maximum samples per batch |

## Logging

The ingest engine logs structured messages at key points:

```typescript
// On successful ingest
info("Ingested batch for client alice-desktop-00bb11cc22", {
  accepted: 98,
  duplicate: 1,
  rejected: 1,
  total: 100,
  monitorCount: 3,
});

// On database error
error("Database error during ingest for client alice-desktop-00bb11cc22", {
  error: "SQLITE_CONSTRAINT: UNIQUE constraint failed",
  sampleCount: 50,
});
```

## Edge Cases

- **Empty sample array:** Throws `Error("EMPTY_SAMPLES")`. The API layer catches this and returns 400.
- **Oversized batch:** Throws `Error("BATCH_TOO_LARGE")`. The API layer catches this and returns 413.
- **All samples rejected:** Returns `{ accepted: 0, duplicate: 0, rejected: N }`. No database transaction is started (no valid samples to insert).
- **All samples are duplicates:** Returns `{ accepted: 0, duplicate: N, rejected: 0 }`. The transaction still runs (monitor state is updated).
- **Client auto-registration:** Requires all three identity fields (`username`, `hostname`, `mac_address`). Providing only one or two is treated as missing.
- **Monitor auto-creation:** Uses `INSERT OR IGNORE` with `ON CONFLICT(client_id, target_host) DO NOTHING`. Safe to call repeatedly — no side effects for existing monitors.
- **Transaction rollback:** If any step within `db.transaction()` fails, the entire batch rolls back. No partial inserts.
- **`changes` property:** `better-sqlite3` returns `{ changes: N }` from `stmt.run()`. `changes > 0` means the row was inserted; `changes === 0` means it was ignored (duplicate).

## Future Hooks

The following hooks are planned for future features:

| Hook | Feature | Status |
|------|---------|--------|
| WebSocket broadcast | F7 | **Implemented** — `broadcastSample()` called from ingest endpoint |
| Quality classifier | F12 | **Implemented** — `classifyMonitorsBatch()` called post-ingest |

## Related

- [Ping Ingest API](../api/ping-ingest.md) — API endpoint that wraps this engine
- [Ping Validation](../utils/ping-validation.md) — `validateSample()` called for each sample
- [Client Utilities](../utils/client.md) — `getClientBySlug()`, `upsertClient()`
- [DB Helper](../utils/db.md) — `getDb()` for database access
- [Database Schema](../database/schema.md) — `ping_samples` table, `monitors` table
- [WebSocket Broadcast](../websocket/broadcast.md) — `broadcastSample()` called after successful ingest
- [Quality Classifier](../utils/quality-classifier.md) — `classifyMonitorsBatch()` called post-ingest
- [Feature F3 Specification](../../requirements/features/feature-0003-ping-ingest.md) — Original requirements
- [Feature F7 Specification](../../requirements/features/feature-0007-websocket-broadcast.md) — WebSocket live broadcast
- [Feature F12 Specification](../../requirements/features/feature-00012-quality-classifier.md) — Quality classifier
