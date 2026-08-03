# LNPM Cloud Dashboard — Implementation Plan (M1-T7)

## Task: Implement Monitors List API with Client Join and Latest State

**Status:** Complete
**Complexity:** Low (single endpoint, well-defined schema, existing patterns)
**Estimated Effort:** 2-3 hours

---

## Approach Decision

**Chosen: Approach A — Single SQL Query with CTE/ROW_NUMBER()**

The acceptance criteria explicitly require "Single SQL query (no N+1)". We use a CTE with `ROW_NUMBER() OVER (PARTITION BY monitor_id ORDER BY timestamp_ms DESC)` to identify the latest sample per monitor, then LEFT JOIN to monitors and clients.

Rejected Approach B (two-query) because it violates the single-query requirement and introduces a race condition window between queries.

---

## Implementation Sequence

### Step 1: Shared Types — `dashboard/shared/types.ts` (Modify)

**File:** `dashboard/shared/types.ts`

Add F5-specific types alongside existing types:

```typescript
/**
 * Monitor item in the monitors list API response (F5).
 */
export interface MonitorListItem {
  id: number;
  clientSlug: string;
  clientName: string;
  targetHost: string;
  targetName: string;
  status: "up" | "down" | null;
  latencyMs: number | null;
  qualityState: "good" | "degraded" | "poor" | "unknown";
  lastSeenMs: number | null;
  createdAt: string;
}

/**
 * Response from GET /api/monitors (F5).
 */
export interface MonitorsListResponse {
  monitors: MonitorListItem[];
}
```

### Step 2: Business Logic — `dashboard/server/utils/monitors.ts` (Create)

**File:** `dashboard/server/utils/monitors.ts`

New utility module with the core query logic:

```typescript
import { getDb } from "./db";
import type { MonitorListItem } from "~/shared/types";

/**
 * Fetch all monitors with their latest state, joined with client info.
 *
 * Single SQL query using a CTE with ROW_NUMBER() to get the latest
 * ping sample per monitor, then LEFT JOIN to monitors and clients.
 *
 * Returns empty array when no monitors exist.
 * Monitors with no samples have null latest state fields.
 *
 * Sort: lastSeenMs DESC, monitors.id ASC
 */
export function getAllMonitorsWithLatestState(): MonitorListItem[] {
  const db = getDb();

  const rows = db.prepare(`
    WITH latest_samples AS (
      SELECT
        monitor_id,
        status,
        latency_ms,
        timestamp_ms,
        ROW_NUMBER() OVER (
          PARTITION BY monitor_id
          ORDER BY timestamp_ms DESC
        ) AS rn
      FROM ping_samples
    )
    SELECT
      m.id,
      c.slug AS client_slug,
      c.name AS client_name,
      m.target_host,
      m.target_name,
      ls.status AS last_status,
      ls.latency_ms AS last_latency_ms,
      ls.timestamp_ms AS last_seen_ms,
      m.quality_state,
      m.created_at
    FROM monitors m
    INNER JOIN clients c ON m.client_id = c.id
    LEFT JOIN latest_samples ls ON m.id = ls.monitor_id AND ls.rn = 1
    ORDER BY
      COALESCE(ls.timestamp_ms, 0) DESC,
      m.id ASC
  `).all() as Array<{
    id: number;
    client_slug: string;
    client_name: string;
    target_host: string;
    target_name: string | null;
    last_status: string | null;
    last_latency_ms: number | null;
    last_seen_ms: number | null;
    quality_state: string;
    created_at: number;
  }>;

  return rows.map(row => ({
    id: row.id,
    clientSlug: row.client_slug,
    clientName: row.client_name,
    targetHost: row.target_host,
    targetName: row.target_name ?? row.target_host,
    status: row.last_status === "success" ? "up" : row.last_status === "timeout" || row.last_status === "error" ? "down" : null,
    latencyMs: row.last_latency_ms,
    qualityState: (row.quality_state ?? "unknown") as "good" | "degraded" | "poor" | "unknown",
    lastSeenMs: row.last_seen_ms,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
```

