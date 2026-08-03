# LNPM Cloud Dashboard — Implementation Plan: M1-T10

## Task: Implement Backend Quality Classifier with Post-Ingest Trigger

**Date:** 2026-08-03
**Author:** Agent 05
**Status:** Complete

---

## Report

**Status:** Complete
**Sequence:** 9 steps, ordered by layer
**Files:** Create 5 | Modify 6
**Dependencies:** M1-T6 (ingest), M1-T8 (history), M1-T9 (WebSocket) — all satisfied
**Risks:** 7 identified with mitigation strategies
**Complexity:** Medium
**Plan saved to memory:** yes (see Step 10)
**Next agent:** Agent 06 (Audit & Present Plan)

---

## Executive Summary

This plan details the implementation of the backend quality classifier (F12 / M1-T10) that analyzes raw ping samples in a 5-minute sliding window and computes a quality state for each monitor. The classifier runs post-ingest (triggered after each batch) and as a background sweep every 60 seconds.

### Approach Decisions (Brainstorming Results)

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Module location | Integrated into `ping-ingest.ts` | Standalone `quality-classifier.ts` | **Standalone** | Single-responsibility; reusable by ingest, sweep, and API; testable independently |
| Classification | SQL-only (compute in DB) | Fetch raw data, compute in TypeScript | **Hybrid** | SQL fetches aggregated stats (SUM, SUM(sq)) in one query; TypeScript applies classification logic — best of both worlds |
| Post-ingest hook | Within DB transaction | Post-transaction callback | **Post-transaction** | Classification reads committed data — no lock contention; if classification fails, ingest still succeeded |
| Background sweep | setInterval in Nitro plugin | Separate worker process | **Nitro plugin** | Simpler, shares DB connection, fits existing plugin pattern (`database.ts` already follows this pattern) |
| State model | Replace existing 4-state model | Migrate to F12 7-state model | **Migrate to F12** | F12 is the authoritative spec; existing `warmingUp`/`good`/`degraded`/`poor` values are interim placeholders |

### Key Observations from Code Review

1. **Existing `quality_state` column** already exists in `monitors` table (migration 002) with interim values: `warmingUp`, `good`, `degraded`, `poor`
2. **F12 spec requires 7 states:** `veryHigh`, `high`, `medium`, `low`, `unstable`, `disconnected`, `warmingUp`
3. **No `quality_state_updated_at` column** exists yet — F12 spec requires it
4. **`mapQualityState`** in `monitors.ts` and `ws/ping.ts` maps to 4-value API type — needs F12 update
5. **`computeQualityIntervals`** in `history.ts` is for chart intervals — NOT the real-time classifier (different purpose)
6. **Ingest pipeline** has a clear transaction structure in `ping-ingest.ts` returning `monitorIds` — perfect hook point

---

## Implementation Sequence (Ordered by Layer)

### Step 1: Database Migration

**File:** `dashboard/schema/migrations/003_add_quality_state_updated_at.sql` (CREATE)

**Purpose:** Add `quality_state_updated_at` column to monitors table and migrate existing quality states to F12 values.

**SQL:**
```sql
-- Add quality_state_updated_at column
ALTER TABLE monitors ADD COLUMN quality_state_updated_at INTEGER;

-- Migrate existing quality states to F12 equivalents
UPDATE monitors SET quality_state = 'disconnected' WHERE quality_state = 'warmingUp';
UPDATE monitors SET quality_state = 'veryHigh' WHERE quality_state = 'good';
UPDATE monitors SET quality_state = 'medium' WHERE quality_state = 'degraded';
UPDATE monitors SET quality_state = 'low' WHERE quality_state = 'poor';
```

**Rationale:** SQLite cannot ALTER CHECK constraints, so we enforce F12 values in TypeScript. The column already accepts TEXT.

### Step 2: Shared Types Update

**File:** `dashboard/shared/types.ts` (MODIFY)

**Changes:**
1. Update `QualityState` type to use F12 values:
   ```typescript
   export type QualityState =
     | 'veryHigh'
     | 'high'
     | 'medium'
     | 'low'
     | 'unstable'
     | 'disconnected'
     | 'warmingUp';
   ```
2. Add `qualityStateUpdatedAtMs: number | null` to `MonitorListItem` interface
3. Add `ClassifyResult` interface:
   ```typescript
   export interface ClassifyResult {
     qualityState: QualityState;
     qualityStateUpdatedAtMs: number;
     sampleCount: number;
     packetLoss: number;
     avgLatency: number;
     cv: number;
   }
   ```
