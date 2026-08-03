# Utility: Quality States Constants & Mapping

**File:** `server/utils/quality-states.ts`
**Feature:** F12 (Backend quality classifier)

## Purpose

Central repository for quality state constants, thresholds, and display color mappings used by the quality classifier. Provides a single source of truth for all threshold values so they can be tuned in one place.

Exported `QualityState` type alias, a safe mapping function for database values, and a color map for frontend display.

## API

### `QualityState` (Type Re-export)

```typescript
import type { QualityState } from "~/server/utils/quality-states";
// Equivalent to importing from shared/types
// QualityState = "veryHigh" | "high" | "medium" | "low" | "unstable" | "disconnected" | "warmingUp"
```

Re-exports the `QualityState` type from `shared/types.ts` for convenience.

### `mapQualityState(state: string): QualityState`

Map a raw string value from the database to a typed `QualityState`. Handles both F12 values and legacy values with fallback.

```typescript
import { mapQualityState } from "~/server/utils/quality-states";

// F12 value — returns as-is
mapQualityState("veryHigh");  // "veryHigh"

// Legacy value — falls back to "warmingUp"
mapQualityState("good");      // "warmingUp"

// Unknown value — falls back to "warmingUp"
mapQualityState("unknown");   // "warmingUp"
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | `string` | Raw value from the database `quality_state` column |

#### Returns

`QualityState` — The validated, typed quality state.

#### Mapping Table

| Input (DB value) | Output | Notes |
|-----------------|--------|-------|
| `"veryHigh"` | `"veryHigh"` | F12 value |
| `"high"` | `"high"` | F12 value |
| `"medium"` | `"medium"` | F12 value |
| `"low"` | `"low"` | F12 value |
| `"unstable"` | `"unstable"` | F12 value |
| `"disconnected"` | `"disconnected"` | F12 value |
| `"warmingUp"` | `"warmingUp"` | F12 value |
| `"good"` | `"warmingUp"` | Legacy fallback |
| `"degraded"` | `"warmingUp"` | Legacy fallback |
| `"poor"` | `"warmingUp"` | Legacy fallback |
| (any other) | `"warmingUp"` | Unknown fallback |

## Threshold Constants

All threshold values are exported as named constants for use by the classifier and for future configuration.

| Constant | Value | Description |
|----------|-------|-------------|
| `QUALITY_WINDOW_MS` | `300_000` | 5-minute sliding window for classification |
| `QUALITY_MIN_SAMPLES` | `10` | Minimum samples before classification can proceed |
| `QUALITY_VERY_HIGH_MAX_LATENCY` | `50` | VeryHigh: avg_latency < 50ms (with 0% packet loss) |
| `QUALITY_HIGH_MAX_LATENCY` | `150` | High: avg_latency < 150ms (with 0% packet loss) |
| `QUALITY_MEDIUM_MAX_LATENCY` | `300` | Medium: avg_latency <= 300ms (with <=10% packet loss) |
| `QUALITY_MEDIUM_MAX_PACKET_LOSS` | `10` | Medium: packet_loss <= 10% (with avg_latency <= 300ms) |
| `QUALITY_UNSTABLE_CV` | `0.5` | Unstable: coefficient of variation > 0.5 (with <10% packet loss) |
| `QUALITY_UNSTABLE_MAX_PACKET_LOSS` | `10` | Unstable: packet_loss < 10% |
| `QUALITY_DISCONNECTED_NO_SAMPLES_WINDOW_MS` | `300_000` | Disconnected: no samples in 5-min window |
| `QUALITY_DISCONNECTED_RECENT_MS` | `3_600_000` | Disconnected: last sample within 1 hour (otherwise `warmingUp`) |

## `QUALITY_COLORS`

Display color mapping for quality states. Used by frontend components to render status indicators.

```typescript
import { QUALITY_COLORS } from "~/server/utils/quality-states";

// Usage example:
const color = QUALITY_COLORS["veryHigh"];  // "#22c55e" (green-500)
```

| State | Color | Tailwind Equivalent | Hex |
|-------|-------|---------------------|-----|
| `veryHigh` | Green | `green-500` | `#22c55e` |
| `high` | Lime | `lime-500` | `#84cc16` |
| `medium` | Yellow | `yellow-500` | `#eab308` |
| `low` | Orange | `orange-500` | `#f97316` |
| `unstable` | Red | `red-500` | `#ef4444` |
| `disconnected` | Gray | `gray-500` | `#6b7280` |
| `warmingUp` | Gray | `gray-400` | `#9ca3af` |

## Edge Cases

- **Legacy values:** Migration 006 maps legacy values (`good` → `veryHigh`, `degraded` → `medium`, `poor` → `low`, `warmingUp` → `disconnected`). The `mapQualityState` function handles any remaining legacy values that might exist in the database by falling back to `"warmingUp"`.
- **Unknown values:** Any database value not recognized by the F12 enum is mapped to `"warmingUp"` — this future-proofs the function against schema changes.

## Related

- [Quality Classifier](./quality-classifier.md) — `classifyMonitor()` uses these constants
- [Quality Sweep Plugin](./quality-sweep.md) — Background re-evaluation timer
- [Shared Types](../shared/types.md) — `QualityState` type definition
- [Migration 006](../database/migration-006-quality-state-updated-at.md) — Maps legacy values to F12 equivalents
- [Feature F12 Specification](../../requirements/features/feature-00012-quality-classifier.md) — Original requirements