**Key design decisions:**
- Uses CTE with `ROW_NUMBER()` for latest sample per monitor — efficient, single pass
- `LEFT JOIN` ensures monitors with no samples are included (null state)
- `COALESCE(ls.timestamp_ms, 0)` in ORDER BY ensures monitors with no samples sort to the end
- Maps `status` from sample values ("success"/"timeout"/"error") to API contract ("up"/"down"/null)
- Maps `quality_state` from DB column, defaulting to "unknown"
- `targetName` falls back to `targetHost` when null (auto-created monitors have targetName=targetHost)

### Step 3: API Route — `dashboard/server/api/monitors.get.ts` (Create)

**File:** `dashboard/server/api/monitors.get.ts`

```typescript
import { getAllMonitorsWithLatestState } from "../utils/monitors";
import { info, error as logError } from "../utils/logger";

export default defineEventHandler((event) => {
  try {
    const monitors = getAllMonitorsWithLatestState();
    info("Monitors list requested", { count: monitors.length });
    return { monitors };
  } catch (err) {
    logError("Failed to fetch monitors list", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw createError({
      statusCode: 500,
      message: "Failed to fetch monitors list",
    });
  }
});
```

**Follows existing patterns:**
- `defineEventHandler` (same as health.get.ts, clients/[slug].get.ts)
- Error handling with `createError` (same as clients/[slug].get.ts)
- Logging with `info`/`error` from logger utility
- No query parameters, no authentication (MVP open read per F5)

### Step 4: Tests — `dashboard/server/api/monitors.get.test.ts` (Create)

**File:** `dashboard/server/api/monitors.get.test.ts`

Unit tests following existing patterns (see health.get.test.ts, clients/[slug].get.test.ts):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAllMonitorsWithLatestState } from "../utils/monitors";
import type { Database } from "better-sqlite3";

// ... test suite mirroring existing patterns
```

Test cases:
1. **Empty database returns empty array** — No monitors/clients → `{ monitors: [] }`
2. **Returns correct shape** — Single monitor with samples → correct field mapping
3. **Sort order is correct** — Multiple monitors with different lastSeenMs → DESC order, tiebreaker by id ASC
4. **Monitors with no samples have null state** — Monitor exists but no ping_samples → null status, latencyMs, lastSeenMs
5. **Client join works** — Returns clientSlug and clientName from joined clients table

### Step 5: Integration Tests — `dashboard/server/api/monitors.get.integration.test.ts` (Create)

**File:** `dashboard/server/api/monitors.get.integration.test.ts`

Integration test using the existing test infrastructure (in-memory SQLite, full route handler):

Test cases:
1. **Full endpoint returns 200 with correct shape**
2. **Database error returns 500**
3. **Multiple monitors sorted correctly end-to-end**

### Step 6: Update Shared Types Fixtures — `dashboard/test/fixtures.ts` (Modify)

**File:** `dashboard/test/fixtures.ts`

Add factory for `MonitorListItem`:

```typescript
import { MonitorListItem, MonitorsListResponse } from "~/shared/types";