4. Update `WsMonitorState.qualityState` to use F12 `QualityState` type
5. Update `MonitorListItem.qualityState` to use F12 `QualityState` type

### Step 3: Quality States Constants

**File:** `dashboard/server/utils/quality-states.ts` (CREATE)

**Purpose:** Constants, type re-exports, and threshold configuration for quality classification.

**Contents:**
```typescript
import type { QualityState } from '#shared/types';

export type { QualityState };

export const QUALITY_WINDOW_MS = 5 * 60 * 1000;       // 5-minute sliding window
export const QUALITY_MIN_SAMPLES = 10;                 // Min samples for classification
export const QUALITY_VERY_HIGH_MAX_LATENCY = 50;       // ms
export const QUALITY_HIGH_MAX_LATENCY = 150;           // ms
export const QUALITY_MEDIUM_MAX_LATENCY = 300;         // ms
export const QUALITY_MEDIUM_MAX_PACKET_LOSS = 10;      // %
export const QUALITY_UNSTABLE_CV = 0.5;               // coefficient of variation threshold
export const QUALITY_UNSTABLE_MAX_PACKET_LOSS = 10;    // CV check only applies below this
export const QUALITY_DISCONNECTED_WINDOW_MS = 5 * 60 * 1000; // 5 min no samples
export const QUALITY_DISCONNECTED_RECENT_MS = 60 * 60 * 1000; // 1 hour has samples

// Display color mapping
export const QUALITY_COLORS: Record<QualityState, string> = {
  veryHigh: '#22c55e',   // green-500
  high: '#84cc16',        // lime-500
  medium: '#eab308',      // yellow-500
  low: '#f97316',         // orange-500
  unstable: '#ef4444',    // red-500
  disconnected: '#6b7280', // gray-500
  warmingUp: '#9ca3af',   // gray-400
};
```

### Step 4: Quality Classifier Service (Core)

**File:** `dashboard/server/utils/quality-classifier.ts` (CREATE)

**Purpose:** Core classification logic — the heart of M1-T10.

**Public API:**
```typescript
/**
 * Classify a single monitor's quality based on its recent ping samples.
 * Uses a 5-minute sliding window. Persists result to the monitor row.
 */
export function classifyMonitor(monitorId: number): ClassifyResult;

/**
 * Bulk classify multiple monitors. Used by background sweep and post-ingest.
 * Returns results only for monitors whose state actually changed.
 */
export function classifyMonitorsBatch(
  monitorIds: number[]
): Map<number, QualityState>;
```

**Algorithm (per monitor):**
1. **SQL Query #1:** Fetch aggregated stats from the 5-minute window:
   ```sql
   SELECT
     COUNT(*) AS sample_count,
     SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
     SUM(CASE WHEN status = 'success' AND latency_ms IS NOT NULL THEN latency_ms END) AS sum_latency,
     SUM(CASE WHEN status = 'success' AND latency_ms IS NOT NULL THEN latency_ms * latency_ms END) AS sum_latency_sq,
     COUNT(CASE WHEN status = 'success' AND latency_ms IS NOT NULL THEN 1 END) AS latency_count
   FROM ping_samples
   WHERE monitor_id = ? AND timestamp_ms >= ?
   ```
2. **SQL Query #2:** Check last sample time (for disconnected detection):
   ```sql
   SELECT MAX(timestamp_ms) AS last_sample_ms
   FROM ping_samples WHERE monitor_id = ?
   ```
3. **Compute metrics in TypeScript:**
   - `packetLoss = (1 - successCount / sampleCount) * 100`
   - `avgLatency = sumLatency / latencyCount`
   - `variance = (sumLatencySq / latencyCount) - (avgLatency ^ 2)`
   - `stddev = sqrt(variance)` (or 0 if variance <= 0)
   - `cv = stddev / avgLatency` (or 0 if avgLatency is 0)
4. **Apply classification (first match wins):**
   - `Disconnected`: no samples in window AND last sample > 5 min ago AND last sample < 1 hour ago
   - `WarmingUp`: sample_count < 10 (not enough data)
   - `Unstable`: cv > 0.5 AND packet_loss < 10%
   - `VeryHigh`: packet_loss == 0% AND avg_latency < 50ms
   - `High`: packet_loss == 0% AND avg_latency < 150ms
   - `Medium`: packet_loss <= 10% AND avg_latency <= 300ms
   - `Low`: everything else
