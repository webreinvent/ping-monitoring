# Component: ClientGroup

**File:** `app/components/sidebars/ClientGroup.vue`
**Feature:** M2-T2 (Monitors list composable and sidebar components)

## Purpose

Collapsible group of monitors belonging to a single client. Renders the client name as a clickable header with a count badge and chevron, and an expandable list of monitor rows. Supports **inline name editing** via click-to-edit on the client name.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `clientName` | `string` | Yes | Human-readable client name (e.g., "Alice's Desktop") |
| `clientSlug` | `string` | Yes | Immutable client identifier (used for rename API calls) |
| `monitors` | `MonitorListItem[]` | Yes | Array of monitors for this client |
| `isVisible` | `(id: number) => boolean` | Yes | Function to check if a monitor is visible in the chart |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `toggle` | `monitorId: number` | Emitted when a monitor's visibility toggle is clicked |
| `rename` | `slug: string, newName: string` | Emitted when inline name edit is saved |

## Slots

None.

## Usage

```vue
<script setup lang="ts">
import type { MonitorListItem } from "#shared/types";

interface Props {
  clientName: string;
  clientSlug: string;
  monitors: MonitorListItem[];
  isVisible: (id: number) => boolean;
}
</script>

<template>
  <ClientGroup
    v-for="group in groupedByClient"
    :key="group.clientSlug"
    :client-name="group.clientName"
    :client-slug="group.clientSlug"
    :monitors="group.monitors"
    :is-visible="isVisible"
    @toggle="handleToggle"
    @rename="handleRename"
  />
</template>
```

## Behavior

### Collapse State

- **Default:** Expanded (`isExpanded = ref(true)`)
- **Toggle:** Click the header to expand/collapse
- **Chevron:** Rotates 90° when collapsed (`.chevron-icon.collapsed`)

### Header

The header is a clickable `div` containing:
- Client name (uppercase, muted, letter-spaced "eyebrow" style) with inline edit button
- Monitor count badge (accent-colored circle with count)
- Chevron icon (rotates based on expanded state)

### Inline Name Editing

- **Trigger:** Click the pencil icon (`.edit-client-name-btn`) next to the client name
- **Edit mode:** Replaces the name display with an `<input>` field + save/cancel buttons
- **Focus management:** Input auto-focuses and selects all text after next tick (`nextTick`)
- **Save:** Enter key or save button; trims whitespace, validates 1-100 chars, emits `rename` event
- **Cancel:** Escape key or cancel button; resets to original name
- **Optimistic UI:** Emits `rename` event with the new name; parent handles API call. On failure, the component re-renders with the original name (rollback)
- **Parent responsibility**: `SidebarContent` receives the `rename` event and calls `PUT /api/clients/:slug/name`

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="client-group"` | `.client-group` container | E2E test selector |

## Edge Cases

- **Empty monitors array:** Renders header with count badge showing "0", but no monitor rows (no `v-for` iterations)
- **Single monitor:** Renders normally with one `MonitorRow`
- **Long client names:** Text is rendered as-is — no truncation. Consider adding `overflow: hidden` + `text-overflow: ellipsis` if needed for very long names.
- **Invalid name input:** Names that are empty, whitespace-only, or exceed 100 characters are rejected — edit mode cancels back to the original name
- **Header click during edit:** No-op — `handleHeaderClick()` returns early if `isEditing` is true

## Related

- [MonitorRow](./MonitorRow.md) — Renders inside each client group
- [DashboardSidebar](./DashboardSidebar.md) — Parent component
- [useMonitors](../composables/useMonitors.md) — Provides `groupedByClient` data
- [Shared Types](../../shared/types.md) — `MonitorListItem` type