export function createMonitorListItem(
  overrides: Partial<MonitorListItem> = {},
): MonitorListItem {
  return {
    id: 1,
    clientSlug: "test-client",
    clientName: "Test Client",
    targetHost: "8.8.8.8",
    targetName: "Google DNS",
    status: "up",
    latencyMs: 42,
    qualityState: "unknown",
    lastSeenMs: Date.now(),
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function createMonitorsListResponse(
  overrides: Partial<MonitorsListResponse> = {},
): MonitorsListResponse {
  return {
    monitors: [],
    ...overrides,
  };
}
```

### Step 7: Verify — `npx nuxi typecheck` and `npx nuxi dev`

Run typecheck and dev server to confirm:
- No TypeScript errors
- No route conflicts
- Dev server starts cleanly

---

## File Inventory

### Files to CREATE (4):

| # | File | Layer | Purpose |
|---|------|-------|---------|
| 1 | `dashboard/server/utils/monitors.ts` | Business Logic | Core query: getAllMonitorsWithLatestState() |
| 2 | `dashboard/server/api/monitors.get.ts` | API Layer | GET /api/monitors route handler |
| 3 | `dashboard/server/api/monitors.get.test.ts` | Tests | Unit tests for monitors utility |
| 4 | `dashboard/server/api/monitors.get.integration.test.ts` | Tests | Integration tests for the endpoint |

### Files to MODIFY (2):

| # | File | Layer | What Changes |
|---|------|-------|-------------|
| 1 | `dashboard/shared/types.ts` | Shared Types | Add MonitorListItem, MonitorsListResponse interfaces |
| 2 | `dashboard/test/fixtures.ts` | Tests | Add createMonitorListItem, createMonitorsListResponse factories |

**Total: Create 4 | Modify 2**

---

## Dependency Graph

```
[Step 1: Shared Types] ────────────┐
                                   │
                                   ▼
[Step 2: Business Logic] ──────────┐
                                   │
                                   ▼
[Step 3: API Route] ───────────────┐
                                   │
                                   ▼
[Step 4: Unit Tests]               │
                                   │
                                   ▼
[Step 5: Integration Tests] ───────┐
                                   │
                                   ▼
[Step 6: Fixtures]                 │
                                   │
                                   ▼
[Step 7: Verify] ←─────────────────┘
```

**Parallelizable work:**
- Step 4 (Unit Tests) and Step 6 (Fixtures) can be done in parallel with Step 3 (API Route)
- Step 5 (Integration Tests) depends on Step 3

**Strict dependencies:**
- Step 1 → Step 2 (types needed by utility)
- Step 2 → Step 3 (utility needed by route)
- Step 3 → Step 4, 5 (route needed by tests)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SQLite window function compatibility | Low | Medium | ROW_NUMBER() is supported in SQLite 3.25+ (2018). Dashboard uses better-sqlite3 v13 which bundles a recent SQLite. Verify in tests. |
| Status mapping mismatch | Medium | Medium | DB stores "success"/"timeout"/"error" but API contract expects "up"/"down"/null. Map explicitly in the utility. Covered by tests. |
| Performance with large monitor count | Low | Low | Single query with indexes (idx_monitors_client, idx_ping_monitor_time). F5 spec says "tens to low hundreds of rows." No caching needed. |
| Monitors with null target_name | Medium | Low | Auto-created monitors (via ingest) have target_name=target_host. Manual monitors may have null. Use fallback `targetName ?? targetHost`. |

---

## Acceptance Criteria Checklist

- [x] Returns array of monitors with client slug, client name, and latest state → CTE JOIN covers this
- [x] Results sorted by lastSeenMs DESC, id ASC → ORDER BY with COALESCE tiebreaker
- [x] Empty database returns empty array with 200 status → LEFT JOIN returns empty set, map returns []
- [x] Monitors with no samples have null latest state fields → LEFT JOIN produces nulls for missing samples
- [x] Response shape matches F5 API contract exactly → MonitorListItem type enforces shape
- [x] Single SQL query (no N+1) → CTE approach is a single query

---

## Notes for Agent 07 (Implementation)

1. **Do NOT modify any files outside `dashboard/`** — this task is self-contained
2. **Follow existing patterns** — the codebase has established patterns for:
   - API routes: `defineEventHandler` with error handling
   - Database access: `getDb()` from `./db`
   - Logging: `info`/`error` from `./logger`
   - Tests: vitest with `beforeEach` clearing `globalThis.__db`
3. **Test patterns** — each existing endpoint has 3 test files:
   - `.test.ts` (unit)
   - `.integration.test.ts` (integration)
   - `.handler.test.ts` or `.edge-cases.test.ts` (edge cases)
   - For M1-T7, create at minimum `.test.ts` and `.integration.test.ts`
4. **Type safety** — use `as Array<...>` type assertion after `.all()` since better-sqlite3 returns `unknown[]`
5. **The existing `Monitor` interface in `shared/types.ts`** is from the initial design and differs from the F5 API contract. Do NOT modify it — add new `MonitorListItem` type alongside it

---

## Report

**Status:** Complete
**Sequence:** 7 steps, ordered by layer
**Files:** Create 4 | Modify 2
**Dependencies:** Linear chain (Types → Logic → Route → Tests → Verify), with fixtures parallelizable
**Risks:** 4 identified, all mitigated
**Complexity:** Low
**Plan saved to memory:** Pending (next action)
**Next agent:** Agent 06 (Audit & Present Plan)