5. **Persist:** UPDATE monitors SET quality_state = ?, quality_state_updated_at = ? WHERE id = ?
6. **Return:** `ClassifyResult` with state and debug metrics

**Logging:** Use `info()` from logger for state changes, `debug()` for no-op classifications.

### Step 5: Background Sweep Plugin

**File:** `dashboard/server/plugins/quality-sweep.ts` (CREATE)

**Purpose:** Nitro plugin that runs a background timer to re-evaluate all active monitors every 60 seconds.

**Implementation:**
```typescript
import { defineNitroPlugin } from 'nitropack';
import { info, warn, error } from '#server/utils/logger';
import { getDb } from '#server/utils/db';
import { classifyMonitorsBatch } from '#server/utils/quality-classifier';

export default defineNitroPlugin(() => {
  const SWEEP_INTERVAL_MS = Number(process.env.QUALITY_SWEEP_INTERVAL_MS ?? 60000);

  const timer = setInterval(() => {
    try {
      const db = getDb();
      // Get monitors that have samples in the last 10 minutes
      const rows = db.prepare(`
        SELECT DISTINCT ps.monitor_id
        FROM ping_samples ps
        WHERE ps.timestamp_ms >= ?
      `).all(Date.now() - 10 * 60 * 1000) as Array<{ monitor_id: number }>;

      const monitorIds = rows.map(r => r.monitor_id);

      if (monitorIds.length > 0) {
        const changes = classifyMonitorsBatch(monitorIds);
        if (changes.size > 0) {
          info('Quality sweep completed', {
            monitorsChecked: monitorIds.length,
            statesChanged: changes.size,
          });
        }
      }
    } catch (err) {
      error('Quality sweep failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, SWEEP_INTERVAL_MS);

  // Graceful shutdown
  return () => {
    clearInterval(timer);
    info('Quality sweep timer cleared');
  };
});
```

### Step 6: Post-Ingest Integration

**File:** `dashboard/server/utils/ping-ingest.ts` (MODIFY)

**Changes:**
1. Import `classifyMonitorsBatch` from `./quality-classifier`
2. After `ingestSamples()` returns (inside `ingestPingBatch`), before returning the response:
   ```typescript
   // Phase 4: Post-ingest classification
   if (validSamples.length > 0) {
     try {
       const result = ingestSamples(client.id, validSamples);
       accepted = result.accepted;
       duplicate = result.duplicate;
       acceptedSamples.push(...result.acceptedSamples);

       // Classify affected monitors post-transaction
       if (result.monitorIds.size > 0) {
         const monitorIds = Array.from(result.monitorIds);
         classifyMonitorsBatch(monitorIds);
       }
     } catch (err) {
       // ... existing error handling ...
     }
   }
   ```
3. Catch classification errors separately — classification failure should NOT fail the ingest

### Step 7: API Response Updates

**File:** `dashboard/server/utils/monitors.ts` (MODIFY)

**Changes:**
1. Update SQL query to include `quality_state_updated_at`:
   ```sql
   -- Add to SELECT:
   m.quality_state,
   m.quality_state_updated_at,
   m.created_at
   ```
2. Update `mapQualityState` to handle F12 states:
   ```typescript
   function mapQualityState(
     qualityState: string,
   ): QualityState {
     if (
       qualityState === 'veryHigh' ||
       qualityState === 'high' ||
       qualityState === 'medium' ||
       qualityState === 'low' ||
       qualityState === 'unstable' ||
       qualityState === 'disconnected' ||
       qualityState === 'warmingUp'
     ) {
       return qualityState as QualityState;
     }
     return 'warmingUp'; // fallback for unknown/legacy values
   }
   ```
3. Add `qualityStateUpdatedAtMs` to the mapped result

**File:** `dashboard/server/api/monitors/[id].get.ts` (MODIFY)

**Changes:**
1. The `buildTarget` call already fetches the monitor row — add `qualityState` to the `Target` object or as a separate field in the response
2. The simplest approach: add `qualityState` and `qualityStateUpdatedAtMs` to the `Target` interface (already in `shared/types.ts`)

**File:** `dashboard/server/api/ping/ingest.post.ts` (MODIFY)

**Changes:**
1. After `ingestPingBatch` returns, the classification is already triggered (Step 6)
2. Update `broadcastAcceptedSamples` to include `qualityState`:
   - After classification, build a `Map<monitorId, qualityState>` from the classifier result
   - Pass the quality state map to `broadcastSample` so each broadcast message includes the current quality

