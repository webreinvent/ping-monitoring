# Composable: useMonitors

**File:** `app/composables/useMonitors.ts`
**Feature:** M2-T2 (Monitors list composable and sidebar components)

## Purpose

Fetches the monitors list from the backend API and exposes reactive, grouped data structures for the dashboard sidebar and pages. Handles data fetching via Nuxt's `useAsyncData`, groups monitors by client, and provides loading/error state tracking. Additionally manages **monitor toggle visibility** state (persisted to `localStorage`) for the all-monitors chart.

## API

### `useMonitors()`

```typescript
import { useMonitors } from "~/app/composables/useMonitors";

const {
  monitors,
  groupedByClient,
  loading,
  hasError,
  error,
  refresh,
  // Toggle visibility state
  visibleMonitors,
  toggleMonitor,
  isVisible,
  showMonitor,
  hideMonitor,
} = useMonitors();
```

No parameters. Uses Nuxt's `useAsyncData` with the key `"monitors-list"` to fetch from `GET /api/monitors`.

### Return Values

#### Data Properties

| Property | Type | Description |
|----------|------|-------------|
| `monitors` | `ComputedRef<MonitorListItem[]>` | Flat array of all monitors from the API response |
| `groupedByClient` | `ComputedRef<MonitorGroup[]>` | Monitors grouped by `clientSlug`, sorted in API order |
| `loading` | `ComputedRef<boolean>` | `true` while the initial fetch is in progress |
| `hasError` | `ComputedRef<boolean>` | `true` if the fetch failed |
| `error` | `Ref<NuxtError \| null>` | Nuxt error object if the fetch failed |
| `refresh` | `() => Promise<void>` | Re-fetch the monitors list (manual refresh trigger) |

#### Toggle Visibility Properties

| Property | Type | Description |
|----------|------|-------------|
| `visibleMonitors` | `Ref<Set<number>>` | Set of monitor IDs currently visible in the chart |
| `toggleMonitor` | `(id: number) => void` | Toggle a monitor's visibility; persists to `localStorage` |
| `isVisible` | `(id: number) => boolean` | Check if a monitor is visible in the chart |
| `showMonitor` | `(id: number) => void` | Show a monitor in the chart; persists to `localStorage` |
| `hideMonitor` | `(id: number) => void` | Hide a monitor from the chart; persists to `localStorage` |

### MonitorGroup Interface

```typescript
interface MonitorGroup {
  clientSlug: string;          // Immutable client identifier
  clientName: string;          // Human-readable client name
  monitors: MonitorListItem[]; // Monitors belonging to this client
}
```

## Usage

### Basic Usage (Sidebar)

```vue
<template>
  <div v-if="loading">Loading monitors...</div>
  <div v-else-if="hasError">Error loading monitors</div>
  <template v-else>
    <ClientGroup
      v-for="group in groupedByClient"
      :key="group.clientSlug"
      :client-name="group.clientName"
      :monitors="group.monitors"
    />
  </template>
</div>
```

### Manual Refresh

```typescript
const { refresh } = useMonitors();

// Refresh after a WebSocket update indicates new data
await refresh();
```

### Loading State

```typescript
const { loading, hasError } = useMonitors();

// Show spinner during initial load
if (loading.value) return;

// Handle error state
if (hasError.value) {
  console.error(error.value?.message);
  return;
}
```

## Implementation Details

### Data Fetching

- Uses `useAsyncData("monitors-list", ...)` with key `"monitors-list"` for Nuxt's built-in caching and deduplication
- Fetches from `GET /api/monitors` via Nuxt's `$fetch` with typed response: `$fetch<MonitorsListResponse>("/api/monitors")`
- SSR-enabled: fetches on server during initial render, hydrates on client
- The `useAsyncData` key ensures only one fetch is active at a time across all components using this composable

### Grouping Logic

Monitors are grouped by `clientSlug` using a `Map<string, MonitorListItem[]>`:

1. Iterate through all monitors from the API response
2. Group by `clientSlug` — each group inherits `clientName` from the first monitor
3. Return as `MonitorGroup[]` array in API sort order (most recently active first)

The grouping is computed reactively — it re-computes whenever the underlying `monitorsResponse` changes (e.g., after a `refresh()` call).

### Toggle Visibility and localStorage Persistence

The composable manages which monitors are visible in the all-monitors chart:

- **localStorage key**: `"lnpm-visible-monitors"` — prefixed to avoid collisions
- **Storage format**: JSON array of monitor IDs (e.g., `[1, 3, 5]`), reconstructed as `Set<number>` in memory
- **Auto-initialization**: On first load, if the `visibleMonitors` set is empty and monitors are loaded, all monitor IDs are automatically added (show-all-by-default UX)
- **SSR-safe**: localStorage access is guarded with `typeof window !== "undefined"` — crashes prevented during SSR
- **Error-resilient**: All localStorage operations wrapped in try/catch — storage quota or private mode failures silently ignored

```typescript
// Auto-show-all on first load
watch(
  () => monitorsResponse.value?.monitors,
  (monitors) => {
    if (monitors && monitors.length > 0 && visibleMonitors.value.size === 0) {
      const allIds = new Set(monitors.map((m) => m.id));
      visibleMonitors.value = allIds;
      saveVisibleMonitors(visibleMonitors.value);
    }
  },
  { immediate: true },
);
```

## Edge Cases

- **Empty database:** Returns empty arrays for both `monitors` and `groupedByClient`. No error — this is the expected initial state.
- **Single monitor:** Returns one `MonitorGroup` with one monitor. Works correctly with sidebar rendering.
- **API failure:** `hasError` becomes `true`, `error` contains the Nuxt error object. Components should render a fallback state (e.g., "Unable to load monitors").
- **Monitor with no client:** Impossible by design — every monitor is created with a `clientSlug` during ingest. The API enforces this relationship.
- **localStorage unavailable:** In private browsing mode or when storage is full, the composable degrades gracefully — toggle state is in-memory only and not persisted across page loads.
- **Stale localStorage data:** If a monitor ID in localStorage no longer exists in the API response, the `Set` simply contains a non-existent ID — no error, and `isVisible()` returns `false` for any ID not in the monitors list.

## Related

- [Monitors API](../../api/monitors.md) — `GET /api/monitors` endpoint documentation
- [Shared Types](../../shared/types.md) — `MonitorListItem`, `MonitorsListResponse` types
- [DashboardSidebar Component](../components/DashboardSidebar.md) — Primary consumer of `useMonitors`
- [Frontend Architecture](../architecture.md) — Data flow overview
