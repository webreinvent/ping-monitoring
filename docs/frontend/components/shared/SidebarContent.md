# Component: SidebarContent

**File:** `app/components/shared/SidebarContent.vue`
**Feature:** M2-T2 (Monitors list composable and sidebar components), M2-T5 (Live client name updates)

## Purpose

Shared sidebar content component that renders the monitor list with client groups. Used by both desktop and mobile sidebar layouts (`DashboardSidebar`) to avoid code duplication. Handles the "All Monitors" row, client groups, toggle events, and inline rename operations.

## Props

None.

## Events

None.

## Slots

None.

## Usage

```vue
<!-- Inside DashboardSidebar (or any sidebar wrapper) -->
<SidebarContent />
```

This component is not intended for direct use in pages — it is a shared subcomponent of `DashboardSidebar`.

## Internal Behavior

- Fetches monitor data via `useMonitors()` — `monitors`, `groupedByClient`, `isVisible`, `toggleMonitor`
- Determines the selected monitor from the current route (`/monitors/:id`)
- Renders:
  - **"All Monitors" row**: Links to `/`, highlights when on `/`
  - **ClientGroup components**: One per client group, passing `isVisible` and handling `toggle`/`rename` events
  - **EmptyState**: Shown when no monitors exist

## Selected Monitor Detection

```typescript
const route = useRoute();
const selectedMonitorId = computed(() => {
  const match = route.path.match(/^\/monitors\/(\d+)$/);
  return match ? Number(match[1]) : null;
});
```

- When on `/` (All Monitors), the "All Monitors" row gets the `selected` class
- When on `/monitors/:id`, the matching `MonitorRow` gets the `selected` class

## Events Handling

### Toggle

```typescript
function handleToggle(monitorId: number): void {
  toggleMonitor(monitorId);
}
```

Receives `toggle` events from `ClientGroup` and delegates to `useMonitors().toggleMonitor()`.

### Rename

```typescript
async function handleRename(slug: string, newName: string): Promise<void> {
  try {
    await $fetch(`/api/clients/${slug}/name`, {
      method: "PUT",
      body: { name: newName },
    });
    // Optimistically update local state
    const group = groupedByClient.value.find((g) => g.clientSlug === slug);
    if (group) {
      group.clientName = newName;
    }
  } catch {
    // Revert on error — the component will re-render from the stored name
  }
}
```

Calls `PUT /api/clients/:slug/name` to persist the name change. On success, updates the local `groupedByClient` state. On failure, the original name is preserved (rollback).

### Live Client Name Updates (M2-T5)

The component listens for `client_name_updated` WebSocket messages via `useWebSocket().onClientNameUpdated()`:

```typescript
const { onClientNameUpdated } = useWebSocket();
onClientNameUpdated((clientSlug: string, newName: string) => {
  const groups = groupedByClient.value;
  const group = groups.find((g) => g.clientSlug === clientSlug);
  if (group) {
    group.clientName = newName;
  }
});
```

- **Source of truth**: The WebSocket message is the authoritative source — no API round-trip needed
- **Direct mutation**: Updates `group.clientName` directly; Vue's reactivity propagates the change to the DOM
- **No API call needed**: The server broadcasts the name change to all connected clients
- **Works across tabs**: All open browser tabs receive the update simultaneously

## Data Attributes

No direct test IDs — relies on child component test IDs (`data-testid="client-group"`, `data-testid="monitor-row"`, `data-testid="empty-state"`).

## Edge Cases

- **Empty database:** Shows `EmptyState` component instead of monitor list
- **Rename API failure:** Local state is not updated; the original name persists in the component
- **Single monitor:** Renders "All Monitors" row + one `ClientGroup` with one `MonitorRow`
- **Monitor with no client:** Impossible by design — every monitor has a `clientSlug`

## Related

- [DashboardSidebar](../components/DashboardSidebar.md) — Parent wrapper component
- [ClientGroup](../components/ClientGroup.md) — Renders client groups
- [MonitorRow](../components/MonitorRow.md) — Renders individual monitor rows
- [EmptyState](../components/EmptyState.md) — Shown when no monitors exist
- [useMonitors](../composables/useMonitors.md) — Data source and toggle state
- [useWebSocket](../composables/useWebSocket.md) — WebSocket connection for live name updates