### Step 8: WebSocket Broadcast Updates

**File:** `dashboard/server/ws/ping.ts` (MODIFY)

**Changes:**
1. Add `qualityState` field to `SampleMessage`:
   ```typescript
   interface SampleMessage {
     type: 'sample';
     monitorId: number;
     qualityState: QualityState;  // NEW
     data: {
       timestampMs: number;
       latencyMs: number | null;
       status: 'success' | 'timeout' | 'error';
       resolvedAddress: string | null;
     };
   }
   ```
2. Update `broadcastSample` signature to accept `qualityState`:
   ```typescript
   export function broadcastSample(
     monitorId: number,
     sample: { ... },
     qualityState?: QualityState,
   ): void { ... }
   ```
3. Update `mapQualityState` to handle F12 states (same as monitors.ts)

### Step 9: Tests

**File:** `dashboard/test/quality-classifier.test.ts` (CREATE)

**Test Cases:**

| # | Scenario | Expected | Method |
|---|----------|----------|--------|
| 1 | 15 samples, 0% loss, avg 30ms | `veryHigh` | Insert test samples, call classifyMonitor |
| 2 | 15 samples, 0% loss, avg 100ms | `high` | Insert test samples, call classifyMonitor |
| 3 | 15 samples, 5% loss, avg 200ms | `medium` | Insert test samples, call classifyMonitor |
| 4 | 15 samples, 20% loss, avg 100ms | `low` | Insert test samples, call classifyMonitor |
| 5 | 15 samples, 3% loss, cv > 0.5 | `unstable` | Insert samples with high variance |
| 6 | No samples in 5 min, last sample 30 min ago | `disconnected` | Insert old sample, call classifyMonitor |
| 7 | 5 samples total | `warmingUp` | Insert few samples |
| 8 | 0 samples ever | `disconnected` | Create monitor, no samples |
| 9 | Post-ingest trigger | State updated after ingest | Call ingestPingBatch, verify monitor row |
| 10 | Background sweep | All active monitors reclassified | Mock timer, verify batch classification |

**Use in-memory SQLite for tests** (via `better-sqlite3` with `:memory:`) to avoid polluting the real database.

---

## File Inventory

### Files to CREATE (5 files)

| # | File | Purpose | Depends On |
|---|------|---------|------------|
| 1 | `dashboard/schema/migrations/003_add_quality_state_updated_at.sql` | DB migration + state migration | — |
| 2 | `dashboard/server/utils/quality-states.ts` | Constants & threshold config | — |
| 3 | `dashboard/server/utils/quality-classifier.ts` | Core classification engine | #1, #2 |
| 4 | `dashboard/server/plugins/quality-sweep.ts` | Background sweep plugin | #3 |
| 5 | `dashboard/test/quality-classifier.test.ts` | Unit tests | #3 |

### Files to MODIFY (6 files)

| # | File | Changes | Depends On |
|---|------|---------|------------|
| 1 | `dashboard/shared/types.ts` | F12 QualityState, ClassifyResult, qualityStateUpdatedAtMs | — |
| 2 | `dashboard/server/utils/monitors.ts` | F12 mapQualityState, include quality_state_updated_at | #1 |
| 3 | `dashboard/server/utils/ping-ingest.ts` | Post-ingest classifyMonitorsBatch call | #3 |
| 4 | `dashboard/server/api/ping/ingest.post.ts` | Include qualityState in broadcast | #3, #4 |
| 5 | `dashboard/server/api/monitors/[id].get.ts` | Include qualityState in history response | #1 |
| 6 | `dashboard/server/ws/ping.ts` | F12 SampleMessage, mapQualityState | #1 |

### Files to LEAVE UNCHANGED

- `dashboard/server/utils/db.ts` — No changes needed
- `dashboard/server/plugins/database.ts` — No changes needed
- `dashboard/server/utils/client.ts` — No changes needed
- `dashboard/server/utils/logger.ts` — No changes needed
- `dashboard/server/utils/ping-types.ts` — No changes needed
- `dashboard/server/utils/ping-validation.ts` — No changes needed
- `dashboard/server/utils/history.ts` — Different quality model (chart intervals)
- `dashboard/app/` — No frontend changes (out of scope for M1)
- `dashboard/nuxt.config.ts` — No changes needed
- `dashboard/package.json` — No changes needed
- `dashboard/schema/index.sql` — Update documentation only (optional)

---

## Dependency Graph

