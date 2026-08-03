# Component: ClientGroup

**File:** `app/components/sidebars/ClientGroup.vue`
**Feature:** M2-T1 (Dashboard shell)

## Purpose

Collapsible group of monitors belonging to a single client. Renders the client name as a clickable header with a count badge and chevron, and an expandable list of monitor rows.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `clientName` | `string` | Yes | Human-readable client name (e.g., "Alice's Desktop") |
| `monitors` | `MonitorListItem[]` | Yes | Array of monitors for this client |

## Events

None.

## Slots

None.

## Usage

```vue
<script setup lang="ts">
import type { MonitorListItem } from "#shared/types";

interface Props {
  clientName: string;
  monitors: MonitorListItem[];
}
</script>

<template>
  <ClientGroup
    v-for="group in groupedByClient"
    :key="group.clientSlug"
    :client-name="group.clientName"
    :monitors="group.monitors"
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
- Client name (uppercase, muted, letter-spaced "eyebrow" style)
- Monitor count badge (accent-colored circle with count)
- Chevron icon (rotates based on expanded state)

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="client-group"` | `.client-group` container | E2E test selector |

## Edge Cases

- **Empty monitors array:** Renders header with count badge showing "0", but no monitor rows (no `v-for` iterations)
- **Single monitor:** Renders normally with one `MonitorRow`
- **Long client names:** Text is rendered as-is — no truncation. Consider adding `overflow: hidden` + `text-overflow: ellipsis` if needed for very long names.

## Related

- [MonitorRow](./MonitorRow.md) — Renders inside each client group
- [DashboardSidebar](./DashboardSidebar.md) — Parent component
- [useMonitors](../composables/useMonitors.md) — Provides `groupedByClient` data
- [Shared Types](../../shared/types.md) — `MonitorListItem` type