```
Step 1 (Migration) ──┐
                      │
Step 2 (Types) ───────┼──────────┐
                      │          │
                      │     Step 3 (quality-states.ts) ──┐
                      │                                  │
                      │                          Step 4 (quality-classifier.ts)
                      │                                  │
                      │                           ┌──────┴──────┐
                      │                           │             │
                      │                    Step 5 (sweep)   Step 6 (post-ingest)
                      │                           │             │
                      │                    ┌──────┴─────┐  ┌────┴──────┐
                      │                    │            │  │            │
                      │             Step 7 (API)   Step 8 (WS)  Step 7 (ingest API)
                      │                    │            │              │
                      └────────────────────┴────────────┴──────────────┘
                                               │
                                        Step 9 (Tests)
```

**Parallelizable work:**
- **Phase 1 (Foundation):** Steps 1-3 can start immediately, in parallel
- **Phase 2 (Core):** Step 4 depends on Phase 1
- **Phase 3 (Integration):** Steps 5, 6, 7, 8 can run in parallel after Step 4
- **Phase 4 (Tests):** Step 9 after all integration is complete

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **SQLite ALTER TABLE limitation** — Cannot add CHECK constraints to existing columns | High | Medium | Use TEXT without CHECK; enforce in TypeScript. Current schema already uses TEXT for quality_state. |
| **Classification performance** — 5-min window query on monitors with many samples | Medium | High | Composite index `idx_ping_monitor_time` already exists. Single query per monitor with parameterized range scan. |
| **Post-ingest classification blocks response** — Classification delay adds to ingest response time | Medium | Medium | Run classification AFTER transaction commits. Catch errors and log — don't fail ingest. Typical classification is <10ms. |
| **Background sweep resource usage** — setInterval with DB queries every 60s | Low | Medium | Only queries active monitors (samples in last 10 min). Configurable interval via env var. |
| **State inconsistency** — Race between ingest and API reads | Low | Medium | SQLite WAL mode + serial writes. Post-transaction classification ensures data is committed. |
| **Quality state enum mismatch** — F12 values differ from existing 4-state model | High | High | Migration maps old → new values. TypeScript enforces correct types. `mapQualityState` handles fallback. |
| **Stddev computation accuracy** — Using SUM/SUM(sq) approach vs. true stddev | Medium | Low | Formula `variance = E[X²] - E[X]²` is mathematically correct. Use Math.max(0, variance) to avoid floating-point negatives. |

---

## Complexity: Medium

- **Data layer:** Low — simple column addition, existing schema pattern
- **Classification logic:** Medium — statistical computation (cv, stddev) and priority-order evaluation
- **Integration:** Medium — post-ingest hook with error isolation; broadcast integration
- **Background sweep:** Low — standard setInterval pattern with graceful shutdown
- **Tests:** Medium — need test fixtures with known sample distributions

**Estimated Effort: 3-4 hours** (matches task estimate)

---

## Acceptance Criteria Checklist

- [ ] `classifyMonitor()` computes correct quality state from 5-minute window
- [ ] States applied in correct priority order: disconnected → unstable → veryHigh → high → medium → low
- [ ] Post-ingest classification runs for each affected monitor
- [ ] Background sweep runs every 60 seconds
- [ ] Quality state persisted on monitor row (quality_state + quality_state_updated_at)
- [ ] `GET /api/monitors` includes quality_state field
- [ ] `GET /api/monitors/:id` includes quality_state in monitor metadata
- [ ] WebSocket sample messages include quality_state
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

---

## Notes for Agent 07 (Implementation Agent)

1. **Start with the migration** — the `quality_state_updated_at` column is needed by the classifier
2. **Create `quality-states.ts` first** — it defines the types and constants used everywhere
3. **Get the classifier working with a test fixture before integrating** — use an in-memory SQLite DB to test classification logic
4. **Post-ingest integration** — add classification AFTER `ingestSamples()` returns, in `ingestPingBatch()`. The `result.monitorIds` Set is exactly what you need
5. **Stddev computation** — use: `variance = (sumLatencySq / n) - (avgLatency ^ 2)` and `stddev = sqrt(max(0, variance))`
6. **The `quality_state` column already exists** — you only need to add `quality_state_updated_at`
7. **Map existing states during migration** — old values (`warmingUp`, `good`, `degraded`, `poor`) → F12 equivalents in the migration SQL
8. **Be careful with the `classifyMonitorsBatch` return type** — return a `Map<number, QualityState>` of changed states, so callers know which monitors actually changed
